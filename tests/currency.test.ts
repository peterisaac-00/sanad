import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("checkout currency rule", () => {
  it("SAR store charges priceSar; unpriced products rejected", async () => {
    const { agent, subdomain } = await registerMerchant("cur");
    await agent.patch("/api/account/store").send({ storeCurrency: "SAR" }).expect(200);
    await agent
      .post(`/api/stores/${subdomain}/products`)
      .send({ sku: "CUR-1", name_en: "Priced", price_egp: 750, price_sar: 57, stock: 10 })
      .expect(201);
    await agent
      .post(`/api/stores/${subdomain}/products`)
      .send({ sku: "CUR-0", name_en: "Unpriced", price_egp: 750, price_sar: 0, stock: 10 })
      .expect(201);

    const ok = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Saudi Buyer", items: [{ sku: "CUR-1", qty: 2 }] })
      .expect(201);
    expect(ok.body.order.amountEgp).toBe(114);
    expect(ok.body.order.amountText).toMatch(/SAR/);

    const bad = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Saudi Buyer", items: [{ sku: "CUR-0", qty: 1 }] })
      .expect(400);
    expect(bad.body.error.code).toBe("PRODUCT_NOT_PRICED");
  });

  it("unsupported store currency is rejected at checkout", async () => {
    const { agent, subdomain } = await registerMerchant("cur2");
    await agent.patch("/api/account/store").send({ storeCurrency: "AED" }).expect(200);
    await agent
      .post(`/api/stores/${subdomain}/products`)
      .send({ sku: "CUR-A", price_egp: 100, stock: 5 })
      .expect(201);
    const res = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Buyer", items: [{ sku: "CUR-A", qty: 1 }] })
      .expect(400);
    expect(res.body.error.code).toBe("CHECKOUT_CURRENCY_UNSUPPORTED");
  });
});
