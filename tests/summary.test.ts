import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { app, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("summary KPIs from real data", () => {
  it("computes exact totals, averages, delivery count and COD share", async () => {
    const { agent, subdomain } = await registerMerchant("sum");
    const base = `/api/stores/${subdomain}/orders`;

    const o1 = await agent.post(base).send({ customer_name: "A", amount_egp: 100, payment_method: "COD" }).expect(201);
    await agent.post(base).send({ customer_name: "B", amount_egp: 300, payment_method: "الدفع عند الاستلام COD" }).expect(201);
    await agent.post(base).send({ customer_name: "C", amount_egp: 200, payment_method: "card" }).expect(201);
    await agent
      .patch(`/api/stores/${subdomain}/orders/${o1.body.order.id}/status`)
      .send({ status: "confirmed" })
      .expect(200);
    await agent
      .patch(`/api/stores/${subdomain}/orders/${o1.body.order.id}/status`)
      .send({ status: "shipped" })
      .expect(200);
    await agent
      .patch(`/api/stores/${subdomain}/orders/${o1.body.order.id}/status`)
      .send({ status: "delivered" })
      .expect(200);

    const sum = await agent.get(`/api/stores/${subdomain}/summary`).expect(200);
    expect(sum.body.kpis.total_orders).toBe(3);
    expect(sum.body.kpis.delivered_orders).toBe(1);
    expect(sum.body.kpis.total_sales_egp).toBe(600);
    expect(sum.body.kpis.avg_order_egp).toBe(200);
    // 2 of 3 paid cash on delivery
    expect(sum.body.kpis.cod_share_percent).toBe(67);
    // marketing constants must not be presented as live data
    expect(sum.body.kpis.commission).toBeUndefined();
    expect(sum.body.kpis.cod_share).toBeUndefined();
    // newest first, capped at 5
    expect(sum.body.recent_orders).toHaveLength(3);
    const times = sum.body.recent_orders.map((o: { createdAt: string }) => o.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });
});
