import type { Request, Response, NextFunction, RequestHandler } from "express";
import { prisma } from "./db.js";
import { hashSessionToken, sessionCookieName } from "./auth.js";
import { ApiError } from "./errors.js";
import { env } from "./env.js";
import { distributedRateLimit, limitKeys } from "./rateLimit.js";

/**
 * Authorization model (OWASP A01 — deny by default):
 * - Every /api route requires a valid session cookie, except the explicit
 *   public allowlist wired in index.ts.
 * - Store-scoped routes never trust the :subdomain (or any store id) from
 *   the client alone: the store is resolved server-side and must equal the
 *   authenticated merchant's own store, otherwise 403.
 * - Sensitive actions (PII exports) additionally require an allowed role.
 */

export interface AuthContext {
  merchantId: string;
  email: string;
  name: string;
  storeId: string | null;
  storeHandle: string;
  role: string;
  emailVerified: boolean;
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
  const token = req.cookies?.[sessionCookieName()];
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
    role: merchant.role,
    emailVerified: Boolean(merchant.emailVerifiedAt),
  };
  next();
}

/**
 * Role gate. Must run after requireAuth. Default deny: only the listed roles
 * pass, and the check uses the role stored in the database, never a header.
 */
export function requireRole(...roles: string[]): RequestHandler {
  const allowed = new Set(roles);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(unauthorized());
      return;
    }
    if (!allowed.has(req.auth.role)) {
      next(new ApiError(403, "FORBIDDEN", "Your role does not permit this action."));
      return;
    }
    next();
  };
}

/** Roles allowed to export customer/order PII. */
export const EXPORT_ROLES = ["admin", "owner", "merchant", "manager"] as const;
export const requireExportRole = requireRole(...EXPORT_ROLES);

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
  const token = req.cookies?.[sessionCookieName()];
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
    role: merchant.role,
    emailVerified: Boolean(merchant.emailVerifiedAt),
  };
  next();
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface CsrfEvaluationInput {
  method: string;
  origin?: string | null;
  referer?: string | null;
  allowedOrigins: string[];
  /** Production rejects mutations that carry neither Origin nor Referer. */
  requireSource: boolean;
}

export type CsrfEvaluation =
  | { ok: true }
  | { ok: false; reason: "origin_not_allowed" | "invalid_referer" | "source_required" };

/**
 * Pure CSRF decision function so the production-only strict rule can be
 * tested without changing NODE_ENV at import time.
 */
export function evaluateCsrfRequest(input: CsrfEvaluationInput): CsrfEvaluation {
  if (!MUTATING_METHODS.has(input.method.toUpperCase())) return { ok: true };
  const origin = String(input.origin ?? "").trim();
  if (origin) {
    if (origin === "null") return { ok: false, reason: "origin_not_allowed" };
    let normalized = origin;
    try {
      normalized = new URL(origin).origin;
    } catch {
      return { ok: false, reason: "origin_not_allowed" };
    }
    return input.allowedOrigins.includes(normalized.replace(/\/$/, ""))
      ? { ok: true }
      : { ok: false, reason: "origin_not_allowed" };
  }
  const referer = String(input.referer ?? "").trim();
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return input.allowedOrigins.includes(refOrigin.replace(/\/$/, ""))
        ? { ok: true }
        : { ok: false, reason: "invalid_referer" };
    } catch {
      return { ok: false, reason: "invalid_referer" };
    }
  }
  if (input.requireSource) return { ok: false, reason: "source_required" };
  return { ok: true };
}

/**
 * CSRF protection for cookie auth. SameSite=Lax is the primary defense; this
 * additionally rejects cross-site mutations and, in production, requests
 * that do not declare any source at all.
 */
export function csrfOriginCheck(req: Request, _res: Response, next: NextFunction) {
  const result = evaluateCsrfRequest({
    method: req.method,
    origin: req.headers.origin,
    referer: req.headers.referer,
    allowedOrigins: env.corsOrigins,
    requireSource: env.isProduction,
  });
  if (!result.ok) {
    next(new ApiError(403, "CSRF_BLOCKED", "Cross-site request rejected."));
    return;
  }
  next();
}

const MINUTE = 60_000;

function ip(req: Request, scope: string) {
  return limitKeys.ip(req, scope);
}

/** Strict distributed limiter for login/register: brute-force protection. */
export const authLimiter = distributedRateLimit({
  name: "auth",
  windowMs: 15 * MINUTE,
  limit: 30,
  identities: (req) => {
    const keys = [ip(req, "auth")];
    const email = limitKeys.email(req, "auth");
    // Per-account limit stops distributed password spraying across many IPs.
    if (email) keys.push({ ...email, limit: 10 });
    return keys;
  },
});

/** Password reset / verification email requests. */
export const emailLimiter = distributedRateLimit({
  name: "email",
  windowMs: 15 * MINUTE,
  limit: 5,
  identities: (req) => {
    const keys = [ip(req, "email-request")];
    const email = limitKeys.email(req, "email-request");
    if (email) keys.push({ ...email, limit: 3 });
    return keys;
  },
});

/** Public write endpoints (leads capture, reviews, coupons, shipping quotes). */
export const publicWriteLimiter = distributedRateLimit({
  name: "public-write",
  windowMs: 15 * MINUTE,
  limit: 60,
  identities: (req) => [ip(req, "public-write")],
});

/** Order tracking lookups: blocks sequential-number enumeration. */
export const trackingLookupLimiter = distributedRateLimit({
  name: "tracking",
  windowMs: 10 * MINUTE,
  limit: 20,
  identities: (req) => {
    const keys = [ip(req, "tracking")];
    const order = limitKeys.param(req, "tracking", "orderNumber");
    if (order) keys.push({ ...order, limit: 40 });
    return keys;
  },
  code: "TRACKING_RATE_LIMITED",
  message: "Too many tracking attempts. Please wait before trying again.",
});

/** Abandoned-cart tracking: prevents anonymous table flooding. */
export const cartLimiter = distributedRateLimit({
  name: "cart",
  windowMs: 10 * MINUTE,
  limit: 40,
  identities: (req) => {
    const keys = [ip(req, "cart")];
    const token = limitKeys.body(req, "cart", "cartToken");
    if (token) keys.push({ ...token, limit: 80 });
    return keys;
  },
  code: "CART_RATE_LIMITED",
  message: "Too many cart updates. Please wait before trying again.",
});

/** PII exports are expensive and audited, so they get a dedicated budget. */
export const exportLimiter = distributedRateLimit({
  name: "export",
  windowMs: 60 * MINUTE,
  limit: 20,
  identities: (req) => {
    const merchant = limitKeys.merchant(req, "export");
    return merchant ? [merchant] : [];
  },
});

/** Media uploads: bounded per merchant to prevent disk exhaustion. */
export const mediaLimiter = distributedRateLimit({
  name: "media",
  windowMs: 10 * MINUTE,
  limit: 30,
  identities: (req) => {
    const merchant = limitKeys.merchant(req, "media");
    return merchant ? [merchant] : [];
  },
});
