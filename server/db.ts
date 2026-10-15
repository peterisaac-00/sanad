import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), "data", "sanad.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  country_code TEXT NOT NULL DEFAULT 'EG',
  currency TEXT NOT NULL DEFAULT 'EGP',
  plan TEXT NOT NULL DEFAULT 'annual',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES stores(id) ON DELETE SET NULL,
  store_handle TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name_ar TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  price_egp REAL NOT NULL DEFAULT 0,
  price_sar REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  items_summary TEXT NOT NULL DEFAULT '',
  amount_text TEXT NOT NULL DEFAULT '',
  amount_egp REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'COD',
  status TEXT NOT NULL DEFAULT 'pending',
  courier TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

function tableIsEmpty(table: string): boolean {
  const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
  return row.c === 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = ""): string {
  return prefix + randomUUID().slice(0, 8);
}

/** Seed demo store (saraya) + products + orders matching the frontend demo cockpit. */
export function seedIfEmpty() {
  if (!tableIsEmpty("stores")) return;

  const t = nowIso();
  const storeId = "store_saraya";

  db.prepare(
    `INSERT INTO stores (id, store_name, subdomain, phone, country_code, currency, plan, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(storeId, "متجر سرايا للأزياء", "saraya", "01000000000", "EG", "EGP", "annual", "active", t, t);

  const products = [
    { sku: "LNN-EGY-01", ar: "قميص كتان طبيعي مصري (Linen Shirt)", en: "Egyptian Linen Shirt", egp: 750, sar: 57, stock: 48 },
    { sku: "ABY-CR-02", ar: "عباية كريب مطرزة يدوياً", en: "Hand-embroidered Crepe Abaya", egp: 1850, sar: 140, stock: 6 },
  ];
  for (const p of products) {
    db.prepare(
      `INSERT INTO products (id, store_id, sku, name_ar, name_en, price_egp, price_sar, stock, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newId("prod_"), storeId, p.sku, p.ar, p.en, p.egp, p.sar, p.stock, t);
  }

  const orders = [
    { id: "SND-4821", customer: "أحمد محمود إبراهيم", city: "القاهرة (التجمع الخامس)", items: "قميص كتان طبيعي (كحلي - L)", amount_text: "750 ج.م", amount_egp: 750, payment: "الدفع عند الاستلام COD", status: "delivered", courier: "بوسطة Bosta" },
    { id: "SND-4822", customer: "سارة خالد المنصوري", city: "الرياض (حي الملقا - السعودية)", items: "عباية حرير مطرزة (مقاس 56)", amount_text: "420 ر.س (5,540 ج.م)", amount_egp: 5540, payment: "Apple Pay (بطاقة دفع إلكتروني)", status: "shipped", courier: "أرامكس إكسبريس" },
    { id: "SND-4823", customer: "كريم عبد العظيم", city: "الإسكندرية (سموحة)", items: "حذاء كاجوال جلد طبيعي (مقاس 43)", amount_text: "1,120 ج.م", amount_egp: 1120, payment: "الدفع عند الاستلام COD", status: "confirmed", courier: "بوسطة Bosta" },
    { id: "SND-4824", customer: "منى الشريف", city: "المنصورة (الدلتا)", items: "فستان صيفي مطبوع + وشاح", amount_text: "890 ج.م", amount_egp: 890, payment: "الدفع عند الاستلام COD", status: "pending", courier: "بانتظار البوليصة" },
  ];
  for (const o of orders) {
    db.prepare(
      `INSERT INTO orders (id, store_id, customer_name, city, items_summary, amount_text, amount_egp, payment_method, status, courier, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(o.id, storeId, o.customer, o.city, o.items, o.amount_text, o.amount_egp, o.payment, o.status, o.courier, t);
  }

  console.log(`[db] seeded demo store 'saraya' (${DB_PATH})`);
}

seedIfEmpty();
