import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, registerMerchant, publishStore, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

type Agent = Awaited<ReturnType<typeof registerMerchant>>["agent"];

async function createProduct(agent: Agent, subdomain: string, body: Record<string, unknown>) {
  const res = await agent.post(`/api/stores/${subdomain}/products`).send(body).expect(201);
  return res.body.product as Record<string, any>;
}

describe("storefront publishing gate", () => {
  it("keeps unpublished stores behind the coming-soon gate and publishes through onboarding", async () => {
    // Approved but not yet published: the storefront must show coming-soon.
    const merchant = await registerMerchant("pub", { publish: false });
    const publicBase = `/api/storefront/${merchant.subdomain}`;

    const draft = await request(app).get(publicBase).expect(200);
    expect(draft.body.published).toBe(false);
    expect(draft.body.store.store_name).toBe("Shop pub");
    expect(draft.body.store.phone).toBeUndefined();
    // Coming-soon hides every payment/catalog detail, not only products.
    expect(draft.body.payments.cod_enabled).toBe(false);
    expect(draft.body.payments.online_enabled).toBe(false);
    expect(draft.body.featured_products).toEqual([]);

    const publishedStore = await publishStore(merchant, {
      storeName: "متجر سند",
      branding: { primaryColor: "#1d4ed8", themeMode: "dark" },
    });
    expect(publishedStore.onboardingCompleted).toBe(true);
    expect(publishedStore.publishedAt).toBeTruthy();

    const published = await request(app).get(publicBase).expect(200);
    expect(published.body.published).toBe(true);
    expect(published.body.store.store_name).toBe("متجر سند");
    expect(published.body.branding.primaryColor).toBe("#1d4ed8");
    expect(published.body.branding.themeMode).toBe("dark");
    expect(published.body.store.online_payment_enabled).toBe(false);
    expect(published.body.payments.online_enabled).toBe(false);
    expect(published.body.store.whatsapp_url).toContain("https://wa.me/");

    await request(app).get("/api/storefront/no-such-shop-123").expect(404);
  });
});

