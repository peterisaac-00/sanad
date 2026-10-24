import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { closeDb, prisma, registerMerchant, truncateAll, uid } from "./helpers.js";
import { storageDriverError } from "../server/env.js";
import { integrationStatus } from "../server/services/integrations.js";
import { FEATURE_REGISTRY, isFeatureGated, isFeatureVisible } from "../src/dashboard/features.js";
import { LEARN_CHECKLIST, LEARN_GUIDE_LINKS, LEARN_ROUTE_PATHS } from "../src/dashboard/learnContent.js";
import { COMMON_FEATURES_LIST_AR, PRICING_MODEL } from "../src/data/pricing.js";
import { PLATFORM_CORE_SYSTEMS } from "../src/data/features.js";
import { FAQS_DATA } from "../src/data/faq.js";
import { INDUSTRIES_DATA } from "../src/data/industries.js";
import { UI_TRANSLATIONS } from "../src/data/translations.js";
import { DEFAULT_MERCHANT_CURRENCY_CONFIG } from "../src/data/currencies.js";

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe("R10.1 online payments are blocked until a real adapter exists", () => {
  it("reports the payment integration as unavailable and rejects enabling it", async () => {
    const merchant = await registerMerchant("pay");
    const base = `/api/stores/${merchant.subdomain}`;

    const settings = await merchant.agent.get(`${base}/settings`).expect(200);
    expect(settings.body.online_payments_available).toBe(false);
    expect(settings.body.integrations.payments.selectable).toBe(false);
    expect(settings.body.integrations.payments.reason).toBeTruthy();

    const rejected = await merchant.agent
      .patch(`${base}/settings`)
      .send({ onlinePaymentEnabled: true })
      .expect(409);
    expect(rejected.body.error.code).toBe("PAYMENT_PROVIDER_NOT_CONFIGURED");

    const stored = await prisma.store.findUnique({ where: { id: merchant.store.id } });
    expect(stored?.onlinePaymentEnabled).toBe(false);

    const disabled = await merchant.agent
      .patch(`${base}/settings`)
      .send({ onlinePaymentEnabled: false })
      .expect(200);
    expect(disabled.body.store.onlinePaymentEnabled).toBe(false);
  });

  it("guards the nested selling flag used by the onboarding wizard", async () => {
    const merchant = await registerMerchant("onbp");

    const rejected = await merchant.agent
      .patch("/api/onboarding")
      .send({ selling: { onlinePaymentEnabled: true } })
      .expect(409);
    expect(rejected.body.error.code).toBe("PAYMENT_PROVIDER_NOT_CONFIGURED");

    const onboarding = await merchant.agent.get("/api/onboarding").expect(200);
    expect(onboarding.body.payments.onlinePaymentEnabled).toBe(false);
    expect(onboarding.body.payments.providerConfigured).toBe(false);

    const stored = await prisma.store.findUnique({ where: { id: merchant.store.id } });
    expect(stored?.onlinePaymentEnabled).toBe(false);
  });
});

describe("R10.2 shipping is explicitly manual", () => {
  it("does not claim a carrier adapter or tracking", () => {
    const status = integrationStatus();
    expect(status.shipping).toMatchObject({
      configured: false,
      provider: "manual",
      label: "manual_carriers",
      trackingAvailable: false,
    });
    expect(status.shipping.reason).toContain("يدوي");
  });
});

