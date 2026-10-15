import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import { app, prisma, registerMerchant, truncateAll, closeDb } from "./helpers.js";
import { cleanupExpiredSessions } from "../server/sessions.js";
import { ARGON_OPTS } from "../server/auth.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("auth hardening", () => {
  it("(a) unknown email costs an argon2 verify: timing matches wrong-password", async () => {
    const { email } = await registerMerchant("tim");
    const t0 = Date.now();
    const unknown = await request(app).post("/api/auth/login").send({ email: "ghost@test.com", password: "Whatever12" });
    const unknownMs = Date.now() - t0;
    const t1 = Date.now();
    const wrong = await request(app).post("/api/auth/login").send({ email, password: "WrongPass1" });
    const wrongMs = Date.now() - t1;

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toEqual(wrong.body.error);
    // dummy verify must dominate: unknown-email path cannot be instant
    expect(unknownMs).toBeGreaterThan(20);
    expect(Math.abs(unknownMs - wrongMs)).toBeLessThan(500);
  });

  it("(b) outdated argon2 params are upgraded via needsRehash on login", async () => {
    const { email, merchant } = await registerMerchant("reh");
    const weak = await argon2.hash("Password123", { type: argon2.argon2id, memoryCost: 8192, timeCost: 1, parallelism: 1 });
    expect(argon2.needsRehash(weak, { ...ARGON_OPTS })).toBe(true);
    await prisma.merchant.update({ where: { id: merchant.id }, data: { passwordHash: weak } });

    await request(app).post("/api/auth/login").send({ email, password: "Password123" }).expect(200);
    const row = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    expect(row?.passwordHash).not.toBe(weak);
    expect(argon2.needsRehash(row!.passwordHash, { ...ARGON_OPTS })).toBe(false);
  });

  it("(c) login deletes the incoming valid session (no accumulation)", async () => {
    const { email, merchant } = await registerMerchant("rot");
    const first = request.agent(app);
    await first.post("/api/auth/login").send({ email, password: "Password123" }).expect(200);
    expect(await prisma.session.count({ where: { merchantId: merchant.id } })).toBe(2);
    // second login presenting the register-time cookie rotates it away
    const second = request.agent(app);
    await second.post("/api/auth/login").send({ email, password: "Password123" }).expect(200);
    expect(await prisma.session.count({ where: { merchantId: merchant.id } })).toBe(3);
    await first.post("/api/auth/login").send({ email, password: "Password123" }).expect(200);
    expect(await prisma.session.count({ where: { merchantId: merchant.id } })).toBe(3);
  });

  it("(d) expired sessions are cleaned up by the janitor", async () => {
    const { merchant } = await registerMerchant("jan");
    await prisma.session.create({
      data: { tokenHash: "x".repeat(64), merchantId: merchant.id, expiresAt: new Date(Date.now() - 1000) },
    });
    const deleted = await cleanupExpiredSessions();
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await prisma.session.findUnique({ where: { tokenHash: "x".repeat(64) } })).toBeNull();
  });

  it("(e) dev/test cookie keeps the plain name", async () => {
    expect(process.env.NODE_ENV).not.toBe("production");
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "cookie@test.com", password: "Password123", storeName: "Cookie Shop", subdomain: "cookiejar" })
      .expect(201);
    const raw = res.headers["set-cookie"];
    const cookie = (Array.isArray(raw) ? raw.join(";") : String(raw ?? "")).split(",").join(";");
    expect(cookie).toMatch(/sanad_session=/);
    expect(cookie).not.toMatch(/__Host-/);
  });
});
