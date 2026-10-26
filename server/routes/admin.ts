import { Router } from "express";
import { z } from "zod";
import { Prisma, type PlatformAdmin } from "@prisma/client";
import { prisma, newId, nowIso } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import {
  adminInitialCredentialsSchema,
  adminLoginSchema,
  adminPasswordSchema,
  adminTwoFactorCodeSchema,
  adminTwoFactorDisableSchema,
  adminTwoFactorSetupSchema,
  adminDomainReviewSchema,
  adminDomainTlsSchema,
  adminIdParamSchema,
  adminStoreReviewSchema,
  adminStoreSettingsSchema,
  adminSubscriptionReviewSchema,
  adminSupportUpdateSchema,
  adminWalletReviewSchema,
  featureFlagUpdateSchema,
  reportsRangeQuerySchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../validate.js";
import {
  authLimiter,
  requireAdminPermission,
  requirePlatformAdmin,
} from "../middleware.js";
import {
  adminAuditActor,
  createNotification,
  ensureStoreDefaults,
  writeAudit,
} from "../services/account.js";
import { storeMedia } from "../services/media.js";
import { storefrontOrigin } from "../services/domains.js";
import {
  hashPasswordArgon2,
  verifyMerchantPassword,
  verifyUnknownEmail,
} from "../auth.js";
import {
  ADMIN_ROLES,
  adminPermissions,
  adminSessionCookieName,
  adminSessionCookieOptions,
  createAdminSession,
  isAdminRole,
  revokeAdminSession,
  revokeOtherAdminSessions,
  serializeAdmin,
  verifyAdminSecondFactor,
} from "../services/platformAdmin.js";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from "../totp.js";
import { decryptSecret, encryptSecret } from "../crypto.js";
import {
  PUBLISH_REASONS,
  publishStateAfterApproval,
  publishingSnapshot,
} from "../services/publishing.js";

export const adminRouter = Router();

/**
 * Platform administration is a separate trust boundary:
 * - `/api/admin/auth/*` authenticates against PlatformAdmin + AdminSession only.
 * - every other route requires the admin cookie and an explicit permission.
 * - merchant sessions (even legacy `role=admin`) never authenticate here.
 */
const SUBSCRIPTION_PRICES = { monthly: 100, annual: 1000 } as const;
const SUBSCRIPTION_CURRENCY = "EGP";
const PLAN_LABEL: Record<string, string> = { monthly: "شهري", annual: "سنوي" };

const mediaBodySchema = z.strictObject({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(3).max(100),
  dataBase64: z.string().min(10).max(12_000_000),
});

const adminCreateSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  name: z.string().trim().max(160).default(""),
  role: z.enum(ADMIN_ROLES).default("readonly"),
});

const adminUpdateSchema = z
  .strictObject({
    role: z.enum(ADMIN_ROLES).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

function utcMonthStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addPlanPeriod(base: Date, plan: string): Date {
  const next = new Date(base);
  if (plan === "annual") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function ownerOf(store: { merchants?: Array<Record<string, unknown>> }) {
  const owner = store.merchants?.[0];
  if (!owner) return null;
  return {
    id: owner.id,
    email: owner.email,
    name: owner.name,
    firstName: owner.firstName,
    lastName: owner.lastName,
    phone: owner.phone,
    role: owner.role,
  };
}

function storeRow(store: any) {
  return {
    id: store.id,
    storeName: store.storeName,
    subdomain: store.subdomain,
    customDomain: store.customDomain,
    public_url: storefrontOrigin(store),
    description: store.description,
    status: store.status,
    statusReason: store.statusReason,
    publishStatus: store.publishStatus,
    publishReason: store.publishReason,
    publishing: publishingSnapshot(store),
    plan: store.plan,
    currency: store.currency,
    countryCode: store.countryCode,
    logoUrl: store.logoUrl,
    coverUrl: store.coverUrl,
    templateKey: store.templateKey,
    seoTitle: store.seoTitle,
    seoDescription: store.seoDescription,
    supportEmail: store.supportEmail,
    whatsapp: store.whatsapp,
    phone: store.phone,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    activatedAt: store.activatedAt,
    subscriptionPaidUntil: store.subscriptionPaidUntil,
    onboardingCompleted: store.onboardingCompleted,
    publishedAt: store.publishedAt,
    owner: ownerOf(store),
    walletBalance: store.wallet?.balance ?? 0,
    paymentCount: store._count?.subscriptionPayments ?? 0,
    visitsTotal: store._count?.visits ?? 0,
    teamCount: store._count?.team ?? 0,
    domainCount: store._count?.domains ?? 0,
    openTickets: store._count?.supportTickets ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Admin authentication (public, but rate limited and audited)
// ---------------------------------------------------------------------------

adminRouter.post(
  "/auth/login",
  authLimiter,
  validateBody(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, totp, recovery_code } = req.body;
    const admin = await prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin) {
      await verifyUnknownEmail(password);
      await writeAudit({
        actorType: "platform_admin",
        action: "admin.login_failed",
        entity: "platform_admin",
        metadata: { email, reason: "unknown_email" },
        ip: req.ip,
      });
      throw new ApiError(401, "ADMIN_INVALID_CREDENTIALS", "Invalid administrator credentials.");
    }
    if (admin.status !== "active") {
      throw new ApiError(403, "ADMIN_DISABLED", "This administrator account is disabled.");
    }

    const { ok, needsRehash } = await verifyMerchantPassword(
      {
        password_hash: admin.passwordHash,
        password_salt: admin.passwordSalt,
        password_algo: admin.passwordAlgo,
      },
      password
    );
    if (!ok) {
      await writeAudit({
        platformAdminId: admin.id,
        actorType: "platform_admin",
        action: "admin.login_failed",
        entity: "platform_admin",
        entityId: admin.id,
        metadata: { reason: "bad_password" },
        ip: req.ip,
      });
      throw new ApiError(401, "ADMIN_INVALID_CREDENTIALS", "Invalid administrator credentials.");
    }

    if (admin.twoFactorEnabled) {
      if (!totp && !recovery_code) {
        throw new ApiError(401, "ADMIN_TWO_FACTOR_REQUIRED", "Enter your administrator authenticator code.");
      }
      const secondFactor = await verifyAdminSecondFactor({
        adminId: admin.id,
        totp: totp || undefined,
        recoveryCode: recovery_code || undefined,
      });
      if (!secondFactor) {
        await writeAudit({
          platformAdminId: admin.id,
          actorType: "platform_admin",
          action: "admin.login_failed",
          entity: "platform_admin",
          entityId: admin.id,
          metadata: { reason: "bad_second_factor" },
          ip: req.ip,
        });
        throw new ApiError(401, "ADMIN_INVALID_TWO_FACTOR", "The administrator authentication code is invalid.");
      }
    }

    if (needsRehash) {
      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { passwordHash: await hashPasswordArgon2(password), passwordSalt: null, passwordAlgo: "argon2id" },
      });
    }

    await revokeAdminSession(req.cookies?.[adminSessionCookieName()]);
    const token = await createAdminSession({ adminId: admin.id, ip: req.ip, userAgent: req.get("user-agent") });
    res.cookie(adminSessionCookieName(), token, adminSessionCookieOptions());
    const fresh = await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    await writeAudit({
      platformAdminId: admin.id,
      actorType: "platform_admin",
      action: "admin.signed_in",
      entity: "platform_admin",
      entityId: admin.id,
      ip: req.ip,
    });
    res.json({ admin: serializeAdmin(fresh), scope: "platform" });
  })
);

