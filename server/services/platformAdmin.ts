import type { CookieOptions } from "express";
import { Prisma, type PlatformAdmin } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { env } from "../env.js";
import { hashPasswordArgon2, hashSessionToken, newSessionToken } from "../auth.js";
import { decryptSecret } from "../crypto.js";
import { findRecoveryCode, verifyTotp } from "../totp.js";
import { recoveryCodeHashes } from "./twoFactor.js";

/**
 * Platform administration is a separate identity from merchants.
 *
 * - A PlatformAdmin has its own password/MFA state and its own session table.
 * - Admin sessions use a different cookie, so a merchant cookie can never be
 *   replayed against /api/admin and an admin cookie can never open a merchant
 *   console.
 * - Every admin route names the permission it needs. Read-only admins can only
 *   call read endpoints; write endpoints are rejected by the API, not the UI.
 */

export const ADMIN_ROLES = ["super_admin", "operations", "finance", "support", "readonly"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "overview.read",
  "stores.read",
  "stores.write",
  "merchants.read",
  "subscriptions.read",
  "subscriptions.write",
  "wallet.read",
  "wallet.write",
  "support.read",
  "support.write",
  "reports.read",
  "domains.read",
  "domains.write",
  "audit.read",
  "flags.read",
  "flags.write",
  "admins.manage",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const READ_ALL: AdminPermission[] = [
  "overview.read",
  "stores.read",
  "merchants.read",
  "subscriptions.read",
  "wallet.read",
  "support.read",
  "reports.read",
  "domains.read",
  "audit.read",
  "flags.read",
];

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  super_admin: new Set(ADMIN_PERMISSIONS),
  operations: new Set([
    ...READ_ALL,
    "stores.write",
    "domains.write",
    "flags.write",
  ]),
  finance: new Set([...READ_ALL, "subscriptions.write", "wallet.write"]),
  support: new Set([...READ_ALL, "support.write"]),
  readonly: new Set(READ_ALL),
};

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export function adminPermissions(role: string): AdminPermission[] {
  const resolved = isAdminRole(role) ? role : "readonly";
  return [...ADMIN_ROLE_PERMISSIONS[resolved]];
}

export function adminCan(role: string, permission: AdminPermission): boolean {
  const resolved = isAdminRole(role) ? role : "readonly";
  return ADMIN_ROLE_PERMISSIONS[resolved].has(permission);
}

export const ADMIN_SESSION_COOKIE = "sanad_admin_session";
export const ADMIN_SESSION_TTL_MS = 8 * 3600 * 1000;

/**
 * The __Host- prefix requires Secure, Path=/ and no Domain. Admin cookies are
 * deliberately never shared with the merchant cookie name even in dev so a
 * mistake in one auth middleware cannot silently authenticate the other.
 */
export function adminSessionCookieName(): string {
  return env.isProduction ? "__Host-sanad_admin_session" : ADMIN_SESSION_COOKIE;
}

export function adminSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS,
  };
}

export async function createAdminSession(input: {
  adminId: string;
  ip?: string;
  userAgent?: string;
}): Promise<string> {
  const token = newSessionToken();
  await prisma.adminSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      adminId: input.adminId,
      expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
      ip: String(input.ip ?? "").slice(0, 80),
      userAgent: String(input.userAgent ?? "").slice(0, 300),
    },
  });
  return token;
}

export async function findAdminSession(token: string | undefined) {
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { admin: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.adminSession.delete({ where: { tokenHash: session.tokenHash } }).catch(() => undefined);
    return null;
  }
  if (session.admin.status !== "active") return null;
  return session;
}

export async function revokeAdminSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.adminSession.delete({ where: { tokenHash: hashSessionToken(token) } }).catch(() => undefined);
}

export async function revokeOtherAdminSessions(adminId: string, currentToken: string | undefined): Promise<number> {
  const currentHash = currentToken ? hashSessionToken(currentToken) : "";
  const result = await prisma.adminSession.deleteMany({
    where: {
      adminId,
      ...(currentHash ? { NOT: { tokenHash: currentHash } } : {}),
    },
  });
  return result.count;
}

/** Admin second-factor verification mirrors the merchant flow with its own table. */
export async function verifyAdminSecondFactor(input: {
  adminId: string;
  totp?: string;
  recoveryCode?: string;
}): Promise<boolean> {
  const admin = await prisma.platformAdmin.findUnique({
    where: { id: input.adminId },
    select: { twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!admin?.twoFactorEnabled) return false;
  const secret = decryptSecret(admin.twoFactorSecret);
  if (!secret) return false;
  if (input.totp && verifyTotp(secret, input.totp)) return true;
  if (!input.recoveryCode) return false;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`admin-2fa:${input.adminId}`}, 0))`;
    const fresh = await tx.platformAdmin.findUnique({
      where: { id: input.adminId },
      select: { twoFactorEnabled: true, twoFactorRecoveryCodes: true },
    });
    if (!fresh?.twoFactorEnabled) return false;
    const hashes = recoveryCodeHashes(fresh.twoFactorRecoveryCodes);
    const index = findRecoveryCode(hashes, input.recoveryCode!);
    if (index < 0) return false;
    const remaining = hashes.filter((_, position) => position !== index);
    await tx.platformAdmin.update({
      where: { id: input.adminId },
      data: { twoFactorRecoveryCodes: remaining as Prisma.InputJsonValue },
    });
    return true;
  });
}

export function serializeAdmin(admin: {
  id: string;
  email: string;
  name: string;
  role: string;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
}) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    two_factor_enabled: admin.twoFactorEnabled,
    permissions: adminPermissions(admin.role),
    last_login_at: admin.lastLoginAt,
    scope: "platform",
  };
}

/**
 * Create the first platform administrator without ever resetting an existing
 * account. The boot-time bootstrap is deliberately idempotent: restarting a
 * deployment with the same environment cannot roll back a password or role
 * that an operator changed from the admin console.
 */
export async function ensurePlatformAdmin(input: {
  email: string;
  password: string;
  name?: string;
  role?: AdminRole;
}): Promise<{ admin: PlatformAdmin; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) return { admin: existing, created: false };

  const passwordHash = await hashPasswordArgon2(input.password);
  try {
    const admin = await prisma.platformAdmin.create({
      data: {
        id: newId("padm_"),
        email,
        name: input.name ?? "",
        passwordHash,
        passwordAlgo: "argon2id",
        role: input.role ?? "readonly",
        status: "active",
      },
    });
    return { admin, created: true };
  } catch (error) {
    // Two replicas can boot at once. A unique-email race is success as long as
    // the winner's row is readable; neither replica overwrites credentials.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.platformAdmin.findUnique({ where: { email } });
      if (winner) return { admin: winner, created: false };
    }
    throw error;
  }
}
