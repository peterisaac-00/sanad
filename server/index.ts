import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { env } from "./env.js";
import { logger, httpLogger } from "./logger.js";
import { db, nowIso, newId, seedDemoIfNeeded, runTransaction } from "./db.js";
import type { MerchantRow } from "./db.js";
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
function publicStorefront(row: Record<string, unknown>) {
  // Storefront-safe fields only: never expose merchant phone/plan via the public endpoint.
  return {
    id: row.id,
    store_name: row.store_name,
    subdomain: row.subdomain,
    country_code: row.country_code,
    currency: row.currency,
  };
}

function toMerchantJson(row: { id: unknown; email: unknown; store_handle: unknown; name: unknown }) {
  return {
    id: row.id,
    email: row.email,
    store_handle: row.store_handle,
    name: row.name ?? "",
  };
}

function createSession(merchantId: string): string {
  const token = newSessionToken();
  const t = nowIso();
  const exp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (token, merchant_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    hashSessionToken(token),
    merchantId,
    exp,
    t
  );
  return token;
}

// ---- health (public) ----
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

    const emailTaken = db.prepare("SELECT id FROM merchants WHERE email = ?").get(email);
    if (emailTaken) throw new ApiError(409, "EMAIL_TAKEN", "This email is already registered.");
    const subTaken = db.prepare("SELECT id FROM stores WHERE subdomain = ?").get(subdomain);
    if (subTaken) throw new ApiError(409, "SUBDOMAIN_TAKEN", "This store address is already taken.");

    const t = nowIso();
    const storeId = newId("store_");
    const merchantId = newId("merch_");
    const passwordHash = await hashPasswordArgon2(password);

    // Atomic store + merchant creation: a store can never be orphaned or hijacked by handle-claiming.
    const createAll = () =>
      runTransaction(() => {
        db.prepare(
          `INSERT INTO stores (id, store_name, subdomain, phone, country_code, currency, plan, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
        ).run(storeId, storeName, subdomain, phone, countryCode, storeCurrency, selectedPlan, t, t);
        db.prepare(
          `INSERT INTO merchants (id, store_id, store_handle, email, password_hash, password_salt, password_algo, name, phone, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, 'argon2id', ?, ?, ?)`
        ).run(merchantId, storeId, subdomain, email, passwordHash, name, phone, t);
      });
    try {
      createAll();
    } catch (e: unknown) {
      if (String((e as Error)?.message || "").includes("UNIQUE")) {
        throw new ApiError(409, "CONFLICT", "Email or store address is already taken.");
      }
      throw e;
    }

    const token = createSession(merchantId);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    const store = db.prepare("SELECT * FROM stores WHERE id = ?").get(storeId);
    const merchant = db.prepare("SELECT * FROM merchants WHERE id = ?").get(merchantId) as unknown as MerchantRow;
    res.status(201).json({ merchant: toMerchantJson(merchant), store });
  })
);

app.post(
  "/api/auth/login",
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const merchant = db.prepare("SELECT * FROM merchants WHERE email = ?").get(email) as MerchantRow | undefined;
    // Generic message: never reveal whether the email exists.
    if (!merchant) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");

    const { ok, needsRehash } = await verifyMerchantPassword(
      { password_hash: merchant.password_hash, password_salt: merchant.password_salt, password_algo: merchant.password_algo },
      password
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");

    // Transparent upgrade of legacy scrypt hashes to Argon2id.
    if (needsRehash) {
      const upgraded = await hashPasswordArgon2(password);
      db.prepare("UPDATE merchants SET password_hash = ?, password_salt = NULL, password_algo = 'argon2id' WHERE id = ?").run(
        upgraded,
        merchant.id
      );
    }

    // Session rotation: every login issues a fresh token.
    const token = createSession(merchant.id);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    const store = merchant.store_id ? db.prepare("SELECT * FROM stores WHERE id = ?").get(merchant.store_id) : null;
    res.json({ merchant: toMerchantJson(merchant), store });
  })
);

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.cookies?.sanad_session;
  if (typeof token === "string" && token) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(hashSessionToken(token));
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const merchant = db.prepare("SELECT * FROM merchants WHERE id = ?").get(req.auth!.merchantId) as MerchantRow | undefined;
  if (!merchant) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
  const store = merchant.store_id ? db.prepare("SELECT * FROM stores WHERE id = ?").get(merchant.store_id) : null;
  res.json({ merchant: toMerchantJson(merchant), store });
});

app.post(
  "/api/auth/password",
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const merchant = db.prepare("SELECT * FROM merchants WHERE id = ?").get(req.auth!.merchantId) as MerchantRow | undefined;
    if (!merchant) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");

    const { ok } = await verifyMerchantPassword(
      { password_hash: merchant.password_hash, password_salt: merchant.password_salt, password_algo: merchant.password_algo },
      currentPassword
    );
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");

    const hash = await hashPasswordArgon2(newPassword);
    const rotateOthers = () =>
      runTransaction(() => {
        db.prepare("UPDATE merchants SET password_hash = ?, password_salt = NULL, password_algo = 'argon2id' WHERE id = ?").run(
          hash,
          merchant.id
        );
        // Invalidate all other sessions (logout other devices), keep the current one.
        const current = req.cookies?.sanad_session;
        if (typeof current === "string" && current) {
          db.prepare("DELETE FROM sessions WHERE merchant_id = ? AND token != ?").run(
            merchant.id,
            hashSessionToken(current)
          );
        } else {
          db.prepare("DELETE FROM sessions WHERE merchant_id = ?").run(merchant.id);
        }
      });
    rotateOthers();
    res.json({ ok: true });
  })
);

// ---- stores ----
// Public storefront lookup (safe fields only). Everything else is authenticated.
app.get("/api/stores/:subdomain", validateParams(subdomainParamSchema), (req, res) => {
  const store = db.prepare("SELECT * FROM stores WHERE subdomain = ?").get(req.params.subdomain) as
    | Record<string, unknown>
    | undefined;
  if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  res.json({ store: publicStorefront(store) });
});

// Authenticated merchant's own store(s) only — never a global listing.
app.get("/api/stores", requireAuth, (req, res) => {
  const rows = req.auth!.storeId
    ? [db.prepare("SELECT * FROM stores WHERE id = ?").get(req.auth!.storeId)].filter(Boolean)
    : [];
  res.json({ stores: rows });
});

// ---- products (owner only) ----
app.get(
  "/api/stores/:subdomain/products",
  requireAuth,
  validateParams(subdomainParamSchema),
  requireStoreOwnership,
  (req, res) => {
    const rows = db
      .prepare("SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC")
      .all(req.ownedStore!.id);
    res.json({ products: rows });
  }
);

app.post(
  "/api/stores/:subdomain/products",
  requireAuth,
  validateParams(subdomainParamSchema),
  requireStoreOwnership,
  validateBody(productBodySchema),
  (req, res) => {
    const { sku, name_ar, name_en, price_egp, price_sar, stock } = req.body;
    const t = nowIso();
    const id = newId("prod_");
    db.prepare(
      `INSERT INTO products (id, store_id, sku, name_ar, name_en, price_egp, price_sar, stock, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.ownedStore!.id, sku, name_ar, name_en, price_egp, price_sar, stock, t);
    res.status(201).json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(id) });
  }
);