adminRouter.post(
  "/auth/logout",
  asyncHandler(requirePlatformAdmin),
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[adminSessionCookieName()];
    await revokeAdminSession(typeof token === "string" ? token : undefined);
    await writeAudit({
      ...adminAuditActor(req.adminAuth!.adminId),
      action: "admin.signed_out",
      entity: "platform_admin",
      entityId: req.adminAuth!.adminId,
      ip: req.ip,
    });
    res.clearCookie(adminSessionCookieName(), { path: "/" });
    res.json({ ok: true });
  })
);

adminRouter.get(
  "/auth/me",
  asyncHandler(requirePlatformAdmin),
  asyncHandler(async (req, res) => {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: req.adminAuth!.adminId } });
    if (!admin || admin.status !== "active") {
      throw new ApiError(401, "ADMIN_UNAUTHENTICATED", "Platform administrator authentication required.");
    }
    res.json({ admin: serializeAdmin(admin), scope: "platform" });
  })
);

adminRouter.post(
  "/auth/password",
  asyncHandler(requirePlatformAdmin),
  validateBody(adminPasswordSchema),
  asyncHandler(async (req, res) => {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: req.adminAuth!.adminId } });
    if (!admin) throw new ApiError(401, "ADMIN_UNAUTHENTICATED", "Platform administrator authentication required.");
    const { ok } = await verifyMerchantPassword(
      { password_hash: admin.passwordHash, password_salt: admin.passwordSalt, password_algo: admin.passwordAlgo },
      req.body.currentPassword
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");
    const reused = await verifyMerchantPassword(
      { password_hash: admin.passwordHash, password_salt: admin.passwordSalt, password_algo: admin.passwordAlgo },
      req.body.newPassword
    );
    if (reused.ok) {
      throw new ApiError(400, "ADMIN_PASSWORD_REUSE", "Choose a password that is different from the current password.");
    }
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        passwordHash: await hashPasswordArgon2(req.body.newPassword),
        passwordSalt: null,
        passwordAlgo: "argon2id",
      },
    });
    const current = req.cookies?.[adminSessionCookieName()];
    const revoked = await revokeOtherAdminSessions(admin.id, typeof current === "string" ? current : undefined);
    await writeAudit({
      ...adminAuditActor(admin.id),
      action: "admin.password_changed",
      entity: "platform_admin",
      entityId: admin.id,
      metadata: { revoked_sessions: revoked },
      ip: req.ip,
    });
    res.json({ ok: true, revoked_sessions: revoked });
  })
);

adminRouter.post(
  "/auth/credentials",
  asyncHandler(requirePlatformAdmin),
  validateBody(adminInitialCredentialsSchema),
  asyncHandler(async (req, res) => {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: req.adminAuth!.adminId } });
    if (!admin) throw new ApiError(401, "ADMIN_UNAUTHENTICATED", "Platform administrator authentication required.");
    if (!admin.mustChangeCredentials) {
      throw new ApiError(409, "ADMIN_CREDENTIALS_ALREADY_SET", "The initial credentials were already replaced.");
    }

    const passwordCheck = await verifyMerchantPassword(
      { password_hash: admin.passwordHash, password_salt: admin.passwordSalt, password_algo: admin.passwordAlgo },
      req.body.currentPassword
    );
    if (!passwordCheck.ok) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");
    }
    const reused = await verifyMerchantPassword(
      { password_hash: admin.passwordHash, password_salt: admin.passwordSalt, password_algo: admin.passwordAlgo },
      req.body.newPassword
    );
    if (reused.ok) {
      throw new ApiError(400, "ADMIN_PASSWORD_REUSE", "Choose a password that is different from the setup password.");
    }

    const email = req.body.email as string;
    if (email === admin.email) {
      throw new ApiError(400, "ADMIN_EMAIL_UNCHANGED", "Choose a new email address for the administrator account.");
    }
    const passwordHash = await hashPasswordArgon2(req.body.newPassword);

    let updated: PlatformAdmin;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const fresh = await tx.platformAdmin.findUnique({ where: { id: admin.id } });
        if (!fresh) throw new ApiError(401, "ADMIN_UNAUTHENTICATED", "Platform administrator authentication required.");
        if (!fresh.mustChangeCredentials) {
          throw new ApiError(409, "ADMIN_CREDENTIALS_ALREADY_SET", "The initial credentials were already replaced.");
        }
        const duplicate = await tx.platformAdmin.findUnique({ where: { email } });
        if (duplicate && duplicate.id !== fresh.id) {
          throw new ApiError(409, "ADMIN_EMAIL_TAKEN", "This email is already used by another administrator.");
        }
        return tx.platformAdmin.update({
          where: { id: fresh.id },
          data: {
            email,
            passwordHash,
            passwordSalt: null,
            passwordAlgo: "argon2id",
            mustChangeCredentials: false,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "ADMIN_EMAIL_TAKEN", "This email is already used by another administrator.");
      }
      throw error;
    }

    const current = req.cookies?.[adminSessionCookieName()];
    const revoked = await revokeOtherAdminSessions(updated.id, typeof current === "string" ? current : undefined);
    await writeAudit({
      ...adminAuditActor(updated.id),
      action: "admin.initial_credentials_changed",
      entity: "platform_admin",
      entityId: updated.id,
      metadata: { previous_email: admin.email, new_email: updated.email, revoked_sessions: revoked },
      ip: req.ip,
    });
    res.json({ admin: serializeAdmin(updated), scope: "platform", revoked_sessions: revoked });
  })
);

