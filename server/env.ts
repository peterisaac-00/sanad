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
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || "",
  DEMO_MERCHANT_PASSWORD: process.env.DEMO_MERCHANT_PASSWORD || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
  SESSION_SECRET: process.env.SESSION_SECRET || "",
};

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  NODE_ENV: z.enum(["development", "test", "production"]),
  CORS_ORIGIN: z.string().min(1),
  DEMO_MODE: z.enum(["true", "false"]),
  TRUST_PROXY: z.string(),
  JSON_BODY_LIMIT: z.string().min(1),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]),
  ADMIN_TOKEN: z.string(),
  DEMO_MERCHANT_PASSWORD: z.string(),
  SESSION_SECRET: z.string(),
  DATABASE_URL: z
    .string()
    .min(1, { message: "DATABASE_URL is required (e.g. postgresql://sanad:sanad@localhost:5432/sanad)" })
    .refine((v) => v.startsWith("postgresql://") || v.startsWith("postgres://"), {
      message: "DATABASE_URL must be a postgresql:// connection string",
    }),
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
  adminToken: parsed.data.ADMIN_TOKEN || null,
  demoMerchantPassword,
  databaseUrl: parsed.data.DATABASE_URL,
  sessionSecret,
};
