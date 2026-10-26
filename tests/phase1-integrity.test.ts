import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, registerMerchant, truncateAll, closeDb, uid, orderIdByNumber } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

type Agent = ReturnType<typeof request.agent>;

async function createProduct(
  agent: Agent,
  subdomain: string,
  body: { sku: string; price_egp: number; stock: number; name_ar?: string }
) {
  const res = await agent.post(`/api/stores/${subdomain}/products`).send(body).expect(201);
  return res.body.product as { id: string; sku: string };
}

async function createManualOrder(agent: Agent, subdomain: string, body: Record<string, unknown>) {
  const res = await agent.post(`/api/stores/${subdomain}/orders`).send(body).expect(201);
  return res.body.order as { id: string; orderNumber: number; customerId: string | null; customerPhone: string; customerEmail: string };
}

function setOrderStatus(agent: Agent, subdomain: string, orderId: string, status: string) {
  return agent.patch(`/api/stores/${subdomain}/orders/${orderId}/status`).send({ status });
}

function payOrder(agent: Agent, subdomain: string, orderId: string) {
  return agent.patch(`/api/stores/${subdomain}/orders/${orderId}/payment-status`).send({ paymentStatus: "paid" });
}

describe("Phase 1 accounting consistency", () => {
  it("excludes cancelled and returned orders from sales, AOV and month sales", async () => {
    const { agent, subdomain } = await registerMerchant("acc");
    const base = `/api/stores/${subdomain}/orders`;

    await agent.post(base).send({ customer_name: "Valid", amount_egp: 100 }).expect(201);
    const cancelled = await agent.post(base).send({ customer_name: "Cancelled", amount_egp: 200 }).expect(201);
    const returned = await agent.post(base).send({ customer_name: "Returned", amount_egp: 300 }).expect(201);

    await setOrderStatus(agent, subdomain, cancelled.body.order.id, "cancelled").expect(200);
    for (const status of ["confirmed", "shipped", "returned"]) {
      await setOrderStatus(agent, subdomain, returned.body.order.id, status).expect(200);
    }

    const summary = await agent.get(`/api/stores/${subdomain}/summary`).expect(200);
    expect(summary.body.kpis.total_orders).toBe(3);
    expect(summary.body.kpis.total_sales_egp).toBe(100);
    expect(summary.body.kpis.avg_order_egp).toBe(100);
    expect(summary.body.kpis.month_sales_egp).toBe(100);

    const today = summary.body.revenue_series[summary.body.revenue_series.length - 1];
    expect(today.orders).toBe(3);
    expect(today.revenue).toBe(100);
  });

  it("computes top product revenue as quantity × unit price and skips lost orders", async () => {
    const { agent, subdomain } = await registerMerchant("top");
    await createProduct(agent, subdomain, { sku: "TOP-A", name_ar: "خاسر", price_egp: 100, stock: 10 });
    await createProduct(agent, subdomain, { sku: "TOP-B", name_ar: "رابح", price_egp: 40, stock: 10 });

    const lost = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Lost", items: [{ sku: "TOP-A", qty: 3 }] })
      .expect(201);
    const lostId = await orderIdByNumber(subdomain, lost.body.order.orderNumber);
    await setOrderStatus(agent, subdomain, lostId, "cancelled").expect(200);

    const won = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Won", items: [{ sku: "TOP-B", qty: 2 }] })
      .expect(201);
    const wonId = await orderIdByNumber(subdomain, won.body.order.orderNumber);
    for (const status of ["confirmed", "shipped", "delivered"]) {
      await setOrderStatus(agent, subdomain, wonId, status).expect(200);
    }

    const summary = await agent.get(`/api/stores/${subdomain}/summary`).expect(200);
    expect(summary.body.top_products).toHaveLength(1);
    expect(summary.body.top_products[0]).toMatchObject({ name: "رابح", qty: 2, revenue: 80 });
    expect(summary.body.kpis.total_sales_egp).toBe(80);
    expect(summary.body.kpis.avg_order_egp).toBe(80);
  });

  it("status_counts honours every filter except status", async () => {
    const { agent, subdomain } = await registerMerchant("cnt");
    const base = `/api/stores/${subdomain}/orders`;

    const pendingPaid = await createManualOrder(agent, subdomain, {
      customer_name: "Alpha Paid",
      amount_egp: 100,
    });
    const confirmedUnpaid = await createManualOrder(agent, subdomain, {
      customer_name: "Beta Unpaid",
      amount_egp: 50,
    });
    const cancelledPaid = await createManualOrder(agent, subdomain, {
      customer_name: "Gamma Paid",
      amount_egp: 25,
    });

    await payOrder(agent, subdomain, pendingPaid.id).expect(200);
    await payOrder(agent, subdomain, cancelledPaid.id).expect(200);
    await setOrderStatus(agent, subdomain, confirmedUnpaid.id, "confirmed").expect(200);
    await setOrderStatus(agent, subdomain, cancelledPaid.id, "cancelled").expect(200);

    const paid = await agent.get(`${base}?paymentStatus=paid&pageSize=100`).expect(200);
    expect(paid.body.orders).toHaveLength(2);
    expect(paid.body.status_counts).toEqual({ pending: 1, cancelled: 1 });

    // The status filter itself must not hide the other pills: counts still
    // reflect the paid filter, while the order list obeys `status=confirmed`.
    const filteredByStatus = await agent.get(`${base}?status=confirmed&paymentStatus=paid`).expect(200);
    expect(filteredByStatus.body.orders).toHaveLength(0);
    expect(filteredByStatus.body.status_counts).toEqual({ pending: 1, cancelled: 1 });

    const searched = await agent.get(`${base}?paymentStatus=paid&search=beta`).expect(200);
    expect(searched.body.orders).toHaveLength(0);
    expect(searched.body.status_counts).toEqual({});

    // Date filters also apply to the counters.
    await prisma.order.update({
      where: { id: pendingPaid.id },
      data: { createdAt: new Date(Date.now() - 10 * 86_400_000) },
    });
    const from = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const recent = await agent.get(`${base}?paymentStatus=paid&from=${encodeURIComponent(from)}`).expect(200);
    expect(recent.body.orders.map((o: any) => o.id)).toEqual([cancelledPaid.id]);
    expect(recent.body.status_counts).toEqual({ cancelled: 1 });
  });
});

