import type { Request, Response, NextFunction, RequestHandler } from "express";
import { prisma } from "./db.js";
import { hashSessionToken, sessionCookieName } from "./auth.js";
import { ApiError } from "./errors.js";
import { env } from "./env.js";
import { distributedRateLimit, limitKeys } from "./rateLimit.js";
import {
  adminPermissions,
  adminSessionCookieName,
  findAdminSession,
  type AdminPermission,
} from "./services/platformAdmin.js";
import { isTrustedStorefrontOrigin, normalizeOrigin } from "./services/domains.js";

/**
 * Authorization model (OWASP A01 - deny by default):
 * - Every /api route requires a valid session cookie, except the explicit
 *   public allowlist wired in index.ts.
 * - Merchant-owner and team-member sessions are distinct principals. Team
 *   sessions carry a teamMemberId and a computed permission set; merchant
 *   role strings no longer grant platform administration.
 * - Store-scoped routes never trust the :subdomain (or any store id) from
 *   the client alone: the store is resolved server-side and must equal the
 *   authenticated principal's own store, otherwise 403.
 * - Every mutation is checked against a granular store permission in this
 *   file, so a viewer/staff member cannot mutate a route just because the UI
 *   hid the button.
 * - Platform administration uses a separate cookie and AdminSession table.
 */

export const STORE_PERMISSIONS = [
  "store.read",
  "operations.write",
  "settings.write",
  "team.manage",
  "domain.manage",
  "billing.manage",
  "export.read",
  "audit.read",
] as const;
export type StorePermission = (typeof STORE_PERMISSIONS)[number];

const ALL_STORE_PERMISSIONS = [...STORE_PERMISSIONS];

/**
 * Team role capabilities, enforced by the API. Owner accounts always receive
 * every permission and cannot be demoted by a team member.
 */
export const TEAM_ROLE_PERMISSIONS: Record<string, ReadonlySet<StorePermission>> = {
  admin: new Set(ALL_STORE_PERMISSIONS),
  manager: new Set<StorePermission>([
    "store.read",
    "operations.write",
    "settings.write",
    "domain.manage",
    "export.read",
    "audit.read",
  ]),
  staff: new Set<StorePermission>(["store.read", "operations.write"]),
  viewer: new Set<StorePermission>(["store.read"]),
};

export function teamPermissions(role: string): StorePermission[] {
  return [...(TEAM_ROLE_PERMISSIONS[role] ?? TEAM_ROLE_PERMISSIONS.viewer)];
}

export interface AuthContext {
  /** merchant = store owner; team = invited TeamMember. */
  principalType: "merchant" | "team";
  /** Owner merchant id, or null for a team session. */
  merchantId: string | null;
  /** Team member id, or null for an owner session. */
  teamMemberId: string | null;
  /** Stable id used for audit attribution regardless of principal type. */
  actorId: string;
  email: string;
  name: string;
  storeId: string | null;
  storeHandle: string;
  role: string;
  emailVerified: boolean;
  permissions: StorePermission[];
}

export interface AdminAuthContext {
  adminId: string;
  email: string;
  name: string;
  role: string;
  permissions: AdminPermission[];
  mustChangeCredentials: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      adminAuth?: AdminAuthContext;
      ownedStore?: { id: string; subdomain: string; currency: string };
    }
  }
}

function unauthorized(): ApiError {
  return new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
}

/**
 * Resolve the merchant/team session cookie into an AuthContext. Returns
 * "expired" for a known-but-expired session, or null for an unknown,
 * suspended, or malformed session. Admin cookies are never consulted here.
 */