describe("public catalog", () => {
  it("serves active products, variants, filters, related products and moderated reviews", async () => {
    const merchant = await registerMerchant("cat");
    await publishStore(merchant);
    const base = `/api/stores/${merchant.subdomain}`;
    const publicBase = `/api/storefront/${merchant.subdomain}`;

    const clothing = await merchant.agent
      .post(`${base}/categories`)
      .send({ nameAr: "ملابس", nameEn: "Clothing", slug: "clothing" })
      .expect(201);
    const other = await merchant.agent
      .post(`${base}/categories`)
      .send({ nameAr: "أخرى", nameEn: "Other", slug: "other" })
      .expect(201);

    const tee = await createProduct(merchant.agent, merchant.subdomain, {
      sku: "TEE-1",
      name_ar: "تيشيرت قطن",
      name_en: "Cotton Tee",
      slug: "cotton-tee",
      categoryId: clothing.body.category.id,
      price_egp: 200,
      price_sar: 15,
      basePrice: 200,
      stock: 0,
      isFeatured: true,
      costPrice: 50,
      barcode: "123456",
      shortDescriptionAr: "قطن 100%",
      descriptionAr: "تيشيرت قطني مريح",
      seoTitle: "تيشيرت قطني",
      seoDescription: "اشتري تيشيرت قطني",
      images: [{ url: "/uploads/tee.jpg", alt: "Tee" }],
      options: [
        {
          name: "المقاس",
          nameAr: "المقاس",
          values: [
            { value: "M", valueAr: "وسط" },
            { value: "L", valueAr: "كبير" },
          ],
        },
      ],
      variants: [
        { sku: "TEE-M", price: 0, stock: 2, optionValues: { "المقاس": "M" } },
        { sku: "TEE-L", price: 220, stock: 4, optionValues: { "المقاس": "L" } },
      ],
    });

    const draft = await createProduct(merchant.agent, merchant.subdomain, {
      sku: "DRAFT-1",
      name_ar: "مسودة",
      price_egp: 10,
      stock: 1,
      status: "draft",
    });
    const fallback = await createProduct(merchant.agent, merchant.subdomain, {
      sku: "OTHER-1",
      name_ar: "منتج آخر",
      price_egp: 50,
      stock: 3,
      categoryId: other.body.category.id,
    });
    await merchant.agent
      .post(`${base}/related-products`)
      .send({ productId: tee.id, relatedProductId: fallback.id })
      .expect(201);

    const list = await request(app).get(`${publicBase}/products?pageSize=50`).expect(200);
    expect(list.body.pagination.total).toBe(2);
    expect(list.body.products.map((p: any) => p.sku).sort()).toEqual(["OTHER-1", "TEE-1"]);
    const publicTee = list.body.products.find((p: any) => p.sku === "TEE-1");
    expect(publicTee.totalStock).toBe(6);
    expect(publicTee.inStock).toBe(true);
    expect(publicTee.displayPrice).toBe(200);
    expect(publicTee.variants).toHaveLength(2);
    // Merchant-only pricing/operations columns must never leak publicly.
    expect(publicTee.costPrice).toBeUndefined();
    expect(publicTee.barcode).toBeUndefined();
    expect(publicTee.lowStockThreshold).toBeUndefined();

    const filtered = await request(app).get(`${publicBase}/products?category=clothing`).expect(200);
    expect(filtered.body.products.map((p: any) => p.sku)).toEqual(["TEE-1"]);
    const searched = await request(app).get(`${publicBase}/products?search=cotton`).expect(200);
    expect(searched.body.products.map((p: any) => p.sku)).toEqual(["TEE-1"]);
    const sorted = await request(app).get(`${publicBase}/products?sort=price_asc`).expect(200);
    expect(sorted.body.products.map((p: any) => p.sku)).toEqual(["OTHER-1", "TEE-1"]);

    const detail = await request(app).get(`${publicBase}/products/cotton-tee`).expect(200);
    expect(detail.body.product.review_summary).toEqual({ average: 0, count: 0 });
    expect(detail.body.product.related_products.map((p: any) => p.sku)).toEqual(["OTHER-1"]);
    expect(detail.body.store.store_name).toBeTruthy();
    expect(detail.body.product.reviews).toEqual([]);

    await request(app).get(`${publicBase}/products/${draft.id}`).expect(404);
    await request(app).get(`${publicBase}/products/does-not-exist`).expect(404);

    const submitted = await request(app)
      .post(`${publicBase}/reviews`)
      .send({ productId: tee.id, customerName: "سارة", rating: 5, content: "ممتاز" })
      .expect(201);
    expect(submitted.body.review.status).toBe("pending");

    const beforeApproval = await request(app).get(`${publicBase}/reviews/${tee.id}`).expect(200);
    expect(beforeApproval.body.reviews).toEqual([]);

    await merchant.agent
      .patch(`${base}/reviews/${submitted.body.review.id}`)
      .send({ status: "approved", merchantReply: "شكراً لك" })
      .expect(200);

    const approved = await request(app).get(`${publicBase}/products/${tee.id}`).expect(200);
    expect(approved.body.product.reviews).toHaveLength(1);
    expect(approved.body.product.reviews[0].merchantReply).toBe("شكراً لك");
    expect(approved.body.product.review_summary).toEqual({ average: 5, count: 1 });
  });
});

