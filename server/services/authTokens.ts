import { prisma, newId } from "../db.js";
import { hashOpaqueToken, randomToken } from "../crypto.js";

/**
 * Single-use, hashed, expiring tokens for email verification and password
 * reset. Only the HMAC is stored, so a database leak cannot be replayed.
 */

export type AuthTokenType = "email_verification" | "password_reset";

export async function issueAuthToken(input: {
  merchantId: string;
  type: AuthTokenType;
  ttlMinutes: number;
}): Promise<string> {
  const token = randomToken(32);
  const tokenHash = hashOpaqueToken(token, input.type);
  const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);
  await prisma.$transaction([
    // A new request invalidates earlier outstanding links of the same type.
    prisma.authToken.updateMany({
      where: { merchantId: input.merchantId, type: input.type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: { id: newId("tok_"), merchantId: input.merchantId, type: input.type, tokenHash, expiresAt },
    }),
  ]);
  return token;
}

/**
 * Atomically consume a token. Concurrent retries race on the conditional
 * update, so exactly one call can ever succeed.
 */
export async function consumeAuthToken(input: {
  token: string;
  type: AuthTokenType;
}): Promise<{ merchantId: string } | null> {
  if (!input.token || input.token.length < 20) return null;
  const tokenHash = hashOpaqueToken(input.token, input.type);
  const row = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!row || row.type !== input.type) return null;
  if (row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  const claimed = await prisma.authToken.updateMany({
    where: {
      id: row.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  return { merchantId: row.merchantId };
}

export async function cleanupExpiredAuthTokens(retainUsedDays = 7): Promise<number> {
  const usedCutoff = new Date(Date.now() - retainUsedDays * 24 * 3600 * 1000);
  const removed = await prisma.authToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { lt: usedCutoff } }],
    },
  });
  return removed.count;
}