adminRouter.post(
  "/auth/2fa/setup",
  asyncHandler(requirePlatformAdmin),
  validateBody(adminTwoFactorSetupSchema),
  asyncHandler(async (req, res) => {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: req.adminAuth!.adminId } });
    if (!admin) throw new ApiError(401, "ADMIN_UNAUTHENTICATED", "Platform administrator authentication required.");
    const { ok } = await verifyMerchantPassword(
      { password_hash: admin.passwordHash, password_salt: admin.passwordSalt, password_algo: admin.passwordAlgo },
      req.body.password
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Password is incorrect.");
    if (admin.twoFactorEnabled) {
      throw new ApiError(409, "TWO_FACTOR_ALREADY_ENABLED", "Two-factor authentication is already enabled.");
    }
    const secret = generateTotpSecret();
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        twoFactorSecret: encryptSecret(secret),
        twoFactorEnabled: false,
        twoFactorRecoveryCodes: [] as Prisma.InputJsonValue,
      },
    });
    res.json({
      secret,
      otpauth_url: otpauthUrl({ secret, account: admin.email }),
      issuer: "Sanad Admin",
      account: admin.email,
    });
  })
);

adminRouter.post(
  "/auth/2fa/enable",
  asyncHandler(requirePlatformAdmin),
  validateBody(adminTwoFactorCodeSchema),
  asyncHandler(async (req, res) => {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: req.adminAuth!.adminId } });
    if (!admin) throw new ApiError(401, "ADMIN_UNAUTHENTICATED", "Platform administrator authentication required.");
    if (admin.twoFactorEnabled) {
      throw new ApiError(409, "TWO_FACTOR_ALREADY_ENABLED", "Two-factor authentication is already enabled.");
    }
    const secret = decryptSecret(admin.twoFactorSecret);
    if (!secret) throw new ApiError(409, "TWO_FACTOR_SETUP_REQUIRED", "Start two-factor setup before enabling it.");
    if (!verifyTotp(secret, req.body.code)) {
      throw new ApiError(400, "INVALID_TWO_FACTOR_CODE", "The authenticator code is invalid.");
    }
    const recoveryCodes = generateRecoveryCodes();
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode) as Prisma.InputJsonValue,
      },
    });
    await writeAudit({
      ...adminAuditActor(admin.id),
      action: "admin.two_factor_enabled",
      entity: "platform_admin",
      entityId: admin.id,
      ip: req.ip,
    });
    res.json({ ok: true, recovery_codes: recoveryCodes });
  })
);

