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

/**
 * Allocate the next per-store order number atomically. The row lock on the
 * store serializes concurrent checkouts, so numbers are unique per store
 * (displayed as SND-{n}). May skip on aborted checkouts.
 */
async function allocateOrderNumber(storeId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ nextOrderNumber: number }[]>`
    UPDATE "stores" SET "next_order_number" = "next_order_number" + 1
    WHERE "id" = ${storeId} RETURNING "next_order_number" AS "nextOrderNumber"`;
  if (rows.length !== 1 || typeof rows[0].nextOrderNumber !== "number") {
    throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  }
  return rows[0].nextOrderNumber;
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
    const { email, password, name, phone, storeName, subdomain, countryCode, storeCurrency } = req.body;

    const emailTaken = await prisma.merchant.findUnique({ where: { email }, select: { id: true } });
    if (emailTaken) throw new ApiError(409, "EMAIL_TAKEN", "This email is already registered.");
    const subTaken = await prisma.store.findUnique({ where: { subdomain }, select: { id: true } });
    if (subTaken) throw new ApiError(409, "SUBDOMAIN_TAKEN", "This store address is already taken.");

    const storeId = newId("store_");
    const merchantId = newId("merch_");
    const passwordHash = await hashPasswordArgon2(password);

    // Atomic store + merchant creation: a store can never be orphaned or hijacked by handle-claiming.
    // The subscription plan is server-assigned (billing lives outside the app).
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
            plan: "annual",
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
    const target = req.body.status as string;
    const current = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: req.ownedStore!.id },
      include: { items: true },
    });
    if (!current) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    const allowed = ORDER_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(target)) {
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        `Cannot move order from '${current.status}' to '${target}'. Allowed: ${allowed.join(", ") || "none"}.`
      );
    }
    // Atomic write: only succeeds if the status is still what we validated.
    // A concurrent transition wins the race; losers get 409, never a lost update.
    const updated = await prisma.$transaction(async (tx) => {
      const wrote = await tx.order.updateMany({
        where: { id: current.id, storeId: current.storeId, status: current.status },
        data: { status: target },
      });
      if (wrote.count !== 1) {
        throw new ApiError(409, "ORDER_CONFLICT", "Order changed concurrently, please retry.");
      }
      // Restore reserved stock exactly once when entering a terminal
      // no-fulfillment state. The flag makes retries/double requests safe.
      if ((target === "cancelled" || target === "returned") && !current.stockRestored) {
        for (const item of current.items) {
          if (!item.productId) continue;
          await tx.product
            .update({ where: { id: item.productId }, data: { stock: { increment: item.qty } } })
            .catch(() => null);
        }
        await tx.order.update({ where: { id: current.id }, data: { stockRestored: true } });
      }
      return tx.order.findUnique({ where: { id: current.id }, include: { items: true } });
    });
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
    const { customer_name, customer_phone, address, city, items_summary, amount_text, amount_egp, payment_method, status, courier } = req.body;
    const orderNumber = await allocateOrderNumber(req.ownedStore!.id);
    try {
      const order = await prisma.order.create({
        data: {
          id: newId("ord_"),
          storeId: req.ownedStore!.id,
          orderNumber,
          customerName: customer_name,
          customerPhone: customer_phone,
          address,
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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
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
    const { customer_name, customer_phone, address, city, payment_method, courier, items } = req.body as {
      customer_name: string;
      customer_phone: string;
      address: string;
      city: string;
      payment_method: string;
      courier: string;
      items: { sku: string; qty: number }[];
    };

    // Merge duplicate SKUs first (summed qty), so stock checks and totals
    // can never be split across lines to oversell.
    const merged = new Map<string, number>();
    for (const i of items) merged.set(i.sku, (merged.get(i.sku) ?? 0) + i.qty);
    const mergedItems = [...merged.entries()].map(([sku, qty]) => ({ sku, qty }));

    const skus = mergedItems.map((i) => i.sku);
    const catalog = await prisma.product.findMany({ where: { storeId: store.id, sku: { in: skus } } });
    const bySku = new Map(catalog.map((p) => [p.sku, p]));
    const missing = skus.filter((s) => !bySku.has(s));
    if (missing.length > 0) {
      throw new ApiError(400, "UNKNOWN_SKU", `Unknown product(s): ${missing.join(", ")}.`, { missing });
    }
    // Fast-path check only; the guarded decrement inside the transaction is authoritative.
    const short = mergedItems.filter((i) => (bySku.get(i.sku)?.stock ?? 0) < i.qty).map((i) => i.sku);
    if (short.length > 0) {
      throw new ApiError(409, "INSUFFICIENT_STOCK", `Not enough stock for: ${short.join(", ")}.`, { short });
    }

    const lines = mergedItems.map((i) => {
      const p = bySku.get(i.sku)!;
      // Currency rule: checkout charges the price column matching the
      // store's currency. Products without a positive price there are
      // rejected; other currencies are unsupported at checkout.
      const priceColumn = store.currency === "EGP" ? "priceEgp" : store.currency === "SAR" ? "priceSar" : null;
      if (!priceColumn) {
        throw new ApiError(
          400,
          "CHECKOUT_CURRENCY_UNSUPPORTED",
          `Checkout supports EGP and SAR priced catalogs; this store uses ${store.currency}.`
        );
      }
      const unit = p[priceColumn];
      if (!(unit > 0)) {
        throw new ApiError(400, "PRODUCT_NOT_PRICED", `Product ${p.sku} has no ${store.currency} price.`, {
          sku: p.sku,
        });
      }
      return { productId: p.id, sku: p.sku, name: p.nameEn || p.nameAr || p.sku, qty: i.qty, unitPrice: unit };
    });
    const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

    const orderNumber = await allocateOrderNumber(store.id);
    try {
      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            id: newId("ord_"),
            storeId: store.id,
            orderNumber,
            customerName: customer_name,
            customerPhone: customer_phone,
            address,
            city,
              itemsSummary: lines.map((l) => `${l.name} ×${l.qty}`).join(" + "),
              amountText: `${total} ${store.currency}`,
              // Legacy column names: amountEgp / unitPriceEgp hold the total
              // denominated in the STORE's currency (EGP or SAR per the rule above).
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
                  unitPriceEgp: l.unitPrice,
                })),
              },
            },
            include: { items: true },
          });
          for (const l of lines) {
            // Guarded decrement: only succeeds when enough stock remains at
            // write time. Concurrent checkouts serialize here; losers abort
            // with 409 and the whole transaction rolls back.
            const moved = await tx.product.updateMany({
              where: { id: l.productId, storeId: store.id, stock: { gte: l.qty } },
              data: { stock: { decrement: l.qty } },
            });
            if (moved.count !== 1) {
              throw new ApiError(409, "INSUFFICIENT_STOCK", `Not enough stock for: ${l.sku}.`, { short: [l.sku] });
            }
          }
          return created;
        });
        res.status(201).json({ order });
      } catch (e: unknown) {
        if (e instanceof ApiError) throw e;
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new ApiError(409, "ORDER_CONFLICT", "Order number collision, please retry.");
        }
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
          throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
        }
        throw e;
      }
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
    // NOTE: plan is intentionally not writable here (server-assigned billing).
    const { storeName, phone, countryCode, storeCurrency } = req.body as {
      storeName?: string;
      phone?: string;
      countryCode?: string;
      storeCurrency?: string;
    };
    const store = await prisma.store.update({
      where: { id: req.auth!.storeId },
      data: {
        ...(storeName !== undefined ? { storeName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(countryCode !== undefined ? { countryCode } : {}),
        ...(storeCurrency !== undefined ? { currency: storeCurrency } : {}),
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
    const storeId = req.ownedStore!.id;
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    const [total, delivered, sales, methods, recent] = await prisma.$transaction([
      prisma.order.count({ where: { storeId } }),
      prisma.order.count({ where: { storeId, status: "delivered" } }),
      prisma.order.aggregate({ where: { storeId }, _sum: { amountEgp: true } }),
      prisma.order.groupBy({ by: ["paymentMethod"], where: { storeId }, _count: { _all: true } }),
      prisma.order.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);
    const totalSales = Math.round(sales._sum.amountEgp ?? 0);
    const codCount = methods
      .filter((m) => /cod/i.test(m.paymentMethod) || m.paymentMethod.includes("استلام"))
      .reduce((s, m) => s + m._count._all, 0);
    res.json({
      store,
      kpis: {
        total_orders: total,
        delivered_orders: delivered,
        total_sales_egp: totalSales,
        avg_order_egp: total ? Math.round(totalSales / total) : 0,
        cod_share_percent: total ? Math.round((codCount / total) * 100) : 0,
      },
      recent_orders: recent,
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

// Authenticated listing, always scoped to the caller's own store.
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

// Admin-only: full leads listing across all stores.
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