describe("R10.3 WhatsApp reminder states are explicit", () => {
  it("returns manual-link state and never pretends a reminder was sent", async () => {
    const merchant = await registerMerchant("wa");
    const cart = await prisma.abandonedCart.create({
      data: {
        id: uid("cart_"),
        storeId: merchant.store.id,
        cartToken: uid("token_"),
        customerName: "عميل",
        phone: "01012345678",
        items: [{ name: "منتج", qty: 1 }],
        cartValue: 100,
      },
    });

    const list = await merchant.agent.get(`/api/stores/${merchant.subdomain}/abandoned-carts`).expect(200);
    expect(list.body.whatsapp.autoSendAvailable).toBe(false);
    expect(list.body.whatsapp.linksAvailable).toBe(true);
    expect(["manual_links_only", "template_required"]).toContain(list.body.whatsapp.sendState);

    const reminder = await merchant.agent
      .post(`/api/stores/${merchant.subdomain}/abandoned-carts/${cart.id}/remind`)
      .expect(200);
    expect(reminder.body.sent).toBe(false);
    expect(reminder.body.auto_send_available).toBe(false);
    expect(["manual_links_only", "template_required"]).toContain(reminder.body.send_state);
    expect(reminder.body.whatsapp_url).toContain("wa.me");
    expect(reminder.body.note).toMatch(/يدوياً|قالب/);

    const stored = await prisma.abandonedCart.findUnique({ where: { id: cart.id } });
    // The boundary cannot send; the cart must not look "reminded" automatically.
    expect(stored?.recoveryStatus).toBe("open");
  });
});

describe("R10.4 unsupported S3 storage fails fast", () => {
  it("accepts only local disk and explains the s3 boot failure", () => {
    expect(storageDriverError("local")).toBeNull();
    const error = storageDriverError("s3");
    expect(error).toContain("STORAGE_DRIVER=s3");
    expect(error).toContain("not supported");
    expect(error).toContain("STORAGE_DRIVER=local");
  });
});

describe("R10.5 wallet deposits are hidden and disabled", () => {
  it("returns read-only wallet data and rejects every deposit", async () => {
    const merchant = await registerMerchant("wal");
    const base = `/api/stores/${merchant.subdomain}`;

    const wallet = await merchant.agent.get(`${base}/wallet`).expect(200);
    expect(wallet.body.deposits_enabled).toBe(false);
    expect(wallet.body.note).toContain("غير متاح");

    const rejected = await merchant.agent
      .post(`${base}/wallet/deposits`)
      .send({ amount: 500, reference: "TX-1", note: "" })
      .expect(503);
    expect(rejected.body.error.code).toBe("WALLET_DEPOSITS_DISABLED");

    const count = await prisma.walletTransaction.count({ where: { storeId: merchant.store.id } });
    expect(count).toBe(0);
  });
});

describe("R10.6 affiliate settlement is manual and audited", () => {
  it("settles only delivered pending commissions and records an audit entry", async () => {
    const merchant = await registerMerchant("aff");
    const base = `/api/stores/${merchant.subdomain}`;

    const created = await merchant.agent
      .post(`${base}/affiliates`)
      .send({ name: "مسوّق", commissionRate: 10 })
      .expect(201);
    const affiliate = created.body.affiliate;

    const delivered = await prisma.order.create({
      data: {
        id: uid("ord_"),
        storeId: merchant.store.id,
        orderNumber: 9001,
        status: "delivered",
        source: "storefront",
      },
    });
    const deliveredAttribution = await prisma.affiliateAttribution.create({
      data: {
        id: uid("attr_"),
        storeId: merchant.store.id,
        affiliateId: affiliate.id,
        orderId: delivered.id,
        commissionAmount: 25,
      },
    });

    const shipped = await prisma.order.create({
      data: {
        id: uid("ord_"),
        storeId: merchant.store.id,
        orderNumber: 9002,
        status: "shipped",
        source: "storefront",
      },
    });
    const shippedAttribution = await prisma.affiliateAttribution.create({
      data: {
        id: uid("attr_"),
        storeId: merchant.store.id,
        affiliateId: affiliate.id,
        orderId: shipped.id,
        commissionAmount: 10,
      },
    });

    const before = await merchant.agent.get(`${base}/affiliates`).expect(200);
    expect(before.body.settlement.mode).toBe("manual_external");
    expect(before.body.affiliates[0].commissionSettleable).toBe(25);
    expect(before.body.affiliates[0].settleableCount).toBe(1);

    const settled = await merchant.agent.post(`${base}/affiliates/${affiliate.id}/settle`).expect(200);
    expect(settled.body.settled).toMatchObject({ count: 1, amount: 25 });
    expect(settled.body.note).toContain("يدوياً");

    const paid = await prisma.affiliateAttribution.findUnique({ where: { id: deliveredAttribution.id } });
    expect(paid?.status).toBe("paid");
    expect(paid?.settledAt).toBeInstanceOf(Date);

    const stillPending = await prisma.affiliateAttribution.findUnique({ where: { id: shippedAttribution.id } });
    expect(stillPending?.status).toBe("pending");
    expect(stillPending?.settledAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { storeId: merchant.store.id, action: "affiliate.commissions_settled" },
    });
    expect(audit).toBeTruthy();
    expect(audit?.metadata).toMatchObject({ count: 1, amount: 25, mode: "manual_external" });

    const after = await merchant.agent.get(`${base}/affiliates`).expect(200);
    expect(after.body.affiliates[0].commissionSettled).toBe(25);
    expect(after.body.affiliates[0].commissionSettleable).toBe(0);

    const nothingLeft = await merchant.agent.post(`${base}/affiliates/${affiliate.id}/settle`).expect(409);
    expect(nothingLeft.body.error.code).toBe("AFFILIATE_NOTHING_TO_SETTLE");
  });
});

