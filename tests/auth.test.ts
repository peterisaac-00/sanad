import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, registerMerchant, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("auth: register/login/logout", () => {
  it("registers store+merchant atomically and sets an httpOnly cookie", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/auth/register")
      .send({ email: "new@test.com", password: "Password123", storeName: "New Shop", subdomain: "newshop" })
      .expect(201);
    expect(res.body.merchant.email).toBe("new@test.com");
    expect(res.body.store.subdomain).toBe("newshop");
    expect(res.body.token).toBeUndefined();
    const rawCookie = res.headers["set-cookie"] ?? "";
    const cookie = Array.isArray(rawCookie) ? rawCookie.join(";") : String(rawCookie);
    expect(cookie).toMatch(/sanad_session=/);
    expect(cookie).toMatch(/httponly/i);
    expect(cookie).toMatch(/samesite=lax/i);
    const row = await prisma.merchant.findUnique({ where: { email: "new@test.com" } });
    expect(row?.passwordAlgo).toBe("argon2id");
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("rejects duplicate email (409) and duplicate subdomain (409)", async () => {
    const { email, subdomain } = await registerMerchant("dup");
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "Password123", storeName: "Other", subdomain: "other-sub" })
      .expect(409);
    await request(app)
      .post("/api/auth/register")
      .send({ email: "other@test.com", password: "Password123", storeName: "Other", subdomain })
      .expect(409);
  });

  it("rejects invalid input with 400 (bad email, short password, unknown field)", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "Password123", storeName: "S", subdomain: "s1x" })
      .expect(400);
    await request(app)
      .post("/api/auth/register")
      .send({ email: "ok@test.com", password: "short", storeName: "S", subdomain: "s1y" })
      .expect(400);
    await request(app)
      .post("/api/auth/register")
      .send({ email: "ok2@test.com", password: "Password123", storeName: "S", subdomain: "s1z", evil: 1 })
      .expect(400);
  });

  it("login succeeds with correct password, fails with wrong password (401, generic message)", async () => {
    const { agent, email } = await registerMerchant("login");
    await agent.post("/api/auth/logout");
    await request(app).post("/api/auth/login").send({ email, password: "Password123" }).expect(200);
    const bad = await request(app).post("/api/auth/login").send({ email, password: "WrongPass1" }).expect(401);
    expect(bad.body.error.code).toBe("INVALID_CREDENTIALS");
    const missing = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "Whatever12" })
      .expect(401);
    expect(missing.body.error.message).toBe(bad.body.error.message);
  });

  it("logout invalidates the session server-side; me returns 401 afterwards", async () => {
    const { agent } = await registerMerchant("logout");
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it("expired sessions are rejected and purged on use", async () => {
    const { email, merchant } = await registerMerchant("exp");
    await prisma.session.deleteMany({ where: { merchantId: merchant.id } });
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email, password: "Password123" }).expect(200);
    expect(await prisma.session.count({ where: { merchantId: merchant.id } })).toBe(1);
    await prisma.session.updateMany({
      where: { merchantId: merchant.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await agent.get("/api/auth/me").expect(401);
    expect(res.body.error.code).toBe("SESSION_EXPIRED");
    expect(await prisma.session.count({ where: { merchantId: merchant.id } })).toBe(0);
  });

  it("change password requires current password and rotates other sessions", async () => {
    const { agent, email, merchant } = await registerMerchant("pw");
    await request(app).post("/api/auth/login").send({ email, password: "Password123" }).expect(200);
    expect(await prisma.session.count({ where: { merchantId: merchant.id } })).toBe(2);
    await agent
      .post("/api/auth/password")
      .send({ currentPassword: "Nope12345", newPassword: "NewPass456" })
      .expect(401);
    await agent.post("/api/auth/password").send({ currentPassword: "Password123", newPassword: "NewPass456" }).expect(200);
    // other devices logged out, current session kept
    expect(await prisma.session.count({ where: { merchantId: merchant.id } })).toBe(1);
    await agent.get("/api/auth/me").expect(200);
    await request(app).post("/api/auth/login").send({ email, password: "Password123" }).expect(401);
    await request(app).post("/api/auth/login").send({ email, password: "NewPass456" }).expect(200);
  });

  it("legacy scrypt hash verifies and re-hashes to argon2id on login", async () => {
    const { store } = await registerMerchant("reh");
    const { scryptSync, randomBytes } = await import("node:crypto");
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync("Legacy123!", salt, 64).toString("hex");
    await prisma.merchant.create({
      data: {
        id: "merch_legacy1",
        storeId: store.id,
        storeHandle: store.subdomain,
        email: "legacy@test.com",
        passwordHash: hash,
        passwordSalt: salt,
        passwordAlgo: "scrypt",
        name: "Legacy",
      },
    });
    await request(app).post("/api/auth/login").send({ email: "legacy@test.com", password: "Legacy123!" }).expect(200);
    const row = await prisma.merchant.findUnique({ where: { email: "legacy@test.com" } });
    expect(row?.passwordAlgo).toBe("argon2id");
    expect(row?.passwordSalt).toBeNull();
  });

  it("DEMO_MODE off: demo credentials are rejected", async () => {
    expect(process.env.DEMO_MODE).not.toBe("true");
    await request(app)
      .post("/api/auth/login")
      .send({ email: "merchant@saraya.sanad.app", password: "anything12" })
      .expect(401);
  });
});
