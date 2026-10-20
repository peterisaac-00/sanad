// Runs the API (tsx server/index.ts) and frontend (vite) together.
// `npm run dev` uses this script so the Vite proxy at /api always has a
// backend to talk to (a frontend-only server would answer /api with 502).
// Use `npm run dev:web` when the API runs somewhere else.
import "dotenv/config";
import { spawn } from "node:child_process";

// Honor the same PORT the API reads from .env, so the health probe and the
// Vite proxy target cannot drift apart.
const API_PORT = process.env.PORT || "5000";
const WEB_PORT = process.env.WEB_PORT || "3000";
const HEALTH_URL = `http://127.0.0.1:${API_PORT}/api/health`;

const children = new Set();
let stopping = false;

function prefix(name, color) {
  return (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line) process.stdout.write(`${color}[${name}]\x1b[0m ${line}\n`);
    }
  };
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === "win32") {
      // Kill the whole tree (tsx -> node / vite) on Windows.
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  if (children.size === 0) process.exit(code);
  // Children normally exit immediately; don't hang forever if one doesn't.
  setTimeout(() => process.exit(code), 2000).unref();
}

function run(name, cmd, args, color) {
  const child = spawn(cmd, args, { stdio: "pipe" });
  children.add(child);
  child.stdout.on("data", prefix(name, color));
  child.stderr.on("data", prefix(name, color));
  child.on("exit", (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[${name}] exited with code ${code}`);
      stop(code ?? 1);
    }
  });
  return child;
}

async function waitForApi() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (children.size === 0) return false; // backend already crashed
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) return true;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// Start the API first: Vite must not be able to proxy to a dead port, which
// browsers surface as "Request failed (502)".
run(
  "backend ",
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "--watch", "server/index.ts"],
  "\x1b[32m"
);

if (await waitForApi()) {
  run(
    "frontend",
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--port", WEB_PORT, "--host", "0.0.0.0", "--strictPort"],
    "\x1b[36m"
  );
} else {
  console.error(
    `[dev] API did not become healthy at ${HEALTH_URL}. ` +
      "Check DATABASE_URL and that PostgreSQL is running (docker compose up -d db)."
  );
  stop(1);
}