describe("R5.1 manual orders are labelled as external records", () => {
  it("stores source=manual, uses the store currency and exports the source column", async () => {
    const merchant = await registerMerchant("man");
    const base = `/api/stores/${merchant.subdomain}`;

    const created = await merchant.agent
      .post(`${base}/orders`)
      .send({
        customer_name: "طلب خارجي",
        customer_phone: "01000000000",
        items_summary: "قميص ×1",
        amount_egp: 250,
      })
      .expect(201);

    expect(created.body.order.source).toBe("manual");
    expect(created.body.order.amountText).toBe(`250 ${merchant.store.currency}`);

    const storedItems = await prisma.orderItem.count({ where: { orderId: created.body.order.id } });
    expect(storedItems).toBe(0);

    const list = await merchant.agent.get(`${base}/orders`).expect(200);
    expect(list.body.orders[0].source).toBe("manual");

    const csv = await merchant.agent.get(`${base}/orders/export`).expect(200);
    const header = csv.text.split(/\r?\n/)[0];
    expect(header).toContain("source");
    expect(csv.text).toContain("manual");
  });
});

describe("R7.2 feature registry hides incomplete workflows", () => {
  it("gives every feature one truthful state and gates unfinished pages", () => {
    const validStates = new Set(["available", "needs_setup", "coming_soon", "not_in_plan"]);
    for (const [path, feature] of Object.entries(FEATURE_REGISTRY)) {
      expect(path.startsWith("/dashboard"), `${path} is a dashboard path`).toBe(true);
      expect(feature.label.length, `${path} has a label`).toBeGreaterThan(0);
      expect(validStates.has(feature.state), `${path} has a valid state`).toBe(true);
      if (feature.state === "coming_soon" || feature.state === "not_in_plan") {
        expect(feature.reason, `${path} explains why it is unavailable`).toBeTruthy();
      }
    }

    for (const path of [
      "/dashboard/upsells",
      "/dashboard/loyalty",
      "/dashboard/wallet",
      "/dashboard/dropshipping",
    ]) {
      expect(isFeatureGated(path), `${path} is gated`).toBe(true);
      expect(isFeatureVisible(path), `${path} is hidden from navigation`).toBe(false);
    }

    for (const path of [
      "/dashboard/orders",
      "/dashboard/affiliates",
      "/dashboard/shipping",
      "/dashboard/abandoned-carts",
    ]) {
      expect(isFeatureVisible(path), `${path} remains available`).toBe(true);
    }
  });
});