adminRouter.post(
  "/auth/2fa/disable",
  asyncHandler(requirePlatformAdmin),
  validateBody(adminTwoFactorDisableSchema),
  asyncHandler(async (req, res) => {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: req.adminAuth!.adminId } });
    if (!admin) throw new ApiError(401, "ADMIN_UNAUTHENTICATED", "Platform administrator authentication required.");
    if (!admin.twoFactorEnabled) {
      throw new ApiError(409, "TWO_FACTOR_NOT_ENABLED", "Two-factor authentication is not enabled.");
    }
    const { ok } = await verifyMerchantPassword(
      { password_hash: admin.passwordHash, password_salt: admin.passwordSalt, password_algo: admin.passwordAlgo },
      req.body.password
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Password is incorrect.");
    const secondFactor = await verifyAdminSecondFactor({
      adminId: admin.id,
      totp: req.body.code,
      recoveryCode: req.body.code,
    });
    if (!secondFactor) {
      throw new ApiError(401, "INVALID_TWO_FACTOR_CODE", "The authentication code is invalid or has already been used.");
    }
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: [] as Prisma.InputJsonValue,
      },
    });
    await revokeOtherAdminSessions(admin.id, req.cookies?.[adminSessionCookieName()]);
    await writeAudit({
      ...adminAuditActor(admin.id),
      action: "admin.two_factor_disabled",
      entity: "platform_admin",
      entityId: admin.id,
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);

adminRouter.post(
  "/auth/sessions/revoke-others",
  asyncHandler(requirePlatformAdmin),
  asyncHandler(async (req, res) => {
    const current = req.cookies?.[adminSessionCookieName()];
    const revoked = await revokeOtherAdminSessions(
      req.adminAuth!.adminId,
      typeof current === "string" ? current : undefined
    );
    await writeAudit({
      ...adminAuditActor(req.adminAuth!.adminId),
      action: "admin.sessions_revoked",
      entity: "platform_admin",
      entityId: req.adminAuth!.adminId,
      metadata: { revoked },
      ip: req.ip,
    });
    res.json({ ok: true, revoked });
  })
);

// Every route below requires a platform-admin session. Permission middleware
// runs per route; the API is the enforcement point, not the admin UI.
adminRouter.use(asyncHandler(requirePlatformAdmin));
adminRouter.use((req, _res, next) => {
  if (req.adminAuth?.mustChangeCredentials) {
    next(
      new ApiError(
        403,
        "ADMIN_CREDENTIAL_CHANGE_REQUIRED",
        "Replace the initial administrator email and password before using the console."
      )
    );
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
adminRouter.get(
  "/overview",
  requireAdminPermission("overview.read"),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const monthStart = utcMonthStart(now);
    const windows = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - (5 - index), 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      return { start, end, month: start.toISOString().slice(0, 7) };
    });

    const [
      stores,
      totalStores,
      activeStores,
      pendingStores,
      suspendedStores,
      rejectedStores,
      publishedStores,
      visitsThisMonth,
      pendingPaymentCount,
      pendingPaymentAgg,
      approvedPaymentAgg,
      pendingWalletAgg,
      openTickets,
      byStore,
      ...monthCounts
    ] = await Promise.all([
      prisma.store.findMany({
        orderBy: { createdAt: "desc" },
        take: 250,
        include: {
          merchants: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
              phone: true,
              role: true,
            },
          },
          wallet: { select: { balance: true } },
          _count: { select: { subscriptionPayments: true, visits: true, team: true, domains: true, supportTickets: true } },
        },
      }),
      prisma.store.count(),
      prisma.store.count({ where: { status: "active" } }),
      prisma.store.count({ where: { status: "pending" } }),
      prisma.store.count({ where: { status: "suspended" } }),
      prisma.store.count({ where: { status: "rejected" } }),
      prisma.store.count({ where: { status: "active", publishStatus: "published" } }),
      prisma.storeVisit.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.subscriptionPayment.count({ where: { status: "pending" } }),
      prisma.subscriptionPayment.aggregate({ where: { status: "pending" }, _sum: { amount: true } }),
      prisma.subscriptionPayment.aggregate({
        where: { status: "approved", reviewedAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { type: "deposit", status: "pending" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress"] } } }),
      prisma.storeVisit.groupBy({
        by: ["storeId"],
        where: { createdAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      ...windows.map((window) =>
        prisma.storeVisit.count({ where: { createdAt: { gte: window.start, lt: window.end } } })
      ),
    ]);

    const visitsByStoreMap = new Map(byStore.map((entry) => [entry.storeId, entry._count._all]));
    const storeRows = stores.map((store) => ({
      ...storeRow(store),
      visitsThisMonth: visitsByStoreMap.get(store.id) ?? 0,
    }));

    res.json({
      summary: {
        totalStores,
        activeStores,
        pendingStores,
        suspendedStores,
        rejectedStores,
        publishedStores,
        draftStores: Math.max(0, activeStores - publishedStores),
        visitsThisMonth,
        pendingSubscriptionPayments: pendingPaymentCount,
        pendingSubscriptionAmount: pendingPaymentAgg._sum.amount ?? 0,
        approvedSubscriptionAmountThisMonth: approvedPaymentAgg._sum.amount ?? 0,
        pendingWalletDeposits: pendingWalletAgg._count._all,
        pendingWalletAmount: pendingWalletAgg._sum.amount ?? 0,
        openSupportTickets: openTickets,
      },
      stores: storeRows,
      monthlyVisits: windows.map((window, index) => ({
        month: window.month,
        visits: monthCounts[index] ?? 0,
      })),
      visitsByStore: storeRows
        .filter((store) => store.visitsThisMonth > 0)
        .map((store) => ({
          storeId: store.id,
          storeName: store.storeName,
          subdomain: store.subdomain,
          visits: store.visitsThisMonth,
        }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 12),
      subscriptionPrices: SUBSCRIPTION_PRICES,
      subscriptionCurrency: SUBSCRIPTION_CURRENCY,
      generatedAt: nowIso(),
    });
  })
);

// ---------------------------------------------------------------------------
// Stores, publishing and identity
// ---------------------------------------------------------------------------
adminRouter.get(
  "/stores",
  requireAdminPermission("stores.read"),
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const publish = typeof req.query.publish === "string" ? req.query.publish : "";
    const stores = await prisma.store.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(publish ? { publishStatus: publish } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        merchants: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { id: true, email: true, name: true, firstName: true, lastName: true, phone: true, role: true },
        },
        wallet: { select: { balance: true } },
        _count: { select: { subscriptionPayments: true, visits: true, team: true, domains: true, supportTickets: true } },
      },
    });
    res.json({ stores: stores.map(storeRow) });
  })
);

adminRouter.get(
  "/stores/:id/settings",
  requireAdminPermission("stores.read"),
  validateParams(adminIdParamSchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({
      where: { id: req.params.id },
      include: {
        branding: true,
        merchants: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { id: true, email: true, name: true, firstName: true, lastName: true, phone: true, role: true },
        },
        domains: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    res.json({
      store: storeRow(store),
      branding: store.branding,
      owner: ownerOf(store),
      domains: store.domains.map((domain) => {
        const safe = { ...domain };
        delete (safe as { verificationToken?: string }).verificationToken;
        return safe;
      }),
      public_url: storeRow(store).public_url,
    });
  })
);

adminRouter.patch(
  "/stores/:id/settings",
  requireAdminPermission("stores.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminStoreSettingsSchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.params.id }, select: { id: true, currency: true } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const b = req.body;
    await ensureStoreDefaults(store.id, store.currency);

    const brandingData = {
      ...(b.primaryColor !== undefined ? { primaryColor: b.primaryColor } : {}),
      ...(b.secondaryColor !== undefined ? { secondaryColor: b.secondaryColor } : {}),
      ...(b.textColor !== undefined ? { textColor: b.textColor } : {}),
      ...(b.themeMode !== undefined ? { themeMode: b.themeMode } : {}),
      ...(b.arabicFont !== undefined ? { arabicFont: b.arabicFont } : {}),
      ...(b.templateKey !== undefined ? { templateKey: b.templateKey } : {}),
    };

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.store.update({
        where: { id: store.id },
        data: {
          ...(b.storeName !== undefined ? { storeName: b.storeName } : {}),
          ...(b.description !== undefined ? { description: b.description } : {}),
          ...(b.logoUrl !== undefined ? { logoUrl: b.logoUrl } : {}),
          ...(b.coverUrl !== undefined ? { coverUrl: b.coverUrl } : {}),
          ...(b.templateKey !== undefined ? { templateKey: b.templateKey } : {}),
          ...(b.seoTitle !== undefined ? { seoTitle: b.seoTitle } : {}),
          ...(b.seoDescription !== undefined ? { seoDescription: b.seoDescription } : {}),
          ...(b.supportEmail !== undefined ? { supportEmail: b.supportEmail } : {}),
          ...(b.whatsapp !== undefined ? { whatsapp: b.whatsapp } : {}),
          ...(b.phone !== undefined ? { phone: b.phone } : {}),
          ...(b.countryCode !== undefined ? { countryCode: b.countryCode } : {}),
        },
      });
      const branding = await tx.storeBranding.upsert({
        where: { storeId: store.id },
        create: { id: newId("brand_"), storeId: store.id, ...brandingData },
        update: brandingData,
      });
      return { store: updated, branding };
    });

    await writeAudit({
      storeId: store.id,
      ...adminAuditActor(req.adminAuth!.adminId),
      action: "admin.store_settings_updated",
      entity: "store",
      entityId: store.id,
      metadata: { fields: Object.keys(b) },
      ip: req.ip,
    });
    await createNotification({
      storeId: store.id,
      type: "settings",
      title: "تم تحديث هوية متجرك",
      body: "حدّث فريق سند بيانات الهوية أو العلامة التجارية لمتجرك.",
      link: "/dashboard/settings",
    });
    res.json({ store: result.store, branding: result.branding });
  })
);

adminRouter.post(
  "/stores/:id/media",
  requireAdminPermission("stores.write"),
  validateParams(adminIdParamSchema),
  validateBody(mediaBodySchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const result = await storeMedia({
      storeId: store.id,
      fileName: req.body.fileName,
      mimeType: req.body.mimeType,
      dataBase64: req.body.dataBase64,
    });
    await writeAudit({
      storeId: store.id,
      ...adminAuditActor(req.adminAuth!.adminId),
      action: "admin.store_media_uploaded",
      entity: "store",
      entityId: store.id,
      metadata: { url: result.media.url },
      ip: req.ip,
    });
    res.status(201).json(result);
  })
);

