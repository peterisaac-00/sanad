import { prisma } from "./db.js";
import { logger } from "./logger.js";

/** Delete all expired sessions. Returns the number removed. */
export async function cleanupExpiredSessions(): Promise<number> {
  const gone = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  if (gone.count > 0) logger.info(`[sessions] cleaned ${gone.count} expired session(s)`);
  return gone.count;
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
