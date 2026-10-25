import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveTxt } from "node:dns/promises";
import {
  app,
  prisma,
  registerMerchant,
  registerTeamMember,
  publishStore,
  truncateAll,
  closeDb,
  uid,
} from "./helpers.js";
import { env, parseTrustProxy } from "../server/env.js";
import { evaluateCsrfRequest } from "../server/middleware.js";
import { consumeRateLimit } from "../server/rateLimit.js";
import { UPLOAD_EXTENSIONS, detectSignature, normalizeImage } from "../server/services/media.js";
import { createTrackingToken, trackingUrl, verifyTrackingToken } from "../server/services/tracking.js";
import { maskEmail, maskName, maskPhone, redactForLogs, sanitizeUrlForLogs } from "../server/privacy.js";
import { CSV_BOM, assertExportWithinLimit, csvCell, csvRow } from "../server/services/csv.js";
import { totpCode } from "../server/totp.js";
import {
  cleanupAbandonedCarts,
  cleanupAuditLogs,
  cleanupRateLimitBuckets,
  runRetentionSweep,
} from "../server/retention.js";
import { cleanupExpiredAuthTokens } from "../server/services/authTokens.js";

// DNS is mocked so domain verification tests never depend on the network.
vi.mock("node:dns/promises", () => ({ resolveTxt: vi.fn() }));

type Session = Awaited<ReturnType<typeof registerMerchant>>;

beforeEach(truncateAll);
beforeEach(() => {
  vi.mocked(resolveTxt).mockReset();
  vi.mocked(resolveTxt).mockRejectedValue(new Error("NXDOMAIN"));
});
afterEach(() => {
  vi.useRealTimers();
});
afterAll(closeDb);

async function publishedStoreWithProduct(tag: string, overrides: Record<string, unknown> = {}) {
  const merchant = await registerMerchant(tag);
  await publishStore(merchant);
  const res = await merchant.agent
    .post(`/api/stores/${merchant.subdomain}/products`)
    .send({ sku: `SKU-${tag}`, name_ar: "منتج اختبار", price_egp: 100, stock: 20, ...overrides })
    .expect(201);
  return { merchant, product: res.body.product as Record<string, any> };
}

