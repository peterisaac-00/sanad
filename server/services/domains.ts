import { isIP } from "node:net";
import { prisma } from "../db.js";
import { env } from "../env.js";

/**
 * Storefront host routing is deliberately conservative:
 *
 * - `<subdomain>.<PLATFORM_DOMAIN>` selects exactly one store by its
 *   registered subdomain. The platform root (`soqeg.com`, `www.soqeg.com`)
 *   remains the marketing/dashboard surface.
 * - Only an exact, verified `StoreDomain` row may select a store for a
 *   merchant-owned custom domain. A Host value that merely looks like a
 *   domain never falls back to another store.
 * - Only the raw `Host` header is trusted. `X-Forwarded-Host` is ignored
 *   because an application behind a proxy cannot distinguish a real proxy
 *   rewrite from a client-supplied header unless the whole chain is trusted.
 * - A verified custom domain opens the storefront only while the store is
 *   approved (status=active) and published (publishStatus=published).
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

/** Normalize an Origin/Referer value to its canonical scheme://host[:port]. */
export function normalizeOrigin(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value || value === "null") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Trust an Origin only when it is one of the configured platform origins or a
 * verified custom domain attached to an active, published store. This is used
 * by both the CORS gate and the CSRF check so the two boundaries cannot drift.
 */
export async function isTrustedStorefrontOrigin(raw: string | null | undefined): Promise<boolean> {
  const normalized = normalizeOrigin(raw);
  if (!normalized) return false;
  if (env.corsOrigins.includes(normalized)) return true;

  const url = new URL(normalized);
  if (!isValidHost(url.hostname.toLowerCase())) return false;
  // Storefront hosts are terminated over HTTPS in production. Local/test
  // environments may use http so the origin policy remains testable.
  if (env.isProduction && url.protocol !== "https:") return false;

  const resolved = await resolveStorefrontHost(url.hostname);
  return Boolean(
    resolved &&
      resolved.status === "active" &&
      resolved.publishStatus === "published"
  );
}

export function platformHostnames(): Set<string> {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "::1"]);
  try {
    hosts.add(new URL(env.appUrl).hostname.toLowerCase());
  } catch {
    // env.appUrl is validated at boot; this is only defensive.
  }
  if (env.platformDomain) {
    hosts.add(env.platformDomain);
    hosts.add(`www.${env.platformDomain}`);
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

/**
 * Extract the store handle from a host like `test.soqeg.com`. Only a single
 * label directly under PLATFORM_DOMAIN is accepted. `www` and the platform
 * root are not store handles.
 */
export function platformSubdomainLabel(rawHost: string): string | null {
  const host = normalizeHost(rawHost);
  const base = env.platformDomain;
  if (!host || !base || host === base || host === `www.${base}`) return null;
  if (!host.endsWith(`.${base}`)) return null;
  const label = host.slice(0, -(base.length + 1));
  if (!label || label.includes(".") || label === "www") return null;
  // Mirrors the merchant subdomain contract: 3-40 lowercase/digit/hyphen
  // characters, never starting or ending with a hyphen.
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(label)) return null;
  return label;
}

/** Public origin for a platform-hosted store, e.g. https://test.soqeg.com. */
export function platformStoreOrigin(subdomain: string): string {
  const url = new URL(env.appUrl);
  // An IP-only deployment cannot use wildcard DNS. Fall back to the path URL
  // instead of generating an invalid `store.203.0.113.10` host.
  if (isIP(env.platformDomain) !== 0) {
    return `${env.appUrl}/store/${encodeURIComponent(subdomain)}`;
  }
  url.hostname = `${subdomain}.${env.platformDomain}`;
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.origin;
}

/** The public storefront URL, preferring a verified custom domain. */
export function storefrontOrigin(store: {
  subdomain: string;
  customDomain?: string | null;
}): string {
  if (store.customDomain) return `https://${store.customDomain}`;
  return platformStoreOrigin(store.subdomain);
}

export type StorefrontHostMode = "platform_subdomain" | "custom_domain";

export interface HostStore {
  storeId: string;
  subdomain: string;
  storeName: string;
  status: string;
  publishStatus: string;
  domain: string;
  tlsStatus: string;
  canonicalUrl: string;
  mode: StorefrontHostMode;
}

/**
 * Resolve a storefront host. Platform subdomains resolve a store even while it
 * is pending (so the merchant can preview the coming-soon page); custom
 * domains require a verified domain on an active, published store.
 */
export async function resolveStorefrontHost(rawHost: string | null | undefined): Promise<HostStore | null> {
  const host = normalizeHost(rawHost);
  if (!host || isPlatformHost(host) || !isValidHost(host)) return null;

  const platformSubdomain = platformSubdomainLabel(host);
  if (platformSubdomain) {
    const store = await prisma.store.findUnique({
      where: { subdomain: platformSubdomain },
      select: {
        id: true,
        subdomain: true,
        storeName: true,
        status: true,
        publishStatus: true,
      },
    });
    if (!store) return null;
    return {
      storeId: store.id,
      subdomain: store.subdomain,
      storeName: store.storeName,
      status: store.status,
      publishStatus: store.publishStatus,
      domain: host,
      tlsStatus: env.appUrl.startsWith("https://") ? "active" : "pending",
      canonicalUrl: platformStoreOrigin(store.subdomain),
      mode: "platform_subdomain",
    };
  }

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
    mode: "custom_domain",
  };
}

/** Backwards-compatible custom-domain-only resolver. */
export async function resolveCustomDomainHost(rawHost: string | null | undefined): Promise<HostStore | null> {
  const resolved = await resolveStorefrontHost(rawHost);
  return resolved?.mode === "custom_domain" ? resolved : null;
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
  return platformStoreOrigin(store.subdomain);
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