describe("coupons, shipping and public checkout", () => {
  it("quotes shipping, applies coupons and keeps order totals server-side", async () => {
    const merchant = await registerMerchant("ship");
    await publishStore(merchant);
    const base = `/api/stores/${merchant.subdomain}`;
    const publicBase = `/api/storefront/${merchant.subdomain}`;

    await createProduct(merchant.agent, merchant.subdomain, {
      sku: "SHIP-1",
      name_ar: "حقيبة",
      price_egp: 100,
      stock: 10,
      images: [{ url: "/uploads/bag.jpg", alt: "Bag" }],
    });

    await merchant.agent
      .post(`${base}/shipping-zones`)
      .send({
        name: "القاهرة الكبرى",
        governorates: ["القاهرة", "الجيزة"],
        fee: 25,
        codFee: 5,
        freeShippingThreshold: 500,
        isFallback: true,
      })
      .expect(201);

    await merchant.agent
      .post(`${base}/coupons`)
      .send({ code: "save10", type: "percentage", value: 10 })
      .expect(201);
    await merchant.agent
      .post(`${base}/coupons`)
      .send({ code: "MIN500", type: "fixed", value: 50, minOrderValue: 500 })
      .expect(201);

    const coupon = await request(app)
      .post(`${publicBase}/coupon`)
      .send({ code: "SAVE10", subtotal: 200 })
      .expect(200);
    expect(coupon.body.valid).toBe(true);
    expect(coupon.body.coupon.discount).toBe(20);

    const invalidCoupon = await request(app)
      .post(`${publicBase}/coupon`)
      .send({ code: "NOPE", subtotal: 200 })
      .expect(400);
    expect(invalidCoupon.body.error.code).toBe("COUPON_INVALID");

    const minimum = await request(app)
      .post(`${publicBase}/coupon`)
      .send({ code: "MIN500", subtotal: 200 })
      .expect(400);
    expect(minimum.body.error.code).toBe("COUPON_MIN_ORDER");

    const paidShipping = await request(app)
      .post(`${publicBase}/shipping-quote`)
      .send({ governorate: "القاهرة", subtotal: 180, payment_method: "COD" })
      .expect(200);
    expect(paidShipping.body.quote).toMatchObject({
      fee: 25,
      codFee: 5,
      total: 30,
      freeShippingApplied: false,
    });

    const freeShipping = await request(app)
      .post(`${publicBase}/shipping-quote`)
      .send({ governorate: "القاهرة", subtotal: 500, payment_method: "COD" })
      .expect(200);
    expect(freeShipping.body.quote).toMatchObject({
      fee: 0,
      codFee: 5,
      total: 5,
      freeShippingApplied: true,
    });

    const checkout = await request(app)
      .post(`${base}/checkout`)
      .send({
        customer_name: "هدى",
        customer_phone: "01012345678",
        governorate: "القاهرة",
        address: "شارع 1",
        payment_method: "COD",
        coupon_code: "SAVE10",
        items: [{ sku: "SHIP-1", qty: 2 }],
      })
      .expect(201);
    expect(checkout.body.order).toMatchObject({
      subtotal: 200,
      discount: 20,
      shippingFee: 30,
      couponCode: "SAVE10",
      amountEgp: 210,
      status: "pending",
      paymentStatus: "unpaid",
    });
    expect(checkout.body.shipping).toMatchObject({ fee: 25, codFee: 5, total: 30 });
    expect(checkout.body.order.items[0]).toMatchObject({
      sku: "SHIP-1",
      qty: 2,
      unitPriceEgp: 100,
      imageUrl: "/uploads/bag.jpg",
    });
    expect(checkout.body.whatsapp_url).toContain("https://wa.me/");

    const stock = await merchant.agent.get(`${base}/products?pageSize=50`).expect(200);
    expect(stock.body.products.find((p: any) => p.sku === "SHIP-1").stock).toBe(8);

    const wrongPhone = await request(app)
      .get(`${publicBase}/orders/${checkout.body.order.orderNumber}?phone=01099999999`)
      .expect(404);
    expect(wrongPhone.body.error.code).toBe("ORDER_NOT_FOUND");
    await request(app).get(`${publicBase}/orders/${checkout.body.order.orderNumber}`).expect(400);

    const tracked = await request(app)
      .get(`${publicBase}/orders/${checkout.body.order.orderNumber}?phone=01012345678`)
      .expect(200);
    expect(tracked.body.order.orderNumber).toBe(checkout.body.order.orderNumber);
    expect(tracked.body.order.customerPhone).toBe("010****5678");
    expect(tracked.body.tracking_token).toBeTruthy();
    expect(tracked.body.tracking_url).toContain("?token=");
    // The internal order id and delivery PII must never be exposed publicly.
    expect(tracked.body.order.id).toBeUndefined();
    expect(tracked.body.order.address).toBeUndefined();
    expect(tracked.body.order.customerEmail).toBeUndefined();
    expect(tracked.body.order.items[0]).toMatchObject({
      sku: "SHIP-1",
      imageUrl: "/uploads/bag.jpg",
      qty: 2,
      unitPriceEgp: 100,
    });

    const onlinePayment = await request(app)
      .post(`${base}/checkout`)
      .send({
        customer_name: "هدى",
        customer_phone: "01012345678",
        payment_method: "card",
        items: [{ sku: "SHIP-1", qty: 1 }],
      })
      .expect(400);
    expect(onlinePayment.body.error.code).toBe("ONLINE_PAYMENT_DISABLED");
  });

  it("rejects cash-on-delivery when the merchant disabled it", async () => {
    const merchant = await registerMerchant("nocod");
    await publishStore(merchant, { codEnabled: false });
    await createProduct(merchant.agent, merchant.subdomain, {
      sku: "NOC-1",
      name_ar: "منتج",
      price_egp: 50,
      stock: 2,
    });

    const res = await request(app)
      .post(`/api/stores/${merchant.subdomain}/checkout`)
      .send({ customer_name: "X", items: [{ sku: "NOC-1", qty: 1 }] })
      .expect(400);
    expect(res.body.error.code).toBe("COD_DISABLED");
  });
});

