import { Router } from "express";
import { prisma } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, authLimiter } from "../middleware.js";
import { hashPasswordArgon2, hashSessionToken, sessionCookieName, sessionCookieOptions, verifyMerchantPassword, verifyUnknownEmail } from "../auth.js";
import { createAuthSession } from "../sessions.js";
import { writeAudit } from "../services/account.js";
import {
  assertTeamMemberCanAuthenticate,
  findActiveTeamMemberByEmail,
  invitationPreview,
  markTeamLogin,
  teamMemberJson,
} from "../services/team.js";
import {
  teamAcceptSchema,
  teamLoginSchema,
  teamInviteTokenParamSchema,
  validateBody,
  validateParams,
} from "../validate.js";

export const teamAuthRouter = Router();

function teamSessionPayload(member: {
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
}, store: { storeName: string; subdomain: string; currency: string; status: string; publishStatus: string } | null) {
  return {
    team_member: teamMemberJson(member),
    store: store
      ? {
          id: member.storeId,
          store_name: store.storeName,
          subdomain: store.subdomain,
          currency: store.currency,
          status: store.status,
          publish_status: store.publishStatus,
        }
      : null,
    scope: "team",
  };
}

// ---- public invitation preview / acceptance ----
teamAuthRouter.get(
  "/api/team/invitations/:token",
  authLimiter,
  validateParams(teamInviteTokenParamSchema),
  asyncHandler(async (req, res) => {
    const { preview } = await invitationPreview(req.params.token);
    res.json({ invitation: preview });
  })
);

teamAuthRouter.post(
  "/api/team/invitations/accept",
  authLimiter,
  validateBody(teamAcceptSchema),
  asyncHandler(async (req, res) => {
    const { member } = await invitationPreview(req.body.token);
    const passwordHash = await hashPasswordArgon2(req.body.password);
    const acceptedAt = new Date();
    const updated = await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        name: req.body.name || member.name,
        passwordHash,
        passwordSalt: null,
        passwordAlgo: "argon2id",
        status: "active",
        acceptedAt,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        lastLoginAt: acceptedAt,
      },
    });

    await prisma.session.deleteMany({ where: { teamMemberId: updated.id } });
    const token = await createAuthSession({ teamMemberId: updated.id });
    res.cookie(sessionCookieName(), token, sessionCookieOptions());

    const store = await prisma.store.findUnique({
      where: { id: updated.storeId },
      select: { storeName: true, subdomain: true, currency: true, status: true, publishStatus: true },
    });
    await writeAudit({
      storeId: updated.storeId,
      teamMemberId: updated.id,
      actorType: "team_member",
      action: "team.invite_accepted",
      entity: "team_member",
      entityId: updated.id,
      metadata: { role: updated.role },
      ip: req.ip,
    });
    res.status(201).json(teamSessionPayload(updated, store));
  })
);

// ---- team login / session ----
teamAuthRouter.post(
  "/api/team/login",
  authLimiter,
  validateBody(teamLoginSchema),
  asyncHandler(async (req, res) => {
    const member = await findActiveTeamMemberByEmail(req.body.email);
    if (!member) {
      await verifyUnknownEmail(req.body.password);
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    assertTeamMemberCanAuthenticate(member);
    const { ok, needsRehash } = await verifyMerchantPassword(
      {
        password_hash: member.passwordHash!,
        password_salt: member.passwordSalt,
        password_algo: member.passwordAlgo,
      },
      req.body.password
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");

    if (needsRehash) {
      const upgraded = await hashPasswordArgon2(req.body.password);
      await prisma.teamMember.update({
        where: { id: member.id },
        data: { passwordHash: upgraded, passwordSalt: null, passwordAlgo: "argon2id" },
      });
    }

    // A team login replaces any existing merchant/team cookie on this browser.
    const incoming = req.cookies?.[sessionCookieName()];
    if (typeof incoming === "string" && incoming) {
      await prisma.session.delete({ where: { tokenHash: hashSessionToken(incoming) } }).catch(() => undefined);
    }
    await markTeamLogin(member.id);
    const token = await createAuthSession({ teamMemberId: member.id });
    res.cookie(sessionCookieName(), token, sessionCookieOptions());

    const store = await prisma.store.findUnique({
      where: { id: member.storeId },
      select: { storeName: true, subdomain: true, currency: true, status: true, publishStatus: true },
    });
    const fresh = await prisma.teamMember.findUniqueOrThrow({ where: { id: member.id } });
    await writeAudit({
      storeId: member.storeId,
      teamMemberId: member.id,
      actorType: "team_member",
      action: "team.signed_in",
      entity: "team_member",
      entityId: member.id,
      ip: req.ip,
    });
    res.json(teamSessionPayload(fresh, store));
  })
);

teamAuthRouter.get(
  "/api/team/me",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    if (req.auth!.principalType !== "team" || !req.auth!.teamMemberId) {
      throw new ApiError(403, "TEAM_SESSION_REQUIRED", "This endpoint is only available to team members.");
    }
    const member = await prisma.teamMember.findUnique({ where: { id: req.auth!.teamMemberId } });
    if (!member) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
    const store = await prisma.store.findUnique({
      where: { id: member.storeId },
      select: { storeName: true, subdomain: true, currency: true, status: true, publishStatus: true },
    });
    res.json(teamSessionPayload(member, store));
  })
);

teamAuthRouter.post(
  "/api/team/logout",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    if (req.auth!.principalType !== "team") {
      throw new ApiError(403, "TEAM_SESSION_REQUIRED", "This endpoint is only available to team members.");
    }
    const token = req.cookies?.[sessionCookieName()];
    if (typeof token === "string" && token) {
      await prisma.session.delete({ where: { tokenHash: hashSessionToken(token) } }).catch(() => undefined);
    }
    res.clearCookie(sessionCookieName(), { path: "/" });
    res.json({ ok: true });
  })
);
