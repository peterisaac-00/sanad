import { Router } from "express";
import { Prisma } from "@prisma/client";
import { resolveTxt } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import { newId, prisma } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireMerchantSession, requireStoreOwnership } from "../middleware.js";
import {
  deleteAccountSchema,
  domainBodySchema,
  idParamSchema,
  notificationPrefsSchema,
  publishingActionSchema,
  storeUpdateSchema,
  subdomainParamSchema,
  teamBodySchema,
  teamUpdateSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { verifyMerchantPassword, sessionCookieName } from "../auth.js";
import { auditActor, writeAudit } from "../services/account.js";
import { integrationStatus, paymentService } from "../services/integrations.js";
import { assertOwnerMayEditStore } from "../services/storePolicy.js";
import { createTeamInvite, rotateTeamInvite, teamMemberJson } from "../services/team.js";
import { sendTeamInviteEmail } from "../services/email.js";
import { storefrontOrigin } from "../services/domains.js";
import { env } from "../env.js";
import {
  PUBLISH_REASONS,
  assertCanPublish,
  publishBlockReason,
  publishingSnapshot,
} from "../services/publishing.js";

export const settingsRouter = Router();

/**
 * Verification tokens are write-only: they are returned once when a domain is
 * created or rotated, never by list/verify responses. Domain records are
 * otherwise safe to serialise.
 */
function sanitizeDomain(row: {
  id: string;
  storeId: string;
  domain: string;
  status: string;
  tlsStatus?: string;
  tlsMode?: string;
  tlsProvisionedAt?: Date | null;
  tlsError?: string;
  lastCheckedAt?: Date | null;
  createdAt: Date;
  verifiedAt: Date | null;
}) {
  return {
    id: row.id,
    storeId: row.storeId,
    domain: row.domain,
    status: row.status,
    tls_status: row.tlsStatus ?? "pending",
    tls_mode: row.tlsMode ?? "external_proxy",
    tls_provisioned_at: row.tlsProvisionedAt ?? null,
    tls_error: row.tlsError ?? "",
    last_checked_at: row.lastCheckedAt ?? null,
    createdAt: row.createdAt,
    verifiedAt: row.verifiedAt,
  };
}

function domainChallenge(domain: string, value: string) {
  return {
    type: "TXT" as const,
    name: `_sanad-verification.${domain}`,
    value,
  };
}

function teamInviteUrl(token: string): string {
  return `${env.appUrl}/team/invite?token=${encodeURIComponent(token)}`;
}

settingsRouter.get(
  "/api/stores/:subdomain/settings",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const isOwner = req.auth!.principalType === "merchant";
    const canManageTeam = isOwner || req.auth!.permissions.includes("team.manage");
    const canManageDomains = isOwner || req.auth!.permissions.includes("domain.manage");
    const merchant = req.auth!.merchantId
      ? await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId } })
      : null;
    const [store, branding, domains, team, productCount, orderCount, customerCount] =
      await prisma.$transaction([
        prisma.store.findUnique({ where: { id: storeId } }),
        prisma.storeBranding.findUnique({ where: { storeId } }),
        prisma.storeDomain.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } }),
        prisma.teamMember.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } }),
        prisma.product.count({ where: { storeId } }),
        prisma.order.count({ where: { storeId } }),
        prisma.customer.count({ where: { storeId } }),
      ]);
    res.json({
      store,
      branding,
      publishing: store ? publishingSnapshot(store) : null,
      merchant: merchant
        ? {
            id: merchant.id,
            email: merchant.email,
            firstName: merchant.firstName,
            lastName: merchant.lastName,
            name: merchant.name,
            phone: merchant.phone,
            role: merchant.role,
            email_verified: Boolean(merchant.emailVerifiedAt),
            two_factor_enabled: merchant.twoFactorEnabled,
          }
        : null,
      current_member: req.auth!.teamMemberId
        ? team.find((member) => member.id === req.auth!.teamMemberId)
          ? teamMemberJson(team.find((member) => member.id === req.auth!.teamMemberId)!)
          : null
        : null,
      domains: canManageDomains ? domains.map(sanitizeDomain) : [],
      team: canManageTeam
        ? team.map((member) => ({
            ...teamMemberJson(member),
            invite_pending: member.status === "invited",
            invite_expires_at: member.inviteExpiresAt,
          }))
        : [],
      integrations: integrationStatus(),
      online_payments_available: paymentService.configured,
      usage: { products: productCount, orders: orderCount, customers: customerCount },
      permissions: req.auth!.permissions,
      principal_type: req.auth!.principalType,
      public_url: storefrontOrigin(req.ownedStore!),
    });
  })
);