describe("Phase 1 checkout idempotency and coupon serialisation", () => {
  it("replays the original order for a repeated Idempotency-Key and decrements stock once", async () => {
    const { agent, subdomain } = await registerMerchant("idem");
    await createProduct(agent, subdomain, { sku: "IDEM-1", price_egp: 50, stock: 5 });
    const key = `checkout-${Date.now()}`;
    const payload = { customer_name: "Retry", customer_phone: "01011111111", items: [{ sku: "IDEM-1", qty: 1 }] };

    const [first, second] = await Promise.all([
      request(app).post(`/api/stores/${subdomain}/checkout`).set("Idempotency-Key", key).send(payload),
      request(app).post(`/api/stores/${subdomain}/checkout`).set("Idempotency-Key", key).send(payload),
    ]);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.order.orderNumber).toBe(second.body.order.orderNumber);

    const store = await prisma.store.findUnique({ where: { subdomain } });
    expect(await prisma.order.count({ where: { storeId: store!.id } })).toBe(1);
    const product = await prisma.product.findFirst({ where: { storeId: store!.id, sku: "IDEM-1" } });
    expect(product?.stock).toBe(4);

    const different = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .set("Idempotency-Key", `${key}-different`)
      .send(payload)
      .expect(201);
    expect(different.body.order.orderNumber).not.toBe(first.body.order.orderNumber);
    expect((await prisma.product.findFirst({ where: { sku: "IDEM-1" } }))?.stock).toBe(3);

    // Reusing a key for a different cart must be rejected instead of silently
    // returning the earlier order.
    const changed = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .set("Idempotency-Key", key)
      .send({ ...payload, items: [{ sku: "IDEM-1", qty: 2 }] })
      .expect(409);
    expect(changed.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect((await prisma.product.findFirst({ where: { sku: "IDEM-1" } }))?.stock).toBe(3);

    const invalid = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .set("Idempotency-Key", "short")
      .send(payload)
      .expect(400);
    expect(invalid.body.error.code).toBe("INVALID_IDEMPOTENCY_KEY");
  });

  it("serialises maxUses so concurrent checkouts cannot redeem a one-use coupon twice", async () => {
    const { agent, subdomain } = await registerMerchant("cpn");
    await createProduct(agent, subdomain, { sku: "CPN-1", price_egp: 100, stock: 10 });
    await agent
      .post(`/api/stores/${subdomain}/coupons`)
      .send({ code: "ONCE", type: "percentage", value: 10, maxUses: 1 })
      .expect(201);

    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post(`/api/stores/${subdomain}/checkout`)
          .send({
            customer_name: `Coupon ${i}`,
            customer_phone: `0100000000${i}`,
            coupon_code: "ONCE",
            items: [{ sku: "CPN-1", qty: 1 }],
          })
          .then((r) => ({ status: r.status, code: (r.body?.error as any)?.code }))
      )
    );

    expect(attempts.filter((a) => a.status === 201)).toHaveLength(1);
    const limited = attempts.filter((a) => a.status !== 201);
    expect(limited).toHaveLength(4);
    expect(limited.every((a) => a.code === "COUPON_LIMIT_REACHED")).toBe(true);

    const store = await prisma.store.findUnique({ where: { subdomain } });
    expect(await prisma.order.count({ where: { storeId: store!.id } })).toBe(1);
    expect(await prisma.couponUsage.count({ where: { storeId: store!.id } })).toBe(1);
    expect((await prisma.product.findFirst({ where: { storeId: store!.id, sku: "CPN-1" } }))?.stock).toBe(9);
  });

  it("normalises phone identity for per-customer coupon limits and customer rows", async () => {
    const { agent, subdomain } = await registerMerchant("ident");
    await createProduct(agent, subdomain, { sku: "ID-1", price_egp: 100, stock: 10 });
    await agent
      .post(`/api/stores/${subdomain}/coupons`)
      .send({ code: "PERPHONE", type: "percentage", value: 10, perCustomerLimit: 1 })
      .expect(201);

    const first = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({
        customer_name: "Same Person",
        customer_phone: "+20 100 123 4567",
        coupon_code: "PERPHONE",
        items: [{ sku: "ID-1", qty: 1 }],
      })
      .expect(201);
    const firstOrder = await prisma.order.findFirst({
      where: { storeId: (await prisma.store.findUnique({ where: { subdomain } }))!.id, orderNumber: first.body.order.orderNumber },
      select: { customerPhone: true },
    });
    expect(firstOrder?.customerPhone).toBe("201001234567");

    const second = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({
        customer_name: "Same Person",
        customer_phone: "0020-100-123-4567",
        coupon_code: "PERPHONE",
        items: [{ sku: "ID-1", qty: 1 }],
      })
      .expect(400);
    expect(second.body.error.code).toBe("COUPON_CUSTOMER_LIMIT");

    const store = await prisma.store.findUnique({ where: { subdomain } });
    expect(await prisma.customer.count({ where: { storeId: store!.id } })).toBe(1);
    const customer = await prisma.customer.findFirst({ where: { storeId: store!.id } });
    expect(customer?.phone).toBe("201001234567");
  });

  it("normalises manual order customer identity without creating duplicates", async () => {
    const { agent, subdomain } = await registerMerchant("manual");
    const first = await createManualOrder(agent, subdomain, {
      customer_name: "Manual One",
      customer_phone: "+20 100 000 0002",
      customer_email: " TEST@Example.COM ",
      amount_egp: 10,
    });
    const second = await createManualOrder(agent, subdomain, {
      customer_name: "Manual Two",
      customer_phone: "0020-100-000-0002",
      customer_email: "test@example.com",
      amount_egp: 20,
    });

    expect(first.customerPhone).toBe("201000000002");
    expect(first.customerEmail).toBe("test@example.com");
    expect(second.customerPhone).toBe("201000000002");
    expect(second.customerId).toBe(first.customerId);

    const store = await prisma.store.findUnique({ where: { subdomain } });
    expect(await prisma.customer.count({ where: { storeId: store!.id } })).toBe(1);
  });
});

