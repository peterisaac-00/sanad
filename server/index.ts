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
  attachAuth,
  csrfOriginCheck,
  authLimiter,
  publicWriteLimiter,
} from "./middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  subdomainParamSchema,
  paginationQuerySchema,
  productBodySchema,
  productUpdateSchema,
  productIdParamSchema,
  merchantOrderBodySchema,
  orderListQuerySchema,
  orderIdParamSchema,
  orderStatusSchema,
  ORDER_TRANSITIONS,
  checkoutBodySchema,
  storeUpdateSchema,
  leadBodySchema,
} from "./validate.js";

export const app = express();

app.set("trust proxy", env.trustProxy);
app.disable("x-powered-by");

app.use(helmet());
// Strict CORS applies to the API only: the served frontend bundle and its
// assets are same-origin and must never be gated by the API allowlist.
app.use(
  "/api",
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
  validateQuery(paginationQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search } = req.query as unknown as { page: number; pageSize: number; search?: string };
    const where: Prisma.ProductWhereInput = { storeId: req.ownedStore!.id };
    if (search) {
      where.OR = [
        { sku: { contains: search, mode: "insensitive" } },
        { nameEn: { contains: search, mode: "insensitive" } },
        { nameAr: { contains: search } },
      ];
    }
    const [total, rows] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ products: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  })
);

app.get(
  "/api/stores/:subdomain/products/:id",
  asyncHandler(requireAuth),
  validateParams(productIdParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, storeId: req.ownedStore!.id },
    });
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    res.json({ product });
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

app.put(
  "/api/stores/:subdomain/products/:id",
  asyncHandler(requireAuth),
  validateParams(productIdParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, storeId: req.ownedStore!.id },
    });
    if (!existing) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    const { sku, name_ar, name_en, price_egp, price_sar, stock } = req.body;
    try {
      const product = await prisma.product.update({
        where: { id: existing.id },
        data: {
          ...(sku !== undefined ? { sku } : {}),
          ...(name_ar !== undefined ? { nameAr: name_ar } : {}),
          ...(name_en !== undefined ? { nameEn: name_en } : {}),
          ...(price_egp !== undefined ? { priceEgp: price_egp } : {}),
          ...(price_sar !== undefined ? { priceSar: price_sar } : {}),
          ...(stock !== undefined ? { stock } : {}),
        },
      });
      res.json({ product });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "SKU_TAKEN", "A product with this SKU already exists in your store.");
      }
      throw e;
    }
  })
);

app.delete(
  "/api/stores/:subdomain/products/:id",
  asyncHandler(requireAuth),
  validateParams(productIdParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, storeId: req.ownedStore!.id },
    });
    if (!existing) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    await prisma.product.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);

// ---- orders (owner only; public checkout below) ----
app.get(
  "/api/stores/:subdomain/orders",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateQuery(orderListQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, status, from, to } = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: string;
      from?: string;
      to?: string;
    };
    const where: Prisma.OrderWhereInput = { storeId: req.ownedStore!.id };
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to);
    }
    const [total, rows] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true },
      }),
    ]);
    res.json({ orders: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  })
);

app.get(
  "/api/stores/:subdomain/orders/:id",
  asyncHandler(requireAuth),
  validateParams(orderIdParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: req.ownedStore!.id },
      include: { items: true },
    });
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    res.json({ order });
  })
);

app.patch(
  "/api/stores/:subdomain/orders/:id/status",
  asyncHandler(requireAuth),
  validateParams(orderIdParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(orderStatusSchema),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: req.ownedStore!.id },
    });
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    const allowed = ORDER_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(req.body.status)) {
      throw new ApiError(
        422,
        "INVALID_TRANSITION",
        `Cannot move order from '${order.status}' to '${req.body.status}'. Allowed: ${allowed.join(", ") || "none"}.`
      );
    }
    const updated = await prisma.order.update({ where: { id: order.id }, data: { status: req.body.status } });
    res.json({ order: updated });
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

