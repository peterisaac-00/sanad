import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("plan integrity (server-assigned, never client-writable)", () => {
  it("register ignores/rejects client plan; new stores get the server default", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "plan1@test.com",
        password: "Password123",
        storeName: "Plan Shop",
        subdomain: "planshop",
        selectedPlan: "monthly",
      })
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    const { store } = await registerMerchant("pland");
    expect(store.plan).toBe("annual");
  });

  it("PATCH store settings rejects plan changes", async () => {
    const { agent } = await registerMerchant("planp");
    await agent.patch("/api/account/store").send({ selectedPlan: "monthly" }).expect(400);
    await agent.patch("/api/account/store").send({ plan: "monthly" }).expect(400);
    const after = await agent.get("/api/account/store").expect(200);
    expect(after.body.store.plan).toBe("annual");
  });
});
