import { rateLimit } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db.js";
import { hashSessionToken } from "./auth.js";
import { ApiError } from "./errors.js";
import { env } from "./env.js";

/**
 * Authorization model (OWASP A01 — deny by default):
 * - Every /api route requires a valid session cookie, except the explicit
 *   public allowlist wired in index.ts.
 * - Store-scoped routes never trust the :subdomain (or any store id) from
 *   the client alone: the store is resolved server-side and must equal the
 *   authenticated merchant's own store, otherwise 403.
 */

export interface AuthContext {
  merchantId: string;
  email: string;
  name: string;
  storeId: string | null;
  storeHandle: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      ownedStore?: { id: string; subdomain: string };
    }
  }
}

function unauthorized(): ApiError {
  return new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.sanad_session;
  if (!token || typeof token !== "string") {
    next(unauthorized());
    return;
  }
  const tokenHash = hashSessionToken(token);
  const sess = await prisma.session.findUnique({ where: { tokenHash } });
  if (!sess || sess.expiresAt.getTime() <= Date.now()) {
    if (sess) {
      await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined);
    }
    next(new ApiError(401, "SESSION_EXPIRED", "Session is invalid or expired."));
    return;
  }
  const merchant = await prisma.merchant.findUnique({ where: { id: sess.merchantId } });
  if (!merchant) {
    await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined);
    next(unauthorized());
    return;
  }
  req.auth = {
    merchantId: merchant.id,
    email: merchant.email,
    name: merchant.name ?? "",
    storeId: merchant.storeId,
    storeHandle: merchant.storeHandle ?? "",
  };
  next();
}

/**
 * Must run after requireAuth on routes with a :subdomain param.
 * Resolves the store server-side and enforces ownership.
 */
export async function requireStoreOwnership(req: Request, _res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) {
    next(unauthorized());
    return;
  }
  const subdomain = String(req.params.subdomain || "").toLowerCase();
  const store = await prisma.store.findUnique({
    where: { subdomain },
    select: { id: true, subdomain: true },
  });
  if (!store) {
    next(new ApiError(404, "STORE_NOT_FOUND", "Store not found."));
    return;
  }
  if (!auth.storeId || auth.storeId !== store.id) {
    next(new ApiError(403, "FORBIDDEN", "You do not own this store."));
    return;
  }
  req.ownedStore = store;
  next();
}

/**
 * Optional authentication: attaches req.auth when a valid session cookie is
 * present, otherwise continues anonymously. Used for public endpoints that
 * attribute data (e.g. leads) without requiring login.
 */
export async function attachAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.sanad_session;
  if (!token || typeof token !== "string") {
    next();
    return;
  }
  const sess = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) } });
  if (!sess || sess.expiresAt.getTime() <= Date.now()) {
    next();
    return;
  }
  const merchant = await prisma.merchant.findUnique({ where: { id: sess.merchantId } });
  if (!merchant) {
    next();
    return;
  }
  req.auth = {
    merchantId: merchant.id,
    email: merchant.email,
    name: merchant.name ?? "",
    storeId: merchant.storeId,
    storeHandle: merchant.storeHandle ?? "",
  };
  next();
}

/**
 * CSRF protection for cookie auth: state-changing requests must carry an
 * Origin (or Referer) that matches the configured allowlist when the header
 * is present. SameSite=Lax cookies are the primary defense; this check
 * covers cross-site POSTs issued with an explicit Origin.
 */
export function csrfOriginCheck(req: Request, _res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    if (!env.corsOrigins.includes(origin.replace(/\/$/, ""))) {
      next(new ApiError(403, "CSRF_BLOCKED", "Cross-site request rejected."));
      return;
    }
    next();
    return;
  }
  const referer = req.headers.referer;
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!env.corsOrigins.includes(refOrigin)) {
        next(new ApiError(403, "CSRF_BLOCKED", "Cross-site request rejected."));
        return;
      }
    } catch {
      next(new ApiError(403, "CSRF_BLOCKED", "Cross-site request rejected."));
      return;
    }
  }
  next();
}

function limiterMessage(code = "RATE_LIMITED") {
  return {
    error: { code, message: "Too many requests. Please slow down and try again later." },
  };
}

/** Strict limiter for login/register: brute-force protection. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: limiterMessage(),
});

/** Public write endpoints (leads capture). */
export const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: limiterMessage(),
});