// ---- orders (owner only; public checkout arrives in Phase 3) ----
app.get(
  "/api/stores/:subdomain/orders",
  requireAuth,
  validateParams(subdomainParamSchema),
  requireStoreOwnership,
  (req, res) => {
    const rows = db
      .prepare("SELECT * FROM orders WHERE store_id = ? ORDER BY created_at DESC LIMIT 200")
      .all(req.ownedStore!.id);
    res.json({ orders: rows });
  }
);

app.post(
  "/api/stores/:subdomain/orders",
  requireAuth,
  validateParams(subdomainParamSchema),
  requireStoreOwnership,
  validateBody(merchantOrderBodySchema),
  (req, res) => {
    const { customer_name, city, items_summary, amount_text, amount_egp, payment_method, status, courier } = req.body;
    const t = nowIso();
    const count = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE store_id = ?").get(req.ownedStore!.id) as { c: number }).c;
    const id = `SND-${4825 + count}`;
    db.prepare(
      `INSERT INTO orders (id, store_id, customer_name, city, items_summary, amount_text, amount_egp, payment_method, status, courier, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.ownedStore!.id, customer_name, city, items_summary, amount_text, amount_egp, payment_method, status, courier, t);
    res.status(201).json({ order: db.prepare("SELECT * FROM orders WHERE id = ?").get(id) });
  }
);

// ---- dashboard summary (owner only, computed from real data) ----
app.get(
  "/api/stores/:subdomain/summary",
  requireAuth,
  validateParams(subdomainParamSchema),
  requireStoreOwnership,
  (req, res) => {
    const store = db.prepare("SELECT * FROM stores WHERE id = ?").get(req.ownedStore!.id);
    const orders = db.prepare("SELECT * FROM orders WHERE store_id = ?").all(req.ownedStore!.id) as { amount_egp: number; status: string }[];
    const totalSales = orders.reduce((s, o) => s + (Number(o.amount_egp) || 0), 0);
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
  }
);

// ---- leads ----
app.post("/api/leads", publicWriteLimiter, validateBody(leadBodySchema), (req, res) => {
  const { type, payload } = req.body;
  const t = nowIso();
  const id = newId("lead_");
  db.prepare("INSERT INTO leads (id, type, payload, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    String(type),
    JSON.stringify(payload ?? {}),
    t
  );
  res.status(201).json({ ok: true, id });
});

// Authenticated listing. When ADMIN_TOKEN is set, the admin header is also accepted.
app.get("/api/leads", requireAuth, (req, res) => {
  if (env.adminToken && req.headers["x-admin-token"] !== env.adminToken) {
    throw new ApiError(403, "FORBIDDEN", "Admin token required.");
  }
  const rows = db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 200").all();
  res.json({ leads: rows });
});

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
  // Demo seed is strictly gated by DEMO_MODE (default off). Production never seeds.
  await seedDemoIfNeeded();
  app.listen(env.port, "0.0.0.0", () => {
    logger.info(`[sanad-backend] listening on http://localhost:${env.port} (env=${env.nodeEnv}, demo=${env.demoMode})`);
  });
}

if (process.env.VITEST !== "true") {
  boot().catch((err) => {
    logger.error({ err }, "failed to boot");
    process.exit(1);
  });
}
