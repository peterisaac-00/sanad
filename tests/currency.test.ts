import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, registerMerchant, truncateAll, closeDb } from "./helpers.js";
beforeEach(truncateAll);
afterAll(closeDb);
describe("Egypt-only currency rule", () => {
  it("uses EGP for checkout and rejects a non-EGP store update", async () => {
    const { agent, subdomain } = await registerMerchant("cur");
    await agent.patch("/api/account/store").send({ storeCurrency: "SAR" }).expect(400);
    await agent
      .post(`/api/stores/${subdomain}/products`)
      .send({ sku: "CUR-1", name_en: "Priced", price_egp: 750, price_sar: 57, stock: 10 })
      .expect(201);
    const ok = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Egyptian Buyer", items: [{ sku: "CUR-1", qty: 2 }] })
      .expect(201);
    expect(ok.body.order.amountEgp).toBe(1500);
    expect(ok.body.order.amountText).toMatch(/EGP|ج/);
  });
  it("rejects a non-Egypt country code", async () => {
    const { agent } = await registerMerchant("cur2");
    await agent.patch("/api/account/store").send({ countryCode: "SA" }).expect(400);
  });
});
