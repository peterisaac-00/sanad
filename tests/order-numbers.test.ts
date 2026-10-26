import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("order numbering per store", () => {
  it("two stores each create their first order -> both 201 with orderNumber 4825", async () => {
    const a = await registerMerchant("n1a");
    const b = await registerMerchant("n1b");
    await a.agent
      .post(`/api/stores/${a.subdomain}/products`)
      .send({ sku: "N-1", price_egp: 10, stock: 50 })
      .expect(201);
    await b.agent
      .post(`/api/stores/${b.subdomain}/products`)
      .send({ sku: "N-1", price_egp: 10, stock: 50 })
      .expect(201);

    const manual = await a.agent
      .post(`/api/stores/${a.subdomain}/orders`)
      .send({ customer_name: "Manual One", amount_egp: 10 })
      .expect(201);
    const co = await request(app)
      .post(`/api/stores/${b.subdomain}/checkout`)
      .send({ customer_name: "Web Buyer", items: [{ sku: "N-1", qty: 1 }] })
      .expect(201);

    // per-store sequences: both first orders are number 4825 with distinct ids
    expect(manual.body.order.orderNumber).toBe(4825);
    expect(co.body.order.orderNumber).toBe(4825);
    expect(co.body.order.id).toBeUndefined();
    const webOrder = await prisma.order.findFirst({
      where: { store: { subdomain: b.subdomain }, orderNumber: 4825 },
      select: { id: true },
    });
    expect(webOrder?.id).toBeTruthy();
    expect(manual.body.order.id).not.toBe(webOrder?.id);
  });

  it("8 concurrent checkouts on one store -> all 201, unique sequential numbers", async () => {
    const owner = await registerMerchant("n2x");
    await owner.agent
      .post(`/api/stores/${owner.subdomain}/products`)
      .send({ sku: "NC-1", price_egp: 5, stock: 100 })
      .expect(201);

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        request(app)
          .post(`/api/stores/${owner.subdomain}/checkout`)
          .send({ customer_name: `C ${i}`, items: [{ sku: "NC-1", qty: 1 }] })
          .then((r) => ({ status: r.status, n: r.body?.order?.orderNumber }))
      )
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const nums = results.map((r) => r.n).sort((x, y) => x - y);
    expect(new Set(nums).size).toBe(8);
    expect(nums).toEqual([4825, 4826, 4827, 4828, 4829, 4830, 4831, 4832]);
  });
});