async function resolveSessionAuth(req: Request): Promise<AuthContext | null | "expired"> {
  const token = req.cookies?.[sessionCookieName()];
  if (!token || typeof token !== "string") return null;
  const tokenHash = hashSessionToken(token);
  const sess = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      merchant: true,
      teamMember: { include: { store: { select: { subdomain: true } } } },
    },
  });
  if (!sess || sess.expiresAt.getTime() <= Date.now()) {
    if (sess) await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined);
    return sess ? "expired" : null;
  }

  if (sess.merchant) {
    const merchant = sess.merchant;
    return {
      principalType: "merchant",
      merchantId: merchant.id,
      teamMemberId: null,
      actorId: merchant.id,
      email: merchant.email,
      name: merchant.name ?? "",
      storeId: merchant.storeId,
      storeHandle: merchant.storeHandle ?? "",
      role: merchant.role,
      emailVerified: Boolean(merchant.emailVerifiedAt),
      permissions: ALL_STORE_PERMISSIONS,
    };
  }

  if (sess.teamMember) {
    const member = sess.teamMember;
    if (member.status !== "active") {
      await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined);
      return null;
    }
    return {
      principalType: "team",
      merchantId: null,
      teamMemberId: member.id,
      actorId: member.id,
      email: member.email,
      name: member.name ?? "",
      storeId: member.storeId,
      storeHandle: member.store?.subdomain ?? "",
      role: member.role,
      emailVerified: true,
      permissions: teamPermissions(member.role),
    };
  }

  // Neither principal: treat as corrupt and remove it.
  await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined);
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = await resolveSessionAuth(req);
  if (auth === "expired") {
    next(new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Sign in again."));
    return;
  }
  if (!auth) {
    next(unauthorized());
    return;
  }
  req.auth = auth;
  next();
}

/** Owner-only routes (onboarding, account deletion, MFA settings, billing). */
export function requireMerchantSession(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) {
    next(unauthorized());
    return;
  }
  if (req.auth.principalType !== "merchant" || !req.auth.merchantId) {
    next(new ApiError(403, "OWNER_ONLY", "Only the store owner can perform this action."));
    return;
  }
  next();
}

/**
 * Role gate for legacy merchant-role checks. Kept for compatibility but
 * platform administration no longer uses merchant roles.
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

/** Resolve the permission implied by the HTTP method and store path. */
export function storePermissionForRequest(method: string, path: string): StorePermission {
  const clean = `/${String(path || "").split("?")[0].replace(/^\/+/, "")}`;
  if (clean.endsWith("/export") || clean.includes("/export/")) return "export.read";
  // Sensitive read surfaces are permissioned even for GET: a viewer may read
  // store operations, but not team identities, billing, or the audit trail.
  if (/\/audit-logs(?:\/|$)/.test(clean)) return "audit.read";
  if (/\/team(?:\/|$)/.test(clean)) return "team.manage";
  if (/\/domains(?:\/|$)/.test(clean)) return "domain.manage";
  if (/\/wallet(?:\/|$)/.test(clean) || /\/subscription-payments(?:\/|$)/.test(clean)) return "billing.manage";
  if (method === "GET" || method === "HEAD") return "store.read";
  if (
    /\/settings(?:\/|$)/.test(clean) ||
    /\/notification-preferences(?:\/|$)/.test(clean) ||
    /\/publishing(?:\/|$)/.test(clean)
  ) {
    return "settings.write";
  }
  return "operations.write";
}

export function requireStorePermission(permission: StorePermission): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) {
      next(unauthorized());
      return;
    }
    if (auth.principalType === "merchant" || auth.permissions.includes(permission)) {
      next();
      return;
    }
    next(new ApiError(403, "FORBIDDEN", "Your team role does not permit this action."));
  };
}

/** Roles allowed to export customer/order PII: owner and manager+ only. */
export const requireExportRole = requireStorePermission("export.read");

/**
 * Must run after requireAuth on routes with a :subdomain param.
 * Resolves the store server-side, enforces ownership, and applies the
 * granular team permission derived from the route/method.
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
    select: { id: true, subdomain: true, currency: true },
  });
  if (!store) {
    next(new ApiError(404, "STORE_NOT_FOUND", "Store not found."));
    return;
  }
  if (!auth.storeId || auth.storeId !== store.id) {
    next(new ApiError(403, "FORBIDDEN", "You do not own this store."));
    return;
  }

  if (auth.principalType === "team") {
    const permission = storePermissionForRequest(req.method, req.path || req.originalUrl);
    if (!auth.permissions.includes(permission)) {
      next(new ApiError(403, "FORBIDDEN", "Your team role does not permit this action."));
      return;
    }
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
  const auth = await resolveSessionAuth(req);
  if (auth && auth !== "expired") req.auth = auth;
  next();
}

/**
 * Platform-admin authentication. Only the admin cookie is read and only the
 * AdminSession table is consulted. A merchant session can never pass.
 */
