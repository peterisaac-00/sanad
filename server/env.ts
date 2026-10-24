import { z } from "zod";
import { isIP } from "node:net";
import { createHash } from "node:crypto";

/**
 * Centralized, validated environment configuration.
 * The process fails fast at boot when required values are missing or invalid.
 */

const raw = {
  PORT: process.env.PORT || process.env.BACKEND_PORT || "5000",
  NODE_ENV: process.env.NODE_ENV || "development",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  DEMO_MODE: process.env.DEMO_MODE || "false",
  TRUST_PROXY: process.env.TRUST_PROXY || "false",
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || "256kb",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  DEMO_MERCHANT_PASSWORD: process.env.DEMO_MERCHANT_PASSWORD || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
  SESSION_SECRET: process.env.SESSION_SECRET || "",
  // Optional integration credentials. Empty values leave the integration
  // explicitly "not configured" instead of silently faking success.
  APP_URL: process.env.APP_URL || "http://localhost:3000",
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || "local",
  STORAGE_DIR: process.env.STORAGE_DIR || "data/uploads",
  AI_BASE_URL: process.env.AI_BASE_URL || "",
  AI_API_KEY: process.env.AI_API_KEY || "",
  AI_MODEL: process.env.AI_MODEL || "gpt-4o-mini",
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || "",
  PAYMENT_SECRET_KEY: process.env.PAYMENT_SECRET_KEY || "",
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || "",
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID || "",
  SHIPPING_PROVIDER: process.env.SHIPPING_PROVIDER || "",
  SHIPPING_API_KEY: process.env.SHIPPING_API_KEY || "",
  MEDIA_MAX_BYTES: process.env.MEDIA_MAX_BYTES || "5242880",
  MEDIA_MAX_DIMENSION: process.env.MEDIA_MAX_DIMENSION || "6000",
  SMTP_URL: process.env.SMTP_URL || "",
  EMAIL_FROM: process.env.EMAIL_FROM || "",
  REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION || "false",
  EMAIL_VERIFICATION_TTL_MINUTES: process.env.EMAIL_VERIFICATION_TTL_MINUTES || "1440",
  PASSWORD_RESET_TTL_MINUTES: process.env.PASSWORD_RESET_TTL_MINUTES || "60",
  TRACKING_SECRET: process.env.TRACKING_SECRET || "",
  TRACKING_TOKEN_TTL_DAYS: process.env.TRACKING_TOKEN_TTL_DAYS || "30",
  TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY || "",
  CART_RETENTION_DAYS: process.env.CART_RETENTION_DAYS || "30",
  AUDIT_RETENTION_DAYS: process.env.AUDIT_RETENTION_DAYS || "365",
  EXPORT_MAX_ROWS: process.env.EXPORT_MAX_ROWS || "50000",
};

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  NODE_ENV: z.enum(["development", "test", "production"]),
  CORS_ORIGIN: z.string().min(1),
  DEMO_MODE: z.enum(["true", "false"]),
  TRUST_PROXY: z.string(),
  JSON_BODY_LIMIT: z.string().min(1),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]),
  DEMO_MERCHANT_PASSWORD: z.string(),
  SESSION_SECRET: z.string(),
  DATABASE_URL: z
    .string()
    .min(1, { message: "DATABASE_URL is required (e.g. postgresql://sanad:sanad@localhost:5432/sanad)" })
    .refine((v) => v.startsWith("postgresql://") || v.startsWith("postgres://"), {
      message: "DATABASE_URL must be a postgresql:// connection string",
    }),
  APP_URL: z.string().url(),
  STORAGE_DRIVER: z.enum(["local", "s3"]),
  STORAGE_DIR: z.string().min(1),
  AI_BASE_URL: z.string(),
  AI_API_KEY: z.string(),
  AI_MODEL: z.string(),
  PAYMENT_PROVIDER: z.string(),
  PAYMENT_SECRET_KEY: z.string(),
  WHATSAPP_ACCESS_TOKEN: z.string(),
  WHATSAPP_PHONE_ID: z.string(),
  SHIPPING_PROVIDER: z.string(),
  SHIPPING_API_KEY: z.string(),
  MEDIA_MAX_BYTES: z.coerce.number().int().min(1024).max(20 * 1024 * 1024),
  MEDIA_MAX_DIMENSION: z.coerce.number().int().min(256).max(12000),
  SMTP_URL: z.union([z.literal(""), z.string().url()]),
  EMAIL_FROM: z.union([z.literal(""), z.string().trim().max(320)]),
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().min(5).max(10080),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440),
  TRACKING_SECRET: z.string(),
  TRACKING_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365),
  TOTP_ENCRYPTION_KEY: z.string(),
  CART_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650),
  EXPORT_MAX_ROWS: z.coerce.number().int().min(1).max(1_000_000),
});


