import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("order customer contact fields", () => {
  it("checkout persists phone + address and returns them", async () => {
    const { agent, subdomain } = await registerMerchant("ct");
    await agent
      .post(`/api/stores/${subdomain}/products`)
      .send({ sku: "CT-1", price_egp: 20, stock: 5 })
      .expect(201);

    const res = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({
        customer_name: "Caller",
        customer_phone: "01012345678",
        address: "12 Nile St, Apt 4, Cairo",
        items: [{ sku: "CT-1", qty: 1 }],
      })
      .expect(201);
    expect(res.body.order.customerPhone).toBe("01012345678");
    expect(res.body.order.address).toBe("12 Nile St, Apt 4, Cairo");

    const got = await agent.get(`/api/stores/${subdomain}/orders/${res.body.order.id}`).expect(200);
    expect(got.body.order.customerPhone).toBe("01012345678");
  });

  it("manual orders accept phone + address; overlong values are 400", async () => {
    const { agent, subdomain } = await registerMerchant("ctm");
    const res = await agent
      .post(`/api/stores/${subdomain}/orders`)
      .send({ customer_name: "Walk-in", customer_phone: "01111111111", address: "Alex" })
      .expect(201);
    expect(res.body.order.customerPhone).toBe("01111111111");

    await agent
      .post(`/api/stores/${subdomain}/orders`)
      .send({ customer_name: "X", customer_phone: "1".repeat(33) })
      .expect(400);
    await agent
      .post(`/api/stores/${subdomain}/orders`)
      .send({ customer_name: "X", address: "a".repeat(301) })
      .expect(400);
  });
});
