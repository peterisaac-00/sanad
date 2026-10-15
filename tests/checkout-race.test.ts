import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("checkout overselling guards", () => {
  it("(a) stock=1 with 10 concurrent checkouts -> exactly one 201, rest 409, stock ends 0", async () => {
    const { agent, subdomain } = await registerMerchant("race");
    const prod = await agent
      .post(`/api/stores/${subdomain}/products`)
      .send({ sku: "RACE-1", name_en: "Race Item", price_egp: 50, stock: 1 })
      .expect(201);
    const productId = prod.body.product.id;

    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post(`/api/stores/${subdomain}/checkout`)
          .send({ customer_name: `Buyer ${i}`, items: [{ sku: "RACE-1", qty: 1 }] })
          .then((r) => ({ status: r.status, code: (r.body?.error as { code?: string } | undefined)?.code }))
      )
    );
    expect(attempts.filter((a) => a.status === 201)).toHaveLength(1);
    const conflicts = attempts.filter((a) => a.status === 409);
    expect(conflicts).toHaveLength(9);
    // guard rejects with stock reason, never an order-number collision
    expect(conflicts.every((a) => a.code === "INSUFFICIENT_STOCK")).toBe(true);

    const after = await agent.get(`/api/stores/${subdomain}/products/${productId}`).expect(200);
    expect(after.body.product.stock).toBe(0);
  });

  it("(b) duplicate SKUs merge: [{A,5},{A,5}] with stock 5 -> 409, stock unchanged", async () => {
    const { agent, subdomain } = await registerMerchant("dup");
    const prod = await agent
      .post(`/api/stores/${subdomain}/products`)
      .send({ sku: "DUP-5", name_en: "Dup Item", price_egp: 10, stock: 5 })
      .expect(201);

    await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Greedy", items: [{ sku: "DUP-5", qty: 5 }, { sku: "DUP-5", qty: 5 }] })
      .expect(409);

    const after = await agent.get(`/api/stores/${subdomain}/products/${prod.body.product.id}`).expect(200);
    expect(after.body.product.stock).toBe(5);
  });
});
