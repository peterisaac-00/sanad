import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  app,
  closeDb,
  orderIdByNumber,
  prisma,
  publishStore,
  registerAdmin,
  registerMerchant,
  registerTeamMember,
  truncateAll,
  uid,
} from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

const source = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

async function createProduct(agent: any, subdomain: string, sku: string, price = 50, stock = 10) {
  const res = await agent
    .post(`/api/stores/${subdomain}/products`)
    .send({ sku, name_ar: `منتج ${sku}`, price_egp: price, stock })
    .expect(201);
  return res.body.product as { id: string };
}

describe("checkout public contract and lifecycle guards", () => {
  it("returns an explicit shopper-safe DTO with no internal ids, contact data or stock flags", async () => {
    const merchant = await registerMerchant("dto");
    await createProduct(merchant.agent, merchant.subdomain, "DTO-1", 80, 5);

    const res = await request(app)
      .post(`/api/stores/${merchant.subdomain}/checkout`)
      .send({
        customer_name: "Shopper",
        customer_phone: "01011112222",
        customer_email: "shopper@example.com",
        address: "12 Nile St",
        city: "Cairo",
        governorate: "القاهرة",
        notes: "private note",
        items: [{ sku: "DTO-1", qty: 2 }],
      })
      .expect(201);

    expect(Object.keys(res.body.order).sort()).toEqual(
      [
        "amountEgp",
        "amountText",
        "couponCode",
        "createdAt",
        "customerName",
        "discount",
        "items",
        "orderNumber",
        "paymentMethod",
        "paymentStatus",
        "shippingFee",
        "status",
        "subtotal",
      ].sort()
    );
    expect(res.body.order.id).toBeUndefined();
    expect(res.body.order.storeId).toBeUndefined();
    expect(res.body.order.customerPhone).toBeUndefined();
    expect(res.body.order.customerEmail).toBeUndefined();
    expect(res.body.order.address).toBeUndefined();
    expect(res.body.order.notes).toBeUndefined();
    expect(res.body.order.idempotencyKey).toBeUndefined();
    expect(res.body.order.source).toBeUndefined();
    expect(res.body.shipping.zoneId).toBeUndefined();

    expect(Object.keys(res.body.order.items[0]).sort()).toEqual(
      ["imageUrl", "name", "qty", "sku", "unitPriceEgp", "variantLabel"].sort()
    );
    expect(res.body.order.items[0].productId).toBeUndefined();
    expect(res.body.order.items[0].variantId).toBeUndefined();
  });

  it("rejects checkout for a product that is no longer active", async () => {
    const merchant = await registerMerchant("inactive");
    const product = await createProduct(merchant.agent, merchant.subdomain, "INACTIVE-1");
    await merchant.agent
      .put(`/api/stores/${merchant.subdomain}/products/${product.id}`)
      .send({ status: "draft" })
      .expect(200);

    const res = await request(app)
      .post(`/api/stores/${merchant.subdomain}/checkout`)
      .send({ customer_name: "Buyer", items: [{ sku: "INACTIVE-1", qty: 1 }] })
      .expect(400);
    expect(res.body.error.code).toBe("UNKNOWN_SKU");
  });

  it("does not merge two customers when phone and email identify different people", async () => {
    const merchant = await registerMerchant("identity");
    await createProduct(merchant.agent, merchant.subdomain, "ID-1", 50, 10);
    const first = await prisma.customer.create({
      data: { id: uid("cus_"), storeId: merchant.store.id, name: "Phone Owner", phone: "201000000001", email: "phone@example.com" },
    });
    const second = await prisma.customer.create({
      data: { id: uid("cus_"), storeId: merchant.store.id, name: "Email Owner", phone: "201000000002", email: "email@example.com" },
    });

    const res = await request(app)
      .post(`/api/stores/${merchant.subdomain}/checkout`)
      .send({
        customer_name: "Conflicting",
        customer_phone: "201000000001",
        customer_email: "email@example.com",
        items: [{ sku: "ID-1", qty: 1 }],
      })
      .expect(201);

    const order = await prisma.order.findFirstOrThrow({
      where: { storeId: merchant.store.id, orderNumber: res.body.order.orderNumber },
      select: { customerId: true, customerEmail: true },
    });
    expect(order.customerId).toBe(first.id);
    expect(order.customerEmail).toBe("email@example.com");
    const unchangedSecond = await prisma.customer.findUniqueOrThrow({ where: { id: second.id } });
    const unchangedFirst = await prisma.customer.findUniqueOrThrow({ where: { id: first.id } });
    expect(unchangedSecond.email).toBe("email@example.com");
    expect(unchangedFirst.email).toBe("phone@example.com");
    expect(unchangedFirst.phone).toBe("201000000001");
  });

  it("rejects a configured store when no shipping zone matches the address", async () => {
    const merchant = await registerMerchant("ship");
    await createProduct(merchant.agent, merchant.subdomain, "SHIP-1", 50, 5);
    await prisma.shippingZone.create({
      data: {
        id: uid("zone_"),
        storeId: merchant.store.id,
        name: "Cairo only",
        governorates: ["القاهرة"],
        fee: 25,
      },
    });

    const res = await request(app)
      .post(`/api/stores/${merchant.subdomain}/checkout`)
      .send({
        customer_name: "Buyer",
        governorate: "الجيزة",
        items: [{ sku: "SHIP-1", qty: 1 }],
      })
      .expect(409);
    expect(res.body.error.code).toBe("SHIPPING_ZONE_UNAVAILABLE");
  });

  it("reflects a free-shipping coupon in the public shipping quote and order total", async () => {
    const merchant = await registerMerchant("freeship");
    await createProduct(merchant.agent, merchant.subdomain, "FREE-1", 100, 5);
    await prisma.shippingZone.create({
      data: {
        id: uid("zone_"),
        storeId: merchant.store.id,
        name: "Cairo",
        governorates: ["القاهرة"],
        fee: 30,
      },
    });
    await merchant.agent
      .post(`/api/stores/${merchant.subdomain}/coupons`)
      .send({ code: "FREESHIP", type: "free_shipping", value: 0 })
      .expect(201);

    const res = await request(app)
      .post(`/api/stores/${merchant.subdomain}/checkout`)
      .send({
        customer_name: "Free Shipping",
        governorate: "القاهرة",
        coupon_code: "FREESHIP",
        items: [{ sku: "FREE-1", qty: 1 }],
      })
      .expect(201);
    expect(res.body.order.shippingFee).toBe(0);
    expect(res.body.shipping).toMatchObject({
      fee: 0,
      codFee: 0,
      total: 0,
      freeShippingApplied: true,
    });
  });
});