async function reviewStore(
  req: Parameters<typeof requirePlatformAdmin>[0],
  res: Parameters<typeof requirePlatformAdmin>[1],
  action: "approve" | "reject" | "suspend"
) {
  const store = await prisma.store.findUnique({ where: { id: req.params.id } });
  if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  const note = String(req.body.note ?? "");
  const now = new Date();
  const activatedAt = store.activatedAt ?? now;

  let data: Prisma.StoreUpdateInput;
  let title: string;
  let body: string;
  if (action === "approve") {
    const publish = publishStateAfterApproval(store, now);
    data = {
      status: "active",
      statusReason: "",
      activatedAt,
      ...publish,
    };
    title = "تم تفعيل متجرك";
    body = publish.publishStatus === "published"
      ? "وافق فريق سند على متجرك. المتجر منشور الآن ويمكنك مشاركة رابطه مع عملائك."
      : "وافق فريق سند على متجرك. أكمل تهيئة المتجر ثم انشره ليظهر للعملاء.";
  } else if (action === "reject") {
    data = {
      status: "rejected",
      publishStatus: "draft",
      publishReason: PUBLISH_REASONS.rejected,
      publishedAt: null,
      statusReason: note || "طلب فتح المتجر يحتاج تعديلاً من المالك.",
    };
    title = "طلب فتح المتجر يحتاج تعديلاً";
    body = note || "راجع بيانات متجرك ثم تواصل مع إدارة سند.";
  } else {
    data = {
      status: "suspended",
      publishStatus: "suspended",
      publishReason: PUBLISH_REASONS.suspended,
      statusReason: note || "تم إيقاف المتجر من إدارة سند.",
    };
    title = "تم إيقاف المتجر مؤقتاً";
    body = note || "تم إيقاف المتجر من إدارة منصة سند.";
  }

  const updated = await prisma.store.update({ where: { id: store.id }, data });
  await writeAudit({
    storeId: store.id,
    ...adminAuditActor(req.adminAuth!.adminId),
    action: `store.${action === "approve" ? "approved" : action === "reject" ? "rejected" : "suspended"}`,
    entity: "store",
    entityId: store.id,
    metadata: { note, published: updated.publishStatus === "published" },
    ip: req.ip,
  });
  await createNotification({
    storeId: store.id,
    type: "approval",
    title,
    body,
    link: updated.publishStatus === "published" ? "/dashboard" : "/dashboard/settings",
  });
  res.json({ store: updated, publishing: publishingSnapshot(updated) });
}

adminRouter.post(
  "/stores/:id/approve",
  requireAdminPermission("stores.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminStoreReviewSchema),
  asyncHandler(async (req, res) => reviewStore(req, res, "approve"))
);
adminRouter.post(
  "/stores/:id/reject",
  requireAdminPermission("stores.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminStoreReviewSchema),
  asyncHandler(async (req, res) => reviewStore(req, res, "reject"))
);
adminRouter.post(
  "/stores/:id/suspend",
  requireAdminPermission("stores.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminStoreReviewSchema),
  asyncHandler(async (req, res) => reviewStore(req, res, "suspend"))
);

adminRouter.post(
  "/stores/:id/publishing",
  requireAdminPermission("stores.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminStoreReviewSchema.extend({ action: z.enum(["publish", "unpublish"]) })),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    if (req.body.action === "publish") {
      if (store.status !== "active") {
        throw new ApiError(409, "STORE_NOT_APPROVED", "Approve the store before publishing it.");
      }
      if (!store.onboardingCompleted) {
        throw new ApiError(409, "ONBOARDING_INCOMPLETE", PUBLISH_REASONS.draft);
      }
    }
    const updated = await prisma.store.update({
      where: { id: store.id },
      data:
        req.body.action === "publish"
          ? { publishStatus: "published", publishReason: "", publishedAt: store.publishedAt ?? new Date() }
          : {
              publishStatus: "draft",
              publishReason: req.body.note || "أوقفت الإدارة نشر المتجر مؤقتًا.",
            },
    });
    await writeAudit({
      storeId: store.id,
      ...adminAuditActor(req.adminAuth!.adminId),
      action: req.body.action === "publish" ? "admin.store_published" : "admin.store_unpublished",
      entity: "store",
      entityId: store.id,
      metadata: { note: req.body.note },
      ip: req.ip,
    });
    await createNotification({
      storeId: store.id,
      type: "approval",
      title: req.body.action === "publish" ? "تم نشر متجرك" : "تم إيقاف نشر متجرك",
      body:
        req.body.action === "publish"
          ? "المتجر ظاهر الآن للعملاء."
          : req.body.note || "أوقفت إدارة سند نشر المتجر مؤقتًا.",
      link: "/dashboard/settings",
    });
    res.json({ store: updated, publishing: publishingSnapshot(updated) });
  })
);

// ---------------------------------------------------------------------------
// Merchants
// ---------------------------------------------------------------------------
adminRouter.get(
  "/merchants",
  requireAdminPermission("merchants.read"),
  asyncHandler(async (_req, res) => {
    const merchants = await prisma.merchant.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        store: { select: { id: true, storeName: true, subdomain: true, status: true, publishStatus: true, plan: true } },
      },
    });
    res.json({
      merchants: merchants.map((merchant) => ({
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        first_name: merchant.firstName,
        last_name: merchant.lastName,
        phone: merchant.phone,
        role: merchant.role,
        email_verified: Boolean(merchant.emailVerifiedAt),
        two_factor_enabled: merchant.twoFactorEnabled,
        created_at: merchant.createdAt,
        store: merchant.store,
      })),
    });
  })
);