settingsRouter.patch(
  "/api/stores/:subdomain/settings",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(storeUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    assertOwnerMayEditStore(b);
    if (b.onlinePaymentEnabled === true && !paymentService.configured) {
      throw new ApiError(
        409,
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
        "لا يمكن تفعيل الدفع الإلكتروني قبل تثبيت مزود دفع فعلي. استخدم الدفع عند الاستلام، أو أضف محوّل الدفع أولاً."
      );
    }
    const store = await prisma.store.update({
      where: { id: storeId },
      data: {
        ...(b.storeName !== undefined ? { storeName: b.storeName } : {}),
        ...(b.phone !== undefined ? { phone: b.phone } : {}),
        ...(b.countryCode !== undefined ? { countryCode: b.countryCode } : {}),
        ...(b.storeCurrency !== undefined ? { currency: b.storeCurrency } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.supportEmail !== undefined ? { supportEmail: b.supportEmail } : {}),
        ...(b.seoTitle !== undefined ? { seoTitle: b.seoTitle } : {}),
        ...(b.seoDescription !== undefined ? { seoDescription: b.seoDescription } : {}),
        ...(b.whatsapp !== undefined ? { whatsapp: b.whatsapp } : {}),
        ...(b.codEnabled !== undefined ? { codEnabled: b.codEnabled } : {}),
        ...(b.onlinePaymentEnabled !== undefined ? { onlinePaymentEnabled: b.onlinePaymentEnabled } : {}),
        ...(b.primaryLanguage !== undefined ? { primaryLanguage: b.primaryLanguage } : {}),
        ...(b.timeZone !== undefined ? { timeZone: b.timeZone } : {}),
      },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "settings.updated",
      entity: "store",
      entityId: storeId,
      ip: req.ip,
    });
    res.json({ store });
  })
);

// ---- notification preferences ----
settingsRouter.patch(
  "/api/stores/:subdomain/notification-preferences",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(notificationPrefsSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { notificationPrefs: true } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const current = (store.notificationPrefs ?? {}) as Record<string, unknown>;
    const updated = await prisma.store.update({
      where: { id: storeId },
      data: { notificationPrefs: { ...current, ...req.body } as Prisma.InputJsonValue },
    });
    res.json({ notificationPrefs: updated.notificationPrefs });
  })
);

// ---- audit log ----
settingsRouter.get(
  "/api/stores/:subdomain/audit-logs",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const take = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
    const logs = await prisma.auditLog.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: { createdAt: "desc" },
      take,
      include: { merchant: { select: { email: true, name: true } } },
    });
    // TeamMember and PlatformAdmin have no Prisma relation on AuditLog (the
    // actor columns are intentionally loose so audits survive identity
    // deletion). Resolve display names in one bounded lookup each.
    const teamIds = [...new Set(logs.map((log) => log.teamMemberId).filter((id): id is string => Boolean(id)))];
    const adminIds = [...new Set(logs.map((log) => log.platformAdminId).filter((id): id is string => Boolean(id)))];
    const [members, admins] = await Promise.all([
      teamIds.length
        ? prisma.teamMember.findMany({
            where: { id: { in: teamIds } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      adminIds.length
        ? prisma.platformAdmin.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
    ]);
    const memberById = new Map(members.map((member) => [member.id, member]));
    const adminById = new Map(admins.map((admin) => [admin.id, admin]));
    res.json({
      logs: logs.map((log) => {
        const member = log.teamMemberId ? memberById.get(log.teamMemberId) : undefined;
        const admin = log.platformAdminId ? adminById.get(log.platformAdminId) : undefined;
        return {
          ...log,
          actor: {
            type: log.actorType,
            name:
              log.actorType === "team_member"
                ? member?.name || "عضو فريق"
                : log.actorType === "platform_admin"
                  ? admin?.name || "إدارة سند"
                  : log.merchant?.name || "مالك المتجر",
            email:
              log.actorType === "team_member"
                ? member?.email || ""
                : log.actorType === "platform_admin"
                  ? admin?.email || ""
                  : log.merchant?.email || "",
          },
        };
      }),
    });
  })
);

