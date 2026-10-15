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
  newSessionToken,
  hashSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  sessionCookieOptions,
} from "./auth.js";
import { ApiError, asyncHandler, errorHandler, notFoundHandler } from "./errors.js";
import {
  requireAuth,
  requireStoreOwnership,
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
  productBodySchema,
  merchantOrderBodySchema,
  leadBodySchema,
} from "./validate.js";

export const app = express();

app.set("trust proxy", env.trustProxy);
app.disable("x-powered-by");

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / non-browser requests (no Origin header) are allowed.
      if (!origin) return cb(null, true);
      if (env.corsOrigins.includes(origin.replace(/\/$/, ""))) return cb(null, true);
      return cb(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(httpLogger);
app.use(csrfOriginCheck);

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

// ---- health (public; DB connectivity check lands in Phase 4) ----
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "sanad-commerce-backend", time: nowIso() });
});

// ---- auth (public: register, login) ----
app.post(
  "/api/auth/register",
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name, phone, storeName, subdomain, countryCode, storeCurrency, selectedPlan } = req.body;

    const emailTaken = await prisma.merchant.findUnique({ where: { email }, select: { id: true } });
    if (emailTaken) throw new ApiError(409, "EMAIL_TAKEN", "This email is already registered.");
    const subTaken = await prisma.store.findUnique({ where: { subdomain }, select: { id: true } });
    if (subTaken) throw new ApiError(409, "SUBDOMAIN_TAKEN", "This store address is already taken.");

    const storeId = newId("store_");
    const merchantId = newId("merch_");
    const passwordHash = await hashPasswordArgon2(password);

    // Atomic store + merchant creation: a store can never be orphaned or hijacked by handle-claiming.
    try {
      await prisma.$transaction([
        prisma.store.create({
          data: {
            id: storeId,
            storeName,
            subdomain,
            phone,
            countryCode,
            currency: storeCurrency,
            plan: selectedPlan,
            status: "active",
          },
        }),
        prisma.merchant.create({
          data: {
            id: merchantId,
            storeId,
            storeHandle: subdomain,
            email,
            passwordHash,
            passwordSalt: null,
            passwordAlgo: "argon2id",
            name,
            phone,
          },
        }),
      ]);
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "CONFLICT", "Email or store address is already taken.");
      }
      throw e;
    }

    const token = await createSession(merchantId);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    const merchant = (await prisma.merchant.findUnique({ where: { id: merchantId } })) as Merchant;
    res.status(201).json({ merchant: toMerchantJson(merchant), store });
  })
);

app.post(
  "/api/auth/login",
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const merchant = await prisma.merchant.findUnique({ where: { email } });
    // Generic message: never reveal whether the email exists.
    if (!merchant) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");

    const { ok, needsRehash } = await verifyMerchantPassword(
      { password_hash: merchant.passwordHash, password_salt: merchant.passwordSalt, password_algo: merchant.passwordAlgo },
      password
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");

    // Transparent upgrade of legacy scrypt hashes to Argon2id.
    if (needsRehash) {
      const upgraded = await hashPasswordArgon2(password);
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { passwordHash: upgraded, passwordSalt: null, passwordAlgo: "argon2id" },
      });
    }

    // Session rotation: every login issues a fresh token.
    const token = await createSession(merchant.id);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    const store = merchant.storeId ? await prisma.store.findUnique({ where: { id: merchant.storeId } }) : null;
    res.json({ merchant: toMerchantJson(merchant), store });
  })
);

app.post("/api/auth/logout", asyncHandler(requireAuth), async (req, res) => {
  const token = req.cookies?.sanad_session;
  if (typeof token === "string" && token) {
    await prisma.session.delete({ where: { tokenHash: hashSessionToken(token) } }).catch(() => undefined);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

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
    const current = req.cookies?.sanad_session;
    await prisma.$transaction([
      prisma.merchant.update({
        where: { id: merchant.id },
        data: { passwordHash: hash, passwordSalt: null, passwordAlgo: "argon2id" },
      }),
      // Invalidate all other sessions (logout other devices), keep the current one.
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
// Public storefront lookup (safe fields only). Everything else is authenticated.
app.get("/api/stores/:subdomain", validateParams(subdomainParamSchema), asyncHandler(async (req, res) => {
  const store = await prisma.store.findUnique({ where: { subdomain: req.params.subdomain } });
  if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  res.json({ store: publicStorefront(store) });
}));

// Authenticated merchant's own store(s) only — never a global listing.
app.get(
  "/api/stores",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    const stores = req.auth!.storeId ? await prisma.store.findMany({ where: { id: req.auth!.storeId } }) : [];
    res.json({ stores });
  })
);

// ---- products (owner only) ----
app.get(
  "/api/stores/:subdomain/products",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const rows = await prisma.product.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ products: rows });
  })
);