// ---- public checkout (no auth; rate-limited; prices computed server-side) ----
// Shoppers submit SKUs + quantities only. Totals, line items, and stock
// moves are derived from the merchant's own catalog — the client can never
// set prices or totals.
app.post(
  "/api/stores/:subdomain/checkout",
  publicWriteLimiter,
  validateParams(subdomainParamSchema),
  validateBody(checkoutBodySchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { subdomain: req.params.subdomain } });
    if (!store || store.status !== "active") throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const { customer_name, city, payment_method, courier, items } = req.body as {
      customer_name: string;
      city: string;
      payment_method: string;
      courier: string;
      items: { sku: string; qty: number }[];
    };

    const skus = [...new Set(items.map((i) => i.sku))];
    const catalog = await prisma.product.findMany({ where: { storeId: store.id, sku: { in: skus } } });
    const bySku = new Map(catalog.map((p) => [p.sku, p]));
    const missing = skus.filter((s) => !bySku.has(s));
    if (missing.length > 0) {
      throw new ApiError(400, "UNKNOWN_SKU", `Unknown product(s): ${missing.join(", ")}.`, { missing });
    }
    const short = items.filter((i) => (bySku.get(i.sku)?.stock ?? 0) < i.qty).map((i) => i.sku);
    if (short.length > 0) {
      throw new ApiError(409, "INSUFFICIENT_STOCK", `Not enough stock for: ${short.join(", ")}.`, { short });
    }

    const lines = items.map((i) => {
      const p = bySku.get(i.sku)!;
      return { productId: p.id, sku: p.sku, name: p.nameEn || p.nameAr || p.sku, qty: i.qty, unitPriceEgp: p.priceEgp };
    });
    const total = lines.reduce((s, l) => s + l.qty * l.unitPriceEgp, 0);

    const base = await prisma.order.count({ where: { storeId: store.id } });
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = attempt === 0 ? `SND-${4825 + base}` : `SND-${Date.now().toString(36).toUpperCase()}${attempt}`;
      try {
        const order = await prisma.$transaction(async (tx) => {
          const created = await tx.order.create({
            data: {
              id,
              storeId: store.id,
              customerName: customer_name,
              city,
              itemsSummary: lines.map((l) => `${l.name} ×${l.qty}`).join(" + "),
              amountText: `${total} ${store.currency}`,
              amountEgp: total,
              paymentMethod: payment_method,
              status: "pending",
              courier,
              items: {
                create: lines.map((l) => ({
                  id: newId("item_"),
                  productId: l.productId,
                  sku: l.sku,
                  name: l.name,
                  qty: l.qty,
                  unitPriceEgp: l.unitPriceEgp,
                })),
              },
            },
            include: { items: true },
          });
          for (const l of lines) {
            await tx.product.update({ where: { id: l.productId }, data: { stock: { decrement: l.qty } } });
          }
          return created;
        });
        res.status(201).json({ order });
        return;
      } catch (e: unknown) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    throw new ApiError(409, "ORDER_CONFLICT", "Could not place the order, please retry.");
  })
);

// ---- store settings (owner only; subdomain is immutable) ----
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
    const { storeName, phone, countryCode, storeCurrency, selectedPlan } = req.body as {
      storeName?: string;
      phone?: string;
      countryCode?: string;
      storeCurrency?: string;
      selectedPlan?: "monthly" | "annual";
    };
    const store = await prisma.store.update({
      where: { id: req.auth!.storeId },
      data: {
        ...(storeName !== undefined ? { storeName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(countryCode !== undefined ? { countryCode } : {}),
        ...(storeCurrency !== undefined ? { currency: storeCurrency } : {}),
        ...(selectedPlan !== undefined ? { plan: selectedPlan } : {}),
      },
    }).catch(() => null);
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    res.json({ store });
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

// Authenticated listing scoped to the merchant's own store.
// With a matching ADMIN_TOKEN header, all leads are returned.
app.get(
  "/api/leads",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => {
    if (env.adminToken) {
      if (req.headers["x-admin-token"] !== env.adminToken) {
        throw new ApiError(403, "FORBIDDEN", "Admin token required.");
      }
      const rows = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
      res.json({ leads: rows });
      return;
    }
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
