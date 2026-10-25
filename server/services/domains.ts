import { prisma } from "../db.js";
import { env } from "../env.js";

/**
 * Custom-domain routing is deliberately conservative:
 *
 * - Only an exact, verified `StoreDomain` row may select a store. A Host value
 *   that merely looks like a domain never falls back to another store.
 * - Only the raw `Host` header is trusted. `X-Forwarded-Host` is ignored
 *   because an application behind a proxy cannot distinguish a real proxy
 *   rewrite from a client-supplied header unless the whole chain is trusted.
 * - A verified domain opens the storefront only while the store is approved
 *   (status=active) and published (publishStatus=published).
 */

export const HOST_PATTERN =
  /^(?=.{4,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;

/** Normalize a raw Host header (or configured domain) to a bare hostname. */
export function normalizeHost(raw: string | string[] | undefined | null): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function isValidHost(host: string): boolean {
  return host.length >= 4 && host.length <= 253 && HOST_PATTERN.test(host);
}

export function platformHostnames(): Set<string> {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "::1"]);
  try {
    hosts.add(new URL(env.appUrl).hostname.toLowerCase());
  } catch {
    // env.appUrl is validated at boot; this is only defensive.
  }
  for (const origin of env.corsOrigins) {
    try {
      hosts.add(new URL(origin).hostname.toLowerCase());
    } catch {
      // ignore malformed optional origin
    }
  }
  return hosts;
}

export function isPlatformHost(host: string): boolean {
  if (!host) return true;
  const platform = platformHostnames();
  if (platform.has(host)) return true;
  // Local development on any port and loopback IPv6 are platform hosts.
  return host === "0.0.0.0" || host === "[::1]";
}

export interface HostStore {
  storeId: string;
  subdomain: string;
  storeName: string;
  status: string;
  publishStatus: string;
  domain: string;
  tlsStatus: string;
  canonicalUrl: string;
}

/**
 * Resolve a host to a published store. Returns null for platform hosts,
 * unknown hosts, unverified domains and stores that are not publicly open.
 */
export async function resolveCustomDomainHost(rawHost: string | null | undefined): Promise<HostStore | null> {
  const host = normalizeHost(rawHost);
  if (!host || isPlatformHost(host) || !isValidHost(host)) return null;
  const row = await prisma.storeDomain.findUnique({
    where: { domain: host },
    include: {
      store: {
        select: {
          id: true,
          subdomain: true,
          storeName: true,
          status: true,
          publishStatus: true,
        },
      },
    },
  });
  if (!row || row.status !== "verified") return null;
  if (row.store.status !== "active" || row.store.publishStatus !== "published") return null;
  return {
    storeId: row.store.id,
    subdomain: row.store.subdomain,
    storeName: row.store.storeName,
    status: row.store.status,
    publishStatus: row.store.publishStatus,
    domain: row.domain,
    tlsStatus: row.tlsStatus,
    canonicalUrl: `https://${row.domain}`,
  };
}

/** The canonical public URL for a store, preferring a verified custom domain. */
export async function canonicalUrlForStore(store: {
  id: string;
  subdomain: string;
  customDomain?: string | null;
}): Promise<string> {
  const verified = await prisma.storeDomain.findFirst({
    where: { storeId: store.id, status: "verified" },
    orderBy: { verifiedAt: "asc" },
    select: { domain: true },
  });
  if (verified) return `https://${verified.domain}`;
  if (store.customDomain) return `https://${store.customDomain}`;
  return `${env.appUrl}/store/${encodeURIComponent(store.subdomain)}`;
}

/** Escape a JSON value for safe inline injection into an HTML document. */
export function serializeForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Escape a value for an HTML attribute (used for meta-tag boot metadata). */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