describe("variant checkout", () => {
  it("decrements variant stock, blocks oversell and requires variant selection", async () => {
    const merchant = await registerMerchant("var");
    await publishStore(merchant);
    const base = `/api/stores/${merchant.subdomain}`;
    const publicBase = `/api/storefront/${merchant.subdomain}`;

    const product = await createProduct(merchant.agent, merchant.subdomain, {
      sku: "VAR-1",
      name_ar: "قميص",
      price_egp: 100,
      stock: 7,
      variants: [
        { sku: "VAR-M", price: 250, stock: 2, optionValues: { "المقاس": "M" } },
        { sku: "VAR-L", price: 0, stock: 3, optionValues: { "المقاس": "L" } },
      ],
    });

    const detail = await request(app).get(`${publicBase}/products/${product.id}`).expect(200);
    const medium = detail.body.product.variants.find((variant: any) => variant.sku === "VAR-M");
    const large = detail.body.product.variants.find((variant: any) => variant.sku === "VAR-L");
    expect(detail.body.product.displayPrice).toBe(100);
    expect(medium).toBeTruthy();
    expect(large).toBeTruthy();

    const first = await request(app)
      .post(`${base}/checkout`)
      .send({ customer_name: "V", items: [{ variantId: medium.id, qty: 2 }] })
      .expect(201);
    expect(first.body.order.amountEgp).toBe(500);
    expect(first.body.order.items[0].variantLabel).toContain("M");

    const after = await request(app).get(`${publicBase}/products/${product.id}`).expect(200);
    expect(after.body.product.variants.find((variant: any) => variant.id === medium.id).stock).toBe(0);
    // The parent product stock is not consumed when a variant is sold.
    expect(after.body.product.stock).toBe(7);

    const oversell = await request(app)
      .post(`${base}/checkout`)
      .send({ customer_name: "V", items: [{ variantId: medium.id, qty: 1 }] })
      .expect(409);
    expect(oversell.body.error.code).toBe("INSUFFICIENT_STOCK");

    // A zero-priced variant inherits the product's store currency price.
    const inherited = await request(app)
      .post(`${base}/checkout`)
      .send({ customer_name: "V", items: [{ variantId: large.id, qty: 1 }] })
      .expect(201);
    expect(inherited.body.order.amountEgp).toBe(100);

    const skuOnly = await request(app)
      .post(`${base}/checkout`)
      .send({ customer_name: "V", items: [{ sku: "VAR-1", qty: 1 }] })
      .expect(400);
    expect(skuOnly.body.error.code).toBe("VARIANT_REQUIRED");
  });
});