async function checkout(merchant: Session, body: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/stores/${merchant.subdomain}/checkout`)
    .send({
      customer_name: "هدى",
      customer_phone: "01012345678",
      address: "شارع 1",
      payment_method: "COD",
      items: [{ sku: "SKU-trk", qty: 1 }],
      ...body,
    })
    .expect(201);
}

describe("media hardening", () => {
  it("detects real signatures and accepts only inert raster formats", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toBuffer();
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .jpeg()
      .toBuffer();
    const webp = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .webp()
      .toBuffer();
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

    expect(detectSignature(png)).toBe("png");
    expect(detectSignature(jpeg)).toBe("jpeg");
    expect(detectSignature(webp)).toBe("webp");
    expect(detectSignature(gif)).toBe("gif");
    expect(detectSignature(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(UPLOAD_EXTENSIONS.has(".svg")).toBe(false);
    expect(UPLOAD_EXTENSIONS.has(".html")).toBe(false);

    const normalized = await normalizeImage({ declaredMime: "image/gif", bytes: gif });
    expect(normalized.mimeType).toBe("image/gif");
    expect(detectSignature(normalized.bytes)).toBe("gif");
  });

  it("rejects SVG, disguised HTML, MIME mismatches, oversized payloads and huge dimensions", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toBuffer();

    await expect(
      normalizeImage({ declaredMime: "image/svg+xml", bytes: Buffer.from("<svg/>") })
    ).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
    await expect(
      normalizeImage({ declaredMime: "image/png", bytes: Buffer.from("<html><script>alert(1)</script>") })
    ).rejects.toMatchObject({ status: 415, code: "INVALID_MEDIA_SIGNATURE" });
    await expect(normalizeImage({ declaredMime: "image/jpeg", bytes: png })).rejects.toMatchObject({
      status: 415,
      code: "MEDIA_TYPE_MISMATCH",
    });
    await expect(
      normalizeImage({ declaredMime: "image/png", bytes: Buffer.alloc(env.mediaMaxBytes + 1) })
    ).rejects.toMatchObject({ status: 413, code: "MEDIA_TOO_LARGE" });

    const huge = await sharp({
      create: { width: env.mediaMaxDimension + 1, height: 1, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    await expect(normalizeImage({ declaredMime: "image/png", bytes: huge })).rejects.toMatchObject({
      status: 413,
      code: "MEDIA_DIMENSIONS_TOO_LARGE",
    });
  });

  it("strips EXIF metadata and trailing polyglot payloads by re-encoding", async () => {
    const marker = "PHASE2-PII-MARKER";
    const jpeg = await sharp({ create: { width: 4, height: 3, channels: 3, background: { r: 9, g: 8, b: 7 } } })
      .jpeg()
      .withExif({ IFD0: { Copyright: marker } })
      .toBuffer();
    expect(jpeg.includes(Buffer.from(marker))).toBe(true);

    const clean = await normalizeImage({ declaredMime: "image/jpeg", bytes: jpeg });
    expect(clean.mimeType).toBe("image/jpeg");
    expect(clean.bytes.includes(Buffer.from(marker))).toBe(false);
    const meta = await sharp(clean.bytes).metadata();
    expect(meta.exif).toBeUndefined();

    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toBuffer();
    const script = Buffer.from("<script>alert(1)</script>");
    const polyglot = Buffer.concat([png, script]);
    const normalized = await normalizeImage({ declaredMime: "image/png", bytes: polyglot });
    expect(normalized.bytes.includes(script)).toBe(false);
    expect(detectSignature(normalized.bytes)).toBe("png");
  });

  it("stores safe files and serves them with inert-content headers", async () => {
    const merchant = await registerMerchant("med");
    const jpeg = await sharp({ create: { width: 3, height: 2, channels: 3, background: { r: 4, g: 5, b: 6 } } })
      .jpeg()
      .toBuffer();
    const storageRoot = path.resolve(process.cwd(), env.storageDir);

    try {
      const uploaded = await merchant.agent
        .post("/api/media")
        .send({
          fileName: "../../evil name?.jpg",
          mimeType: "image/jpeg",
          dataBase64: jpeg.toString("base64"),
        })
        .expect(201);

      expect(uploaded.body.media.mimeType).toBe("image/jpeg");
      expect(uploaded.body.media.fileName).toBe("evil name.jpg");
      expect(uploaded.body.media.url).toMatch(/^\/uploads\/.+\/[0-9]+-[a-f0-9]+\.jpg$/);

      const served = await request(app).get(uploaded.body.media.url).expect(200);
      expect(served.headers["x-content-type-options"]).toBe("nosniff");
      expect(served.headers["content-security-policy"]).toContain("sandbox");
      expect(served.headers["cross-origin-resource-policy"]).toBe("same-site");
      expect(served.headers["cross-origin-embedder-policy"]).toBe("require-corp");

      const asset = await prisma.mediaAsset.findFirst({ where: { storeId: merchant.store.id } });
      expect(asset).not.toBeNull();
      const stored = await fs.readFile(path.join(storageRoot, asset!.storageKey));
      expect(stored.length).toBeGreaterThan(0);

      const invalid = await merchant.agent
        .post("/api/media")
        .send({ fileName: "x.png", mimeType: "image/png", dataBase64: "not-valid-base64!!" })
        .expect(400);
      expect(invalid.body.error.code).toBe("INVALID_MEDIA");

      const probe = path.join(storageRoot, "phase2-probe.html");
      await fs.mkdir(path.dirname(probe), { recursive: true });
      await fs.writeFile(probe, "<script>alert(1)</script>");
      await request(app).get("/uploads/phase2-probe.html").expect(404);
      await request(app).get("/uploads/").expect(404);
      await fs.unlink(probe).catch(() => undefined);
    } finally {
      await fs.rm(path.join(storageRoot, merchant.store.id), { recursive: true, force: true });
    }
  });
});

describe("CSRF and proxy configuration", () => {
  it("applies pure CSRF rules for mutating requests", () => {
    const allowedOrigins = ["http://localhost:3000"];
    expect(evaluateCsrfRequest({ method: "GET", allowedOrigins, requireSource: true })).toEqual({ ok: true });
    expect(
      evaluateCsrfRequest({ method: "POST", origin: "http://localhost:3000", allowedOrigins, requireSource: true })
    ).toEqual({ ok: true });
    expect(
      evaluateCsrfRequest({ method: "PATCH", origin: "http://localhost:3000/", allowedOrigins, requireSource: true })
    ).toEqual({ ok: true });
    expect(
      evaluateCsrfRequest({ method: "POST", origin: "http://evil.test", allowedOrigins, requireSource: true })
    ).toEqual({ ok: false, reason: "origin_not_allowed" });
    expect(
      evaluateCsrfRequest({ method: "POST", origin: "null", allowedOrigins, requireSource: true })
    ).toEqual({ ok: false, reason: "origin_not_allowed" });
    expect(
      evaluateCsrfRequest({ method: "POST", origin: "not a url", allowedOrigins, requireSource: true })
    ).toEqual({ ok: false, reason: "origin_not_allowed" });
    expect(
      evaluateCsrfRequest({
        method: "POST",
        referer: "http://localhost:3000/dashboard?x=1",
        allowedOrigins,
        requireSource: true,
      })
    ).toEqual({ ok: true });
    expect(
      evaluateCsrfRequest({ method: "POST", referer: "http://evil.test/", allowedOrigins, requireSource: true })
    ).toEqual({ ok: false, reason: "invalid_referer" });
    expect(
      evaluateCsrfRequest({ method: "POST", referer: "::::", allowedOrigins, requireSource: true })
    ).toEqual({ ok: false, reason: "invalid_referer" });
    expect(evaluateCsrfRequest({ method: "POST", allowedOrigins, requireSource: true })).toEqual({
      ok: false,
      reason: "source_required",
    });
    expect(evaluateCsrfRequest({ method: "POST", allowedOrigins, requireSource: false })).toEqual({ ok: true });
  });

  it("wires CSRF into the app and rejects cross-site mutations", async () => {
    const blocked = await request(app)
      .post("/api/auth/login")
      .set("Referer", "http://evil.test/")
      .send({ email: "nobody@test.com", password: "Password123" })
      .expect(403);
    expect(blocked.body.error.code).toBe("CSRF_BLOCKED");

    await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://localhost:3000")
      .send({ email: "nobody@test.com", password: "Password123" })
      .expect(401);
  });

  it("parses safe trust-proxy settings and refuses unsafe ones", () => {
    expect(env.trustProxy).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("loopback, 10.0.0.0/8, ::1/128")).toEqual(["loopback", "10.0.0.0/8", "::1/128"]);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number): never => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as typeof process.exit);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      for (const bad of ["true", "0", "33", "10.0.0.0/33", "::1/129", "nope", "10.0.0.0/8, nope"]) {
        expect(() => parseTrustProxy(bad)).toThrow(/EXIT_1/);
      }
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe("distributed rate limiting", () => {
  it("never grants extra quota under concurrency and is shared through PostgreSQL", async () => {
    const key = uid("rl_atomic_");
    const results = await Promise.all(
      Array.from({ length: 40 }, () => consumeRateLimit({ key, limit: 10, windowMs: 60_000 }))
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 40 }, (_, index) => index + 1)
    );
    const row = await prisma.rateLimitBucket.findUnique({ where: { key } });
    expect(row?.count).toBe(40);
  });

  it("resets a fixed window and bounds the stored key length", async () => {
    const key = uid("rl_window_");
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    await consumeRateLimit({ key, limit: 2, windowMs: 1_000, now: t0 });
    await consumeRateLimit({ key, limit: 2, windowMs: 1_000, now: t0 });
    const third = await consumeRateLimit({ key, limit: 2, windowMs: 1_000, now: new Date(t0.getTime() + 1_001) });
    expect(third.allowed).toBe(true);
    expect(third.count).toBe(1);

    const longKey = "x".repeat(1_000);
    await consumeRateLimit({ key: longKey, limit: 1, windowMs: 60_000 });
    const stored = await prisma.rateLimitBucket.findUnique({ where: { key: "x".repeat(400) } });
    expect(stored).not.toBeNull();
  });

  it("returns 429 with standards headers when an endpoint budget is exhausted", async () => {
    const email = `limited-${Date.now()}@test.com`;
    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/auth/forgot-password").send({ email }).expect(200);
    }
    const blocked = await request(app).post("/api/auth/forgot-password").send({ email }).expect(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["ratelimit-limit"]).toBe("3");
    expect(Number(blocked.headers["ratelimit-remaining"])).toBe(0);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("sweeps expired buckets without touching active ones", async () => {
    const activeKey = uid("rl_active_");
    const expiredKey = uid("rl_expired_");
    await consumeRateLimit({ key: activeKey, limit: 5, windowMs: 60_000 });
    await consumeRateLimit({ key: expiredKey, limit: 5, windowMs: 1, now: new Date(Date.now() - 60_000) });
    await cleanupRateLimitBuckets();
    expect(await prisma.rateLimitBucket.findUnique({ where: { key: activeKey } })).not.toBeNull();
    expect(await prisma.rateLimitBucket.findUnique({ where: { key: expiredKey } })).toBeNull();
  });
});

describe("two-factor authentication", () => {
  it("stores encrypted secrets, requires a second factor and consumes recovery codes once", async () => {
    const merchant = await registerMerchant("2fa");
    const setup = await merchant.agent
      .post("/api/auth/2fa/setup")
      .send({ password: "Password123" })
      .expect(200);
    const secret = setup.body.secret as string;
    expect(setup.body.otpauth_url).toContain("otpauth://totp/");
    expect(setup.body.account).toBe(merchant.email);

    const stored = await prisma.merchant.findUnique({ where: { id: merchant.merchant.id } });
    expect(stored?.twoFactorSecret).toBeTruthy();
    expect(stored?.twoFactorSecret).not.toBe(secret);
    expect(stored?.twoFactorSecret).toMatch(/^v1\./);

    await merchant.agent.post("/api/auth/2fa/setup").send({ password: "WrongPass1" }).expect(401);
    await merchant.agent.post("/api/auth/2fa/enable").send({ code: "abcdef" }).expect(400);

    const enabled = await merchant.agent
      .post("/api/auth/2fa/enable")
      .send({ code: totpCode(secret) })
      .expect(200);
    const recoveryCodes = enabled.body.recovery_codes as string[];
    expect(recoveryCodes).toHaveLength(10);

    const afterEnable = await prisma.merchant.findUnique({ where: { id: merchant.merchant.id } });
    expect(afterEnable?.twoFactorEnabled).toBe(true);
    const hashes = afterEnable?.twoFactorRecoveryCodes as string[];
    expect(hashes).toHaveLength(10);
    expect(hashes).not.toContain(recoveryCodes[0]);
    expect(hashes.every((hash) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);

    const me = await merchant.agent.get("/api/auth/me").expect(200);
    expect(me.body.merchant.two_factor_enabled).toBe(true);

    const login = (extra: Record<string, unknown>) =>
      request(app)
        .post("/api/auth/login")
        .send({ email: merchant.email, password: "Password123", ...extra });

    const noFactor = await login({}).expect(401);
    expect(noFactor.body.error.code).toBe("TWO_FACTOR_REQUIRED");
    const badFactor = await login({ totp: "abcdef" }).expect(401);
    expect(badFactor.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");
    await login({ totp: totpCode(secret) }).expect(200);

    await login({ recovery_code: recoveryCodes[0] }).expect(200);
    const reused = await login({ recovery_code: recoveryCodes[0] }).expect(401);
    expect(reused.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");

    // Concurrent redemption: exactly one request may win.
    const [first, second] = await Promise.all([
      login({ recovery_code: recoveryCodes[1] }),
      login({ recovery_code: recoveryCodes[1] }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 401]);

    await merchant.agent
      .post("/api/auth/2fa/disable")
      .send({ password: "Password123", code: totpCode(secret) })
      .expect(200);
    const disabled = await prisma.merchant.findUnique({ where: { id: merchant.merchant.id } });
    expect(disabled?.twoFactorEnabled).toBe(false);
    expect(disabled?.twoFactorSecret).toBeNull();
    expect(disabled?.twoFactorRecoveryCodes).toEqual([]);
    await login({}).expect(200);
  });
});

describe("session and password security", () => {
  it("keeps the current session on password change and revokes every other session", async () => {
    const merchant = await registerMerchant("pwd");
    const other = request.agent(app);
    await other.post("/api/auth/login").send({ email: merchant.email, password: "Password123" }).expect(200);

    await merchant.agent
      .post("/api/auth/password")
      .send({ currentPassword: "Password123", newPassword: "NewPassword1" })
      .expect(200);
    await merchant.agent.get("/api/auth/me").expect(200);
    await other.get("/api/auth/me").expect(401);

    await request(app)
      .post("/api/auth/login")
      .send({ email: merchant.email, password: "Password123" })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ email: merchant.email, password: "NewPassword1" })
      .expect(200);
  });

  it("revokes other sessions explicitly and audits the action", async () => {
    const merchant = await registerMerchant("rev");
    const second = request.agent(app);
    const third = request.agent(app);
    await second.post("/api/auth/login").send({ email: merchant.email, password: "Password123" }).expect(200);
    await third.post("/api/auth/login").send({ email: merchant.email, password: "Password123" }).expect(200);

    const revoked = await merchant.agent.post("/api/auth/sessions/revoke-others").expect(200);
    expect(revoked.body.revoked).toBe(2);
    await merchant.agent.get("/api/auth/me").expect(200);
    await second.get("/api/auth/me").expect(401);
    await third.get("/api/auth/me").expect(401);
    expect(
      await prisma.auditLog.findFirst({ where: { merchantId: merchant.merchant.id, action: "account.sessions_revoked" } })
    ).not.toBeNull();
  });

  it("resets passwords with a single-use hashed token and revokes all sessions", async () => {
    const merchant = await registerMerchant("rst");
    const other = request.agent(app);
    await other.post("/api/auth/login").send({ email: merchant.email, password: "Password123" }).expect(200);

    const forgot = await request(app).post("/api/auth/forgot-password").send({ email: merchant.email }).expect(200);
    const token = forgot.body.debug_token as string;
    expect(token).toBeTruthy();
    const row = await prisma.authToken.findFirst({ where: { merchantId: merchant.merchant.id, type: "password_reset" } });
    expect(row?.tokenHash).not.toBe(token);
    expect(row?.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "ResetPassword1" })
      .expect(200);
    expect(await prisma.session.count({ where: { merchantId: merchant.merchant.id } })).toBe(0);
    await merchant.agent.get("/api/auth/me").expect(401);
    await other.get("/api/auth/me").expect(401);

    const reused = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "ResetPassword2" })
      .expect(400);
    expect(reused.body.error.code).toBe("RESET_INVALID");

    await request(app)
      .post("/api/auth/login")
      .send({ email: merchant.email, password: "Password123" })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ email: merchant.email, password: "ResetPassword1" })
      .expect(200);
  });
});

describe("email verification", () => {
  it("stores only token hashes and enforces single use", async () => {
    const merchant = await registerMerchant("ver");
    const registerRow = await prisma.authToken.findFirst({
      where: { merchantId: merchant.merchant.id, type: "email_verification" },
    });
    expect(registerRow).not.toBeNull();
    expect(registerRow?.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    // Re-register through the public endpoint to capture the one-time debug token.
    const email = `verify-${Date.now()}@test.com`;
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "Password123", storeName: "Verify Shop", subdomain: `verify${Date.now().toString(36)}` })
      .expect(201);
    const debug = registered.body.email_verification.debug_token as string;
    expect(debug).toBeTruthy();
    const row = await prisma.authToken.findFirst({ where: { merchantId: registered.body.merchant.id } });
    expect(row?.tokenHash).not.toBe(debug);

    await request(app).post("/api/auth/verify-email").send({ token: debug }).expect(200);
    const reused = await request(app).post("/api/auth/verify-email").send({ token: debug }).expect(400);
    expect(reused.body.error.code).toBe("VERIFICATION_INVALID");

    const verifiedMerchant = await prisma.merchant.findUnique({ where: { id: registered.body.merchant.id } });
    expect(verifiedMerchant?.emailVerifiedAt).toBeTruthy();

    const resend = await request(app).post("/api/auth/verify-email/resend").send({ email }).expect(200);
    expect(resend.body.already_verified).toBe(true);
    expect(resend.body.sent).toBe(false);
  });

  it("rotates resend links, rejects expired links and never mixes token purposes", async () => {
    const email = `rotate-${Date.now()}@test.com`;
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "Password123", storeName: "Rotate Shop", subdomain: `rotate${Date.now().toString(36)}` })
      .expect(201);
    const first = registered.body.email_verification.debug_token as string;

    const resend = await request(app).post("/api/auth/verify-email/resend").send({ email }).expect(200);
    const second = resend.body.debug_token as string;
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    await request(app).post("/api/auth/verify-email").send({ token: first }).expect(400);
    await request(app).post("/api/auth/verify-email").send({ token: second }).expect(200);

    const expiredEmail = `expired-${Date.now()}@test.com`;
    const expired = await request(app)
      .post("/api/auth/register")
      .send({
        email: expiredEmail,
        password: "Password123",
        storeName: "Expired Shop",
        subdomain: `expired${Date.now().toString(36)}`,
      })
      .expect(201);
    const expiredToken = expired.body.email_verification.debug_token as string;
    await prisma.authToken.updateMany({
      where: { merchantId: expired.body.merchant.id, type: "email_verification" },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await request(app).post("/api/auth/verify-email").send({ token: expiredToken }).expect(400);

    const resetEmail = `purpose-${Date.now()}@test.com`;
    await request(app)
      .post("/api/auth/register")
      .send({
        email: resetEmail,
        password: "Password123",
        storeName: "Purpose Shop",
        subdomain: `purpose${Date.now().toString(36)}`,
      })
      .expect(201);
    const reset = await request(app).post("/api/auth/forgot-password").send({ email: resetEmail }).expect(200);
    const resetToken = reset.body.debug_token as string;
    const wrongPurpose = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: resetToken })
      .expect(400);
    expect(wrongPurpose.body.error.code).toBe("VERIFICATION_INVALID");
  });

  it("answers resend requests identically for unknown addresses", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email/resend")
      .send({ email: `unknown-${Date.now()}@test.com` })
      .expect(200);
    expect(res.body).toMatchObject({ ok: true, already_verified: false, sent: false });
    expect(res.body.debug_token).toBeUndefined();
  });

  it("cleans up expired auth tokens", async () => {
    const merchant = await registerMerchant("tokclean");
    const row = await prisma.authToken.findFirst({ where: { merchantId: merchant.merchant.id } });
    await prisma.authToken.update({
      where: { id: row!.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect(await cleanupExpiredAuthTokens()).toBeGreaterThanOrEqual(1);
    expect(await prisma.authToken.findUnique({ where: { id: row!.id } })).toBeNull();
  });
});

describe("PII exports", () => {
  async function seedCustomers(merchant: Session, count: number) {
    for (let i = 0; i < count; i++) {
      await prisma.customer.create({
        data: {
          id: uid("cus_"),
          storeId: merchant.store.id,
          name: i === 0 ? '=HYPERLINK("http://evil.test")' : `Customer ${i}`,
          phone: i === 0 ? "-12345" : `0100000${String(i).padStart(4, "0")}`,
          email: i === 0 ? "@evil.test" : `customer${i}@test.com`,
          notes: i === 0 ? "+SUM(1,2)" : "",
        },
      });
    }
  }

  it("gates exports by team role and audits successful PII reads", async () => {
    const merchant = await registerMerchant("rbac");
    await seedCustomers(merchant, 2);
    const url = `/api/stores/${merchant.subdomain}/customers/export`;

    // The owner always retains full access, regardless of any legacy role.
    await prisma.merchant.update({ where: { id: merchant.merchant.id }, data: { role: "viewer" } });
    await merchant.agent.get(url).expect(200);

    const viewer = await registerTeamMember(merchant, "viewer", "rbac-v");
    const staff = await registerTeamMember(merchant, "staff", "rbac-s");
    const manager = await registerTeamMember(merchant, "manager", "rbac-m");
    const admin = await registerTeamMember(merchant, "admin", "rbac-a");

    await viewer.agent.get(url).expect(403);
    await staff.agent.get(url).expect(403);
    await manager.agent.get(url).expect(200);
    await admin.agent.get(url).expect(200);

    const audits = await prisma.auditLog.findMany({
      where: { storeId: merchant.store.id, action: "customer.exported" },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.length).toBe(3);
    expect(audits.some((audit) => audit.merchantId === merchant.merchant.id)).toBe(true);
    expect(audits.some((audit) => audit.teamMemberId === manager.member.id)).toBe(true);
    expect(audits.some((audit) => audit.teamMemberId === admin.member.id)).toBe(true);
  });

  it("streams formula-safe CSV with no-store headers", async () => {
    const merchant = await registerMerchant("csv");
    await seedCustomers(merchant, 2);

    const res = await merchant.agent.get(`/api/stores/${merchant.subdomain}/customers/export`).expect(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.text.startsWith(CSV_BOM)).toBe(true);
    expect(res.text).toContain("'=HYPERLINK");
    expect(res.text).toContain("'-12345");
    expect(res.text).toContain("'@evil.test");
    expect(res.text).toContain("'+SUM(1,2)");
  });

  it("exports orders with audit trail and refuses exports above the row cap", async () => {
    const merchant = await registerMerchant("ocsv");
    await merchant.agent
      .post(`/api/stores/${merchant.subdomain}/orders`)
      .send({ customer_name: "=cmd|' /C calc'!A0", customer_phone: "+201000000000", amount_egp: 10 })
      .expect(201);

    const orders = await merchant.agent.get(`/api/stores/${merchant.subdomain}/orders/export`).expect(200);
    expect(orders.headers["cache-control"]).toContain("no-store");
    expect(orders.text).toContain("'=cmd");
    expect(
      await prisma.auditLog.findFirst({ where: { storeId: merchant.store.id, action: "order.exported" } })
    ).not.toBeNull();

    await seedCustomers(merchant, 2);
    const previous = env.exportMaxRows;
    env.exportMaxRows = 1;
    try {
      const blocked = await merchant.agent
        .get(`/api/stores/${merchant.subdomain}/customers/export`)
        .expect(413);
      expect(blocked.body.error.code).toBe("EXPORT_TOO_LARGE");
      expect(blocked.body.error.details).toMatchObject({ limit: 1 });
    } finally {
      env.exportMaxRows = previous;
    }
  });

  it("escapes CSV cells and rejects oversized exports before streaming", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell("\tx")).toBe("'\tx");
    expect(csvCell("\rx")).toBe("\"'\rx\"");
    expect(csvCell('a,b"c')).toBe('"a,b""c"');
    expect(csvCell(null)).toBe("");
    expect(csvRow(["a", "b"])).toBe("a,b");
    expect(() => assertExportWithinLimit(3, 2)).toThrow(/limit is 2/);
    try {
      assertExportWithinLimit(3, 2);
    } catch (err) {
      expect(err).toMatchObject({ status: 413, code: "EXPORT_TOO_LARGE", details: { rows: 3, limit: 2 } });
    }
    expect(() => assertExportWithinLimit(2, 2)).not.toThrow();
  });
});

describe("domain verification", () => {
  it("reveals DNS challenges once and never returns verification tokens on reads", async () => {
    const merchant = await registerMerchant("dom");
    const base = `/api/stores/${merchant.subdomain}`;
    const domain = `shop-${Date.now().toString(36)}.example.com`;

    const created = await merchant.agent.post(`${base}/domains`).send({ domain }).expect(201);
    const challenge = created.body.challenge as { type: string; name: string; value: string };
    expect(challenge.type).toBe("TXT");
    expect(challenge.name).toBe(`_sanad-verification.${domain}`);
    expect(challenge.value).toMatch(/^sanad-verify=[a-f0-9]{32}$/);
    expect(created.body.domain.verificationToken).toBeUndefined();

    const list = await merchant.agent.get(`${base}/domains`).expect(200);
    expect(JSON.stringify(list.body)).not.toContain(challenge.value);
    expect(list.body.domains[0].verificationToken).toBeUndefined();

    const settings = await merchant.agent.get(`${base}/settings`).expect(200);
    expect(JSON.stringify(settings.body.domains)).not.toContain(challenge.value);

    const pending = await merchant.agent.post(`${base}/domains/${created.body.domain.id}/verify`).expect(200);
    expect(pending.body.verified).toBe(false);
    expect(JSON.stringify(pending.body)).not.toContain(challenge.value);
    expect(JSON.stringify(pending.body)).not.toContain("verificationToken");

    vi.mocked(resolveTxt).mockResolvedValueOnce([[challenge.value]]);
    const verified = await merchant.agent.post(`${base}/domains/${created.body.domain.id}/verify`).expect(200);
    expect(verified.body.verified).toBe(true);
    expect(verified.body.domain.status).toBe("verified");
    expect(JSON.stringify(verified.body)).not.toContain(challenge.value);

    const rotate = await merchant.agent.post(`${base}/domains/${created.body.domain.id}/challenge`).expect(409);
    expect(rotate.body.error.code).toBe("DOMAIN_ALREADY_VERIFIED");

    expect(
      await prisma.auditLog.findFirst({ where: { storeId: merchant.store.id, action: "domain.added" } })
    ).not.toBeNull();
    expect(
      await prisma.auditLog.findFirst({ where: { storeId: merchant.store.id, action: "domain.verified" } })
    ).not.toBeNull();
  });

  it("rotates challenges for unverified domains and isolates stores", async () => {
    const a = await registerMerchant("doma");
    const b = await registerMerchant("domb");
    const domain = `rotate-${Date.now().toString(36)}.example.com`;
    const created = await a.agent
      .post(`/api/stores/${a.subdomain}/domains`)
      .send({ domain })
      .expect(201);
    const firstValue = created.body.challenge.value as string;

    const rotated = await a.agent
      .post(`/api/stores/${a.subdomain}/domains/${created.body.domain.id}/challenge`)
      .expect(200);
    expect(rotated.body.challenge.value).not.toBe(firstValue);

    vi.mocked(resolveTxt).mockResolvedValueOnce([[firstValue]]);
    const stale = await a.agent
      .post(`/api/stores/${a.subdomain}/domains/${created.body.domain.id}/verify`)
      .expect(200);
    expect(stale.body.verified).toBe(false);

    vi.mocked(resolveTxt).mockResolvedValueOnce([[rotated.body.challenge.value]]);
    const fresh = await a.agent
      .post(`/api/stores/${a.subdomain}/domains/${created.body.domain.id}/verify`)
      .expect(200);
    expect(fresh.body.verified).toBe(true);

    await b.agent.post(`/api/stores/${b.subdomain}/domains/${created.body.domain.id}/challenge`).expect(404);
    expect(
      await prisma.auditLog.findFirst({ where: { storeId: a.store.id, action: "domain.challenge_rotated" } })
    ).not.toBeNull();
  });
});

describe("order tracking privacy", () => {
  it("masks PII, hides internal fields and accepts signed tokens", async () => {
    const { merchant } = await publishedStoreWithProduct("trk");
    const created = await checkout(merchant);
    const orderNumber = created.body.order.orderNumber as number;
    const token = created.body.tracking_token as string;
    expect(token).toBeTruthy();
    expect(created.body.tracking_url).toContain(`?token=${encodeURIComponent(token)}`);
    const publicBase = `/api/storefront/${merchant.subdomain}`;

    const byPhone = await request(app)
      .get(`${publicBase}/orders/${orderNumber}?phone=01012345678`)
      .expect(200);
    expect(byPhone.body.order.customerPhone).toBe("010****5678");
    expect(byPhone.body.order.id).toBeUndefined();
    expect(byPhone.body.order.address).toBeUndefined();
    expect(byPhone.body.order.customerEmail).toBeUndefined();
    expect(byPhone.body.tracking_token).toBeTruthy();

    const byToken = await request(app)
      .get(`${publicBase}/orders/${orderNumber}?token=${encodeURIComponent(token)}`)
      .expect(200);
    expect(byToken.body.order.orderNumber).toBe(orderNumber);
    expect(byToken.body.order.customerPhone).toBe("010****5678");

    const wrongPhone = await request(app)
      .get(`${publicBase}/orders/${orderNumber}?phone=01099999999`)
      .expect(404);
    expect(wrongPhone.body.error.code).toBe("ORDER_NOT_FOUND");
    const missing = await request(app).get(`${publicBase}/orders/${orderNumber}`).expect(400);
    expect(missing.body.error.code).toBe("TRACKING_REQUIRED");

    const [body, signature] = token.split(".");
    const tampered = `${body[0] === "A" ? "B" : "A"}${body.slice(1)}.${signature}`;
    await request(app)
      .get(`${publicBase}/orders/${orderNumber}?token=${encodeURIComponent(tampered)}`)
      .expect(404);
    await request(app)
      .get(`${publicBase}/orders/${orderNumber + 1}?token=${encodeURIComponent(token)}`)
      .expect(404);

    const other = await publishedStoreWithProduct("trk2");
    await request(app)
      .get(`/api/storefront/${other.merchant.subdomain}/orders/${orderNumber}?token=${encodeURIComponent(token)}`)
      .expect(404);
  });

  it("signs tokens for one store/order and expires them", () => {
    const token = createTrackingToken({ orderId: "ord_1", storeId: "store_1", orderNumber: 42 });
    expect(verifyTrackingToken(token, { storeId: "store_1", orderNumber: 42 })).toEqual({ orderId: "ord_1" });
    expect(verifyTrackingToken(token, { storeId: "store_2", orderNumber: 42 })).toBeNull();
    expect(verifyTrackingToken(token, { storeId: "store_1", orderNumber: 43 })).toBeNull();
    expect(verifyTrackingToken(`${token}x`, { storeId: "store_1", orderNumber: 42 })).toBeNull();
    expect(trackingUrl({ subdomain: "shop", orderNumber: 42, token })).toBe(
      `${env.appUrl}/store/shop/order/42?token=${encodeURIComponent(token)}`
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const expiring = createTrackingToken({ orderId: "ord_2", storeId: "store_1", orderNumber: 7 });
    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
    expect(verifyTrackingToken(expiring, { storeId: "store_1", orderNumber: 7 })).toBeNull();
  });

  it("rate-limits sequential tracking enumeration", async () => {
    const { merchant } = await publishedStoreWithProduct("trl");
    const created = await checkout(merchant, { items: [{ sku: "SKU-trl", qty: 1 }] });
    const orderNumber = created.body.order.orderNumber as number;
    const base = `/api/storefront/${merchant.subdomain}/orders/${orderNumber}?token=bad`;

    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await request(app).get(base);
      statuses.push(res.status);
      if (res.status === 429) {
        expect(res.body.error.code).toBe("TRACKING_RATE_LIMITED");
        expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
      }
    }
    expect(statuses.slice(0, 20).every((status) => status === 404)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe("abandoned cart anti-abuse", () => {
  it("rejects anonymous empty carts, normalizes contacts and upserts one row", async () => {
    const merchant = await registerMerchant("cart");
    const base = `/api/storefront/${merchant.subdomain}/cart`;
    const empty = await request(app)
      .post(base)
      .send({ cartToken: "cart-token-1234", customerName: "", phone: "", email: "", items: [] })
      .expect(400);
    expect(empty.body.error.code).toBe("CART_EMPTY");

    await request(app)
      .post(base)
      .send({
        cartToken: "cart-token-1234",
        customerName: "هدى",
        phone: "+20 101 234 5678",
        email: "Shopper@Test.com",
        items: [],
      })
      .expect(200);
    const cart = await prisma.abandonedCart.findUnique({
      where: { storeId_cartToken: { storeId: merchant.store.id, cartToken: "cart-token-1234" } },
    });
    expect(cart?.phone).not.toContain(" ");
    expect(cart?.phone).not.toContain("+");
    expect(cart?.email).toBe("shopper@test.com");

    await prisma.abandonedCart.update({
      where: { id: cart!.id },
      data: { lastActivityAt: new Date(Date.now() - 60_000) },
    });
    await request(app)
      .post(base)
      .send({ cartToken: "cart-token-1234", customerName: "هدى", phone: "01012345678", email: "", items: [] })
      .expect(200);
    const again = await prisma.abandonedCart.findMany({ where: { storeId: merchant.store.id } });
    expect(again).toHaveLength(1);
    expect(again[0].lastActivityAt.getTime()).toBeGreaterThan(cart!.lastActivityAt.getTime());
  });

  it("rate-limits cart writes and sweeps stale carts", async () => {
    const merchant = await registerMerchant("cartrl");
    const base = `/api/storefront/${merchant.subdomain}/cart`;
    let blocked: { status: number; body: { error: { code: string } } } | null = null;
    for (let i = 0; i < 41; i++) {
      const res = await request(app)
        .post(base)
        .send({ cartToken: `cart-token-${i}`, customerName: "", phone: "01012345678", email: "", items: [] });
      if (res.status === 429) blocked = res;
    }
    expect(blocked?.status).toBe(429);
    expect(blocked?.body.error.code).toBe("CART_RATE_LIMITED");

    const old = await prisma.abandonedCart.create({
      data: {
        id: uid("cart_old_"),
        storeId: merchant.store.id,
        cartToken: "old-cart",
        lastActivityAt: new Date(Date.now() - 31 * 24 * 3600 * 1000),
      },
    });
    const recent = await prisma.abandonedCart.create({
      data: { id: uid("cart_new_"), storeId: merchant.store.id, cartToken: "new-cart" },
    });
    expect(await cleanupAbandonedCarts(30)).toBeGreaterThanOrEqual(1);
    expect(await prisma.abandonedCart.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.abandonedCart.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it("runs the full retention sweep for carts, audit logs, sessions, tokens and buckets", async () => {
    const merchant = await registerMerchant("sweep");
    const oldCart = await prisma.abandonedCart.create({
      data: {
        id: uid("cart_"),
        storeId: merchant.store.id,
        cartToken: "sweep-cart",
        lastActivityAt: new Date(Date.now() - 40 * 24 * 3600 * 1000),
      },
    });
    const oldAudit = await prisma.auditLog.create({
      data: {
        id: uid("aud_"),
        storeId: merchant.store.id,
        merchantId: merchant.merchant.id,
        action: "test.old",
        entity: "test",
        createdAt: new Date(Date.now() - 400 * 24 * 3600 * 1000),
      },
    });
    const oldSession = await prisma.session.create({
      data: {
        tokenHash: "f".repeat(64),
        merchantId: merchant.merchant.id,
        expiresAt: new Date(Date.now() - 1_000),
      },
    });
    await prisma.rateLimitBucket.create({
      data: { key: uid("rl_"), count: 1, resetAt: new Date(Date.now() - 1_000), updatedAt: new Date() },
    });
    const tokenRow = await prisma.authToken.findFirst({ where: { merchantId: merchant.merchant.id } });
    await prisma.authToken.update({
      where: { id: tokenRow!.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const result = await runRetentionSweep();
    expect(result.carts).toBeGreaterThanOrEqual(1);
    expect(result.auditLogs).toBeGreaterThanOrEqual(1);
    expect(result.sessions).toBeGreaterThanOrEqual(1);
    expect(result.authTokens).toBeGreaterThanOrEqual(1);
    expect(result.rateLimitBuckets).toBeGreaterThanOrEqual(1);
    expect(await prisma.abandonedCart.findUnique({ where: { id: oldCart.id } })).toBeNull();
    expect(await prisma.auditLog.findUnique({ where: { id: oldAudit.id } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { tokenHash: oldSession.tokenHash } })).toBeNull();
  });
});

describe("log and response privacy helpers", () => {
  it("masks phone, email and names", () => {
    expect(maskPhone("01012345678")).toBe("010****5678");
    expect(maskPhone("+20 101 234 5678")).toBe("201*****5678");
    expect(maskPhone("123456")).toBe("******");
    expect(maskPhone("123456789")).toBe("12*****89");
    expect(maskPhone("")).toBe("");
    expect(maskEmail("ahmed@example.com")).toBe("a****@example.com");
    expect(maskEmail("bad")).toBe("***");
    expect(maskName("Ahmed Ali Hassan")).toBe("Ahmed A*** H***");
  });

  it("redacts secrets and PII from logs and URLs", () => {
    const url = sanitizeUrlForLogs("/api/orders?phone=01012345678&token=secret&email=a@b.com&page=2");
    expect(url).toContain("page=2");
    expect(url).not.toContain("01012345678");
    expect(url).not.toContain("secret");
    expect(url).not.toContain("a@b.com");
    expect(url).toContain("%5BREDACTED%5D");
    expect(sanitizeUrlForLogs("/api/health")).toBe("/api/health");

    const redacted = redactForLogs({
      password: "hunter2",
      customerPhone: "01012345678",
      customerEmail: "a@b.com",
      nested: { accessToken: "tok", ok: 1 },
    }) as Record<string, any>;
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.customerPhone).toBe("010****5678");
    expect(redacted.customerEmail).toBe("a***@b.com");
    expect(redacted.nested.accessToken).toBe("[REDACTED]");
    expect(redacted.nested.ok).toBe(1);
  });
});
