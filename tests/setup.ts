/**
 * Vitest setup: point the app at an isolated TEST database and apply
 * migrations once per worker. Runs before any test module is imported,
 * so server/env.ts validates against the test values.
 */
import { execSync } from "node:child_process";
import pg from "pg";

process.env.VITEST = "true";
process.env.NODE_ENV ??= "test";
process.env.SESSION_SECRET ??= "test-only-session-secret-0123456789abcdef";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.LOG_LEVEL ??= "error";

// One database per vitest worker so parallel test files never share rows.
// (beforeEach truncation handles isolation within a file.)
const worker = process.env.VITEST_WORKER_ID ?? "0";
const dbName = `sanad_test_w${worker}`;
const base =
  process.env.TEST_DATABASE_URL?.replace(/\/[^/]*$/, `/${dbName}`) ||
  `postgresql://sanad:sanad@localhost:5432/${dbName}`;
process.env.DATABASE_URL = base;

const admin = new pg.Client({ connectionString: "postgresql://sanad:sanad@localhost:5432/postgres" });
await admin.connect();
await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]).then(async (r) => {
  if (r.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${dbName}`);
    console.log(`[tests] created database ${dbName}`);
  }
});
await admin.end();

execSync("node node_modules/prisma/build/index.js migrate deploy", {
  env: { ...process.env, DATABASE_URL: base },
  stdio: "pipe",
});
