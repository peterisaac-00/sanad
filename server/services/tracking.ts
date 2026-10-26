import { createHmac } from "node:crypto";
import { env } from "../env.js";
import { safeEqualString } from "../crypto.js";
import { platformStoreOrigin } from "./domains.js";

/**
 * Stateless signed tracking tokens.
 *
 * Checkout returns a token once; the customer can revisit their order
 * without putting their phone number in the URL/history. Tokens are signed
 * with TRACKING_SECRET (or a secret derived from SESSION_SECRET), expire
 * after TRACKING_TOKEN_TTL_DAYS, and are bound to one store + order number.
 */

const VERSION = 1;

interface TrackingPayload {
  v: number;
  o: string;
  s: string;
  n: number;
  e: number;
}

function sign(body: string): string {
  return createHmac("sha256", env.tracking.secret).update(body, "utf8").digest("base64url");
}

export function createTrackingToken(input: { orderId: string; storeId: string; orderNumber: number }): string {
  const payload: TrackingPayload = {
    v: VERSION,
    o: input.orderId,
    s: input.storeId,
    n: input.orderNumber,
    e: Math.floor(Date.now() / 1000) + env.tracking.ttlDays * 86_400,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyTrackingToken(
  token: string,
  expected: { storeId: string; orderNumber: number }
): { orderId: string } | null {
  if (!token || token.length > 512) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  if (!safeEqualString(signature, sign(body))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TrackingPayload;
    if (parsed.v !== VERSION) return null;
    if (parsed.s !== expected.storeId) return null;
    if (Number(parsed.n) !== expected.orderNumber) return null;
    if (!Number.isFinite(parsed.e) || parsed.e <= Math.floor(Date.now() / 1000)) return null;
    if (typeof parsed.o !== "string" || !parsed.o) return null;
    return { orderId: parsed.o };
  } catch {
    return null;
  }
}

export function trackingUrl(input: { subdomain: string; orderNumber: number; token: string }): string {
  return `${platformStoreOrigin(input.subdomain)}/order/${input.orderNumber}?token=${encodeURIComponent(input.token)}`;
}
