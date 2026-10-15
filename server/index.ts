import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { db, nowIso, newId } from "./db.js";
import { hashPassword, verifyPassword, newToken } from "./auth.js";

const app = express();
const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 5000);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// ---- middleware ----
app.use(express.json({ limit: "1mb" }));

// Minimal CORS (no extra dependency)
app.use((req, res, next) => {
  const origin = req.headers.origin || FRONTEND_URL;
  res.header("Access-Control-Allow-Origin", origin as string);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ---- helpers ----
const SUBDOMAIN_RE = /^[a-z0-9-]{3,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getStoreBySubdomain(subdomain: string) {
  return db.prepare("SELECT * FROM stores WHERE subdomain = ?").get(subdomain) as any;
}

function getStoreById(id: string) {
  return db.prepare("SELECT * FROM stores WHERE id = ?").get(id) as any;
}

function publicStore(row: any) {
  if (!row) return row;
  return row;
}

// ---- health ----
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "sanad-commerce-backend", time: nowIso() });
});

// ---- stores ----
app.get("/api/stores", (_req, res) => {
  const rows = db.prepare("SELECT * FROM stores ORDER BY created_at DESC LIMIT 100").all();
  res.json({ stores: rows });
});

app.get("/api/stores/:subdomain", (req, res) => {
  const store = getStoreBySubdomain(req.params.subdomain.toLowerCase());
  if (!store) return res.status(404).json({ error: "Store not found" });
  res.json({ store: publicStore(store) });
});

app.post("/api/stores", (req, res) => {
  const { storeName, subdomain, phone, countryCode, storeCurrency, selectedPlan } = req.body ?? {};

  if (!storeName || typeof storeName !== "string" || storeName.trim().length < 2) {
    return res.status(400).json({ error: "storeName is required (min 2 chars)" });
  }
  const handle = String(subdomain || "").toLowerCase().trim();
  if (!SUBDOMAIN_RE.test(handle)) {
    return res.status(400).json({ error: "subdomain must be 3-40 chars: a-z, 0-9, hyphen" });
  }
  if (getStoreBySubdomain(handle)) {
    return res.status(409).json({ error: "subdomain already taken" });
  }

  const t = nowIso();
  const id = newId("store_");
  const plan = selectedPlan === "monthly" ? "monthly" : "annual";
  try {
    db.prepare(
      `INSERT INTO stores (id, store_name, subdomain, phone, country_code, currency, plan, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(
      id,
      String(storeName).trim(),
      handle,
      String(phone || "").trim(),
      String(countryCode || "EG"),
      String(storeCurrency || "EGP"),
      plan,
      t,
      t
    );
  } catch (e: any) {
    if (String(e?.message || "").includes("UNIQUE")) {
      return res.status(409).json({ error: "subdomain already taken" });
    }
    throw e;
  }
  const store = getStoreById(id);
  res.status(201).json({ store });
});

// ---- auth (merchants) ----
app.post("/api/auth/register", (req, res) => {
  const { email, password, storeHandle, name, phone } = req.body ?? {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: "valid email is required" });
  if (!password || String(password).length < 6) return res.status(400).json({ error: "password min 6 chars" });

  const exists = db.prepare("SELECT id FROM merchants WHERE email = ?").get(cleanEmail);
  if (exists) return res.status(409).json({ error: "email already registered" });

  let storeId: string | null = null;
  const handle = String(storeHandle || "").toLowerCase().trim();
  if (handle) {
    const s = getStoreBySubdomain(handle);
    if (!s) return res.status(404).json({ error: "store handle not found. Create the store first." });
    storeId = s.id;
  }

  const { hash, salt } = hashPassword(String(password));
  const t = nowIso();
  const id = newId("merch_");
  db.prepare(
    `INSERT INTO merchants (id, store_id, store_handle, email, password_hash, password_salt, name, phone, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, storeId, handle, cleanEmail, hash, salt, String(name || ""), String(phone || ""), t);

  const token = newToken();
  const exp = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token, merchant_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(token, id, exp, t);

  res.status(201).json({
    token,
    merchant: { id, email: cleanEmail, store_handle: handle, name: String(name || "") },
    store: storeId ? getStoreById(storeId) : null,
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password, storeHandle } = req.body ?? {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: "valid email is required" });

  const merchant = db.prepare("SELECT * FROM merchants WHERE email = ?").get(cleanEmail) as any;
  if (!merchant) return res.status(401).json({ error: "invalid credentials" });

  const handle = String(storeHandle || "").toLowerCase().trim();
  if (handle && merchant.store_handle && merchant.store_handle !== handle) {
    return res.status(401).json({ error: "store handle does not match this account" });
  }

  if (!verifyPassword(String(password || ""), merchant.password_salt, merchant.password_hash)) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const token = newToken();
  const t = nowIso();
  const exp = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token, merchant_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(token, merchant.id, exp, t);

  const store = merchant.store_id ? getStoreById(merchant.store_id) : handle ? getStoreBySubdomain(handle) : null;
  res.json({
    token,
    merchant: { id: merchant.id, email: merchant.email, store_handle: merchant.store_handle, name: merchant.name },
    store,
  });
});

app.get("/api/auth/me", (req, res) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "missing token" });
  const sess = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as any;
  if (!sess || new Date(sess.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: "invalid or expired token" });
  }
  const merchant = db.prepare("SELECT * FROM merchants WHERE id = ?").get(sess.merchant_id) as any;
  if (!merchant) return res.status(401).json({ error: "account not found" });
  const store = merchant.store_id ? getStoreById(merchant.store_id) : null;
  res.json({ merchant: { id: merchant.id, email: merchant.email, store_handle: merchant.store_handle, name: merchant.name }, store });
});