describe("Phase 1 refund and payment concurrency", () => {
  it("never reserves more than the order amount and finalises refunds atomically", async () => {
    const { agent, subdomain } = await registerMerchant("rfd");
    const order = await createManualOrder(agent, subdomain, { customer_name: "Refund", amount_egp: 100 });
    await payOrder(agent, subdomain, order.id).expect(200);
    const base = `/api/stores/${subdomain}/orders/${order.id}/refunds`;

    const attempts = await Promise.all([
      agent.post(base).send({ amount: 60, reason: "first" }).then((r) => r),
      agent.post(base).send({ amount: 60, reason: "second" }).then((r) => r),
    ]);
    expect(attempts.filter((r) => r.status === 201)).toHaveLength(1);
    const rejected = attempts.find((r) => r.status !== 201)!;
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe("REFUND_EXCEEDS_ORDER");

    const refundId = attempts.find((r) => r.status === 201)!.body.refund.id;
    const concurrent = await Promise.all([
      agent.patch(`${base}/${refundId}`).send({ status: "processed" }).then((r) => r.status),
      agent.patch(`${base}/${refundId}`).send({ status: "processed" }).then((r) => r.status),
    ]);
    expect(concurrent.sort()).toEqual([200, 409]);

    const afterPartial = await agent.get(`/api/stores/${subdomain}/orders/${order.id}`).expect(200);
    expect(afterPartial.body.order.paymentStatus).toBe("partially_refunded");

    await agent.post(base).send({ amount: 50, reason: "too much" }).expect(400);
    const final = await agent.post(base).send({ amount: 40, reason: "rest" }).expect(201);
    await agent.patch(`${base}/${final.body.refund.id}`).send({ status: "processed" }).expect(200);

    const afterFull = await agent.get(`/api/stores/${subdomain}/orders/${order.id}`).expect(200);
    expect(afterFull.body.order.paymentStatus).toBe("refunded");
    expect(afterFull.body.order.refunds.filter((r: any) => r.status === "processed")).toHaveLength(2);
  });

  it("makes paid idempotent and blocks paid -> unpaid", async () => {
    const { agent, subdomain } = await registerMerchant("pay");
    const order = await createManualOrder(agent, subdomain, { customer_name: "Pay", amount_egp: 100 });

    const concurrent = await Promise.all([
      payOrder(agent, subdomain, order.id).then((r) => r.status),
      payOrder(agent, subdomain, order.id).then((r) => r.status),
    ]);
    expect(concurrent).toEqual([200, 200]);

    const payments = await prisma.payment.findMany({ where: { orderId: order.id, status: "succeeded" } });
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(100);

    // Repeating the current status is a no-op, never a second ledger row.
    await payOrder(agent, subdomain, order.id).expect(200);
    expect(await prisma.payment.count({ where: { orderId: order.id, status: "succeeded" } })).toBe(1);

    const backwards = await agent
      .patch(`/api/stores/${subdomain}/orders/${order.id}/payment-status`)
      .send({ paymentStatus: "unpaid" })
      .expect(409);
    expect(backwards.body.error.code).toBe("INVALID_PAYMENT_TRANSITION");

    const got = await agent.get(`/api/stores/${subdomain}/orders/${order.id}`).expect(200);
    expect(got.body.order.paymentStatus).toBe("paid");
  });
});

