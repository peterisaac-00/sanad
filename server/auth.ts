import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import argon2 from "argon2";
import type { CookieOptions } from "express";
import { env } from "./env.js";

/**
 * Password storage per the OWASP Password Storage Cheat Sheet:
 * Argon2id with m=19456 KiB, t=2, p=1. Parameters are embedded in the
 * stored hash string, so future rotation only requires changing ARGON_OPTS.
 *
 * Legacy scrypt hashes (salt stored separately) still verify. On a
 * successful login with a legacy hash the password is re-hashed to
 * Argon2id transparently.
 */

export const ARGON_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const SCRYPT_KEYLEN = 64;

export type PasswordAlgo = "argon2id" | "scrypt";

export interface MerchantPasswordRow {
  password_hash: string;
  password_salt: string | null;
  password_algo: string;
}

export async function hashPasswordArgon2(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTS);
}

function verifyScrypt(password: string, salt: string, expectedHash: string): boolean {
  try {
    const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(expectedHash, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verify a password against either a modern Argon2id hash or a legacy
 * scrypt hash. Returns whether the stored hash should be upgraded.
 */
export async function verifyMerchantPassword(
  row: MerchantPasswordRow,
  password: string
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (row.password_algo === "argon2id") {
    try {
      const ok = await argon2.verify(row.password_hash, password);
      // Upgrade hashes whenever stored parameters drift from current policy.
      return { ok, needsRehash: ok && argon2.needsRehash(row.password_hash, { ...ARGON_OPTS }) };
    } catch {
      return { ok: false, needsRehash: false };
    }
  }
  // Legacy scrypt: salt in a separate column.
  if (!row.password_salt) return { ok: false, needsRehash: false };
  const ok = verifyScrypt(password, row.password_salt, row.password_hash);
  return { ok, needsRehash: ok };
}

// Precomputed dummy hash so unknown-email logins cost a full Argon2 verify,
// making their timing indistinguishable from wrong-password attempts.
let dummyHash: Promise<string> | null = null;

export async function verifyUnknownEmail(password: string): Promise<void> {
  dummyHash ??= hashPasswordArgon2(`invalid-email-dummy:${randomBytes(8).toString("hex")}`);
  await argon2.verify(await dummyHash, password).catch(() => false);
}

/** Opaque session token (256-bit). Only its HMAC is stored in the DB. */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHmac("sha256", env.sessionSecret).update(token, "utf8").digest("hex");
}

export const SESSION_COOKIE = "sanad_session";
export const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

/**
 * Production uses the __Host- prefix (requires Secure + Path=/ + no Domain,
 * all of which we set), locking the cookie to the exact host. Dev/test keep
 * the plain name so http://localhost works without TLS.
 */
export function sessionCookieName(): string {
  return env.isProduction ? "__Host-sanad_session" : SESSION_COOKIE;
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}
