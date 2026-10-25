import { prisma } from "./db.js";
import { logger } from "./logger.js";
import { hashSessionToken, newSessionToken, SESSION_TTL_MS } from "./auth.js";

/**
 * Create a merchant-owner or team-member session. Exactly one principal id is
 * required; the auth resolver rejects a row that carries both or neither.
 */
export async function createAuthSession(input: {
  merchantId?: string | null;
  teamMemberId?: string | null;
}): Promise<string> {
  const merchantId = input.merchantId ?? null;
  const teamMemberId = input.teamMemberId ?? null;
  if (Boolean(merchantId) === Boolean(teamMemberId)) {
    throw new Error("a session must belong to exactly one principal");
  }
  const token = newSessionToken();
  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      merchantId,
      teamMemberId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

/** Delete all expired sessions. Returns the number removed. */
export async function cleanupExpiredSessions(): Promise<number> {
  const [gone, adminGone] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  ]);
  const count = gone.count + adminGone.count;
  if (count > 0) logger.info(`[sessions] cleaned ${count} expired session(s)`);
  return count;
}

/**
 * Periodically purge expired sessions so the table cannot grow unbounded.
 * The timer is unref'd so it never keeps the process alive on its own.
 */
export function startSessionCleanup(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
  const timer = setInterval(() => {
    cleanupExpiredSessions().catch((err) => logger.error({ err }, "session cleanup failed"));
  }, intervalMs);
  timer.unref();
  return timer;
}
