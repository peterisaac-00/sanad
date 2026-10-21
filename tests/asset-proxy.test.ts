import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * In development the app is served by Vite (:3000) while Express (:5000) owns
 * both the JSON API and the stored media. Vite's SPA fallback answers unknown
 * paths with index.html and a 200, so any Express-served root path that is not
 * proxied turns into a "broken image" instead of an obvious 404. This test keeps
 * the two configs in sync so that regression cannot ship silently again.
 */
const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

function expressStaticMounts(): string[] {
  return [...read("server/index.ts").matchAll(/app\.use\(\s*"(\/[^"]+)"\s*,\s*express\.static/g)].map((m) => m[1]);
}

function viteProxyPrefixes(): string[] {
  return [...read("vite.config.ts").matchAll(/["'](\/[^"']+)["']\s*:\s*\{[^}]*\btarget\b/g)].map((m) => m[1]);
}

describe("dev server / API asset parity", () => {
  it("proxies every root-absolute path the API serves as static files", () => {
    const mounts = expressStaticMounts();
    const proxies = viteProxyPrefixes();

    expect(mounts, "expected server/index.ts to mount at least the uploads directory").toContain("/uploads");

    for (const mount of mounts) {
      const covered = proxies.some(
        (prefix) => mount === prefix || mount.startsWith(`${prefix.replace(/\/$/, "")}/`)
      );
      expect(
        covered,
        `Express serves "${mount}" but the Vite dev server does not proxy it; ` +
          `requests would return index.html and render as broken images`
      ).toBe(true);
    }
  });

  it("proxies the JSON API", () => {
    expect(viteProxyPrefixes()).toContain("/api");
  });
});