// ---- domains ----
settingsRouter.get(
  "/api/stores/:subdomain/domains",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const domains = await prisma.storeDomain.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ domains: domains.map(sanitizeDomain) });
  })
);

settingsRouter.post(
  "/api/stores/:subdomain/domains",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(domainBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const domain = req.body.domain as string;
    const taken = await prisma.storeDomain.findUnique({ where: { domain }, select: { id: true } });
    if (taken) throw new ApiError(409, "DOMAIN_TAKEN", "This domain is already connected to a store.");
    const verificationToken = `sanad-verify=${randomBytes(16).toString("hex")}`;
    try {
      const row = await prisma.storeDomain.create({
        data: {
          id: newId("dom_"),
          storeId,
          domain,
          status: "pending",
          verificationToken,
          lastCheckedAt: new Date(),
        },
      });
      await writeAudit({
        storeId,
        ...auditActor(req.auth!),
        action: "domain.added",
        entity: "store_domain",
        entityId: row.id,
        ip: req.ip,
      });
      // The DNS value is returned exactly once, at creation time.
      res.status(201).json({ domain: sanitizeDomain(row), challenge: domainChallenge(row.domain, verificationToken) });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "DOMAIN_TAKEN", "This domain is already connected to a store.");
      }
      throw e;
    }
  })
);

settingsRouter.post(
  "/api/stores/:subdomain/domains/:id/verify",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const row = await prisma.storeDomain.findFirst({ where: { id: req.params.id, storeId } });
    if (!row) throw new ApiError(404, "DOMAIN_NOT_FOUND", "Domain not found.");
    if (row.status === "verified") {
      res.json({ domain: sanitizeDomain(row), verified: true, status: "verified" });
      return;
    }
    let verified = false;
    try {
      const txt = await resolveTxt(`_sanad-verification.${row.domain}`);
      const records = txt.map((chunks) => chunks.join("").trim());
      // Exact match only: a record that merely embeds the token is not proof.
      verified = records.includes(row.verificationToken);
    } catch {
      verified = false;
    }
    const domain = await prisma.storeDomain.update({
      where: { id: row.id },
      data: {
        status: verified ? "verified" : "pending",
        verifiedAt: verified ? new Date() : null,
        lastCheckedAt: new Date(),
        // TLS terminates at the platform edge/proxy. Verification does not
        // fabricate a certificate; the admin records the proxy state once it
        // has actually been provisioned.
        ...(verified ? { tlsStatus: row.tlsStatus, tlsError: "" } : {}),
      },
    });
    if (verified) {
      await prisma.store.update({ where: { id: storeId }, data: { customDomain: row.domain } });
      await writeAudit({
        storeId,
        ...auditActor(req.auth!),
        action: "domain.verified",
        entity: "store_domain",
        entityId: row.id,
        metadata: { domain: row.domain },
        ip: req.ip,
      });
    }
    // Never echo the token or arbitrary TXT records: only the decision and
    // generic setup instructions leave the server.
    res.json({
      domain: sanitizeDomain(domain),
      verified,
      status: domain.status,
      instructions: verified
        ? "تم التحقق من النطاق بنجاح."
        : `أضف سجل TXT على _sanad-verification.${row.domain} بالقيمة التي ظهرت عند إضافة النطاق، ثم أعد المحاولة.`,
    });
  })
);

