import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

/**
 * Small, dependency-free crypto helpers shared by sessions, auth tokens,
 * tracking links and 2FA secrets.
 *
 * - Opaque bearer tokens are random (256-bit) and only their HMAC is stored.
 * - Reversible secrets (TOTP) use AES-256-GCM with a purpose-bound key.
 * - Comparisons are timing-safe.
 */

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hmacHex(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}

/**
 * Derive a stable, purpose-bound key from SESSION_SECRET. Rotating the
 * session secret intentionally invalidates every derived credential.
 */
function derivedKey(purpose: string): Buffer {
  return createHash("sha256").update(`sanad:${purpose}:${env.sessionSecret}`, "utf8").digest();
}

/** Hash an opaque token before storing it. Purpose prevents cross-token reuse. */
export function hashOpaqueToken(token: string, purpose: string): string {
  return hmacHex(derivedKey(purpose).toString("hex"), token);
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

const SECRET_VERSION = "v1";

/**
 * Encrypt a small secret at rest (TOTP seeds). The key is derived from
 * TOTP_ENCRYPTION_KEY, so the database alone cannot reveal TOTP seeds.
 */
export function encryptSecret(plaintext: string, keyMaterial: string = env.totpEncryptionKey): string {
  const key = createHash("sha256").update(`sanad:totp:${keyMaterial}`, "utf8").digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    SECRET_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string | null | undefined, keyMaterial: string = env.totpEncryptionKey): string | null {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== SECRET_VERSION) return null;
  try {
    const key = createHash("sha256").update(`sanad:totp:${keyMaterial}`, "utf8").digest();
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const ciphertext = Buffer.from(parts[3], "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