// ---------------------------------------------------------------------------
// Subscription billing
// ---------------------------------------------------------------------------
adminRouter.get(
  "/subscription-payments",
  requireAdminPermission("subscriptions.read"),
  asyncHandler(async (req, res) => {
    const requested = typeof req.query.status === "string" ? req.query.status : "";
    const status = ["pending", "approved", "rejected"].includes(requested) ? requested : undefined;
    const where = status ? { status } : {};

    const [payments, pendingCount, rejectedCount, approvedThisMonth] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 300,
        include: {
          store: {
            select: {
              id: true,
              storeName: true,
              subdomain: true,
              status: true,
              plan: true,
              currency: true,
              activatedAt: true,
              subscriptionPaidUntil: true,
              merchants: {
                orderBy: { createdAt: "asc" },
                take: 1,
                select: { id: true, email: true, name: true, firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
      }),
      prisma.subscriptionPayment.count({ where: { status: "pending" } }),
      prisma.subscriptionPayment.count({ where: { status: "rejected" } }),
      prisma.subscriptionPayment.aggregate({
        where: { status: "approved", reviewedAt: { gte: utcMonthStart(new Date()) } },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      payments: payments.map((payment) => ({
        ...payment,
        store: { ...payment.store, owner: ownerOf(payment.store as any) },
      })),
      summary: {
        pending: pendingCount,
        rejected: rejectedCount,
        approvedThisMonth: approvedThisMonth._sum.amount ?? 0,
        prices: SUBSCRIPTION_PRICES,
        currency: SUBSCRIPTION_CURRENCY,
      },
    });
  })
);

adminRouter.post(
  "/subscription-payments/:id/review",
  requireAdminPermission("subscriptions.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminSubscriptionReviewSchema),
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body;
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: req.params.id },
      include: { store: true },
    });
    if (!payment) throw new ApiError(404, "SUBSCRIPTION_PAYMENT_NOT_FOUND", "Subscription payment not found.");
    if (payment.status !== "pending") {
      throw new ApiError(409, "SUBSCRIPTION_PAYMENT_ALREADY_REVIEWED", "This payment has already been reviewed.");
    }
    if (!["monthly", "annual"].includes(payment.plan)) {
      throw new ApiError(400, "INVALID_SUBSCRIPTION_PLAN", "The payment has an unsupported plan.");
    }
    if (payment.currency !== SUBSCRIPTION_CURRENCY) {
      throw new ApiError(400, "INVALID_SUBSCRIPTION_CURRENCY", "The payment currency is not supported.");
    }
    const expectedAmount = SUBSCRIPTION_PRICES[payment.plan as keyof typeof SUBSCRIPTION_PRICES];
    if (Math.abs(payment.amount - expectedAmount) > 0.009) {
      throw new ApiError(
        400,
        "INVALID_SUBSCRIPTION_AMOUNT",
        `The payment amount does not match the ${payment.plan} plan price.`
      );
    }

    const reviewedAt = new Date();
    let updatedStore = payment.store;
    const updatedPayment = await prisma.$transaction(async (tx) => {
      const claimed = await tx.subscriptionPayment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: {
          status: decision === "approve" ? "approved" : "rejected",
          reviewNote: note,
          reviewedById: req.adminAuth!.adminId,
          reviewedAt,
        },
      });
      if (claimed.count !== 1) {
        throw new ApiError(409, "SUBSCRIPTION_PAYMENT_ALREADY_REVIEWED", "This payment has already been reviewed.");
      }
      if (decision === "approve") {
        const current = payment.store.subscriptionPaidUntil;
        const base = current && current.getTime() > reviewedAt.getTime() ? current : reviewedAt;
        updatedStore = await tx.store.update({
          where: { id: payment.storeId },
          data: {
            plan: payment.plan,
            subscriptionPaidUntil: addPlanPeriod(base, payment.plan),
          },
        });
      }
      return tx.subscriptionPayment.findUniqueOrThrow({ where: { id: payment.id } });
    });

    await writeAudit({
      storeId: payment.storeId,
      ...adminAuditActor(req.adminAuth!.adminId),
      action: decision === "approve" ? "subscription_payment.approved" : "subscription_payment.rejected",
      entity: "subscription_payment",
      entityId: payment.id,
      metadata: { plan: payment.plan, amount: payment.amount, note },
      ip: req.ip,
    });
    await createNotification({
      storeId: payment.storeId,
      type: "billing",
      title: decision === "approve" ? "تم اعتماد دفعة الاشتراك" : "تم رفض دفعة الاشتراك",
      body:
        decision === "approve"
          ? `تم اعتماد اشتراكك ${PLAN_LABEL[payment.plan] ?? payment.plan} بقيمة ${payment.amount} ${payment.currency}.`
          : note || "راجع بيانات الدفعة ثم أعد إرسالها.",
      link: "/dashboard/wallet",
    });

    res.json({ payment: updatedPayment, store: updatedStore });
  })
);

// ---------------------------------------------------------------------------
// Wallet deposits
// ---------------------------------------------------------------------------
adminRouter.get(
  "/wallet/transactions",
  requireAdminPermission("wallet.read"),
  asyncHandler(async (req, res) => {
    const requested = typeof req.query.status === "string" ? req.query.status : "";
    const status = ["pending", "completed", "rejected"].includes(requested) ? requested : undefined;
    const [transactions, pendingAgg] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { type: "deposit", ...(status ? { status } : {}) },
        orderBy: { createdAt: "desc" },
        take: 300,
        include: {
          store: { select: { id: true, storeName: true, subdomain: true, currency: true } },
        },
      }),
      prisma.walletTransaction.aggregate({
        where: { type: "deposit", status: "pending" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    res.json({
      transactions,
      summary: {
        pending: pendingAgg._count._all,
        pendingAmount: pendingAgg._sum.amount ?? 0,
      },
    });
  })
);

adminRouter.post(
  "/wallet/transactions/:id/review",
  requireAdminPermission("wallet.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminWalletReviewSchema),
  asyncHandler(async (req, res) => {
    const decision = req.body.decision as "approve" | "reject";
    const note = String(req.body.note ?? "");
    const existing = await prisma.walletTransaction.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "WALLET_TRANSACTION_NOT_FOUND", "Wallet transaction not found.");
    if (existing.type !== "deposit") {
      throw new ApiError(409, "WALLET_TRANSACTION_NOT_DEPOSIT", "Only deposit requests can be reviewed.");
    }
    const reviewedAt = new Date();
    const amount = round2(existing.amount);

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.walletTransaction.updateMany({
          where: { id: existing.id, status: "pending" },
          data: { status: decision === "approve" ? "completed" : "rejected" },
        });
        if (claimed.count !== 1) {
          throw new ApiError(409, "WALLET_TRANSACTION_ALREADY_REVIEWED", "This deposit has already been reviewed.");
        }
        if (decision === "approve") {
          const account = await tx.walletAccount.update({
            where: { id: existing.accountId },
            data: { balance: { increment: amount } },
          });
          const balanceAfter = round2(account.balance);
          return tx.walletTransaction.update({
            where: { id: existing.id },
            data: {
              status: "completed",
              balanceBefore: round2(balanceAfter - amount),
              balanceAfter,
              reviewedByAdminId: req.adminAuth!.adminId,
              reviewedAt,
              reviewNote: note,
            },
          });
        }
        return tx.walletTransaction.update({
          where: { id: existing.id },
          data: {
            status: "rejected",
            balanceBefore: 0,
            balanceAfter: 0,
            reviewedByAdminId: req.adminAuth!.adminId,
            reviewedAt,
            reviewNote: note,
          },
        });
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw error;
    }

    await writeAudit({
      storeId: existing.storeId,
      ...adminAuditActor(req.adminAuth!.adminId),
      action: decision === "approve" ? "wallet.deposit_approved" : "wallet.deposit_rejected",
      entity: "wallet_transaction",
      entityId: existing.id,
      metadata: { amount, note, reference: existing.reference },
      ip: req.ip,
    });
    await createNotification({
      storeId: existing.storeId,
      type: "billing",
      title: decision === "approve" ? "تم اعتماد إيداع المحفظة" : "تم رفض طلب الإيداع",
      body:
        decision === "approve"
          ? `أُضيف ${amount} إلى رصيد محفظتك بعد مراجعة الإدارة.`
          : note || "راجع تفاصيل الإيداع ثم أعد إرساله.",
      link: "/dashboard/wallet",
    });

    res.json({ transaction: updated, decision });
  })
);