describe("Phase 1 loyalty lifecycle", () => {
  it("grants points only on delivery and reverses them on return", async () => {
    const { agent, subdomain } = await registerMerchant("loy");
    await createProduct(agent, subdomain, { sku: "LOY-1", price_egp: 100, stock: 5 });
    await agent
      .post(`/api/stores/${subdomain}/loyalty/rules`)
      .send({ name: "نقاط", type: "earn", points: 1, perAmount: 10, minOrderValue: 0 })
      .expect(201);

    const checkout = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Loyal", customer_phone: "01000000099", items: [{ sku: "LOY-1", qty: 1 }] })
      .expect(201);
    const orderId = await orderIdByNumber(subdomain, checkout.body.order.orderNumber);

    expect(await prisma.loyaltyAccount.count()).toBe(0);
    expect(await prisma.loyaltyTransaction.count()).toBe(0);

    for (const status of ["confirmed", "shipped", "delivered"]) {
      await setOrderStatus(agent, subdomain, orderId, status).expect(200);
    }

    let loyalty = await agent.get(`/api/stores/${subdomain}/loyalty`).expect(200);
    expect(loyalty.body.accounts).toHaveLength(1);
    expect(loyalty.body.accounts[0].points).toBe(10);
    const earn = loyalty.body.transactions.find((t: any) => t.type === "earn");
    expect(earn).toMatchObject({ orderId, points: 10 });

    // Repeating delivered cannot double-grant.
    await setOrderStatus(agent, subdomain, orderId, "delivered").expect(409);
    loyalty = await agent.get(`/api/stores/${subdomain}/loyalty`).expect(200);
    expect(loyalty.body.accounts[0].points).toBe(10);
    expect(loyalty.body.transactions.filter((t: any) => t.type === "earn")).toHaveLength(1);

    await setOrderStatus(agent, subdomain, orderId, "returned").expect(200);
    loyalty = await agent.get(`/api/stores/${subdomain}/loyalty`).expect(200);
    expect(loyalty.body.accounts[0].points).toBe(0);
    const revoke = loyalty.body.transactions.find((t: any) => t.type === "revoke");
    expect(revoke).toMatchObject({ orderId, points: -10 });
    expect(loyalty.body.transactions).toHaveLength(2);
  });

  it("does not grant points for an order cancelled before delivery", async () => {
    const { agent, subdomain } = await registerMerchant("loyc");
    await createProduct(agent, subdomain, { sku: "LOYC-1", price_egp: 100, stock: 5 });
    await agent
      .post(`/api/stores/${subdomain}/loyalty/rules`)
      .send({ name: "نقاط", type: "earn", points: 1, perAmount: 10 })
      .expect(201);

    const checkout = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Cancelled", customer_phone: "01000000098", items: [{ sku: "LOYC-1", qty: 1 }] })
      .expect(201);
    const checkoutId = await orderIdByNumber(subdomain, checkout.body.order.orderNumber);
    await setOrderStatus(agent, subdomain, checkoutId, "cancelled").expect(200);

    expect(await prisma.loyaltyTransaction.count()).toBe(0);
    expect(await prisma.loyaltyAccount.count()).toBe(0);
  });
});

