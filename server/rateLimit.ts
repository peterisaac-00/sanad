import type { NextFunction, Request, RequestHandler, Response } from "express";
import { prisma } from "./db.js";
import { ApiError } from "./errors.js";
import { logger } from "./logger.js";
import { sha256Hex } from "./crypto.js";

/**
 * Distributed fixed-window rate limiting backed by PostgreSQL.
 *
 * Every replica shares `rate_limit_buckets`, so a limit reached by one
 * replica immediately blocks all others. The upsert is a single atomic
 * statement: no read-then-write race can grant extra quota.
 *
 * Expired rows are removed by the retention sweep.
 */

export interface RateLimitIdentity {
  /** Stable, rule-scoped key (e.g. `auth:ip:1.2.3.4`). */
  key: string;
  /** Optional per-identity override of the rule limit. */
  limit?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): Promise<RateLimitResult> {
  const now = input.now ?? new Date();
  const resetAt = new Date(now.getTime() + input.windowMs);
  // Keep the key bounded even if a caller accidentally includes user input.
  const key = input.key.slice(0, 400);
  const rows = await prisma.$queryRaw<Array<{ count: number; reset_at: Date }>>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "reset_at", "updated_at")
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."reset_at" <= ${now} THEN 1
        ELSE "rate_limit_buckets"."count" + 1
      END,
      "reset_at" = CASE
        WHEN "rate_limit_buckets"."reset_at" <= ${now} THEN ${resetAt}
        ELSE "rate_limit_buckets"."reset_at"
      END,
      "updated_at" = ${now}
    RETURNING "count", "reset_at"
  `;
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const bucketResetAt = row?.reset_at instanceof Date ? row.reset_at : new Date(row?.reset_at ?? resetAt);
  const limit = Math.max(1, input.limit);
  return {
    allowed: count <= limit,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: bucketResetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucketResetAt.getTime() - now.getTime()) / 1000)),
  };
}

function requestIp(req: Request): string {
  return String(req.ip || req.socket.remoteAddress || "unknown");
}

function lower(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export interface DistributedRateLimitOptions {
  /** Rule name; part of every bucket key so rules never share quota. */
  name: string;
  windowMs: number;
  limit: number;
  /** One or more identities to consume atomically for this request. */
  identities: (req: Request) => RateLimitIdentity[];
  message?: string;
  code?: string;
  /** Skip requests that cannot be attributed (e.g. authenticated merchant rules). */
  skip?: (req: Request) => boolean;
}

/**
 * Express middleware. All identities are checked; the most restrictive
 * bucket decides the response, and the strictest retry window is returned.
 */
export function distributedRateLimit(options: DistributedRateLimitOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (options.skip?.(req)) {
      next();
      return;
    }
    const identities = options.identities(req).filter((identity) => identity.key);
    if (identities.length === 0) {
      next();
      return;
    }
    void (async () => {
      try {
        const results = await Promise.all(
          identities.map((identity) =>
            consumeRateLimit({
              key: options.name + ":" + identity.key,
              limit: identity.limit ?? options.limit,
              windowMs: options.windowMs,
            })
          )
        );
        const blocked = results.filter((result) => !result.allowed);
        const strictest = (blocked.length ? blocked : results).reduce((worst, result) =>
          result.remaining < worst.remaining ? result : worst
        );
        res.setHeader("RateLimit-Limit", String(strictest.limit));
        res.setHeader("RateLimit-Remaining", String(strictest.remaining));
        res.setHeader("RateLimit-Reset", String(strictest.retryAfterSeconds));
        res.setHeader("RateLimit-Policy", `${strictest.limit};w=${Math.ceil(options.windowMs / 1000)}`);
        if (blocked.length) {
          res.setHeader("Retry-After", String(Math.max(...blocked.map((result) => result.retryAfterSeconds))));
          res.status(429).json({
            error: {
              code: options.code ?? "RATE_LIMITED",
              message: options.message ?? "Too many requests. Please slow down and try again later.",
            },
          });
          return;
        }
        next();
      } catch (err) {
        // The database is required for authentication and most writes anyway.
        // Failing closed here prevents a transient outage from disabling the
        // brute-force protections entirely.
        logger.error({ err, rule: options.name }, "distributed rate limiter unavailable");
        next(new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "Request protection is temporarily unavailable. Please retry."));
      }
    })();
  };
}

/** Reusable identity builders. */
export const limitKeys = {
  ip(req: Request, scope: string): RateLimitIdentity {
    return { key: `${scope}:ip:${sha256Hex(requestIp(req)).slice(0, 32)}` };
  },
  email(req: Request, scope: string): RateLimitIdentity | null {
    const email = lower((req.body as Record<string, unknown> | undefined)?.email);
    return email ? { key: `${scope}:email:${sha256Hex(email).slice(0, 32)}` } : null;
  },
  merchant(req: Request, scope: string): RateLimitIdentity | null {
    return req.auth?.merchantId ? { key: `${scope}:merchant:${req.auth.merchantId}` } : null;
  },
  param(req: Request, scope: string, name: string): RateLimitIdentity | null {
    const value = String((req.params as Record<string, unknown> | undefined)?.[name] ?? "");
    return value ? { key: `${scope}:${name}:${sha256Hex(value).slice(0, 32)}` } : null;
  },
  body(req: Request, scope: string, name: string): RateLimitIdentity | null {
    const value = lower((req.body as Record<string, unknown> | undefined)?.[name]);
    return value ? { key: `${scope}:${name}:${sha256Hex(value).slice(0, 32)}` } : null;
  },
};
