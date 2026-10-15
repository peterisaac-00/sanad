// Production server build: bundles server/index.ts with esbuild so
// `npm start` runs on plain node without devDependencies (no tsx).
// Usage: node scripts/build-server.mjs  (also wired as `prestart`, which
// skips itself when esbuild is unavailable but a bundle already exists)
import { existsSync } from "node:fs";

const OUT = "dist-server/server.cjs";

let esbuild;
try {
  const mod = await import("esbuild");
  esbuild = mod.default ?? mod;
} catch {
  if (existsSync(OUT)) {
    console.log(`[build-server] esbuild unavailable, reusing existing ${OUT}`);
    process.exit(0);
  }
  console.error("[build-server] esbuild is required to bundle the server (devDependency).");
  process.exit(1);
}

await esbuild.build({
  entryPoints: ["server/index.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  packages: "external",
  outfile: OUT,
  logLevel: "info",
});
console.log(`[build-server] wrote ${OUT}`);