settingsRouter.post(
  "/api/stores/:subdomain/domains/:id/challenge",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const row = await prisma.storeDomain.findFirst({ where: { id: req.params.id, storeId } });
    if (!row) throw new ApiError(404, "DOMAIN_NOT_FOUND", "Domain not found.");
    if (row.status === "verified") {
      throw new ApiError(409, "DOMAIN_ALREADY_VERIFIED", "A verified domain does not need a new verification record.");
    }
    const verificationToken = `sanad-verify=${randomBytes(16).toString("hex")}`;
    const domain = await prisma.storeDomain.update({
      where: { id: row.id },
      data: { verificationToken, status: "pending", verifiedAt: null },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "domain.challenge_rotated",
      entity: "store_domain",
      entityId: row.id,
      ip: req.ip,
    });
    // One-time disclosure; subsequent GETs never contain the token.
    res.json({ domain: sanitizeDomain(domain), challenge: domainChallenge(domain.domain, verificationToken) });
  })
);

settingsRouter.delete(
  "/api/stores/:subdomain/domains/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const row = await prisma.storeDomain.findFirst({ where: { id: req.params.id, storeId } });
    if (!row) throw new ApiError(404, "DOMAIN_NOT_FOUND", "Domain not found.");
    await prisma.$transaction(async (tx) => {
      await tx.storeDomain.delete({ where: { id: row.id } });
      const store = await tx.store.findUnique({ where: { id: storeId }, select: { customDomain: true } });
      if (store?.customDomain === row.domain) {
        await tx.store.update({ where: { id: storeId }, data: { customDomain: null } });
      }
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "domain.removed",
      entity: "store_domain",
      entityId: row.id,
      metadata: { domain: row.domain },
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);

// ---- team ----
settingsRouter.get(
  "/api/stores/:subdomain/team",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const team = await prisma.teamMember.findMany({ where: { storeId: req.ownedStore!.id }, orderBy: { createdAt: "asc" } });
    res.json({
      team: team.map((member) => ({ ...teamMemberJson(member), invite_pending: member.status === "invited" })),
      invitation_email_configured: env.email.configured,
      roles: ["admin", "manager", "staff", "viewer"],
    });
  })
);

settingsRouter.post(
  "/api/stores/:subdomain/team",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(teamBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { storeName: true } });
    const b = req.body;
    const { member, token, expiresAt } = await createTeamInvite({
      storeId,
      name: b.name,
      email: b.email,
      role: b.role,
      actorId: req.auth!.actorId,
    });
    const inviteUrl = teamInviteUrl(token);
    const sent = await sendTeamInviteEmail({
      to: member.email,
      storeName: store?.storeName ?? "",
      role: member.role,
      link: inviteUrl,
      expiresAt,
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "team.invited",
      entity: "team_member",
      entityId: member.id,
      metadata: { role: member.role, email_sent: sent },
      ip: req.ip,
    });
    res.status(201).json({
      member: { ...teamMemberJson(member), invite_pending: true },
      email_sent: sent,
      // One-time disclosure so an owner can always deliver the link even when
      // SMTP is not configured. It is never returned by list endpoints.
      invite_token: token,
      invite_url: inviteUrl,
      expires_at: expiresAt,
      note: sent
        ? "تم إرسال الدعوة بالبريد. تنتهي صلاحيتها بعد 7 أيام."
        : "تم إنشاء الدعوة. إرسال البريد غير مهيأ، لذا انسخ رابط الدعوة وشاركه بأمان.",
    });
  })
);

