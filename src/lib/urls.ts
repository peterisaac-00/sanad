/**
 * Public storefront URLs for dashboard, onboarding and admin surfaces.
 *
 * Production keeps the dashboard on the platform root (`soqeg.com`) and serves
 * every store from `<subdomain>.soqeg.com`. Local development keeps the same
 * shape with `<subdomain>.localhost`. An IP-only deployment cannot use
 * wildcard DNS, so it falls back to the legacy `/store/<subdomain>` path.
 */

function isIpHost(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

export function platformDomain(): string {
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return "localhost";
  return host.replace(/^www\./, "");
}

export function storefrontUrl(store: { subdomain?: string | null; customDomain?: string | null } | null | undefined): string {
  if (!store?.subdomain) return "/";
  if (store.customDomain) return `https://${store.customDomain}`;

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const port = window.location.port ? `:${window.location.port}` : "";
  const base = platformDomain();
  if (isIpHost(base)) return `${protocol}//${base}${port}/store/${encodeURIComponent(store.subdomain)}`;
  return `${protocol}//${store.subdomain}.${base}${port}`;
}

export function storefrontLabel(store: { subdomain?: string | null; customDomain?: string | null } | null | undefined): string {
  if (!store?.subdomain) return "";
  if (store.customDomain) return store.customDomain;
  const url = storefrontUrl(store);
  return url.replace(/^https?:\/\//, "");
}

export function storefrontHref(
  store: { subdomain?: string | null; customDomain?: string | null } | null | undefined,
  path = ""
): string {
  const origin = storefrontUrl(store).replace(/\/$/, "");
  if (!path || path === "/") return origin;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
