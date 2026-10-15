import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env.js";

/**
 * PostgreSQL access via Prisma. There is no create-tables-on-boot:
 * schema changes ship as versioned migrations under prisma/migrations
 * (apply with `npm run db:migrate`). The app only connects.
 */

declare global {
  // Reuse one client across tsx --watch reloads in dev.
  // eslint-disable-next-line no-var
  var __sanadPrisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma =
  globalThis.__sanadPrisma ??
  new PrismaClient({
    adapter,
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });

if (!env.isProduction) {
  globalThis.__sanadPrisma = prisma;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = ""): string {
  return prefix + randomUUID().slice(0, 8);
}

export async function checkDb(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
