import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { logger } from "../logger.js";

/** Slugify a merchant-supplied name. Arabic is preserved for storefront slugs. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export async function uniqueSubdomain(base: string): Promise<string> {
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const root = cleaned.length >= 3 ? cleaned : "store";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}-${randomBytes(2).toString("hex")}`;
    const taken = await prisma.store.findUnique({ where: { subdomain: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${root}-${randomBytes(4).toString("hex")}`;
}

/** Create the 1:1 rows every store needs. Safe to call repeatedly. */
export async function ensureStoreDefaults(storeId: string, currency: string) {
  await prisma.storeBranding.upsert({
    where: { storeId },
    create: {
      id: newId("brand_"),
      storeId,
      primaryColor: "#047857",
      secondaryColor: "#0F2A24",
      textColor: "#0F172A",
      themeMode: "light",
      arabicFont: "IBM Plex Sans Arabic",
    },
    update: {},
  });
  await prisma.walletAccount.upsert({
    where: { storeId },
    create: { id: newId("wal_"), storeId, currency },
    update: {},
  });
}

/**
 * Map an authenticated principal onto audit columns. Kept structural (rather
 * than importing Express types) so services can accept it without cycles.
 */
export function auditActor(auth:
  | { principalType?: string; merchantId?: string | null; teamMemberId?: string | null; actorId?: string }
  | null
  | undefined
) {
  if (!auth) return {};
  if (auth.principalType === "team" || (!auth.merchantId && auth.teamMemberId)) {
    return {
      teamMemberId: auth.teamMemberId ?? auth.actorId ?? null,
      actorType: "team_member" as const,
    };
  }
  return {
    merchantId: auth.merchantId ?? null,
    actorType: "merchant" as const,
  };
}

export function adminAuditActor(adminId: string) {
  return {
    platformAdminId: adminId,
    actorType: "platform_admin" as const,
  };
}

export async function writeAudit(args: {
  storeId?: string | null;
  merchantId?: string | null;
  teamMemberId?: string | null;
  platformAdminId?: string | null;
  actorType?: string;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    const actorType =
      args.actorType ??
      (args.platformAdminId ? "platform_admin" : args.teamMemberId ? "team_member" : "merchant");
    await prisma.auditLog.create({
      data: {
        id: newId("aud_"),
        storeId: args.storeId ?? null,
        merchantId: args.merchantId ?? null,
        teamMemberId: args.teamMemberId ?? null,
        platformAdminId: args.platformAdminId ?? null,
        actorType,
        action: args.action,
        entity: args.entity ?? "",
        entityId: args.entityId ?? "",
        metadata: (args.metadata ?? {}) as Prisma.InputJsonValue,
        ip: args.ip ?? "",
      },
    });
  } catch (err) {
    // Auditing must never break the merchant action.
    logger.warn({ err }, "failed to write audit log");
  }
}

export async function createNotification(args: {
  storeId: string;
  merchantId?: string | null;
  type?: string;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        id: newId("ntf_"),
        storeId: args.storeId,
        merchantId: args.merchantId ?? null,
        type: args.type ?? "system",
        title: args.title,
        body: args.body ?? "",
        link: args.link ?? "",
      },
    });
  } catch (err) {
    logger.warn({ err }, "failed to create notification");
  }
}

export function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    unpaid: "unpaid",
    paid: "paid",
    partially_refunded: "partially_refunded",
    refunded: "refunded",
    failed: "failed",
  };
  return labels[status] ?? status;
}
