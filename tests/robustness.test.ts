import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("robustness", () => {
  it("reserved subdomains are rejected at registration", async () => {
    for (const sub of ["www", "api", "admin", "app", "mail", "static", "assets"]) {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: `${sub}@test.com`, password: "Password123", storeName: "Reserved", subdomain: sub });
      expect(res.status).toBe(400);
    }
    // non-reserved names containing those words still work
    await request(app)
      .post("/api/auth/register")
      .send({ email: "apiary@test.com", password: "Password123", storeName: "Apiary", subdomain: "apiary-shop" })
      .expect(201);
  });

  it("email is trimmed and lowercased at registration", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "  MiXeD@TeSt.CoM ", password: "Password123", storeName: "Case Shop", subdomain: "caseshop" })
      .expect(201);
    expect(res.body.merchant.email).toBe("mixed@test.com");
    const row = await prisma.merchant.findUnique({ where: { email: "mixed@test.com" } });
    expect(row).not.toBeNull();
    await request(app).post("/api/auth/login").send({ email: "MIXED@test.com", password: "Password123" }).expect(200);
  });

  it("CORS rejection returns 403 JSON, not 500", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://evil.example.com");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CORS_ORIGIN_REJECTED");
    const ok = await request(app).get("/api/health").set("Origin", "http://localhost:3000");
    expect(ok.status).toBe(200);
  });
});
