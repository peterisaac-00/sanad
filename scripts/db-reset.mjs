// Dev-only database reset: drops everything and re-applies all migrations.
// Refuses to run when NODE_ENV=production. Usage: npm run db:reset
import { spawnSync } from "node:child_process";

if (process.env.NODE_ENV === "production") {
  console.error("[db:reset] refused: will not reset the database in production.");
  process.exit(1);
}

const prismaBin = process.platform === "win32" ? "node_modules/.bin/prisma.cmd" : "node_modules/.bin/prisma";
const r = spawnSync(prismaBin, ["migrate", "reset", "--force", "--skip-seed"], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