describe("custom-domain origin policy", () => {
  async function verifiedDomain(tag: string) {
    const merchant = await registerMerchant(tag);
    await publishStore(merchant);
    await createProduct(merchant.agent, merchant.subdomain, "WEB-1", 50, 5);
    await prisma.storeDomain.create({
      data: {
        id: uid("dom_"),
        storeId: merchant.store.id,
        domain: "shop.example.com",
        status: "verified",
        verificationToken: `sanad-verify=${"a".repeat(32)}`,
        verifiedAt: new Date(),
        tlsStatus: "active",
      },
    });
    return merchant;
  }

  it("accepts a verified custom-domain origin for CORS and CSRF and answers preflight", async () => {
    const merchant = await verifiedDomain("custom");
    const payload = { customer_name: "Web", items: [{ sku: "WEB-1", qty: 1 }] };

    const preflight = await request(app)
      .options(`/api/stores/${merchant.subdomain}/checkout`)
      .set("Origin", "https://shop.example.com")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,idempotency-key")
      .expect(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe("https://shop.example.com");
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true");

    const res = await request(app)
      .post(`/api/stores/${merchant.subdomain}/checkout`)
      .set("Origin", "https://shop.example.com")
      .send(payload)
      .expect(201);
    expect(res.headers["access-control-allow-origin"]).toBe("https://shop.example.com");
  });

  it("rejects an unknown origin without weakening CSRF", async () => {
    const merchant = await verifiedDomain("evil");
    const res = await request(app)
      .post(`/api/stores/${merchant.subdomain}/checkout`)
      .set("Origin", "https://evil.example")
      .send({ customer_name: "Bad", items: [{ sku: "WEB-1", qty: 1 }] })
      .expect(403);
    expect(res.body.error.code).toBe("CORS_ORIGIN_REJECTED");
  });

  it("does not treat a merchant custom domain as a trusted platform-admin origin", async () => {
    await verifiedDomain("adminorigin");
    const admin = await registerAdmin("origin", "super_admin");
    const res = await admin.agent
      .get("/api/admin/overview")
      .set("Origin", "https://shop.example.com")
      .expect(403);
    expect(res.body.error.code).toBe("CORS_ORIGIN_REJECTED");
  });
});

describe("media and platform-admin authorization", () => {
  const PNG =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  it("blocks viewer uploads while allowing staff and read-only viewing", async () => {
    const owner = await registerMerchant("media");
    const viewer = await registerTeamMember(owner, "viewer", "view");
    const staff = await registerTeamMember(owner, "staff", "staff");

    const denied = await viewer.agent
      .post("/api/media")
      .send({ fileName: "x.png", mimeType: "image/png", dataBase64: PNG })
      .expect(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");

    await owner.agent
      .post("/api/media")
      .send({ fileName: "x.png", mimeType: "image/png", dataBase64: PNG })
      .expect(201);
    const uploaded = await staff.agent
      .post("/api/media")
      .send({ fileName: "y.png", mimeType: "image/png", dataBase64: PNG })
      .expect(201);
    expect(uploaded.body.media.url).toContain("/uploads/");

    const listed = await viewer.agent.get("/api/media").expect(200);
    expect(listed.body.media.length).toBeGreaterThanOrEqual(2);
  });

  it("does not expose DNS verification challenges to read-only administrators", async () => {
    const merchant = await registerMerchant("token");
    const domain = await prisma.storeDomain.create({
      data: {
        id: uid("dom_"),
        storeId: merchant.store.id,
        domain: "token.example.com",
        status: "pending",
        verificationToken: `sanad-verify=${"b".repeat(32)}`,
      },
    });
    const readonly = await registerAdmin("ro", "readonly");
    const list = await readonly.agent.get("/api/admin/domains").expect(200);
    const row = list.body.domains.find((item: any) => item.id === domain.id);
    expect(row).toBeTruthy();
    expect(row.verificationToken).toBeUndefined();

    const superAdmin = await registerAdmin("super", "super_admin");
    const writerList = await superAdmin.agent.get("/api/admin/domains").expect(200);
    expect(writerList.body.domains.find((item: any) => item.id === domain.id).verificationToken).toBe(
      domain.verificationToken
    );
    const settings = await superAdmin.agent.get(`/api/admin/stores/${merchant.store.id}/settings`).expect(200);
    expect(JSON.stringify(settings.body.domains)).not.toContain("sanad-verify=");
  });
});

describe("financial and request-error correctness", () => {
  it("subtracts processed refunds from reports and dashboard revenue", async () => {
    const merchant = await registerMerchant("refund");
    await createProduct(merchant.agent, merchant.subdomain, "REF-1", 100, 5);
    const base = `/api/stores/${merchant.subdomain}/orders`;
    const checkout = await request(app)
      .post(`/api/stores/${merchant.subdomain}/checkout`)
      .send({ customer_name: "Refunded", customer_phone: "01000000123", items: [{ sku: "REF-1", qty: 1 }] })
      .expect(201);
    const orderId = await orderIdByNumber(merchant.subdomain, checkout.body.order.orderNumber);
    await merchant.agent
      .patch(`${base}/${orderId}/payment-status`)
      .send({ paymentStatus: "paid" })
      .expect(200);
    const refund = await merchant.agent
      .post(`${base}/${orderId}/refunds`)
      .send({ amount: 20, reason: "partial return" })
      .expect(201);
    await merchant.agent
      .patch(`${base}/${orderId}/refunds/${refund.body.refund.id}`)
      .send({ status: "processed" })
      .expect(200);

    const report = await merchant.agent.get(`/api/stores/${merchant.subdomain}/reports`).expect(200);
    expect(report.body.totals.grossRevenue).toBe(100);
    expect(report.body.totals.refunds).toBe(20);
    expect(report.body.totals.revenue).toBe(80);
    expect(report.body.totals.estimatedNet).toBe(80);
    expect(report.body.top_products[0]).toMatchObject({ qty: 1, grossRevenue: 100, revenue: 80 });

    const summary = await merchant.agent.get(`/api/stores/${merchant.subdomain}/summary`).expect(200);
    expect(summary.body.kpis.total_sales_egp).toBe(80);
    expect(summary.body.kpis.total_refunds_egp).toBe(20);
    expect(summary.body.top_products[0]).toMatchObject({ qty: 1, revenue: 80 });
  });

  it("maps malformed and oversized JSON bodies to stable client errors", async () => {
    const malformed = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not-json")
      .expect(400);
    expect(malformed.body.error.code).toBe("INVALID_JSON");

    const oversized = await request(app)
      .post("/api/auth/login")
      .send({ email: `${"a".repeat(300_000)}@example.com`, password: "Password123" })
      .expect(413);
    expect(oversized.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("validates subscription currency and amount before approving a payment", async () => {
    const merchant = await registerMerchant("sub");
    const admin = await registerAdmin("billing", "super_admin");
    const payment = await prisma.subscriptionPayment.create({
      data: {
        id: uid("subp_"),
        storeId: merchant.store.id,
        plan: "monthly",
        amount: 1,
        currency: "USD",
        status: "pending",
      },
    });

    const currency = await admin.agent
      .post(`/api/admin/subscription-payments/${payment.id}/review`)
      .send({ decision: "approve" })
      .expect(400);
    expect(currency.body.error.code).toBe("INVALID_SUBSCRIPTION_CURRENCY");

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { currency: "EGP", amount: 99 },
    });
    const amount = await admin.agent
      .post(`/api/admin/subscription-payments/${payment.id}/review`)
      .send({ decision: "approve" })
      .expect(400);
    expect(amount.body.error.code).toBe("INVALID_SUBSCRIPTION_AMOUNT");

    await prisma.subscriptionPayment.update({ where: { id: payment.id }, data: { amount: 100 } });
    await admin.agent
      .post(`/api/admin/subscription-payments/${payment.id}/review`)
      .send({ decision: "approve" })
      .expect(200);
  });
});

describe("deployment configuration regression guards", () => {
  it("persists uploads outside the app container and validates the server build in CI", () => {
    const compose = source("docker-compose.yml");
    expect(compose).toContain("sanad-uploads:/app/data/uploads");
    expect(compose).toMatch(/^  sanad-uploads:$/m);
    expect(source("Dockerfile")).toContain("mkdir -p /app/data/uploads");
    const ci = source(".github/workflows/ci.yml");
    expect(ci).toContain("npm run build:server");
    expect(ci).toContain("npx prisma validate");
  });

  it("ships no bootstrap credentials in the public environment template", () => {
    const example = source(".env.example");
    expect(example).toMatch(/^ADMIN_BOOTSTRAP_EMAIL=\s*$/m);
    expect(example).toMatch(/^ADMIN_BOOTSTRAP_PASSWORD=\s*$/m);
    expect(example).toMatch(/^ADMIN_BOOTSTRAP_NAME=\s*$/m);
  });
});
