/**
 * Privacy helpers used at every boundary where customer PII could leak:
 * public API responses, logs and URL query strings.
 */

const SENSITIVE_QUERY_KEYS = new Set([
  "phone",
  "customer_phone",
  "customerPhone",
  "email",
  "customer_email",
  "customerEmail",
  "token",
  "tracking_token",
  "access_token",
  "refresh_token",
  "password",
  "newPassword",
  "currentPassword",
  "code",
  "otp",
  "totp",
  "recovery_code",
  "secret",
  "api_key",
  "apikey",
  "key",
]);

const SENSITIVE_BODY_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "totp",
  "code",
  "recovery_code",
  "phone",
  "customer_phone",
  "email",
  "customer_email",
  "secret",
]);

/** Mask a phone number while keeping the prefix/suffix useful to its owner. */
export function maskPhone(input: string | null | undefined): string {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 6) return "*".repeat(digits.length);
  if (digits.length <= 9) return `${digits.slice(0, 2)}${"*".repeat(digits.length - 4)}${digits.slice(-2)}`;
  return `${digits.slice(0, 3)}${"*".repeat(digits.length - 7)}${digits.slice(-4)}`;
}

/** Mask an email address: a***@example.com. */
export function maskEmail(input: string | null | undefined): string {
  const email = String(input ?? "").trim();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return email ? "***" : "";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(3, local.length - 1))}@${domain}`;
}

export function maskName(input: string | null | undefined): string {
  const name = String(input ?? "").trim();
  if (!name) return "";
  const parts = name.split(/\s+/);
  return parts
    .map((part, index) => (index === 0 ? part : `${part.slice(0, 1)}***`))
    .join(" ");
}

/**
 * Remove sensitive query parameters from a URL before it is written to logs.
 * Keeps the route and non-sensitive filters readable for debugging.
 */
export function sanitizeUrlForLogs(url: string | null | undefined): string {
  const raw = String(url ?? "");
  if (!raw) return "";
  const [pathname, query = ""] = raw.split("?", 2);
  if (!query) return pathname;
  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key) || /token|secret|password|phone|email/i.test(key)) {
      params.set(key, "[REDACTED]");
    }
  }
  const clean = params.toString();
  return clean ? `${pathname}?${clean}` : pathname;
}

/** Recursively redact PII from an object before logging it. */
export function redactForLogs(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((entry) => redactForLogs(entry, depth + 1));
  if (typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_BODY_KEYS.has(key) || /token|secret|password/i.test(key)) {
      output[key] = "[REDACTED]";
    } else if (/phone/i.test(key)) {
      output[key] = maskPhone(String(entry ?? ""));
    } else if (/email/i.test(key)) {
      output[key] = maskEmail(String(entry ?? ""));
    } else {
      output[key] = redactForLogs(entry, depth + 1);
    }
  }
  return output;
}

export function isSensitiveQueryKey(key: string): boolean {
  return SENSITIVE_QUERY_KEYS.has(key);
}