app.post(
  "/api/stores/:subdomain/products",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(productBodySchema),
  asyncHandler(async (req, res) => {
    const { sku, name_ar, name_en, price_egp, price_sar, stock } = req.body;
    try {
      const product = await prisma.product.create({
        data: {
          id: newId("prod_"),
          storeId: req.ownedStore!.id,
          sku,
          nameAr: name_ar,
          nameEn: name_en,
          priceEgp: price_egp,
          priceSar: price_sar,
          stock,
        },
      });
      res.status(201).json({ product });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "SKU_TAKEN", "A product with this SKU already exists in your store.");
      }
      throw e;
    }
  })
);

// ---- orders (owner only; public checkout arrives in Phase 3) ----
app.get(
  "/api/stores/:subdomain/orders",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const rows = await prisma.order.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ orders: rows });
  })
);

app.post(
  "/api/stores/:subdomain/orders",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(merchantOrderBodySchema),
  asyncHandler(async (req, res) => {
    const { customer_name, city, items_summary, amount_text, amount_egp, payment_method, status, courier } = req.body;
    const count = await prisma.order.count({ where: { storeId: req.ownedStore!.id } });
    const id = `SND-${4825 + count}`;
    try {
      const order = await prisma.order.create({
        data: {
          id,
          storeId: req.ownedStore!.id,
          customerName: customer_name,
          city,
          itemsSummary: items_summary,
          amountText: amount_text,
          amountEgp: amount_egp,
          paymentMethod: payment_method,
          status,
          courier,
        },
      });
      res.status(201).json({ order });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "ORDER_CONFLICT", "Order number collision, please retry.");
      }
      throw e;
    }
  })
);

// ---- dashboard summary (owner only, computed from real data) ----
app.get(
  "/api/stores/:subdomain/summary",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.ownedStore!.id } });
    const orders = await prisma.order.findMany({ where: { storeId: req.ownedStore!.id } });
    const totalSales = orders.reduce((s, o) => s + (Number(o.amountEgp) || 0), 0);
    const delivered = orders.filter((o) => o.status === "delivered").length;
    res.json({
      store,
      kpis: {
        total_orders: orders.length,
        delivered_orders: delivered,
        total_sales_egp: totalSales,
        avg_order_egp: orders.length ? Math.round(totalSales / orders.length) : 0,
        cod_share: "65%+",
        commission: "0%",
      },
      recent_orders: orders.slice(-5).reverse(),
    });
  })
);

// ---- leads ----
app.post("/api/leads", publicWriteLimiter, validateBody(leadBodySchema), asyncHandler(async (req, res) => {
  const { type, payload } = req.body;
  const lead = await prisma.lead.create({
    data: { id: newId("lead_"), type: String(type), payload: (payload ?? {}) as Prisma.InputJsonValue },
  });
  res.status(201).json({ ok: true, id: lead.id });
}));

// Authenticated listing. When ADMIN_TOKEN is set, the admin header is also required.
app.get(
  "/api/leads",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    if (env.adminToken && req.headers["x-admin-token"] !== env.adminToken) {
      throw new ApiError(403, "FORBIDDEN", "Admin token required.");
    }
    const rows = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ leads: rows });
  })
);

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

async function boot() {
  // No seeding on boot. Demo data comes only from `npm run db:seed` (DEMO_MODE-gated).
  await checkDb();
  app.listen(env.port, "0.0.0.0", () => {
    logger.info(`[sanad-backend] listening on http://localhost:${env.port} (env=${env.nodeEnv})`);
  });
}

if (process.env.VITEST !== "true") {
  boot().catch((err) => {
    logger.error({ err }, "failed to boot");
    process.exit(1);
  });
}