settingsRouter.patch(
  "/api/stores/:subdomain/team/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(teamUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.teamMember.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "TEAM_MEMBER_NOT_FOUND", "Team member not found.");

    let invite: { token: string; expiresAt: Date } | null = null;
    if (req.body.status === "invited" && !existing.inviteTokenHash) {
      // Re-inviting an expired or revoked member must mint a fresh, hashed
      // token instead of leaving a dead invitation in the list.
      const rotated = await rotateTeamInvite(existing.id);
      invite = { token: rotated.token, expiresAt: rotated.expiresAt };
    }
    const member = await prisma.teamMember.update({
      where: { id: existing.id },
      data: {
        ...(req.body.role !== undefined ? { role: req.body.role } : {}),
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        ...(req.body.status === "active"
          ? { acceptedAt: existing.acceptedAt ?? new Date(), inviteTokenHash: null, inviteExpiresAt: null }
          : {}),
      },
    });
    // Suspension/revocation must invalidate every live session for the member.
    if (member.status !== "active") {
      await prisma.session.deleteMany({ where: { teamMemberId: member.id } });
    }
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: member.status === "suspended" ? "team.suspended" : "team.updated",
      entity: "team_member",
      entityId: member.id,
      metadata: {
        role: member.role,
        status: member.status,
        ...(invite ? { invite_rotated: true } : {}),
      },
      ip: req.ip,
    });
    res.json({
      member: { ...teamMemberJson(member), invite_pending: member.status === "invited" },
      ...(invite
        ? { invite_token: invite.token, invite_url: teamInviteUrl(invite.token), expires_at: invite.expiresAt }
        : {}),
    });
  })
);

settingsRouter.delete(
  "/api/stores/:subdomain/team/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.teamMember.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "TEAM_MEMBER_NOT_FOUND", "Team member not found.");
    await prisma.teamMember.delete({ where: { id: existing.id } });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "team.removed",
      entity: "team_member",
      entityId: existing.id,
      metadata: { email: existing.email, role: existing.role },
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);

// ---- publishing lifecycle (owner or a team member with settings.write) ----
settingsRouter.post(
  "/api/stores/:subdomain/publishing",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(publishingActionSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");

    if (req.body.action === "publish") {
      if (!store.onboardingCompleted) {
        throw new ApiError(409, "ONBOARDING_INCOMPLETE", PUBLISH_REASONS.draft);
      }
      assertCanPublish(store);
      const updated = await prisma.store.update({
        where: { id: storeId },
        data: {
          publishStatus: "published",
          publishReason: "",
          publishedAt: store.publishedAt ?? new Date(),
        },
      });
      await writeAudit({
        storeId,
        ...auditActor(req.auth!),
        action: "store.published",
        entity: "store",
        entityId: storeId,
        ip: req.ip,
      });
      res.json({ store: updated, publishing: publishingSnapshot(updated) });
      return;
    }

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: {
        publishStatus: "draft",
        publishReason: req.body.reason || "أوقف المالك نشر المتجر مؤقتًا.",
      },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "store.unpublished",
      entity: "store",
      entityId: storeId,
      metadata: { reason: req.body.reason },
      ip: req.ip,
    });
    res.json({ store: updated, publishing: publishingSnapshot(updated) });
  })
);

// ---- account deletion (real, irreversible, owner only) ----
settingsRouter.delete(
  "/api/account",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  validateBody(deleteAccountSchema),
  asyncHandler(async (req, res) => {
    const merchant = req.auth!.merchantId
      ? await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId } })
      : null;
    if (!merchant) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
    const { ok } = await verifyMerchantPassword(
      { password_hash: merchant.passwordHash, password_salt: merchant.passwordSalt, password_algo: merchant.passwordAlgo },
      req.body.password
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Password is incorrect.");
    const storeId = merchant.storeId;
    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { merchantId: merchant.id } });
      await tx.merchant.update({ where: { id: merchant.id }, data: { storeId: null } });
      await tx.merchant.delete({ where: { id: merchant.id } });
      if (storeId) {
        const remaining = await tx.merchant.count({ where: { storeId } });
        if (remaining === 0) await tx.store.delete({ where: { id: storeId } });
      }
    });
    res.clearCookie(sessionCookieName(), { path: "/" });
    res.json({ ok: true });
  })
);