// ---------------------------------------------------------------------------
// Support desk
// ---------------------------------------------------------------------------
adminRouter.get(
  "/support-tickets",
  requireAdminPermission("support.read"),
  asyncHandler(async (req, res) => {
    const requested = typeof req.query.status === "string" ? req.query.status : "";
    const status = ["open", "in_progress", "resolved", "closed"].includes(requested) ? requested : undefined;
    const tickets = await prisma.supportTicket.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
      include: { store: { select: { id: true, storeName: true, subdomain: true } } },
    });
    res.json({ tickets });
  })
);

adminRouter.patch(
  "/support-tickets/:id",
  requireAdminPermission("support.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminSupportUpdateSchema),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) throw new ApiError(404, "SUPPORT_TICKET_NOT_FOUND", "Support ticket not found.");
    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        ...(req.body.priority !== undefined ? { priority: req.body.priority } : {}),
        ...(req.body.resolution !== undefined ? { resolution: req.body.resolution } : {}),
        ...(req.body.assignToMe ? { assignedAdminId: req.adminAuth!.adminId } : {}),
      },
    });
    await writeAudit({
      storeId: ticket.storeId,
      ...adminAuditActor(req.adminAuth!.adminId),
      action: "support.ticket_updated",
      entity: "support_ticket",
      entityId: ticket.id,
      metadata: { status: updated.status, priority: updated.priority },
      ip: req.ip,
    });
    res.json({ ticket: updated });
  })
);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
adminRouter.get(
  "/reports",
  requireAdminPermission("reports.read"),
  validateQuery(reportsRangeQuerySchema),
  asyncHandler(async (req, res) => {
    const rawFrom = typeof req.query.from === "string" ? req.query.from : "";
    const rawTo = typeof req.query.to === "string" ? req.query.to : "";
    const from = rawFrom ? new Date(rawFrom) : utcMonthStart(new Date());
    const to = rawTo ? new Date(rawTo) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new ApiError(400, "INVALID_DATE_RANGE", "from/to must be valid dates.");
    }
    if (from.getTime() > to.getTime()) {
      throw new ApiError(400, "INVALID_DATE_RANGE", "from must be before to.");
    }
    const range = { gte: from, lte: to };

    const [orders, revenueAgg, newMerchants, newStores, topStores, orderStatus] = await Promise.all([
      prisma.order.count({ where: { createdAt: range } }),
      prisma.order.aggregate({ where: { createdAt: range }, _sum: { amountEgp: true } }),
      prisma.merchant.count({ where: { createdAt: range } }),
      prisma.store.count({ where: { createdAt: range } }),
      prisma.order.groupBy({
        by: ["storeId"],
        where: { createdAt: range },
        _sum: { amountEgp: true },
        _count: { _all: true },
        orderBy: { _sum: { amountEgp: "desc" } },
        take: 10,
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { createdAt: range },
        _count: { _all: true },
      }),
    ]);

    const storeIds = topStores.map((row) => row.storeId);
    const stores = storeIds.length
      ? await prisma.store.findMany({
          where: { id: { in: storeIds } },
          select: { id: true, storeName: true, subdomain: true },
        })
      : [];
    const storeMap = new Map(stores.map((store) => [store.id, store]));

    res.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        orders,
        revenue: round2(revenueAgg._sum.amountEgp ?? 0),
        newMerchants,
        newStores,
        averageOrderValue: orders > 0 ? round2((revenueAgg._sum.amountEgp ?? 0) / orders) : 0,
      },
      ordersByStatus: orderStatus.map((row) => ({ status: row.status, count: row._count._all })),
      topStores: topStores.map((row) => ({
        storeId: row.storeId,
        storeName: storeMap.get(row.storeId)?.storeName ?? "",
        subdomain: storeMap.get(row.storeId)?.subdomain ?? "",
        orders: row._count._all,
        revenue: round2(row._sum.amountEgp ?? 0),
      })),
    });
  })
);

// ---------------------------------------------------------------------------
// Custom domains and TLS state
// ---------------------------------------------------------------------------
adminRouter.get(
  "/domains",
  requireAdminPermission("domains.read"),
  asyncHandler(async (req, res) => {
    const rows = await prisma.storeDomain.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { store: { select: { id: true, storeName: true, subdomain: true, status: true, publishStatus: true } } },
    });
    // Domain challenges prove DNS control. Read-only administrators may see
    // domain state but must not receive the value that can be used to forge
    // verification. Writers keep the token for the existing review workflow.
    const canSeeChallenge = req.adminAuth?.permissions.includes("domains.write") ?? false;
    const domains = rows.map((row) => {
      if (canSeeChallenge) return row;
      const safe = { ...row };
      delete (safe as { verificationToken?: string }).verificationToken;
      return safe;
    });
    res.json({ domains });
  })
);

adminRouter.post(
  "/domains/:id/verify",
  requireAdminPermission("domains.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminDomainReviewSchema),
  asyncHandler(async (req, res) => {
    const domain = await prisma.storeDomain.findUnique({ where: { id: req.params.id } });
    if (!domain) throw new ApiError(404, "DOMAIN_NOT_FOUND", "Domain not found.");
    const verified = Boolean(req.body.verified);
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.storeDomain.update({
        where: { id: domain.id },
        data: {
          status: verified ? "verified" : "pending",
          verifiedAt: verified ? new Date() : null,
          lastCheckedAt: new Date(),
          tlsError: verified ? "" : domain.tlsError,
        },
      });
      const store = await tx.store.findUnique({ where: { id: domain.storeId }, select: { customDomain: true } });
      if (verified) {
        await tx.store.update({ where: { id: domain.storeId }, data: { customDomain: row.domain } });
      } else if (store?.customDomain === row.domain) {
        await tx.store.update({ where: { id: domain.storeId }, data: { customDomain: null } });
      }
      return row;
    });
    await writeAudit({
      storeId: domain.storeId,
      ...adminAuditActor(req.adminAuth!.adminId),
      action: verified ? "admin.domain_verified" : "admin.domain_unverified",
      entity: "store_domain",
      entityId: domain.id,
      metadata: { domain: domain.domain, note: req.body.note },
      ip: req.ip,
    });
    res.json({ domain: updated });
  })
);

