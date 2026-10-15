import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

/**
 * Authorization matrix (OWASP A01): every endpoint is exercised as
 * - anonymous (no cookie)            -> expect 401 (or 404 for safe public lookups)
 * - other merchant (valid session)   -> expect 403 (or 404 where noted)
 * - owner                            -> expect success
 *
 * Public allowlist (no auth by design): health, register, login,
 * public storefront lookup, public checkout, leads capture.
 */
describe("authorization matrix", () => {
  it("covers every endpoint", async () => {
    const a = await registerMerchant("mxa");
    const b = await registerMerchant("mxb");

    // Seed one product + one order in A's store (as A).
    const prod = await a.agent
      .post(`/api/stores/${a.subdomain}/products`)
      .send({ sku: "MX-1", name_en: "Matrix Tee", price_egp: 100, stock: 10 })
      .expect(201);
    const productId = prod.body.product.id;
    const order = await a.agent
      .post(`/api/stores/${a.subdomain}/orders`)
      .send({ customer_name: "Matrix Buyer", amount_egp: 100 })
      .expect(201);
    const orderId = order.body.order.id;

    const anon = request(app);
    type Case = { name: string; anon: number; other: number; owner: number };
    const results: (Case & { ok: boolean })[] = [];
    async function check(
      name: string,
      method: "get" | "post" | "put" | "patch" | "delete",
      path: string,
      body: unknown,
      expected: Case
    ) {
      const run = async (agent: typeof anon | typeof a.agent, withBody: boolean) => {
        let r = agent[method](path);
        if (withBody && body !== undefined) r = r.send(body as object);
        return (await r).status;
      };
      const gotAnon = await run(anon, true);
      const gotOther = await run(b.agent, true);
      const gotOwner = await run(a.agent, true);
      const ok = gotAnon === expected.anon && gotOther === expected.other && gotOwner === expected.owner;
      results.push({ ...expected, name, ok });
      if (!ok) {
        console.log(`[matrix] ${name}: anon=${gotAnon}(exp ${expected.anon}) other=${gotOther}(exp ${expected.other}) owner=${gotOwner}(exp ${expected.owner})`);
      }
    }

    await check("GET /api/auth/me", "get", "/api/auth/me", undefined, { name: "", anon: 401, other: 200, owner: 200 });
    await check("POST /api/auth/logout", "post", "/api/auth/logout", undefined, { name: "", anon: 401, other: 200, owner: 200 });
    // logout destroyed both sessions: sign back in before the remaining checks.
    await a.agent.post("/api/auth/login").send({ email: a.email, password: "Password123" }).expect(200);
    await b.agent.post("/api/auth/login").send({ email: b.email, password: "Password123" }).expect(200);
    await check("POST /api/auth/password", "post", "/api/auth/password", { currentPassword: "Password123", newPassword: "OtherPass1" }, { name: "", anon: 401, other: 200, owner: 200 });
    await check("GET /api/stores (own only)", "get", "/api/stores", undefined, { name: "", anon: 401, other: 200, owner: 200 });
    await check("GET /api/stores/:sub/products", "get", `/api/stores/${a.subdomain}/products`, undefined, { name: "", anon: 401, other: 403, owner: 200 });
    await check("POST /api/stores/:sub/products", "post", `/api/stores/${a.subdomain}/products`, { sku: "MX-2" }, { name: "", anon: 401, other: 403, owner: 201 });
    await check("GET /api/stores/:sub/products/:id", "get", `/api/stores/${a.subdomain}/products/${productId}`, undefined, { name: "", anon: 401, other: 403, owner: 200 });
    await check("PUT /api/stores/:sub/products/:id", "put", `/api/stores/${a.subdomain}/products/${productId}`, { stock: 7 }, { name: "", anon: 401, other: 403, owner: 200 });
    await check("DELETE /api/stores/:sub/products/:id", "delete", `/api/stores/${a.subdomain}/products/${productId}`, undefined, { name: "", anon: 401, other: 403, owner: 200 });
    await check("GET /api/stores/:sub/orders", "get", `/api/stores/${a.subdomain}/orders`, undefined, { name: "", anon: 401, other: 403, owner: 200 });
    await check("POST /api/stores/:sub/orders", "post", `/api/stores/${a.subdomain}/orders`, { customer_name: "X" }, { name: "", anon: 401, other: 403, owner: 201 });
    await check("GET /api/stores/:sub/orders/:id", "get", `/api/stores/${a.subdomain}/orders/${orderId}`, undefined, { name: "", anon: 401, other: 403, owner: 200 });
    await check("PATCH /api/stores/:sub/orders/:id/status", "patch", `/api/stores/${a.subdomain}/orders/${orderId}/status`, { status: "confirmed" }, { name: "", anon: 401, other: 403, owner: 200 });
    await check("GET /api/stores/:sub/summary", "get", `/api/stores/${a.subdomain}/summary`, undefined, { name: "", anon: 401, other: 403, owner: 200 });
    await check("GET /api/account/store", "get", "/api/account/store", undefined, { name: "", anon: 401, other: 200, owner: 200 });
    await check("PATCH /api/account/store", "patch", "/api/account/store", { phone: "01000000000" }, { name: "", anon: 401, other: 200, owner: 200 });
    await check("GET /api/leads", "get", "/api/leads", undefined, { name: "", anon: 401, other: 200, owner: 200 });

    // Public allowlist: anonymous must succeed (or 404 for unknown store), never 401.
    const pub1 = await anon.get(`/api/stores/${a.subdomain}`).expect(200);
    expect(pub1.body.store.phone).toBeUndefined();
    await anon.get("/api/stores/no-such-store-xyz").expect(404);
    await a.agent
      .post(`/api/stores/${a.subdomain}/products`)
      .send({ sku: "MX-9", name_en: "Checkout Tee", price_egp: 100, stock: 5 })
      .expect(201);
    await anon
      .post(`/api/stores/${a.subdomain}/checkout`)
      .send({ customer_name: "Anon Buyer", items: [{ sku: "MX-9", qty: 1 }] })
      .expect(201);
    await anon.post("/api/leads").send({ type: "probe", payload: {} }).expect(201);
    await anon.get("/api/health").expect(200);

    const failed = results.filter((r) => !r.ok);
    expect(failed).toEqual([]);
  });
});
