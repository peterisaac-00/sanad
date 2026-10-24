import { Router } from "express";
import { Prisma } from "@prisma/client";
import { resolveTxt } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  deleteAccountSchema,
  domainBodySchema,
  idParamSchema,
  notificationPrefsSchema,
  storeUpdateSchema,
  subdomainParamSchema,
  teamBodySchema,
  teamUpdateSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { verifyMerchantPassword, sessionCookieName } from "../auth.js";
import { writeAudit } from "../services/account.js";
import { integrationStatus } from "../services/integrations.js";

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
  createdAt: Date;
  verifiedAt: Date | null;
}) {
  return {
    id: row.id,
    storeId: row.storeId,
    domain: row.domain,
    status: row.status,
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

settingsRouter.get(
  "/api/stores/:subdomain/settings",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const [store, branding, merchant, domains, team, productCount, orderCount, customerCount] =
      await prisma.$transaction([
        prisma.store.findUnique({ where: { id: storeId } }),
        prisma.storeBranding.findUnique({ where: { storeId } }),
        prisma.merchant.findUnique({ where: { id: req.auth!.merchantId } }),
        prisma.storeDomain.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } }),
        prisma.teamMember.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } }),
        prisma.product.count({ where: { storeId } }),
        prisma.order.count({ where: { storeId } }),
        prisma.customer.count({ where: { storeId } }),
      ]);
    res.json({
      store,
      branding,
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
      domains: domains.map(sanitizeDomain),
      team,
      integrations: integrationStatus(),
      usage: { products: productCount, orders: orderCount, customers: customerCount },
      public_url: `/store/${req.ownedStore!.subdomain}`,
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
      merchantId: req.auth!.merchantId,
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
    res.json({ logs });
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
        },
      });
      await writeAudit({
        storeId,
        merchantId: req.auth!.merchantId,
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
      data: { status: verified ? "verified" : "pending", verifiedAt: verified ? new Date() : null },
    });
    if (verified) {
      await writeAudit({
        storeId,
        merchantId: req.auth!.merchantId,
        action: "domain.verified",
        entity: "store_domain",
        entityId: row.id,
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
      merchantId: req.auth!.merchantId,
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
    const row = await prisma.storeDomain.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!row) throw new ApiError(404, "DOMAIN_NOT_FOUND", "Domain not found.");
    await prisma.storeDomain.delete({ where: { id: row.id } });
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
    res.json({ team, invitation_email_configured: false });
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
    const b = req.body;
    try {
      const member = await prisma.teamMember.create({
        data: { id: newId("team_"), storeId, name: b.name, email: b.email, role: b.role, status: "invited" },
      });
      await writeAudit({
        storeId,
        merchantId: req.auth!.merchantId,
        action: "team.invited",
        entity: "team_member",
        entityId: member.id,
        ip: req.ip,
      });
      res.status(201).json({
        member,
        email_sent: false,
        note: "تم إنشاء الدعوة في النظام. إرسال البريد غير مهيأ بعد، لذا لن نؤكد إرسالاً لم يحدث.",
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "TEAM_MEMBER_EXISTS", "A team member with this email already exists.");
      }
      throw e;
    }
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
    const member = await prisma.teamMember.update({
      where: { id: existing.id },
      data: {
        ...(req.body.role !== undefined ? { role: req.body.role } : {}),
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
      },
    });
    res.json({ member });
  })
);

settingsRouter.delete(
  "/api/stores/:subdomain/team/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.teamMember.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "TEAM_MEMBER_NOT_FOUND", "Team member not found.");
    await prisma.teamMember.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);

// ---- account deletion (real, irreversible) ----
settingsRouter.delete(
  "/api/account",
  asyncHandler(requireAuth),
  validateBody(deleteAccountSchema),
  asyncHandler(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId } });
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
