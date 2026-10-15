/**
 * Demo seed for Sanad (Prisma + PostgreSQL).
 *
 * Runs ONLY when explicitly requested:
 *   - `npm run db:seed`, or
 *   - automatically after `prisma migrate` when DEMO_MODE=true
 *
 * Never runs on app boot. Refuses to run when NODE_ENV=production
 * unless DEMO_MODE=true AND DEMO_MERCHANT_PASSWORD is set.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../server/db.js";
import { hashPasswordArgon2 } from "../server/auth.js";

const DEMO_EMAIL = "merchant@saraya.sanad.app";

function id(prefix: string): string {
  return prefix + randomUUID().slice(0, 8);
}

async function main() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const demoMode = process.env.DEMO_MODE === "true";
  const demoPassword = process.env.DEMO_MERCHANT_PASSWORD || "";

  if (nodeEnv === "production" && (!demoMode || !demoPassword)) {
    throw new Error("Seed refused: production requires DEMO_MODE=true and DEMO_MERCHANT_PASSWORD.");
  }
  const password = demoPassword || "ChangeMe123!";
  if (!demoPassword) {
    console.warn("[seed] DEMO_MERCHANT_PASSWORD not set: using default demo password. Never use in production.");
  }

  const existing = await prisma.store.count();
  if (existing > 0) {
    console.log("[seed] stores table not empty — nothing to do.");
    return;
  }

  const t = new Date();
  const storeId = "store_saraya";

  await prisma.store.create({
    data: {
      id: storeId,
      storeName: "متجر سرايا للأزياء",
      subdomain: "saraya",
      phone: "01000000000",
      countryCode: "EG",
      currency: "EGP",
      plan: "annual",
      status: "active",
      createdAt: t,
      updatedAt: t,
    },
  });

  await prisma.product.createMany({
    data: [
      { id: id("prod_"), storeId, sku: "LNN-EGY-01", nameAr: "قميص كتان طبيعي مصري (Linen Shirt)", nameEn: "Egyptian Linen Shirt", priceEgp: 750, priceSar: 57, stock: 48, createdAt: t },
      { id: id("prod_"), storeId, sku: "ABY-CR-02", nameAr: "عباية كريب مطرزة يدوياً", nameEn: "Hand-embroidered Crepe Abaya", priceEgp: 1850, priceSar: 140, stock: 6, createdAt: t },
    ],
  });

  await prisma.order.createMany({
    data: [
      { id: "SND-4821", orderNumber: 4821, storeId, customerName: "أحمد محمود إبراهيم", city: "القاهرة (التجمع الخامس)", itemsSummary: "قميص كتان طبيعي (كحلي - L)", amountText: "750 ج.م", amountEgp: 750, paymentMethod: "الدفع عند الاستلام COD", status: "delivered", courier: "بوسطة Bosta", createdAt: t },
      { id: "SND-4822", orderNumber: 4822, storeId, customerName: "سارة خالد المنصوري", city: "الرياض (حي الملقا - السعودية)", itemsSummary: "عباية حرير مطرزة (مقاس 56)", amountText: "420 ر.س (5,540 ج.م)", amountEgp: 5540, paymentMethod: "Apple Pay (بطاقة دفع إلكتروني)", status: "shipped", courier: "أرامكس إكسبريس", createdAt: t },
      { id: "SND-4823", orderNumber: 4823, storeId, customerName: "كريم عبد العظيم", city: "الإسكندرية (سموحة)", itemsSummary: "حذاء كاجوال جلد طبيعي (مقاس 43)", amountText: "1,120 ج.م", amountEgp: 1120, paymentMethod: "الدفع عند الاستلام COD", status: "confirmed", courier: "بوسطة Bosta", createdAt: t },
      { id: "SND-4824", orderNumber: 4824, storeId, customerName: "منى الشريف", city: "المنصورة (الدلتا)", itemsSummary: "فستان صيفي مطبوع + وشاح", amountText: "890 ج.م", amountEgp: 890, paymentMethod: "الدفع عند الاستلام COD", status: "pending", courier: "بانتظار البوليصة", createdAt: t },
    ],
  });

  const merchantCount = await prisma.merchant.count();
  if (merchantCount === 0) {
    await prisma.merchant.create({
      data: {
        id: id("merch_"),
        storeId,
        storeHandle: "saraya",
        email: DEMO_EMAIL,
        passwordHash: await hashPasswordArgon2(password),
        passwordSalt: null,
        passwordAlgo: "argon2id",
        name: "Saraya Demo",
        phone: "01000000000",
        createdAt: t,
      },
    });
  }

  console.log(`[seed] demo store 'saraya' + demo merchant '${DEMO_EMAIL}' created.`);
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
