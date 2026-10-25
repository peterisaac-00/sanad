import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError } from "../errors.js";
import { hashOpaqueToken, randomToken } from "../crypto.js";
import { teamPermissions } from "../middleware.js";

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;
export const TEAM_INVITE_PURPOSE = "team-invite";

export type TeamRole = "admin" | "manager" | "staff" | "viewer";

export function hashTeamInviteToken(token: string): string {
  return hashOpaqueToken(token, TEAM_INVITE_PURPOSE);
}

export function teamMemberJson(member: {
  id: string;
  storeId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  acceptedAt: Date | null;
  lastLoginAt: Date | null;
  inviteExpiresAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: member.id,
    storeId: member.storeId,
    name: member.name,
    email: member.email,
    role: member.role,
    status: member.status,
    permissions: teamPermissions(member.role),
    accepted_at: member.acceptedAt,
    last_login_at: member.lastLoginAt,
    invite_expires_at: member.inviteExpiresAt,
    created_at: member.createdAt,
  };
}

export async function createTeamInvite(input: {
  storeId: string;
  name: string;
  email: string;
  role: TeamRole;
  actorId: string;
}) {
  const token = randomToken(32);
  const tokenHash = hashTeamInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  try {
    const member = await prisma.teamMember.create({
      data: {
        id: newId("team_"),
        storeId: input.storeId,
        name: input.name,
        email: input.email,
        role: input.role,
        status: "invited",
        inviteTokenHash: tokenHash,
        inviteExpiresAt: expiresAt,
      },
    });
    return { member, token, expiresAt };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "TEAM_MEMBER_EXISTS", "A team member with this email already exists.");
    }
    throw error;
  }
}

export async function rotateTeamInvite(memberId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const member = await prisma.teamMember.update({
    where: { id: memberId },
    data: {
      inviteTokenHash: hashTeamInviteToken(token),
      inviteExpiresAt: expiresAt,
      status: "invited",
      acceptedAt: null,
    },
  });
  return { member, token, expiresAt };
}

/** Public invitation lookup: never returns the hash or other members' data. */
export async function invitationPreview(token: string) {
  const member = await prisma.teamMember.findUnique({
    where: { inviteTokenHash: hashTeamInviteToken(token) },
    include: { store: { select: { storeName: true, subdomain: true } } },
  });
  if (!member) {
    throw new ApiError(404, "INVITE_NOT_FOUND", "This invitation is invalid or has already been used.");
  }
  if (member.status === "active") {
    throw new ApiError(409, "INVITE_ALREADY_ACCEPTED", "This invitation has already been accepted.");
  }
  if (!member.inviteExpiresAt || member.inviteExpiresAt.getTime() <= Date.now()) {
    throw new ApiError(410, "INVITE_EXPIRED", "This invitation has expired. Ask the store owner for a new one.");
  }
  return {
    member,
    preview: {
      email: member.email,
      name: member.name,
      role: member.role,
      permissions: teamPermissions(member.role),
      store_name: member.store.storeName,
      subdomain: member.store.subdomain,
      expires_at: member.inviteExpiresAt,
    },
  };
}

/**
 * Consume an invitation with the token and state in one conditional write.
 * A preview is intentionally not treated as a lock: two browser tabs may
 * preview the same link, but only one can transition it from invited to active.
 */
export async function acceptTeamInvite(input: { token: string; name?: string; passwordHash: string }) {
  const tokenHash = hashTeamInviteToken(input.token);
  const now = new Date();
  const existing = await prisma.teamMember.findUnique({ where: { inviteTokenHash: tokenHash } });
  if (!existing) throw new ApiError(404, "INVITE_NOT_FOUND", "This invitation is invalid or has already been used.");
  const result = await prisma.teamMember.updateMany({
    where: {
      id: existing.id,
      inviteTokenHash: tokenHash,
      status: "invited",
      inviteExpiresAt: { gt: now },
    },
    data: {
      passwordHash: input.passwordHash,
      passwordSalt: null,
      passwordAlgo: "argon2id",
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      status: "active",
      acceptedAt: now,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      lastLoginAt: now,
    },
  });
  if (result.count !== 1) {
    throw new ApiError(409, "INVITE_ALREADY_ACCEPTED", "This invitation is invalid, expired, or has already been accepted.");
  }
  return prisma.teamMember.findUniqueOrThrow({ where: { id: existing.id } });
}

export async function findActiveTeamMemberByEmail(email: string) {
  return prisma.teamMember.findUnique({ where: { email } });
}

export function assertTeamMemberCanAuthenticate(member: {
  status: string;
  inviteExpiresAt?: Date | null;
  passwordHash?: string | null;
}): void {
  if (member.status === "suspended") {
    throw new ApiError(403, "TEAM_MEMBER_SUSPENDED", "This team account is suspended.");
  }
  if (member.status !== "active" || !member.passwordHash) {
    throw new ApiError(403, "TEAM_INVITE_PENDING", "Accept your invitation before signing in.");
  }
}

export async function markTeamLogin(memberId: string) {
  await prisma.teamMember.update({ where: { id: memberId }, data: { lastLoginAt: new Date() } });
}
