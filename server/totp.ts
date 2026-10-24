import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hashOpaqueToken } from "./crypto.js";

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30-second step) and one-time recovery
 * codes. Implemented locally so 2FA has no hidden runtime dependency.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function totpCode(secret: string, timestampMs = Date.now()): string {
  const counter = Math.floor(timestampMs / 1000 / STEP_SECONDS);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Verify a code with a ±1 step window for clock drift. */
export function verifyTotp(secret: string, code: string, timestampMs = Date.now()): boolean {
  const normalized = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized) || !secret) return false;
  const expected = Buffer.from(normalized, "utf8");
  for (const drift of [-1, 0, 1]) {
    const candidate = Buffer.from(totpCode(secret, timestampMs + drift * STEP_SECONDS * 1000), "utf8");
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}

export function otpauthUrl(input: { secret: string; account: string; issuer?: string }): string {
  const issuer = input.issuer ?? "Sanad";
  const label = `${issuer}:${input.account}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

/** Human-friendly one-time recovery codes (e.g. K7M2P-Q9X4T). */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  while (codes.length < count) {
    const raw = base32Encode(randomBytes(5)).slice(0, 10);
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  return hashOpaqueToken(code.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), "recovery-code");
}

/**
 * Compare a recovery code against stored hashes without leaking which entry
 * matched. Returns the matching index or -1.
 */
export function findRecoveryCode(hashes: string[], code: string): number {
  const candidate = hashRecoveryCode(code);
  let match = -1;
  for (let index = 0; index < hashes.length; index++) {
    const expected = String(hashes[index] ?? "");
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length === b.length && a.length > 0 && timingSafeEqual(a, b)) match = index;
  }
  return match;
}

export function recoveryCodeHashes(codes: string[]): string[] {
  return codes.map((code) => hashRecoveryCode(code));
}
