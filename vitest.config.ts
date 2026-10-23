import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Runtime equivalent of the tsconfig `@prisma/client` path alias. Vitest
    // does not read tsconfig paths, and the default `@prisma/client` package
    // points at a stale copy under node_modules/.prisma.
    alias: {
      "@prisma/client": path.resolve(process.cwd(), "generated/prisma/client"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: "forks",
    isolate: true,
    sequence: { shuffle: false },
  },
});