describe("public tenant isolation", () => {
  it("never mixes catalog, pages, reviews, checkout or order lookups between stores", async () => {
    const a = await registerMerchant("xa");
    const b = await registerMerchant("xb");
    await publishStore(a);
    await publishStore(b);

    const aBase = `/api/stores/${a.subdomain}`;
    const bBase = `/api/stores/${b.subdomain}`;
    const aPublic = `/api/storefront/${a.subdomain}`;
    const bPublic = `/api/storefront/${b.subdomain}`;

    await a.agent.post(`${aBase}/categories`).send({ nameAr: "قسم أ", slug: "shared" }).expect(201);
    await b.agent.post(`${bBase}/categories`).send({ nameAr: "قسم ب", slug: "shared" }).expect(201);

    const aProduct = await createProduct(a.agent, a.subdomain, {
      sku: "A-1",
      name_ar: "منتج أ",
      slug: "shared",
      price_egp: 100,
      stock: 5,
    });
    const bProduct = await createProduct(b.agent, b.subdomain, {
      sku: "B-1",
      name_ar: "منتج ب",
      slug: "shared",
      price_egp: 200,
      stock: 5,
    });

    await a.agent
      .post(`${aBase}/pages`)
      .send({ title: "من نحن أ", slug: "about", content: "محتوى أ", status: "published" })
      .expect(201);
    await b.agent
      .post(`${bBase}/pages`)
      .send({ title: "من نحن ب", slug: "about", content: "محتوى ب", status: "published" })
      .expect(201);

    const aProductDetail = await request(app).get(`${aPublic}/products/shared`).expect(200);
    expect(aProductDetail.body.product.sku).toBe("A-1");
    const bProductDetail = await request(app).get(`${bPublic}/products/shared`).expect(200);
    expect(bProductDetail.body.product.sku).toBe("B-1");

    const aPage = await request(app).get(`${aPublic}/pages/about`).expect(200);
    expect(aPage.body.page.content).toBe("محتوى أ");
    const bPage = await request(app).get(`${bPublic}/pages/about`).expect(200);
    expect(bPage.body.page.content).toBe("محتوى ب");

    const aList = await request(app).get(`${aPublic}/products?pageSize=50`).expect(200);
    expect(aList.body.products.map((p: any) => p.sku)).toEqual(["A-1"]);
    const bList = await request(app).get(`${bPublic}/products?pageSize=50`).expect(200);
    expect(bList.body.products.map((p: any) => p.sku)).toEqual(["B-1"]);

    // A review can only target a product in the same store.
    await request(app)
      .post(`${bPublic}/reviews`)
      .send({ productId: aProduct.id, customerName: "X", rating: 5, content: "X" })
      .expect(404);

    // A SKU from store A cannot be purchased in store B.
    const crossCheckout = await request(app)
      .post(`${bBase}/checkout`)
      .send({ customer_name: "X", items: [{ sku: "A-1", qty: 1 }] })
      .expect(400);
    expect(crossCheckout.body.error.code).toBe("UNKNOWN_SKU");

    const aOrder = await request(app)
      .post(`${aBase}/checkout`)
      .send({ customer_name: "X", customer_phone: "01055555555", items: [{ sku: "A-1", qty: 1 }] })
      .expect(201);
    // The same order number + phone must not resolve on another storefront.
    await request(app)
      .get(`${bPublic}/orders/${aOrder.body.order.orderNumber}?phone=01055555555`)
      .expect(404);

    // Store B cannot read store A through merchant endpoints.
    await b.agent.get(`${aBase}/categories`).expect(403);
    await b.agent.get(`${aBase}/pages`).expect(403);
    await b.agent.get(`${aBase}/settings`).expect(403);
  });
});