describe("Phase 1 reports period consistency", () => {
  it("scopes discounts, shipping and expenses to the selected period and excludes lost orders", async () => {
    const { agent, subdomain, store } = await registerMerchant("rep");
    const base = `/api/stores/${subdomain}/orders`;
    const now = Date.now();

    const valid = await agent.post(base).send({ customer_name: "Valid", amount_egp: 100 }).expect(201);
    const cancelled = await agent.post(base).send({ customer_name: "Cancelled", amount_egp: 500 }).expect(201);
    const old = await agent.post(base).send({ customer_name: "Old", amount_egp: 300 }).expect(201);

    await setOrderStatus(agent, subdomain, cancelled.body.order.id, "cancelled").expect(200);
    await prisma.order.update({
      where: { id: valid.body.order.id },
      data: { discount: 10, shippingFee: 5, createdAt: new Date(now) },
    });
    await prisma.order.update({
      where: { id: cancelled.body.order.id },
      data: { discount: 50, shippingFee: 50, createdAt: new Date(now) },
    });
    await prisma.order.update({
      where: { id: old.body.order.id },
      data: { discount: 30, shippingFee: 30, createdAt: new Date(now - 40 * 86_400_000) },
    });

    const wallet = await prisma.walletAccount.upsert({
      where: { storeId: store.id },
      update: {},
      create: { id: uid("wal_"), storeId: store.id },
    });
    for (const [amount, createdAt] of [
      [7, new Date(now - 86_400_000)],
      [99, new Date(now - 40 * 86_400_000)],
    ] as const) {
      await prisma.walletTransaction.create({
        data: {
          id: uid("wtx_"),
          storeId: store.id,
          accountId: wallet.id,
          type: "fee",
          amount,
          status: "completed",
          createdAt,
        },
      });
    }

    const from = new Date(now - 2 * 86_400_000).toISOString();
    const to = new Date(now + 60_000).toISOString();
    const report = await agent
      .get(`/api/stores/${subdomain}/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .expect(200);

    expect(report.body.totals).toMatchObject({
      orders: 2,
      validOrders: 1,
      revenue: 100,
      averageOrderValue: 100,
      discounts: 10,
      shippingCollected: 5,
      cancelled: 1,
      returned: 0,
      completedExpenses: 7,
      estimatedNet: 93,
    });
    expect(report.body.series.reduce((sum: number, row: any) => sum + row.discounts, 0)).toBe(10);
    expect(report.body.orders_by_status.cancelled).toBe(1);
  });
});
