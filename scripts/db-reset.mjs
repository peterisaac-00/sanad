// Dev-only database reset: drops everything and re-applies all migrations.
// Refuses production, remote hosts and the maintenance database, and requires
// an explicit confirmation. Usage: CONFIRM_DB_RESET=yes npm run db:reset
import "dotenv/config";
import { spawnSync } from "node:child_process";

if (process.env.NODE_ENV === "production") {
  console.error("[db:reset] refused: will not reset the database in production.");
  process.exit(1);
}
if (process.env.CONFIRM_DB_RESET !== "yes") {
  console.error("[db:reset] refused: set CONFIRM_DB_RESET=yes to confirm this destructive reset.");
  process.exit(1);
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[db:reset] refused: DATABASE_URL is required.");
  process.exit(1);
}
let target;
try {
  target = new URL(databaseUrl);
} catch {
  console.error("[db:reset] refused: DATABASE_URL is not a valid PostgreSQL URL.");
  process.exit(1);
}
if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") {
  console.error("[db:reset] refused: DATABASE_URL must be a PostgreSQL URL.");
  process.exit(1);
}
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db"]);
if (!localHosts.has(target.hostname)) {
  console.error(`[db:reset] refused: host '${target.hostname}' is not a local/development database host.`);
  process.exit(1);
}
if (target.pathname === "/postgres" || target.pathname === "/postgres/") {
  console.error("[db:reset] refused: will not reset the PostgreSQL maintenance database.");
  process.exit(1);
}

const prismaBin = process.platform === "win32" ? "node_modules/.bin/prisma.cmd" : "node_modules/.bin/prisma";
const r = spawnSync(prismaBin, ["migrate", "reset", "--force", "--skip-seed"], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
