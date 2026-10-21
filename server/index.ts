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
  newSessionToken,
  hashSessionToken,
  SESSION_TTL_MS,
  sessionCookieName,
  sessionCookieOptions,
} from "./auth.js";
import { startSessionCleanup } from "./sessions.js";
import { ApiError, asyncHandler, errorHandler, notFoundHandler } from "./errors.js";
import {
  requireAuth,
  requireStoreOwnership,
  attachAuth,
  csrfOriginCheck,
  authLimiter,
  publicWriteLimiter,
} from "./middleware.js";
import {
  validateBody,
  validateParams,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  subdomainParamSchema,
  storeUpdateSchema,
  leadBodySchema,
} from "./validate.js";
import { ensureStoreDefaults, uniqueSubdomain, writeAudit } from "./services/account.js";
import { paymentService } from "./services/integrations.js";

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
  };
}

async function createSession(merchantId: string): Promise<string> {
  const token = newSessionToken();
  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      merchantId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
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
            // Kept active so the storefront and checkout are usable while the
            // merchant finishes onboarding. Publication is tracked separately.
            status: "active",
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

    const token = await createSession(merchantId);
    res.cookie(sessionCookieName(), token, sessionCookieOptions());
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    const merchant = (await prisma.merchant.findUnique({ where: { id: merchantId } })) as Merchant;
    await writeAudit({
      storeId,
      merchantId,
      action: "account.registered",
      entity: "merchant",
      entityId: merchantId,
      ip: req.ip,
    });
    res.status(201).json({
      merchant: toMerchantJson(merchant),
      store,
      next: store?.onboardingCompleted ? "/dashboard" : "/onboarding",
    });
  })
);

app.post(
  "/api/auth/login",
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
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
    const token = await createSession(merchant.id);
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
    const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId } });
    if (!merchant) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
    const store = merchant.storeId ? await prisma.store.findUnique({ where: { id: merchant.storeId } }) : null;
    res.json({ merchant: toMerchantJson(merchant), store });
  })
);

app.post(
  "/api/auth/password",
  asyncHandler(requireAuth),
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId } });
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
  validateBody(storeUpdateSchema),
  asyncHandler(async (req, res) => {
    if (!req.auth!.storeId) throw new ApiError(404, "STORE_NOT_FOUND", "No store linked to this account.");
    const b = req.body;
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

app.get(
  "/api/admin/leads",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId } });
    if (!merchant || merchant.role !== "admin") {
      throw new ApiError(403, "FORBIDDEN", "Admin access required.");
    }
    const rows = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ leads: rows });
  })
);

// ---- domain routers ----
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
app.use(storefrontRouter);

// ---- uploaded media (local storage driver) ----
const uploadsDir = path.resolve(process.cwd(), env.storageDir);
app.use("/uploads", express.static(uploadsDir, { fallthrough: true, maxAge: "7d" }));

// ---- frontend build in production ----
const distDir = path.join(process.cwd(), "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
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
  startSessionCleanup();
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