const parsed = envSchema.safeParse(raw);
if (!parsed.success) {
  console.error("[env] Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

/**
 * The S3 adapter is not implemented. Selecting it must fail at boot instead of
 * accepting uploads and only then returning a configuration error.
 */
export function storageDriverError(driver: string): string | null {
  if (driver === "local") return null;
  return `[env] STORAGE_DRIVER=${driver} is not supported yet: the S3 media adapter is not implemented. Use STORAGE_DRIVER=local.`;
}

const storageError = storageDriverError(parsed.data.STORAGE_DRIVER);
if (storageError) {
  console.error(storageError);
  process.exit(1);
}

/**
 * Express accepts a boolean, a hop count, or a list of trusted proxy
 * addresses/CIDRs. `true` is rejected on purpose: it trusts the entire
 * X-Forwarded-For chain, so any client can spoof its own IP and bypass
 * per-IP rate limits and audit attribution.
 */
export type TrustProxySetting = false | number | string[];

const PROXY_PRESETS = new Set(["loopback", "linklocal", "uniquelocal"]);

function validProxyToken(token: string): boolean {
  if (PROXY_PRESETS.has(token)) return true;
  const [address, bits] = token.split("/");
  if (!address || isIP(address) === 0) return false;
  if (bits === undefined) return true;
  if (!/^\d{1,3}$/.test(bits)) return false;
  const prefix = Number(bits);
  return prefix >= 0 && prefix <= (isIP(address) === 6 ? 128 : 32);
}

export function parseTrustProxy(v: string): TrustProxySetting {
  const value = v.trim();
  if (value === "false" || value === "") return false;
  if (value === "true") {
    console.error(
      '[env] TRUST_PROXY=true is unsafe (any client can spoof X-Forwarded-For). Use a hop count such as "1" or an explicit proxy IP/CIDR list.'
    );
    process.exit(1);
  }
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (hops >= 1 && hops <= 32) return hops;
    console.error("[env] TRUST_PROXY hop count must be between 1 and 32.");
    process.exit(1);
  }
  const tokens = value.split(",").map((s) => s.trim()).filter(Boolean);
  if (!tokens.length || !tokens.every(validProxyToken)) {
    console.error(
      '[env] TRUST_PROXY must be "false", a positive hop count, or a comma-separated list of IP addresses/CIDRs ("loopback", "linklocal", "uniquelocal" are also accepted).'
    );
    process.exit(1);
  }
  return tokens;
}

const corsOrigins = parsed.data.CORS_ORIGIN.split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (corsOrigins.length === 0) {
  console.error("[env] CORS_ORIGIN must contain at least one allowed origin.");
  process.exit(1);
}

const isProduction = parsed.data.NODE_ENV === "production";
const demoMode = parsed.data.DEMO_MODE === "true";
const requireEmailVerification = parsed.data.REQUIRE_EMAIL_VERIFICATION === "true";
const emailConfigured = Boolean(parsed.data.SMTP_URL && parsed.data.EMAIL_FROM);

if (isProduction && requireEmailVerification && !emailConfigured) {
  console.error(
    "[env] REQUIRE_EMAIL_VERIFICATION=true requires SMTP_URL and EMAIL_FROM. Refusing to boot without a way to deliver verification links."
  );
  process.exit(1);
}
if ((parsed.data.SMTP_URL && !parsed.data.EMAIL_FROM) || (!parsed.data.SMTP_URL && parsed.data.EMAIL_FROM)) {
  console.warn("[env] Set both SMTP_URL and EMAIL_FROM to enable email delivery. Email is currently disabled.");
}


// Never silently run demo data in production: an explicit demo password is required.
let demoMerchantPassword = parsed.data.DEMO_MERCHANT_PASSWORD;
if (demoMode && isProduction && !demoMerchantPassword) {
  console.error("[env] DEMO_MODE=true in production requires DEMO_MERCHANT_PASSWORD to be set. Refusing to boot.");
  process.exit(1);
}
if (demoMode && !demoMerchantPassword) {
  demoMerchantPassword = "ChangeMe123!";
  console.warn("[env] DEMO_MODE=true without DEMO_MERCHANT_PASSWORD: using default demo password. Never use this in production.");
}

// Session tokens are HMACed with SESSION_SECRET before storage, so a
// read-only database leak alone cannot mint sessions. Production refuses
// to boot without a strong secret; rotating it invalidates all sessions.
let sessionSecret = parsed.data.SESSION_SECRET;
if (isProduction) {
  if (!sessionSecret || sessionSecret.length < 32) {
    console.error("[env] SESSION_SECRET must be set to at least 32 characters in production. Refusing to boot.");
    process.exit(1);
  }
} else if (!sessionSecret) {
  sessionSecret = "dev-only-insecure-session-secret-change-me";
  console.warn("[env] SESSION_SECRET not set: using an insecure dev default. Never use this in production.");
}

function derivedSecret(purpose: string): string {
  return createHash("sha256").update(`sanad:${purpose}:${sessionSecret}`, "utf8").digest("hex");
}

let trackingSecret = parsed.data.TRACKING_SECRET || derivedSecret("tracking");
if (isProduction && parsed.data.TRACKING_SECRET && parsed.data.TRACKING_SECRET.length < 32) {
  console.error("[env] TRACKING_SECRET must be at least 32 characters when set in production. Refusing to boot.");
  process.exit(1);
}

let totpEncryptionKey = parsed.data.TOTP_ENCRYPTION_KEY || derivedSecret("totp");
if (isProduction && parsed.data.TOTP_ENCRYPTION_KEY && parsed.data.TOTP_ENCRYPTION_KEY.length < 32) {
  console.error("[env] TOTP_ENCRYPTION_KEY must be at least 32 characters when set in production. Refusing to boot.");
  process.exit(1);
}

export const env = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  isProduction,
  corsOrigins,
  demoMode,
  trustProxy: parseTrustProxy(parsed.data.TRUST_PROXY),
  jsonBodyLimit: parsed.data.JSON_BODY_LIMIT,
  logLevel: parsed.data.LOG_LEVEL,
  demoMerchantPassword,
  databaseUrl: parsed.data.DATABASE_URL,
  sessionSecret,
  appUrl: parsed.data.APP_URL.replace(/\/$/, ""),
  storageDriver: parsed.data.STORAGE_DRIVER,
  storageDir: parsed.data.STORAGE_DIR,
  mediaMaxBytes: parsed.data.MEDIA_MAX_BYTES,
  mediaMaxDimension: parsed.data.MEDIA_MAX_DIMENSION,
  email: {
    configured: emailConfigured,
    smtpUrl: parsed.data.SMTP_URL,
    from: parsed.data.EMAIL_FROM,
    requireVerification: requireEmailVerification,
    verificationTtlMinutes: parsed.data.EMAIL_VERIFICATION_TTL_MINUTES,
    resetTtlMinutes: parsed.data.PASSWORD_RESET_TTL_MINUTES,
  },
  tracking: {
    secret: trackingSecret,
    ttlDays: parsed.data.TRACKING_TOKEN_TTL_DAYS,
  },
  totpEncryptionKey,
  retention: {
    cartDays: parsed.data.CART_RETENTION_DAYS,
    auditDays: parsed.data.AUDIT_RETENTION_DAYS,
  },
  exportMaxRows: parsed.data.EXPORT_MAX_ROWS,
  ai: {

    configured: Boolean(parsed.data.AI_BASE_URL && parsed.data.AI_API_KEY),
    baseUrl: parsed.data.AI_BASE_URL,
    apiKey: parsed.data.AI_API_KEY,
    model: parsed.data.AI_MODEL,
  },
  payments: {
    configured: Boolean(parsed.data.PAYMENT_PROVIDER && parsed.data.PAYMENT_SECRET_KEY),
    provider: parsed.data.PAYMENT_PROVIDER,
    secretKey: parsed.data.PAYMENT_SECRET_KEY,
  },
  whatsapp: {
    cloudConfigured: Boolean(parsed.data.WHATSAPP_ACCESS_TOKEN && parsed.data.WHATSAPP_PHONE_ID),
    accessToken: parsed.data.WHATSAPP_ACCESS_TOKEN,
    phoneId: parsed.data.WHATSAPP_PHONE_ID,
  },
  shipping: {
    configured: Boolean(parsed.data.SHIPPING_PROVIDER && parsed.data.SHIPPING_API_KEY),
    provider: parsed.data.SHIPPING_PROVIDER,
    apiKey: parsed.data.SHIPPING_API_KEY,
  },
};