adminRouter.post(
  "/domains/:id/tls",
  requireAdminPermission("domains.write"),
  validateParams(adminIdParamSchema),
  validateBody(adminDomainTlsSchema),
  asyncHandler(async (req, res) => {
    const domain = await prisma.storeDomain.findUnique({ where: { id: req.params.id } });
    if (!domain) throw new ApiError(404, "DOMAIN_NOT_FOUND", "Domain not found.");
    const status = req.body.status as "pending" | "active" | "failed";
    const updated = await prisma.storeDomain.update({
      where: { id: domain.id },
      data: {
        tlsStatus: status,
        tlsMode: "external_proxy",
        tlsProvisionedAt: status === "active" ? new Date() : null,
        tlsError: status === "failed" ? req.body.error || "TLS provisioning failed." : "",
        lastCheckedAt: new Date(),
      },
    });
    await writeAudit({
      storeId: domain.storeId,
      ...adminAuditActor(req.adminAuth!.adminId),
      action: "admin.domain_tls_updated",
      entity: "store_domain",
      entityId: domain.id,
      metadata: { domain: domain.domain, status, error: req.body.error },
      ip: req.ip,
    });
    res.json({ domain: updated });
  })
);

// ---------------------------------------------------------------------------
// Audit and security events
// ---------------------------------------------------------------------------
adminRouter.get(
  "/audit",
  requireAdminPermission("audit.read"),
  asyncHandler(async (req, res) => {
    const actorType = typeof req.query.actorType === "string" ? req.query.actorType : "";
    const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
    const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(actorType ? { actorType } : {}),
        ...(action ? { action: { contains: action } } : {}),
        ...(storeId ? { storeId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { store: { select: { storeName: true, subdomain: true } } },
    });
    const security = await prisma.auditLog.findMany({
      where: { action: { startsWith: "admin.login" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ logs, security_events: security });
  })
);

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------
adminRouter.get(
  "/feature-flags",
  requireAdminPermission("flags.read"),
  asyncHandler(async (_req, res) => {
    const flags = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
    res.json({ flags });
  })
);

adminRouter.patch(
  "/feature-flags/:key",
  requireAdminPermission("flags.write"),
  validateBody(featureFlagUpdateSchema),
  asyncHandler(async (req, res) => {
    const key = String(req.params.key || "").trim().slice(0, 80);
    if (!/^[a-z0-9_]+$/.test(key)) {
      throw new ApiError(400, "INVALID_FEATURE_FLAG", "Feature flag key must be lowercase letters, digits or underscores.");
    }
    const flag = await prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled: req.body.enabled, updatedByAdminId: req.adminAuth!.adminId },
      update: { enabled: req.body.enabled, updatedByAdminId: req.adminAuth!.adminId },
    });
    await writeAudit({
      ...adminAuditActor(req.adminAuth!.adminId),
      action: "admin.feature_flag_updated",
      entity: "feature_flag",
      entityId: key,
      metadata: { enabled: flag.enabled },
      ip: req.ip,
    });
    res.json({ flag });
  })
);

// ---------------------------------------------------------------------------
// Platform administrators (super admin only)
// ---------------------------------------------------------------------------
adminRouter.get(
  "/admins",
  requireAdminPermission("admins.manage"),
  asyncHandler(async (_req, res) => {
    const admins = await prisma.platformAdmin.findMany({ orderBy: { createdAt: "asc" } });
    res.json({
      admins: admins.map((admin) => ({
        ...serializeAdmin(admin),
        status: admin.status,
        created_at: admin.createdAt,
      })),
    });
  })
);

adminRouter.post(
  "/admins",
  requireAdminPermission("admins.manage"),
  validateBody(adminCreateSchema),
  asyncHandler(async (req, res) => {
    const email = String(req.body.email).toLowerCase();
    const exists = await prisma.platformAdmin.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ApiError(409, "ADMIN_EMAIL_TAKEN", "An administrator with this email already exists.");
    const admin = await prisma.platformAdmin.create({
      data: {
        id: newId("padm_"),
        email,
        name: req.body.name,
        passwordHash: await hashPasswordArgon2(req.body.password),
        passwordSalt: null,
        passwordAlgo: "argon2id",
        role: req.body.role,
        status: "active",
      },
    });
    await writeAudit({
      ...adminAuditActor(req.adminAuth!.adminId),
      action: "admin.created",
      entity: "platform_admin",
      entityId: admin.id,
      metadata: { email: admin.email, role: admin.role },
      ip: req.ip,
    });
    res.status(201).json({ admin: serializeAdmin(admin) });
  })
);

adminRouter.patch(
  "/admins/:id",
  requireAdminPermission("admins.manage"),
  validateParams(adminIdParamSchema),
  validateBody(adminUpdateSchema),
  asyncHandler(async (req, res) => {
    const target = await prisma.platformAdmin.findUnique({ where: { id: req.params.id } });
    if (!target) throw new ApiError(404, "ADMIN_NOT_FOUND", "Administrator not found.");
    if (target.id === req.adminAuth!.adminId) {
      throw new ApiError(409, "ADMIN_SELF_EDIT", "You cannot change your own role or disable your own account.");
    }
    const admin = await prisma.platformAdmin.update({
      where: { id: target.id },
      data: {
        ...(req.body.role !== undefined && isAdminRole(req.body.role) ? { role: req.body.role } : {}),
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
      },
    });
    if (admin.status !== "active") {
      await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });
    }
    await writeAudit({
      ...adminAuditActor(req.adminAuth!.adminId),
      action: "admin.updated",
      entity: "platform_admin",
      entityId: admin.id,
      metadata: { role: admin.role, status: admin.status },
      ip: req.ip,
    });
    res.json({
      admin: { ...serializeAdmin(admin), status: admin.status, permissions: adminPermissions(admin.role) },
    });
  })
);

// ---------------------------------------------------------------------------
// Leads (existing capability)
// ---------------------------------------------------------------------------
adminRouter.get(
  "/leads",
  requireAdminPermission("stores.read"),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { store: { select: { storeName: true, subdomain: true } } },
    });
    res.json({ leads: rows });
  })
);
