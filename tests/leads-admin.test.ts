import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("leads scoping and admin route", () => {
  it("merchants see only their own store leads; others never leak", async () => {
    const a = await registerMerchant("lda");
    const b = await registerMerchant("ldb");

    await a.agent.post("/api/leads").send({ type: "a-probe", payload: { from: "a" } }).expect(201);
    await b.agent.post("/api/leads").send({ type: "b-probe", payload: { from: "b" } }).expect(201);
    await request(app).post("/api/leads").send({ type: "anon-probe", payload: {} }).expect(201);

    const mine = await a.agent.get("/api/leads").expect(200);
    expect(mine.body.leads.map((l: { type: string }) => l.type)).toEqual(["a-probe"]);

    const others = await b.agent.get("/api/leads").expect(200);
    expect(others.body.leads.map((l: { type: string }) => l.type)).toEqual(["b-probe"]);
  });

  it("non-admin gets 403 on /api/admin/leads; admin sees all", async () => {
    const m = await registerMerchant("adm");
    await m.agent.post("/api/leads").send({ type: "m-probe", payload: {} }).expect(201);

    await m.agent.get("/api/admin/leads").expect(403);

    await prisma.merchant.update({ where: { id: m.merchant.id }, data: { role: "admin" } });
    const all = await m.agent.get("/api/admin/leads").expect(200);
    expect(all.body.leads.length).toBeGreaterThanOrEqual(1);
  });

  it("no admin env var changes behaviour; payload bounds enforced", async () => {
    const m = await registerMerchant("bnd");
    // legacy shared-secret header must have no effect anymore
    await m.agent.get("/api/leads").set("x-admin-token", "whatever").expect(200);

    const big: Record<string, string> = {};
    for (let i = 0; i < 200; i++) big[`k${i}`] = "x".repeat(100);
    await m.agent.post("/api/leads").send({ type: "big", payload: big }).expect(400);
    await m.agent.post("/api/leads").send({ type: "arr", payload: [1, 2, 3] }).expect(400);
    await m.agent.post("/api/leads").send({ type: "str", payload: "nope" }).expect(400);
    await m.agent.post("/api/leads").send({ type: "ok", payload: { a: 1 } }).expect(201);
  });
});
