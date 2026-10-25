import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import type { Merchant, Store } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { env } from "./env.js";
import { logger, httpLogger } from "./logger.js";
import { prisma, nowIso, newId, checkDb } from "./db.js";
import {
  hashPasswordArgon2,
  verifyMerchantPassword,
  verifyUnknownEmail,
  hashSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "./auth.js";
import { createAuthSession, startSessionCleanup } from "./sessions.js";
import { ApiError, asyncHandler, errorHandler, notFoundHandler } from "./errors.js";
import {
  requireAuth,
  requireMerchantSession,
  requireStoreOwnership,
  attachAuth,
  csrfOriginCheck,
  authLimiter,
  emailLimiter,
  publicWriteLimiter,
} from "./middleware.js";
import {
  validateBody,
  validateParams,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  emailOnlySchema,
  verifyEmailSchema,
  resetPasswordSchema,
  twoFactorSetupSchema,
  twoFactorCodeSchema,
  twoFactorDisableSchema,
  subdomainParamSchema,
  storeUpdateSchema,
  leadBodySchema,
} from "./validate.js";
import { auditActor, ensureStoreDefaults, uniqueSubdomain, writeAudit } from "./services/account.js";
import { paymentService } from "./services/integrations.js";
import { issueAuthToken, consumeAuthToken } from "./services/authTokens.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./services/email.js";
import { verifySecondFactor } from "./services/twoFactor.js";
import { encryptSecret, decryptSecret } from "./crypto.js";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from "./totp.js";
import { startRetentionSweep } from "./retention.js";
import { UPLOAD_EXTENSIONS, responsiveMedia } from "./services/media.js";

// Feature routers
import { productsRouter } from "./routes/products.js";
import { categoriesRouter } from "./routes/categories.js";
import { ordersRouter } from "./routes/orders.js";
import { customersRouter } from "./routes/customers.js";
import { walletRouter } from "./routes/wallet.js";
import { shippingRouter } from "./routes/shipping.js";
import { couponsRouter } from "./routes/coupons.js";
import { growthRouter } from "./routes/growth.js";
import { contentRouter } from "./routes/content.js";
import { reviewsRouter } from "./routes/reviews.js";
import { loyaltyRouter } from "./routes/loyalty.js";
import { dropshippingRouter } from "./routes/dropshipping.js";
import { assistantRouter } from "./routes/assistant.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { abandonedRouter } from "./routes/abandoned.js";
import { reportsRouter } from "./routes/reports.js";
import { settingsRouter } from "./routes/settings.js";
import { storefrontRouter } from "./routes/storefront.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { mediaRouter } from "./routes/media.js";
import { adminRouter } from "./routes/admin.js";
import { teamAuthRouter } from "./routes/teamAuth.js";
import { supportRouter } from "./routes/support.js";
import { assertOwnerMayEditStore } from "./services/storePolicy.js";
import { escapeHtmlAttribute, isPlatformHost, normalizeHost, resolveCustomDomainHost, serializeForHtml } from "./services/domains.js";
import { isPublished, publishingSnapshot } from "./services/publishing.js";
import { teamMemberJson } from "./services/team.js";
import { ensurePlatformAdmin } from "./services/platformAdmin.js";
import { marketingSitemap, resolveStoreForRequest, storefrontSeo, storeSitemap } from "./services/seo.js";

export const app = express();

app.set("trust proxy", env.trustProxy);
app.disable("x-powered-by");

app.use(helmet());
app.use(
  "/api",
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (env.corsOrigins.includes(origin.replace(/\/$/, ""))) return cb(null, true);
      return cb(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(httpLogger);
app.use(csrfOriginCheck);

// Media uploads are base64 JSON and need a larger parser than normal API
// requests. Mount them before the global parser so the limit applies only here.
app.use("/api/media", express.json({ limit: "12mb" }), mediaRouter);

app.use(express.json({ limit: env.jsonBodyLimit }));

// ---- helpers ----
function publicStorefront(row: Store) {
  // Storefront-safe fields only: never expose merchant phone/plan via the public endpoint.
  return {
    id: row.id,
    store_name: row.storeName,
    subdomain: row.subdomain,
    country_code: row.countryCode,
    currency: row.currency,
  };
}

function toMerchantJson(row: Merchant) {
  return {
    id: row.id,
    email: row.email,
    store_handle: row.storeHandle,
    name: row.name ?? "",
    first_name: row.firstName,
    last_name: row.lastName,
    phone: row.phone,
    role: row.role,
    email_verified: Boolean(row.emailVerifiedAt),
    two_factor_enabled: row.twoFactorEnabled,
  };
}

async function sessionStoreJson(storeId: string | null) {
  if (!storeId) return null;
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  return store ? { ...store, publishing: publishingSnapshot(store) } : null;
}

/**
 * Debug tokens exist only outside production and only when the message could
 * not actually be delivered, so a developer is never locked out of an
 * unconfigured local environment. They are never returned in production.
 */
function debugToken(token: string, sent: boolean): string | undefined {
  return !env.isProduction && !sent ? token : undefined;
}

function verificationLink(token: string): string {
  return `${env.appUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
}

function passwordResetLink(token: string): string {
  return `${env.appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

async function issueVerification(merchant: { id: string; email: string }) {
  const token = await issueAuthToken({
    merchantId: merchant.id,
    type: "email_verification",
    ttlMinutes: env.email.verificationTtlMinutes,
  });
  const sent = await sendVerificationEmail({
    to: merchant.email,
    link: verificationLink(token),
    ttlMinutes: env.email.verificationTtlMinutes,
  });
  return { sent, debug_token: debugToken(token, sent) };
}

async function issuePasswordReset(merchant: { id: string; email: string }) {
  const token = await issueAuthToken({
    merchantId: merchant.id,
    type: "password_reset",
    ttlMinutes: env.email.resetTtlMinutes,
  });
  const sent = await sendPasswordResetEmail({
    to: merchant.email,
    link: passwordResetLink(token),
    ttlMinutes: env.email.resetTtlMinutes,
  });
  return { sent, debug_token: debugToken(token, sent) };
}

// ---- health (public): liveness + database connectivity ----
app.get("/api/health", async (_req, res) => {
  try {
    await checkDb();
    res.json({ ok: true, service: "sanad-commerce-backend", time: nowIso(), db: "up" });
  } catch {
    res.status(503).json({ ok: false, service: "sanad-commerce-backend", time: nowIso(), db: "down" });
  }
});

// Crawlable public discovery surfaces. Store maps are emitted only for active,
// published stores; draft and suspended catalogs never enter search indexes.
app.get("/sitemap.xml", asyncHandler(async (req, res) => {
  const store = await resolveStoreForRequest(req);
  if (store) {
    const sitemap = await storeSitemap(store);
    if (!sitemap) return res.status(404).type("text/plain").send("Not found");
    return res.type("application/xml").set("Cache-Control", "public, max-age=300").send(sitemap);
  }
  const host = normalizeHost(req.headers.host);
  if (!isPlatformHost(host)) return res.status(404).type("text/plain").send("Not found");
  return res.type("application/xml").set("Cache-Control", "public, max-age=300").send(marketingSitemap());
}));
app.get("/robots.txt", asyncHandler(async (req, res) => {
  const store = await resolveStoreForRequest(req);
  if (store) {
    const sitemap = `${store.customDomain ? `https://${store.customDomain}` : `${env.appUrl}/store/${encodeURIComponent(store.subdomain)}`}/sitemap.xml`;
    return res.type("text/plain").send(isPublished(store) ? `User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout\nDisallow: /track\nSitemap: ${sitemap}\n` : "User-agent: *\nDisallow: /\n");
  }
  return res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /admin\nSitemap: ${env.appUrl}/sitemap.xml\n`);
}));

// ---- public host metadata (used by the SPA on custom domains) ----
app.get(
  "/api/site",
  asyncHandler(async (req, res) => {
    const host = normalizeHost(req.headers.host);
    const custom = !isPlatformHost(host);
    const resolved = custom ? await resolveCustomDomainHost(host) : null;
    res.json({
      host,
      mode: custom ? "custom_domain" : "platform",
      custom_domain: custom,
      store: resolved
        ? {
            id: resolved.storeId,
            store_name: resolved.storeName,
            subdomain: resolved.subdomain,
            status: resolved.status,
            publish_status: resolved.publishStatus,
            canonical_url: resolved.canonicalUrl,
            tls_status: resolved.tlsStatus,
          }
        : null,
      canonical_url: resolved?.canonicalUrl ?? "",
    });
  })
);

// ---- auth (public: register, login) ----
app.post(
  "/api/auth/register",
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const {
      email,
      password,
      name,
      firstName,
      lastName,
      phone,
      storeName,
      subdomain,
      countryCode,
      storeCurrency,
      acceptTerms,
    } = req.body;

    if (acceptTerms === false) {
      throw new ApiError(400, "TERMS_REQUIRED", "You must accept the terms of service to create an account.");
    }

    const displayName =
      name || [firstName, lastName].filter(Boolean).join(" ").trim() || email.split("@")[0] || "";
    const chosenStoreName = storeName || (displayName ? `متجر ${displayName}` : "متجري");
    const chosenSubdomain = subdomain || (await uniqueSubdomain(email.split("@")[0] || chosenStoreName));

    const emailTaken = await prisma.merchant.findUnique({ where: { email }, select: { id: true } });
    if (emailTaken) throw new ApiError(409, "EMAIL_TAKEN", "This email is already registered.");
    const subTaken = await prisma.store.findUnique({ where: { subdomain: chosenSubdomain }, select: { id: true } });
    if (subTaken) throw new ApiError(409, "SUBDOMAIN_TAKEN", "This store address is already taken.");

    const storeId = newId("store_");
    const merchantId = newId("merch_");
    const passwordHash = await hashPasswordArgon2(password);

    try {
      await prisma.$transaction([
        prisma.store.create({
          data: {
            id: storeId,
            storeName: chosenStoreName,
            subdomain: chosenSubdomain,
            phone,
            countryCode,
            currency: storeCurrency,
            plan: "annual",
            // New stores stay pending until a platform admin approves them.
            // Publishing during onboarding only prepares the storefront; it
            // does not bypass this gate.
            status: "pending",
            activatedAt: null,
            onboardingStep: 1,
            onboardingCompleted: false,
            publishedAt: null,
          },
        }),
        prisma.merchant.create({
          data: {
            id: merchantId,
            storeId,
            storeHandle: chosenSubdomain,
            email,
            passwordHash,
            passwordSalt: null,
            passwordAlgo: "argon2id",
            name: displayName,
            firstName: firstName ?? "",
            lastName: lastName ?? "",
            phone,
          },
        }),
        prisma.storeBranding.create({
          data: { id: newId("brand_"), storeId },
        }),
        prisma.walletAccount.create({
          data: { id: newId("wal_"), storeId, currency: storeCurrency },
        }),
      ]);
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "CONFLICT", "Email or store address is already taken.");
      }
      throw e;
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    const merchant = (await prisma.merchant.findUnique({ where: { id: merchantId } })) as Merchant;
    const verification = await issueVerification({ id: merchant.id, email: merchant.email });

    // When verification is mandatory, registration proves the account exists
    // but does not grant a console session until the email link is consumed.
    if (!env.email.requireVerification) {
      const token = await createAuthSession({ merchantId });
      res.cookie(sessionCookieName(), token, sessionCookieOptions());
    }

    await writeAudit({
      storeId,
      merchantId,
      action: "account.registered",
      entity: "merchant",
      entityId: merchantId,
      metadata: { email_sent: verification.sent },
      ip: req.ip,
    });
    res.status(201).json({
      merchant: toMerchantJson(merchant),
      store,
      next: env.email.requireVerification
        ? "/auth/verify-email"
        : store?.onboardingCompleted
          ? "/dashboard"
          : "/onboarding",
      email_verification: {
        required: env.email.requireVerification,
        email_configured: env.email.configured,
        sent: verification.sent,
        ...(verification.debug_token ? { debug_token: verification.debug_token } : {}),
      },
    });
  })
);

app.post(
  "/api/auth/login",
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, totp, recovery_code } = req.body;
    const merchant = await prisma.merchant.findUnique({ where: { email } });
    if (!merchant) {
      await verifyUnknownEmail(password);
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const { ok, needsRehash } = await verifyMerchantPassword(
      { password_hash: merchant.passwordHash, password_salt: merchant.passwordSalt, password_algo: merchant.passwordAlgo },
      password
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");

    if (merchant.twoFactorEnabled) {
      if (!totp && !recovery_code) {
        throw new ApiError(401, "TWO_FACTOR_REQUIRED", "Enter your authenticator code to finish signing in.");
      }
      const secondFactor = await verifySecondFactor({
        merchantId: merchant.id,
        totp: totp || undefined,
        recoveryCode: recovery_code || undefined,
      });
      if (!secondFactor) {
        throw new ApiError(
          401,
          "INVALID_TWO_FACTOR_CODE",
          "The authentication code is invalid or has already been used."
        );
      }
    }

    if (env.email.requireVerification && !merchant.emailVerifiedAt) {
      throw new ApiError(
        403,
        "EMAIL_NOT_VERIFIED",
        "Verify your email address before signing in. You can request a new verification link."
      );
    }

    if (needsRehash) {
      const upgraded = await hashPasswordArgon2(password);
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { passwordHash: upgraded, passwordSalt: null, passwordAlgo: "argon2id" },
      });
    }

    const incoming = req.cookies?.[sessionCookieName()];
    if (typeof incoming === "string" && incoming) {
      await prisma.session.delete({ where: { tokenHash: hashSessionToken(incoming) } }).catch(() => undefined);
    }
    const token = await createAuthSession({ merchantId: merchant.id });
    res.cookie(sessionCookieName(), token, sessionCookieOptions());
    const store = merchant.storeId ? await prisma.store.findUnique({ where: { id: merchant.storeId } }) : null;
    res.json({ merchant: toMerchantJson(merchant), store });
  })
);

app.post(
  "/api/auth/logout",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[sessionCookieName()];
    if (typeof token === "string" && token) {
      await prisma.session.delete({ where: { tokenHash: hashSessionToken(token) } }).catch(() => undefined);
    }
    res.clearCookie(sessionCookieName(), { path: "/" });
    res.json({ ok: true });
  })
);

app.get(
  "/api/auth/me",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const store = await sessionStoreJson(auth.storeId);
    if (auth.principalType === "team" && auth.teamMemberId) {
      const member = await prisma.teamMember.findUnique({ where: { id: auth.teamMemberId } });
      if (!member) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
      res.json({
        merchant: null,
        store,
        team_member: teamMemberJson(member),
        principal_type: "team",
        permissions: auth.permissions,
        publishing: store?.publishing ?? null,
      });
      return;
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: auth.merchantId! } });
    if (!merchant) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
    res.json({
      merchant: toMerchantJson(merchant),
      store,
      team_member: null,
      principal_type: "merchant",
      permissions: auth.permissions,
      publishing: store?.publishing ?? null,
    });
  })
);

app.post(
  "/api/auth/password",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId! } });
    if (!merchant) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");

    const { ok } = await verifyMerchantPassword(
      { password_hash: merchant.passwordHash, password_salt: merchant.passwordSalt, password_algo: merchant.passwordAlgo },
      currentPassword
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");

    const hash = await hashPasswordArgon2(newPassword);
    const current = req.cookies?.[sessionCookieName()];
    await prisma.$transaction([
      prisma.merchant.update({
        where: { id: merchant.id },
        data: { passwordHash: hash, passwordSalt: null, passwordAlgo: "argon2id" },
      }),
      ...(typeof current === "string" && current
        ? [
            prisma.session.deleteMany({
              where: { merchantId: merchant.id, NOT: { tokenHash: hashSessionToken(current) } },
            }),
          ]
        : [prisma.session.deleteMany({ where: { merchantId: merchant.id } })]),
    ]);
    res.json({ ok: true });
  })
);

// ---- email verification / password reset ----
app.post(
  "/api/auth/verify-email",
  authLimiter,
  validateBody(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const consumed = await consumeAuthToken({ token: req.body.token, type: "email_verification" });
    if (!consumed) {
      throw new ApiError(400, "VERIFICATION_INVALID", "This verification link is invalid, expired, or already used.");
    }
    const merchant = await prisma.merchant.update({
      where: { id: consumed.merchantId },
      data: { emailVerifiedAt: new Date() },
    });
    await writeAudit({
      storeId: merchant.storeId,
      merchantId: merchant.id,
      action: "account.email_verified",
      entity: "merchant",
      entityId: merchant.id,
      ip: req.ip,
    });
    res.json({ ok: true, email_verified: true });
  })
);

app.post(
  "/api/auth/verify-email/resend",
  emailLimiter,
  validateBody(emailOnlySchema),
  asyncHandler(async (req, res) => {
    // Public on purpose: when verification is mandatory, registration does not
    // grant a session, so an authenticated-only resend would strand the user.
    // The response is identical for unknown and verified addresses.
    const merchant = await prisma.merchant.findUnique({ where: { email: req.body.email } });
    if (!merchant) {
      res.json({ ok: true, already_verified: false, email_configured: env.email.configured, sent: false });
      return;
    }
    if (merchant.emailVerifiedAt) {
      res.json({ ok: true, already_verified: true, email_configured: env.email.configured, sent: false });
      return;
    }
    const verification = await issueVerification({ id: merchant.id, email: merchant.email });
    await writeAudit({
      storeId: merchant.storeId,
      merchantId: merchant.id,
      action: "account.verification_resent",
      entity: "merchant",
      entityId: merchant.id,
      metadata: { email_sent: verification.sent },
      ip: req.ip,
    });
    res.json({
      ok: true,
      already_verified: false,
      email_configured: env.email.configured,
      sent: verification.sent,
      ...(verification.debug_token ? { debug_token: verification.debug_token } : {}),
    });
  })
);

app.post(
  "/api/auth/forgot-password",
  emailLimiter,
  validateBody(emailOnlySchema),
  asyncHandler(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({ where: { email: req.body.email } });
    // Always answer identically so the endpoint cannot be used to discover
    // which email addresses have accounts.
    let debug: string | undefined;
    if (merchant) {
      const reset = await issuePasswordReset({ id: merchant.id, email: merchant.email });
      debug = reset.debug_token;
      await writeAudit({
        storeId: merchant.storeId,
        merchantId: merchant.id,
        action: "account.password_reset_requested",
        entity: "merchant",
        entityId: merchant.id,
        metadata: { email_sent: reset.sent },
        ip: req.ip,
      });
    }
    res.json({ ok: true, ...(debug ? { debug_token: debug } : {}) });
  })
);

app.post(
  "/api/auth/reset-password",
  authLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const consumed = await consumeAuthToken({ token: req.body.token, type: "password_reset" });
    if (!consumed) {
      throw new ApiError(400, "RESET_INVALID", "This reset link is invalid, expired, or already used.");
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: consumed.merchantId } });
    if (!merchant) throw new ApiError(400, "RESET_INVALID", "This reset link is no longer valid.");
    const hash = await hashPasswordArgon2(req.body.newPassword);
    await prisma.$transaction([
      prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          passwordHash: hash,
          passwordSalt: null,
          passwordAlgo: "argon2id",
          // Consuming a reset link also proves control of the mailbox.
          emailVerifiedAt: merchant.emailVerifiedAt ?? new Date(),
        },
      }),
      // Every existing session is revoked: a password reset is a recovery
      // action, so no device should keep access with the old credential.
      prisma.session.deleteMany({ where: { merchantId: merchant.id } }),
      prisma.authToken.updateMany({
        where: { merchantId: merchant.id, type: "password_reset", usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    await writeAudit({
      storeId: merchant.storeId,
      merchantId: merchant.id,
      action: "account.password_reset",
      entity: "merchant",
      entityId: merchant.id,
      ip: req.ip,
    });
    res.clearCookie(sessionCookieName(), { path: "/" });
    res.json({ ok: true });
  })
);

// ---- two-factor authentication ----
app.post(
  "/api/auth/2fa/setup",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  validateBody(twoFactorSetupSchema),
  asyncHandler(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId! } });
    if (!merchant) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
    const { ok } = await verifyMerchantPassword(
      { password_hash: merchant.passwordHash, password_salt: merchant.passwordSalt, password_algo: merchant.passwordAlgo },
      req.body.password
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Password is incorrect.");
    if (merchant.twoFactorEnabled) {
      throw new ApiError(409, "TWO_FACTOR_ALREADY_ENABLED", "Two-factor authentication is already enabled.");
    }

    const secret = generateTotpSecret();
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        twoFactorSecret: encryptSecret(secret),
        twoFactorEnabled: false,
        twoFactorRecoveryCodes: [] as Prisma.InputJsonValue,
      },
    });
    res.json({
      secret,
      otpauth_url: otpauthUrl({ secret, account: merchant.email }),
      issuer: "Sanad",
      account: merchant.email,
    });
  })
);

app.post(
  "/api/auth/2fa/enable",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  validateBody(twoFactorCodeSchema),
  asyncHandler(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId! } });
    if (!merchant) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
    if (merchant.twoFactorEnabled) {
      throw new ApiError(409, "TWO_FACTOR_ALREADY_ENABLED", "Two-factor authentication is already enabled.");
    }
    const secret = decryptSecret(merchant.twoFactorSecret);
    if (!secret) {
      throw new ApiError(409, "TWO_FACTOR_SETUP_REQUIRED", "Start two-factor setup before enabling it.");
    }
    if (!verifyTotp(secret, req.body.code)) {
      throw new ApiError(400, "INVALID_TWO_FACTOR_CODE", "The authenticator code is invalid. Check your clock and try again.");
    }

    const recoveryCodes = generateRecoveryCodes();
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode) as Prisma.InputJsonValue,
      },
    });
    await writeAudit({
      storeId: merchant.storeId,
      merchantId: merchant.id,
      action: "account.two_factor_enabled",
      entity: "merchant",
      entityId: merchant.id,
      ip: req.ip,
    });
    // Recovery codes are shown exactly once and never returned again.
    res.json({ ok: true, recovery_codes: recoveryCodes });
  })
);

app.post(
  "/api/auth/2fa/disable",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  validateBody(twoFactorDisableSchema),
  asyncHandler(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId! } });
    if (!merchant) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
    if (!merchant.twoFactorEnabled) {
      throw new ApiError(409, "TWO_FACTOR_NOT_ENABLED", "Two-factor authentication is not enabled.");
    }
    const { ok } = await verifyMerchantPassword(
      { password_hash: merchant.passwordHash, password_salt: merchant.passwordSalt, password_algo: merchant.passwordAlgo },
      req.body.password
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Password is incorrect.");
    const secondFactor = await verifySecondFactor({
      merchantId: merchant.id,
      totp: req.body.code,
      recoveryCode: req.body.code,
    });
    if (!secondFactor) {
      throw new ApiError(401, "INVALID_TWO_FACTOR_CODE", "The authentication code is invalid or has already been used.");
    }

    const current = req.cookies?.[sessionCookieName()];
    await prisma.$transaction([
      prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorRecoveryCodes: [] as Prisma.InputJsonValue,
        },
      }),
      ...(typeof current === "string" && current
        ? [
            prisma.session.deleteMany({
              where: { merchantId: merchant.id, NOT: { tokenHash: hashSessionToken(current) } },
            }),
          ]
        : [prisma.session.deleteMany({ where: { merchantId: merchant.id } })]),
    ]);
    await writeAudit({
      storeId: merchant.storeId,
      merchantId: merchant.id,
      action: "account.two_factor_disabled",
      entity: "merchant",
      entityId: merchant.id,
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);

// ---- session management ----
app.post(
  "/api/auth/sessions/revoke-others",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  asyncHandler(async (req, res) => {
    const current = req.cookies?.[sessionCookieName()];
    const result = await prisma.session.deleteMany({
      where: {
        merchantId: req.auth!.merchantId,
        ...(typeof current === "string" && current ? { NOT: { tokenHash: hashSessionToken(current) } } : {}),
      },
    });
    await writeAudit({
      storeId: req.auth!.storeId,
      ...auditActor(req.auth!),
      action: "account.sessions_revoked",
      entity: "merchant",
      entityId: req.auth!.actorId,
      metadata: { revoked: result.count },
      ip: req.ip,
    });
    res.json({ ok: true, revoked: result.count });
  })
);

// ---- stores ----
app.get(
  "/api/stores/:subdomain",
  validateParams(subdomainParamSchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { subdomain: req.params.subdomain } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    res.json({ store: publicStorefront(store) });
  })
);

app.get(
  "/api/stores",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    const stores = req.auth!.storeId ? await prisma.store.findMany({ where: { id: req.auth!.storeId } }) : [];
    res.json({ stores });
  })
);

// ---- account store settings (legacy path preserved) ----
app.get(
  "/api/account/store",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  asyncHandler(async (req, res) => {
    if (!req.auth!.storeId) throw new ApiError(404, "STORE_NOT_FOUND", "No store linked to this account.");
    const store = await prisma.store.findUnique({ where: { id: req.auth!.storeId } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    res.json({ store });
  })
);

app.patch(
  "/api/account/store",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  validateBody(storeUpdateSchema),
  asyncHandler(async (req, res) => {
    if (!req.auth!.storeId) throw new ApiError(404, "STORE_NOT_FOUND", "No store linked to this account.");
    const b = req.body;
    assertOwnerMayEditStore(b);
    if (b.onlinePaymentEnabled === true && !paymentService.configured) {
      throw new ApiError(
        409,
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
        "Online payments cannot be enabled until a payment gateway is configured."
      );
    }
    await ensureStoreDefaults(req.auth!.storeId, b.storeCurrency ?? "EGP");
    const store = await prisma.store
      .update({
        where: { id: req.auth!.storeId },
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
      })
      .catch(() => null);
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    res.json({ store });
  })
);

// ---- leads ----
app.post(
  "/api/leads",
  publicWriteLimiter,
  asyncHandler(attachAuth),
  validateBody(leadBodySchema),
  asyncHandler(async (req, res) => {
    const { type, payload } = req.body;
    const lead = await prisma.lead.create({
      data: {
        id: newId("lead_"),
        type: String(type),
        payload: (payload ?? {}) as Prisma.InputJsonValue,
        storeId: req.auth?.storeId ?? null,
      },
    });
    res.status(201).json({ ok: true, id: lead.id });
  })
);

app.get(
  "/api/leads",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    const rows = req.auth!.storeId
      ? await prisma.lead.findMany({
          where: { storeId: req.auth!.storeId },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];
    res.json({ leads: rows });
  })
);

// ---- domain routers ----
app.use("/api/admin", adminRouter);
app.use(teamAuthRouter);
app.use("/api/onboarding", onboardingRouter);
app.use(productsRouter);
app.use(categoriesRouter);
app.use(ordersRouter);
app.use(customersRouter);
app.use(walletRouter);
app.use(shippingRouter);
app.use(couponsRouter);
app.use(growthRouter);
app.use(contentRouter);
app.use(reviewsRouter);
app.use(loyaltyRouter);
app.use(dropshippingRouter);
app.use(assistantRouter);
app.use(dashboardRouter);
app.use(abandonedRouter);
app.use(reportsRouter);
app.use(settingsRouter);
app.use(supportRouter);
app.use(storefrontRouter);

// Responsive variants are generated from the validated original and cached by
// URL. The path is constrained inside STORAGE_DIR by responsiveMedia().
app.get("/uploads/*", asyncHandler(async (req, res, next) => {
  const width = Number(req.query.w);
  if (!Number.isFinite(width) || width < 160) return next();
  const key = decodeURIComponent(req.path.replace(/^\/uploads\//, ""));
  const image = await responsiveMedia(key, width);
  if (!image) return next();
  res.setHeader("Content-Type", "image/webp");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(image);
}));

// ---- uploaded media (local storage driver) ----
// Only inert raster images may be served. The extension allowlist plus
// nosniff, a sandboxing CSP and a cross-origin resource policy prevent an
// uploaded file from ever being interpreted as HTML/JS on the app origin.
const uploadsDir = path.resolve(process.cwd(), env.storageDir);
app.use(
  "/uploads",
  (req, res, next) => {
    const extension = path.extname(req.path).toLowerCase();
    if (!UPLOAD_EXTENSIONS.has(extension)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    next();
  },
  express.static(uploadsDir, {
    fallthrough: true,
    index: false,
    dotfiles: "deny",
    redirect: false,
    maxAge: "7d",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'none'; sandbox");
      res.setHeader("Cross-Origin-Resource-Policy", "same-site");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    },
  })
);

// ---- frontend build in production ----
const distDir = path.join(process.cwd(), "dist");
if (fs.existsSync(distDir)) {
  const indexFile = path.join(distDir, "index.html");
  let cachedIndexHtml = "";
  const readIndexHtml = () => {
    if (!cachedIndexHtml) cachedIndexHtml = fs.readFileSync(indexFile, "utf8");
    return cachedIndexHtml;
  };

  app.use(express.static(distDir, { index: false }));

  // Resolve the raw Host header before the SPA is served. Verified custom
  // domains receive the store boot metadata in a <meta> tag (not an inline
  // script, which the CSP would block). Unknown custom hosts never receive the
  // platform SPA, so host-header poisoning cannot open a random store.
  app.get(/^(?!\/api\/).*/, asyncHandler(async (req, res) => {
    const host = normalizeHost(req.headers.host);
    const wantsHtml = Boolean(req.accepts("html")) && !path.extname(req.path);
    if (!wantsHtml) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }

    if (isPlatformHost(host)) {
      const store = await resolveStoreForRequest(req);
      if (req.path.startsWith("/store/") && !store) {
        res.status(404).type("text/plain").send("Not found");
        return;
      }
      if (store) {
        const seo = await storefrontSeo(req, store);
        const tags = `<title>${escapeHtmlAttribute(seo.title)}</title><meta name="description" content="${escapeHtmlAttribute(seo.description)}"><meta property="og:title" content="${escapeHtmlAttribute(seo.title)}"><meta property="og:description" content="${escapeHtmlAttribute(seo.description)}"><link rel="canonical" href="${escapeHtmlAttribute(seo.canonical)}">${seo.noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}<script type="application/ld+json">${serializeForHtml(seo.jsonLd)}</script>`;
        let html = readIndexHtml();
        html = html.includes("</head>") ? html.replace("</head>", `${tags}</head>`) : `${tags}${html}`;
        res.status(seo.status).set("Cache-Control", seo.noindex ? "no-store" : "public, max-age=60").type("html").send(html);
        return;
      }
      res.sendFile(indexFile);
      return;
    }

    const resolved = await resolveCustomDomainHost(host);
    if (!resolved) {
      res.status(404).type("html").send(
        "<!doctype html><html lang=\"ar\" dir=\"rtl\"><meta charset=\"utf-8\"><title>المتجر غير متاح</title>" +
        "<body style=\"font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a\">" +
        "<main style=\"text-align:center;padding:32px\"><h1 style=\"font-size:20px\">المتجر غير متاح</h1>" +
        "<p style=\"color:#64748b\">تحقق من عنوان الموقع أو تواصل مع صاحب المتجر.</p></main></body></html>"
      );
      return;
    }

    const boot = {
      host,
      mode: "custom_domain" as const,
      custom_domain: true,
      canonical_url: resolved.canonicalUrl,
      tls_status: resolved.tlsStatus,
      store: {
        id: resolved.storeId,
        store_name: resolved.storeName,
        subdomain: resolved.subdomain,
        status: resolved.status,
        publish_status: resolved.publishStatus,
        canonical_url: resolved.canonicalUrl,
        tls_status: resolved.tlsStatus,
      },
    };
    const meta = `<meta name="sanad-site" content="${escapeHtmlAttribute(serializeForHtml(boot))}">`;
    const seo = await storefrontSeo(req, await prisma.store.findUniqueOrThrow({ where: { id: resolved.storeId } }));
    const canonical = `<title>${escapeHtmlAttribute(seo.title)}</title><meta name="description" content="${escapeHtmlAttribute(seo.description)}"><meta property="og:title" content="${escapeHtmlAttribute(seo.title)}"><meta property="og:description" content="${escapeHtmlAttribute(seo.description)}"><link rel="canonical" href="${escapeHtmlAttribute(seo.canonical)}">${seo.noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}<script type="application/ld+json">${serializeForHtml(seo.jsonLd)}</script>`;
    let html = readIndexHtml();
    html = html.includes("</head>") ? html.replace("</head>", `${meta}${canonical}</head>`) : `${meta}${canonical}${html}`;
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(html);
  }));
}

app.use("/api", notFoundHandler);
app.use(errorHandler);

/**
 * Wait for PostgreSQL instead of exiting on the first failed ping. Containers
 * and managed databases routinely report "the database system is starting up"
 * for a few seconds after boot; exiting here restarts the process and turns
 * every API request (including registration) into a gateway 502.
 */
async function waitForDatabase(attempts = 30, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await checkDb();
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      logger.warn({ err, attempt }, "database not ready yet, retrying");
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function boot() {
  await waitForDatabase();
  if (env.adminBootstrap) {
    const { admin, created } = await ensurePlatformAdmin({
      ...env.adminBootstrap,
      role: "super_admin",
    });
    if (created) {
      logger.info({ adminId: admin.id, email: admin.email }, "[sanad-backend] created bootstrap platform administrator");
    } else {
      logger.info(
        { adminId: admin.id, email: admin.email },
        "[sanad-backend] bootstrap platform administrator already exists; password and role unchanged (remove ADMIN_BOOTSTRAP_PASSWORD)"
      );
    }
  }
  startSessionCleanup();
  startRetentionSweep();
  const server = app.listen(env.port, "0.0.0.0", () => {
    logger.info(`[sanad-backend] listening on http://localhost:${env.port} (env=${env.nodeEnv})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`[sanad-backend] ${signal} received, shutting down`);
    server.close(() => {
      prisma
        .$disconnect()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  if (process.env.VITEST !== "true") {
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }
}

if (process.env.VITEST !== "true") {
  boot().catch((err) => {
    logger.error({ err }, "failed to boot");
    process.exit(1);
  });
}
