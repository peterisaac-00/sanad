import { z } from "zod";

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
});

const parsed = envSchema.safeParse(raw);
if (!parsed.success) {
  console.error("[env] Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

function parseTrustProxy(v: string): boolean | number {
  if (v === "true") return true;
  if (v === "false") return false;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 0) return n;
  console.error('[env] TRUST_PROXY must be "true", "false", or a non-negative integer.');
  process.exit(1);
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
