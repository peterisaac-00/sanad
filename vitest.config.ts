import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: "forks",
    // Each worker boots its own PostgreSQL database and runs `prisma migrate
    // deploy`. Unbounded forks exhaust memory on CI/Windows, so cap concurrency.
    maxWorkers: 2,
    isolate: true,
    sequence: { shuffle: false },
  },
});
