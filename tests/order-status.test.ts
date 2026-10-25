import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

async function setupStore(tag: string, stock = 10) {
  const m = await registerMerchant(tag);
  const prod = await m.agent
    .post(`/api/stores/${m.subdomain}/products`)
    .send({ sku: "ST-1", price_egp: 50, stock })
    .expect(201);
  const co = await request(app)
    .post(`/api/stores/${m.subdomain}/checkout`)
    .send({ customer_name: "Buyer", items: [{ sku: "ST-1", qty: 3 }] })
    .expect(201);
  return { ...m, productId: prod.body.product.id as string, orderId: co.body.order.id as string };
}

async function stockOf(agent: ReturnType<typeof request.agent>, subdomain: string, productId: string) {
  const r = await agent.get(`/api/stores/${subdomain}/products/${productId}`).expect(200);
  return r.body.product.stock as number;
}

const patch = (agent: ReturnType<typeof request.agent>, subdomain: string, orderId: string, status: string) =>
  agent.patch(`/api/stores/${subdomain}/orders/${orderId}/status`).send({ status });

describe("atomic status transitions with stock restore", () => {
  it("cancel restores stock exactly once; second cancel is 409 with no further restore", async () => {
    const s = await setupStore("c1");
    expect(await stockOf(s.agent, s.subdomain, s.productId)).toBe(7);
    await patch(s.agent, s.subdomain, s.orderId, "cancelled").expect(200);
    expect(await stockOf(s.agent, s.subdomain, s.productId)).toBe(10);
    const again = await patch(s.agent, s.subdomain, s.orderId, "cancelled").expect(409);
    expect(again.body.error.code).toBe("INVALID_TRANSITION");
    expect(await stockOf(s.agent, s.subdomain, s.productId)).toBe(10);
  });

  it("return after delivery restores stock", async () => {
    const s = await setupStore("ret");
    for (const st of ["confirmed", "shipped", "delivered"]) {
      await patch(s.agent, s.subdomain, s.orderId, st).expect(200);
    }
    expect(await stockOf(s.agent, s.subdomain, s.productId)).toBe(7);
    await patch(s.agent, s.subdomain, s.orderId, "returned").expect(200);
    expect(await stockOf(s.agent, s.subdomain, s.productId)).toBe(10);
  });

  it("concurrent confirms: exactly one 200, one 409", async () => {
    const s = await setupStore("conc");
    const results = await Promise.all([
      patch(s.agent, s.subdomain, s.orderId, "confirmed").then((r) => r.status),
      patch(s.agent, s.subdomain, s.orderId, "confirmed").then((r) => r.status),
    ]);
    expect(results.sort()).toEqual([200, 409]);
  });

  it("concurrent cancel/return restores stock once", async () => {
    const s = await setupStore("cancel-return");
    await patch(s.agent, s.subdomain, s.orderId, "confirmed").expect(200);
    await patch(s.agent, s.subdomain, s.orderId, "shipped").expect(200);
    const results = await Promise.all([
      patch(s.agent, s.subdomain, s.orderId, "cancelled").then((r) => r.status),
      patch(s.agent, s.subdomain, s.orderId, "returned").then((r) => r.status),
    ]);
    expect(results.filter((status) => status === 200)).toHaveLength(1);
    expect(results.filter((status) => status === 409)).toHaveLength(1);
    expect(await stockOf(s.agent, s.subdomain, s.productId)).toBe(10);
    const events = await prisma.orderEvent.findMany({ where: { orderId: s.orderId, type: "stock_restore_failed" } });
    expect(events).toHaveLength(0);
  });

  it("records one structured restore failure when the product was deleted", async () => {
    const s = await setupStore("deleted-product");
    await prisma.product.delete({ where: { id: s.productId } });
    await patch(s.agent, s.subdomain, s.orderId, "cancelled").expect(200);
    const events = await prisma.orderEvent.findMany({ where: { orderId: s.orderId, type: "stock_restore_failed" } });
    expect(events).toHaveLength(1);
    expect((events[0].metadata as any).failures[0]).toMatchObject({ sku: "ST-1", qty: 3, reason: "product_not_found" });
  });

  it("illegal jumps are 409, not applied", async () => {
    const s = await setupStore("ill");
    await patch(s.agent, s.subdomain, s.orderId, "delivered").expect(409);
    const got = await s.agent.get(`/api/stores/${s.subdomain}/orders/${s.orderId}`).expect(200);
    expect(got.body.order.status).toBe("pending");
  });

  it("cancel of a manual order without items succeeds with nothing to restore", async () => {
    const m = await registerMerchant("man");
    const o = await m.agent
      .post(`/api/stores/${m.subdomain}/orders`)
      .send({ customer_name: "Walk-in", amount_egp: 5 })
      .expect(201);
    await patch(m.agent, m.subdomain, o.body.order.id, "cancelled").expect(200);
    const row = await prisma.order.findUnique({ where: { id: o.body.order.id } });
    expect(row?.status).toBe("cancelled");
    expect(row?.stockRestored).toBe(true);
  });
});
