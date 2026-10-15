import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("products CRUD + validation", () => {
  it("full lifecycle: create, get, update, search, paginate, delete", async () => {
    const { agent, subdomain } = await registerMerchant("crud");
    const base = `/api/stores/${subdomain}/products`;

    const c1 = await agent.post(base).send({ sku: "CRUD-1", name_en: "Alpha", price_egp: 100, price_sar: 8, stock: 5 }).expect(201);
    const c2 = await agent.post(base).send({ sku: "CRUD-2", name_en: "Beta", price_egp: 200, stock: 3 }).expect(201);
    expect(c1.body.product.sku).toBe("CRUD-1");

    await agent.post(base).send({ sku: "CRUD-1", price_egp: 1 }).expect(409);

    const got = await agent.get(`${base}/${c1.body.product.id}`).expect(200);
    expect(got.body.product.nameEn).toBe("Alpha");

    await agent.get(`${base}/prod_does_not_exist`).expect(404);

    const search = await agent.get(`${base}?search=beta`).expect(200);
    expect(search.body.products.map((p: { sku: string }) => p.sku)).toEqual(["CRUD-2"]);

    const page = await agent.get(`${base}?page=2&pageSize=1`).expect(200);
    expect(page.body.pagination).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect(page.body.products).toHaveLength(1);

    await agent.put(`${base}/${c1.body.product.id}`).send({}).expect(400);
    const upd = await agent.put(`${base}/${c1.body.product.id}`).send({ price_egp: 150, stock: 9 }).expect(200);
    expect(upd.body.product.priceEgp).toBe(150);
    expect(upd.body.product.stock).toBe(9);
    await agent.put(`${base}/${c1.body.product.id}`).send({ sku: "CRUD-2" }).expect(409);
    await agent.put(`${base}/${c1.body.product.id}`).send({ price_egp: -1 }).expect(400);

    await agent.delete(`${base}/${c2.body.product.id}`).expect(200);
    await agent.delete(`${base}/${c2.body.product.id}`).expect(404);
  });
});

describe("orders: filters, transitions, summary", () => {
  it("lists with status/date filters, enforces transitions, summarizes real data", async () => {
    const { agent, subdomain } = await registerMerchant("ord");
    const base = `/api/stores/${subdomain}/orders`;

    const o1 = await agent.post(base).send({ customer_name: "Buyer One", amount_egp: 100 }).expect(201);
    await agent.post(base).send({ customer_name: "Buyer Two", amount_egp: 300 }).expect(201);
    const oid = o1.body.order.id;

    const all = await agent.get(`${base}?pageSize=50`).expect(200);
    expect(all.body.pagination.total).toBe(2);

    const pend = await agent.get(`${base}?status=pending`).expect(200);
    expect(pend.body.pagination.total).toBe(2);

    await agent.patch(`/api/stores/${subdomain}/orders/${oid}/status`).send({ status: "delivered" }).expect(422);
    await agent.patch(`/api/stores/${subdomain}/orders/${oid}/status`).send({ status: "confirmed" }).expect(200);
    await agent.patch(`/api/stores/${subdomain}/orders/${oid}/status`).send({ status: "pending" }).expect(422);
    await agent.patch(`/api/stores/${subdomain}/orders/${oid}/status`).send({ status: "bogus" }).expect(400);

    const conf = await agent.get(`${base}?status=confirmed`).expect(200);
    expect(conf.body.pagination.total).toBe(1);

    const now = new Date();
    const from = new Date(now.getTime() - 3600_000).toISOString();
    const to = new Date(now.getTime() + 3600_000).toISOString();
    const ranged = await agent.get(`${base}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).expect(200);
    expect(ranged.body.pagination.total).toBe(2);
    const future = await agent.get(`${base}?from=${encodeURIComponent(new Date(now.getTime() + 7200_000).toISOString())}`).expect(200);
    expect(future.body.pagination.total).toBe(0);

    const one = await agent.get(`/api/stores/${subdomain}/orders/${oid}`).expect(200);
    expect(one.body.order.id).toBe(oid);

    const sum = await agent.get(`/api/stores/${subdomain}/summary`).expect(200);
    expect(sum.body.kpis.total_orders).toBe(2);
    expect(sum.body.kpis.total_sales_egp).toBe(400);
    expect(sum.body.kpis.avg_order_egp).toBe(200);
  });

  it("store settings get/update; subdomain immutable", async () => {
    const { agent } = await registerMerchant("set");
    const before = await agent.get("/api/account/store").expect(200);
    expect(before.body.store.subdomain).toMatch(/^s/);
    await agent.patch("/api/account/store").send({}).expect(400);
    const upd = await agent
      .patch("/api/account/store")
      .send({ storeName: "Renamed", phone: "01234567890", storeCurrency: "SAR" })
      .expect(200);
    expect(upd.body.store.storeName).toBe("Renamed");
    expect(upd.body.store.currency).toBe("SAR");
    expect(upd.body.store.plan).toBe("annual");
    // subdomain is not accepted at all (strict schema rejects unknown field)
    await agent.patch("/api/account/store").send({ subdomain: "hijack" }).expect(400);
  });
});

describe("public checkout: server-side pricing", () => {
  it("computes totals from catalog, moves stock, rejects abuse", async () => {
    const { agent, subdomain } = await registerMerchant("co");
    await agent.post(`/api/stores/${subdomain}/products`).send({ sku: "CO-1", name_en: "Item", price_egp: 120, stock: 4 }).expect(201);
    await agent.post(`/api/stores/${subdomain}/products`).send({ sku: "CO-2", name_en: "Item2", price_egp: 30, stock: 10 }).expect(201);

    // no auth needed; client cannot set totals (schema rejects unknown fields)
    const ok = await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "Shopper", city: "Giza", items: [{ sku: "CO-1", qty: 2 }, { sku: "CO-2", qty: 1 }] })
      .expect(201);
    expect(ok.body.order.amountEgp).toBe(270);
    expect(ok.body.order.status).toBe("pending");
    expect(ok.body.order.items).toHaveLength(2);

    const stock = await agent.get(`/api/stores/${subdomain}/products?pageSize=50`).expect(200);
    const co1 = stock.body.products.find((p: { sku: string }) => p.sku === "CO-1");
    expect(co1.stock).toBe(2);

    await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "X", items: [{ sku: "CO-1", qty: 99 }] })
      .expect(409);
    await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "X", items: [{ sku: "NOPE", qty: 1 }] })
      .expect(400);
    // attempted price override is rejected as unknown field
    await request(app)
      .post(`/api/stores/${subdomain}/checkout`)
      .send({ customer_name: "X", items: [{ sku: "CO-2", qty: 1 }], amountEgp: 1 })
      .expect(400);
    await request(app).post(`/api/stores/${subdomain}/checkout`).send({ customer_name: "X", items: [] }).expect(400);
    await request(app).post("/api/stores/no-such-shop/checkout").send({ customer_name: "X", items: [{ sku: "CO-1", qty: 1 }] }).expect(404);
  });
});

describe("rate limiting on auth endpoints", () => {
  it("throttles repeated login attempts with 429", async () => {
    const { email } = await registerMerchant("rl");
    let last = 0;
    for (let i = 0; i < 31; i++) {
      const r = await request(app).post("/api/auth/login").send({ email, password: "WrongPass1" });
      last = r.status;
    }
    expect(last).toBe(429);
  });
});
