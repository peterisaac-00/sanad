import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, registerMerchant, publishStore, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("new dashboard endpoints: tenant isolation", () => {
  it("returns 401 to anonymous, 403 to another merchant and 200 to the owner", async () => {
    const a = await registerMerchant("ta");
    const b = await registerMerchant("tb");
    await publishStore(a);

    await a.agent.post(`/api/stores/${a.subdomain}/categories`).send({ nameAr: "قسم أ", slug: "a-section" }).expect(201);
    await a.agent.post(`/api/stores/${a.subdomain}/coupons`).send({ code: "TA10", type: "percentage", value: 10 }).expect(201);
    await a.agent
      .post(`/api/stores/${a.subdomain}/shipping-zones`)
      .send({ name: "القاهرة", fee: 20 })
      .expect(201);

    const routes = [
      "categories",
      "customers",
      "wallet",
      "shipping-zones",
      "coupons",
      "upsells",
      "related-products",
      "pages",
      "blog",
      "affiliates",
      "reviews",
      "loyalty",
      "dropshipping",
      "assistant",
      "summary",
      "reports",
      "settings",
      "audit-logs",
      "domains",
      "team",
      "abandoned-carts",
    ];

    for (const route of routes) {
      const path = `/api/stores/${a.subdomain}/${route}`;
      await request(app).get(path).expect(401);
      await b.agent.get(path).expect(403);
      await a.agent.get(path).expect(200);
    }
  });

  it("scopes reads and writes to the authenticated store", async () => {
    const a = await registerMerchant("sa");
    const b = await registerMerchant("sb");
    await publishStore(a);

    const aCategory = await a.agent
      .post(`/api/stores/${a.subdomain}/categories`)
      .send({ nameAr: "قسم أ", slug: "shared" })
      .expect(201);
    const bCategory = await b.agent
      .post(`/api/stores/${b.subdomain}/categories`)
      .send({ nameAr: "قسم ب", slug: "shared" })
      .expect(201);
    const aCoupon = await a.agent
      .post(`/api/stores/${a.subdomain}/coupons`)
      .send({ code: "TA10", type: "percentage", value: 10 })
      .expect(201);
    const aZone = await a.agent
      .post(`/api/stores/${a.subdomain}/shipping-zones`)
      .send({ name: "القاهرة", fee: 20 })
      .expect(201);
    const aPage = await a.agent
      .post(`/api/stores/${a.subdomain}/pages`)
      .send({ title: "About A", slug: "about", content: "A", status: "published" })
      .expect(201);
    const aPost = await a.agent
      .post(`/api/stores/${a.subdomain}/blog`)
      .send({ title: "Post A", slug: "post", content: "A", status: "published" })
      .expect(201);
    const aProduct = await a.agent
      .post(`/api/stores/${a.subdomain}/products`)
      .send({ sku: "TA-1", name_ar: "منتج أ", price_egp: 100, stock: 5 })
      .expect(201);
    const aReview = await request(app)
      .post(`/api/storefront/${a.subdomain}/reviews`)
      .send({ productId: aProduct.body.product.id, customerName: "Buyer", rating: 4, content: "Good" })
      .expect(201);

    // B sees only its own rows even though both stores use the same slug.
    const bCategories = await b.agent.get(`/api/stores/${b.subdomain}/categories`).expect(200);
    expect(bCategories.body.categories.map((category: { id: string }) => category.id)).toEqual([bCategory.body.category.id]);
    const bCoupons = await b.agent.get(`/api/stores/${b.subdomain}/coupons`).expect(200);
    expect(bCoupons.body.coupons).toEqual([]);
    const bPages = await b.agent.get(`/api/stores/${b.subdomain}/pages`).expect(200);
    expect(bPages.body.pages).toEqual([]);

    const aCategories = await a.agent.get(`/api/stores/${a.subdomain}/categories`).expect(200);
    expect(aCategories.body.categories.map((category: { id: string }) => category.id)).toContain(aCategory.body.category.id);
    expect(aCategories.body.categories.map((category: { id: string }) => category.id)).not.toContain(bCategory.body.category.id);

    // Another merchant cannot mutate store A's resources.
    await request(app)
      .patch(`/api/stores/${a.subdomain}/categories/${aCategory.body.category.id}`)
      .send({ nameAr: "hijacked" })
      .expect(401);
    await b.agent
      .patch(`/api/stores/${a.subdomain}/categories/${aCategory.body.category.id}`)
      .send({ nameAr: "hijacked" })
      .expect(403);
    await b.agent
      .patch(`/api/stores/${a.subdomain}/coupons/${aCoupon.body.coupon.id}`)
      .send({ value: 99 })
      .expect(403);
    await b.agent
      .patch(`/api/stores/${a.subdomain}/shipping-zones/${aZone.body.zone.id}`)
      .send({ fee: 0 })
      .expect(403);
    await b.agent
      .patch(`/api/stores/${a.subdomain}/pages/${aPage.body.page.id}`)
      .send({ title: "hijacked" })
      .expect(403);
    await b.agent
      .patch(`/api/stores/${a.subdomain}/blog/${aPost.body.post.id}`)
      .send({ title: "hijacked" })
      .expect(403);
    await b.agent
      .patch(`/api/stores/${a.subdomain}/reviews/${aReview.body.review.id}`)
      .send({ status: "approved" })
      .expect(403);
    await b.agent
      .patch(`/api/stores/${a.subdomain}/settings`)
      .send({ storeName: "hijacked" })
      .expect(403);
    await b.agent
      .patch(`/api/stores/${a.subdomain}/notification-preferences`)
      .send({ newOrders: false })
      .expect(403);
    await b.agent
      .post(`/api/stores/${a.subdomain}/assistant/generate`)
      .send({ task: "seo", input: {} })
      .expect(403);
    await b.agent
      .post(`/api/stores/${a.subdomain}/suppliers`)
      .send({ name: "hijacked" })
      .expect(403);

    // The owner can still perform the same writes.
    await a.agent
      .patch(`/api/stores/${a.subdomain}/categories/${aCategory.body.category.id}`)
      .send({ nameAr: "قسم أ محدث" })
      .expect(200);
    await a.agent
      .patch(`/api/stores/${a.subdomain}/coupons/${aCoupon.body.coupon.id}`)
      .send({ value: 15 })
      .expect(200);
    await a.agent
      .patch(`/api/stores/${a.subdomain}/shipping-zones/${aZone.body.zone.id}`)
      .send({ fee: 30 })
      .expect(200);
    await a.agent
      .patch(`/api/stores/${a.subdomain}/reviews/${aReview.body.review.id}`)
      .send({ status: "approved" })
      .expect(200);
    await a.agent
      .patch(`/api/stores/${a.subdomain}/settings`)
      .send({ storeName: "Store A" })
      .expect(200);
    await a.agent
      .patch(`/api/stores/${a.subdomain}/notification-preferences`)
      .send({ newOrders: false })
      .expect(200);

    // A new supplier belongs to A only.
    await a.agent
      .post(`/api/stores/${a.subdomain}/suppliers`)
      .send({ name: "Supplier A" })
      .expect(201);
    const aDropshipping = await a.agent.get(`/api/stores/${a.subdomain}/dropshipping`).expect(200);
    expect(aDropshipping.body.suppliers.map((supplier: { name: string }) => supplier.name)).toEqual(["Supplier A"]);
    const bDropshipping = await b.agent.get(`/api/stores/${b.subdomain}/dropshipping`).expect(200);
    expect(bDropshipping.body.suppliers).toEqual([]);
  });
});