describe("R8.3 Learn links reach real workflows", () => {
  it("contains no links to hidden or nonexistent features", () => {
    expect(LEARN_ROUTE_PATHS.length).toBeGreaterThan(0);
    for (const path of LEARN_ROUTE_PATHS) {
      expect(FEATURE_REGISTRY[path], `${path} exists in the feature registry`).toBeTruthy();
      expect(isFeatureVisible(path), `${path} is a visible workflow`).toBe(true);
    }
    expect(LEARN_CHECKLIST.flatMap((group) => group.items).some((item) => item.id === "publish")).toBe(false);
    expect(LEARN_GUIDE_LINKS).toEqual(expect.arrayContaining(["/dashboard/products", "/dashboard/orders"]));
  });
});

describe("paid-feature claims match what the product actually ships", () => {
  it("does not sell unfinished payments, tracking, WhatsApp or migration as included", () => {
    const included = COMMON_FEATURES_LIST_AR.join(" ");
    expect(included).not.toMatch(/مركز الترحيل|العروض المجمعة|تعدد العملات|Meta Commerce/);
    expect(included).toContain("بدون إرسال تلقائي");
    expect(included).toContain("اختيار عملة المتجر الأساسية");

    const paymentRow = PRICING_MODEL.third_party_transparency.find((row) => row.category_ar.includes("بوابات الدفع"));
    expect(paymentRow?.cost_ar).toContain("غير متاحة");
    expect(paymentRow?.notes_ar).toContain("Webhooks");
    expect(paymentRow?.notes_ar).toContain("لن يظهر خيار الدفع الإلكتروني");

    const shippingRow = PRICING_MODEL.third_party_transparency.find((row) => row.category_ar.includes("شركات الشحن"));
    expect(shippingRow?.notes_ar).toContain("لا يوجد ربط آلي");

    const domainRow = PRICING_MODEL.third_party_transparency.find((row) => row.category_ar.includes("النطاق الفرعي"));
    expect(domainRow?.notes_ar).toContain("غير متاح");

    const payments = PLATFORM_CORE_SYSTEMS.find((system) => system.id === "payments-engine");
    expect(payments?.status).toBe("limited");
    expect(payments?.short_description_ar).toContain("غير متاح");

    const shipping = PLATFORM_CORE_SYSTEMS.find((system) => system.id === "shipping-logistics");
    expect(shipping?.status).toBe("limited");
    expect(shipping?.title_ar).toContain("يدوي");
    expect(shipping?.detailed_points_ar.join(" ")).toContain("دون ربط آلي");

    const whatsapp = PLATFORM_CORE_SYSTEMS.find((system) => system.id === "whatsapp-commerce");
    expect(whatsapp?.status).toBe("limited");
    expect(whatsapp?.badge_ar).toContain("بدون إرسال تلقائي");
    expect(whatsapp?.detailed_points_ar.join(" ")).toContain("يرسلها التاجر يدوياً");

    const cod = PLATFORM_CORE_SYSTEMS.find((system) => system.id === "cod-lifecycle");
    const codCopy = cod?.detailed_points_ar.join(" ") ?? "";
    expect(codCopy).not.toContain("إشعار المشتري تلقائياً");
    expect(codCopy).not.toContain("مطابقة التحصيلات النقدية");
    expect(codCopy).toContain("تسجيل التحصيل يدوياً");

    const migration = PLATFORM_CORE_SYSTEMS.find((system) => system.id === "migration-center");
    expect(migration?.status).toBe("designed_for_expansion");
    expect(migration?.short_description_ar).toContain("غير متاح");
    expect(migration?.short_description_ar).toContain("يدوياً");

    expect(UI_TRANSLATIONS.ar.nav_migration).toBe("الترحيل اليدوي");
    expect(UI_TRANSLATIONS.en.nav_migration).toBe("Manual Migration");

    const faq = FAQS_DATA.map(
      (item) => `${item.question_ar} ${item.answer_ar} ${item.question_en} ${item.answer_en}`
    ).join(" ");
    expect(faq).not.toMatch(/إشعار صباحي تلقائي|تحديث آلي لأسعار الصرف|We provide a complete Meta/);
    expect(faq).not.toMatch(/بنقرة واحدة من لوحة التحكم|one click from your admin console/);
    expect(faq).toContain("غير متاحة");
    expect(faq).toContain("مركز الترحيل التلقائي غير متاح");

    const industries = INDUSTRIES_DATA.flatMap((industry) => [...industry.solutions_ar, ...industry.solutions_en]).join(" ");
    expect(industries).not.toMatch(/تتبع الشحنات|Automated order confirmation|automated re-order reminders/);
    expect(industries).toContain("تسجيل بيانات الشحن يدوياً");
  });

  it("keeps marketing pages from reviving fake FX, migration or domain claims", () => {
    const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

    const solutions = read("views/SolutionsView.tsx");
    expect(solutions).not.toContain("نظام الصرف المزدوج");
    expect(solutions).not.toContain("Dual FX engine");
    expect(solutions).not.toContain("مركز الترحيل");
    expect(solutions).not.toContain("Migration Center");
    expect(solutions).not.toContain("عرض الأسعار بالريال السعودي");

    const migration = read("views/MigrationCenterView.tsx");
    expect(migration).not.toContain("api.migration");
    expect(migration).not.toContain('type="file"');
    expect(migration).toContain("الترحيل التلقائي غير متاح");
    expect(migration).toContain("لا يوجد مركز ترحيل");

    const codVisualizer = read("components/CODProcessVisualizer.tsx");
    expect(codVisualizer).not.toContain("Automated 1-to-1 reconciliation");
    expect(codVisualizer).not.toContain("إشعار صباحي تلقائي للمشتري");
    expect(codVisualizer).not.toContain("merchant notified");
    expect(codVisualizer).not.toContain("إرسال إشعار فوري للتاجر");
    expect(codVisualizer).not.toContain("Eliminates picking mistakes entirely");
    expect(codVisualizer).not.toContain("100% margin locked");
    expect(codVisualizer).toContain("لا توجد مطابقة آلية");

    const storeModal = read("components/StoreCreationModal.tsx");
    expect(storeModal).not.toContain("لاحقاً مجاناً");
    expect(storeModal).toContain("ربط النطاقات قيد التطوير");

    const templates = read("views/TemplatesView.tsx");
    expect(templates).not.toContain("بنطاقك المخصص");
    expect(templates).not.toContain("تأكيد فوري للطلب عبر واتساب");
    expect(templates).not.toContain("instant WhatsApp order tracking");
    expect(templates).toContain("نطاق فرعي مجاني");

    const countries = read("views/CountriesView.tsx");
    expect(countries).not.toContain("التتبع الكامل لدورة حياة الطرد");
    expect(countries).not.toContain("automated verification workflows");
    expect(countries).toContain("لا يوجد ربط آلي بشركات الشحن");

    expect(DEFAULT_MERCHANT_CURRENCY_CONFIG.exchangeRateMode).toBe("manual");
    expect(DEFAULT_MERCHANT_CURRENCY_CONFIG.displayCurrencies).toEqual(["EGP"]);

    const pricing = read("views/PricingView.tsx");
    expect(pricing).not.toContain("بنقرة زر واحدة");
    expect(pricing).not.toContain("with one click");

    const about = read("views/AboutView.tsx");
    expect(about).not.toContain("بنقرة زر");
    expect(about).not.toContain("Excel في أي وقت");

    const settings = read("dashboard/pages/SettingsPage.tsx");
    expect(settings).toContain("ربط النطاق بالمتجر غير مكتمل");
    expect(settings).not.toContain("أضف نطاقاً خاصاً بك لتعزيز الثقة");

    const knowledge = read("data/knowledge.ts");
    expect(knowledge).not.toContain("يقوم نظام منصة سند بإرسال");
    expect(knowledge).toContain("سند لا يرسل هذه الإشارة تلقائياً");

    const fxCta = read("components/ExchangeRateSimulator.tsx");
    expect(fxCta).not.toContain("Official Live FX Feed");
    expect(fxCta).not.toContain("basePriceEGP");
    expect(fxCta).toContain("قيد التطوير");
  });
});
