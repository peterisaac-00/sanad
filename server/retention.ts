import { prisma } from "./db.js";
import { logger } from "./logger.js";
import { env } from "./env.js";
import { cleanupExpiredSessions } from "./sessions.js";
import { cleanupExpiredAuthTokens } from "./services/authTokens.js";

/**
 * Data-retention sweeps. These run at boot and daily, and are exported so
 * tests can prove rows disappear without waiting for a timer.
 */

export async function cleanupAbandonedCarts(cutoffDays = env.retention.cartDays): Promise<number> {
  const cutoff = new Date(Date.now() - cutoffDays * 24 * 3600 * 1000);
  const removed = await prisma.abandonedCart.deleteMany({ where: { lastActivityAt: { lt: cutoff } } });
  if (removed.count > 0) logger.info(`[retention] removed ${removed.count} abandoned cart(s)`);
  return removed.count;
}

export async function cleanupAuditLogs(cutoffDays = env.retention.auditDays): Promise<number> {
  const cutoff = new Date(Date.now() - cutoffDays * 24 * 3600 * 1000);
  const removed = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  if (removed.count > 0) logger.info(`[retention] removed ${removed.count} audit log(s)`);
  return removed.count;
}

export async function cleanupRateLimitBuckets(): Promise<number> {
  const removed = await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return removed.count;
}

export interface RetentionResult {
  carts: number;
  auditLogs: number;
  sessions: number;
  authTokens: number;
  rateLimitBuckets: number;
}

export async function runRetentionSweep(): Promise<RetentionResult> {
  const [carts, auditLogs, sessions, authTokens, rateLimitBuckets] = await Promise.all([
    cleanupAbandonedCarts(),
    cleanupAuditLogs(),
    cleanupExpiredSessions(),
    cleanupExpiredAuthTokens(),
    cleanupRateLimitBuckets(),
  ]);
  return { carts, auditLogs, sessions, authTokens, rateLimitBuckets };
}

/** Daily, unref'd timer; runs once immediately so old rows never linger after deploy. */
export function startRetentionSweep(intervalMs = 24 * 3600 * 1000): NodeJS.Timeout {
  runRetentionSweep().catch((err) => logger.error({ err }, "retention sweep failed"));
  const timer = setInterval(() => {
    runRetentionSweep().catch((err) => logger.error({ err }, "retention sweep failed"));
  }, intervalMs);
  timer.unref();
  return timer;
}