// ---- products ----
app.get("/api/stores/:subdomain/products", (req, res) => {
  const store = getStoreBySubdomain(req.params.subdomain.toLowerCase());
  if (!store) return res.status(404).json({ error: "Store not found" });
  const rows = db.prepare("SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC").all(store.id);
  res.json({ products: rows });
});

app.post("/api/stores/:subdomain/products", (req, res) => {
  const store = getStoreBySubdomain(req.params.subdomain.toLowerCase());
  if (!store) return res.status(404).json({ error: "Store not found" });
  const { sku, name_ar, name_en, price_egp, price_sar, stock } = req.body ?? {};
  if (!sku) return res.status(400).json({ error: "sku is required" });
  const t = nowIso();
  const id = newId("prod_");
  db.prepare(
    `INSERT INTO products (id, store_id, sku, name_ar, name_en, price_egp, price_sar, stock, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, store.id, String(sku), String(name_ar || ""), String(name_en || ""), Number(price_egp || 0), Number(price_sar || 0), Number(stock || 0), t);
  res.status(201).json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(id) });
});

// ---- orders ----
app.get("/api/stores/:subdomain/orders", (req, res) => {
  const store = getStoreBySubdomain(req.params.subdomain.toLowerCase());
  if (!store) return res.status(404).json({ error: "Store not found" });
  const rows = db.prepare("SELECT * FROM orders WHERE store_id = ? ORDER BY created_at DESC LIMIT 200").all(store.id);
  res.json({ orders: rows });
});

app.post("/api/stores/:subdomain/orders", (req, res) => {
  const store = getStoreBySubdomain(req.params.subdomain.toLowerCase());
  if (!store) return res.status(404).json({ error: "Store not found" });
  const { customer_name, city, items_summary, amount_text, amount_egp, payment_method, status, courier } = req.body ?? {};
  if (!customer_name) return res.status(400).json({ error: "customer_name is required" });
  const t = nowIso();
  const count = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE store_id = ?").get(store.id) as any).c as number;
  const id = `SND-${4825 + count}`;
  db.prepare(
    `INSERT INTO orders (id, store_id, customer_name, city, items_summary, amount_text, amount_egp, payment_method, status, courier, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, store.id,
    String(customer_name), String(city || ""), String(items_summary || ""),
    String(amount_text || ""), Number(amount_egp || 0),
    String(payment_method || "COD"), String(status || "pending"), String(courier || ""), t
  );
  res.status(201).json({ order: db.prepare("SELECT * FROM orders WHERE id = ?").get(id) });
});

// ---- dashboard summary ----
app.get("/api/stores/:subdomain/summary", (req, res) => {
  const store = getStoreBySubdomain(req.params.subdomain.toLowerCase());
  if (!store) return res.status(404).json({ error: "Store not found" });
  const orders = db.prepare("SELECT * FROM orders WHERE store_id = ?").all(store.id) as any[];
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
});

// ---- generic leads (migration requests, contact, help searches) ----
app.post("/api/leads", (req, res) => {
  const { type, payload } = req.body ?? {};
  if (!type) return res.status(400).json({ error: "type is required" });
  const t = nowIso();
  const id = newId("lead_");
  db.prepare("INSERT INTO leads (id, type, payload, created_at) VALUES (?, ?, ?, ?)").run(
    id, String(type), JSON.stringify(payload ?? {}), t
  );
  res.status(201).json({ ok: true, id });
});

app.get("/api/leads", (req, res) => {
  // simple admin listing (protect with ADMIN_TOKEN if set)
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken && req.headers["x-admin-token"] !== adminToken) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const rows = db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 200").all();
  res.json({ leads: rows });
});

// ---- serve frontend build in production ----
const distDir = path.join(process.cwd(), "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[sanad-backend] listening on http://localhost:${PORT}`);
  console.log(`[sanad-backend] health: http://localhost:${PORT}/api/health`);
});