export async function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[adminSessionCookieName()];
  const session = await findAdminSession(typeof token === "string" ? token : undefined);
  if (!session) {
    // A signed-in merchant or team member is authenticated but never allowed:
    // return 403 (not 401) so the two trust boundaries stay unambiguous.
    const merchantAuth = await resolveSessionAuth(req);
    if (merchantAuth && merchantAuth !== "expired") {
      next(new ApiError(403, "ADMIN_ACCESS_DENIED", "Merchant accounts cannot access platform administration."));
      return;
    }
    next(new ApiError(401, "ADMIN_UNAUTHENTICATED", "Platform administrator authentication required."));
    return;
  }
  req.adminAuth = {
    adminId: session.admin.id,
    email: session.admin.email,
    name: session.admin.name,
    role: session.admin.role,
    permissions: adminPermissions(session.admin.role),
    mustChangeCredentials: session.admin.mustChangeCredentials,
  };
  next();
}

export function requireAdminPermission(permission: AdminPermission): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.adminAuth) {
      next(new ApiError(401, "ADMIN_UNAUTHENTICATED", "Platform administrator authentication required."));
      return;
    }
    if (req.adminAuth.mustChangeCredentials) {
      next(
        new ApiError(
          403,
          "ADMIN_CREDENTIAL_CHANGE_REQUIRED",
          "Replace the initial administrator email and password before using the console."
        )
      );
      return;
    }
    if (!req.adminAuth.permissions.includes(permission)) {
      next(new ApiError(403, "ADMIN_FORBIDDEN", "Your administrator role does not permit this action."));
      return;
    }
    next();
  };
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

function customDomainAllowedForPath(req: Request): boolean {
  // A merchant-controlled custom domain must never become a trusted origin for
  // platform-admin cookie APIs. Admin remains restricted to configured platform
  // origins even when a store domain is verified.
  return !req.originalUrl.split("?")[0].startsWith("/api/admin");
}

/**
 * CORS gate with the same trust decision as CSRF. Only configured platform
 * origins and verified custom domains receive CORS headers; preflight requests
 * are answered here so a custom-domain storefront can POST JSON to the API.
 */
export async function corsOriginGuard(req: Request, res: Response, next: NextFunction) {
  const rawOrigin = req.headers.origin;
  if (!rawOrigin) {
    next();
    return;
  }
  const origin = normalizeOrigin(rawOrigin);
  if (!origin) {
    next(new ApiError(403, "CORS_ORIGIN_REJECTED", "Origin not allowed."));
    return;
  }
  const platformOrigin = env.corsOrigins.includes(origin);
  if (
    !platformOrigin &&
    (!customDomainAllowedForPath(req) || !(await isTrustedStorefrontOrigin(origin)))
  ) {
    next(new ApiError(403, "CORS_ORIGIN_REJECTED", "Origin not allowed."));
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.append("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
    res.setHeader("Access-Control-Max-Age", "600");
    res.status(204).end();
    return;
  }
  next();
}

/**
 * CSRF protection for cookie auth. SameSite=Lax is the primary defense; this
 * additionally rejects cross-site mutations and, in production, requests
 * that do not declare any source at all. Verified custom domains are accepted
 * as first-party origins for storefront/merchant APIs, but never for the
 * platform-admin cookie surface.
 */
export async function csrfOriginCheck(req: Request, _res: Response, next: NextFunction) {
  let allowedOrigins = env.corsOrigins;
  const source = req.headers.origin || req.headers.referer;
  const normalized = normalizeOrigin(source);
  if (
    normalized &&
    customDomainAllowedForPath(req) &&
    !allowedOrigins.includes(normalized) &&
    (await isTrustedStorefrontOrigin(normalized))
  ) {
    allowedOrigins = [...allowedOrigins, normalized];
  }
  const result = evaluateCsrfRequest({
    method: req.method,
    origin: req.headers.origin,
    referer: req.headers.referer,
    allowedOrigins,
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
    const actor = req.auth?.actorId ? { key: `export:actor:${req.auth.actorId}`, limit: 20 } : null;
    return actor ? [actor] : [];
  },
});

/** Media uploads: bounded per principal to prevent disk exhaustion. */
export const mediaLimiter = distributedRateLimit({
  name: "media",
  windowMs: 10 * MINUTE,
  limit: 30,
  identities: (req) => {
    const actor = req.auth?.actorId ? { key: `media:actor:${req.auth.actorId}`, limit: 30 } : null;
    return actor ? [actor] : [];
  },
});

/** Storefront visit beacons are cheap, but still bounded per IP. */
export const visitLimiter = distributedRateLimit({
  name: "storefront-visits",
  windowMs: 15 * MINUTE,
  limit: 120,
  identities: (req) => [ip(req, "storefront-visits")],
  code: "VISIT_RATE_LIMITED",
  message: "Too many visit beacons. Please wait before trying again.",
});
