import { prisma } from "../db.js";

/**
 * Feature flags are stored in PostgreSQL so an operator change applies to the
 * next request without a redeploy. Unknown keys fall back to the caller's
 * explicit default rather than silently enabling a feature.
 */
export async function isFeatureEnabled(key: string, fallback = false): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key }, select: { enabled: true } });
  return flag ? flag.enabled : fallback;
}

export async function featureFlagMap(keys: string[]): Promise<Record<string, boolean>> {
  const flags = await prisma.featureFlag.findMany({ where: { key: { in: keys } } });
  const found = new Map(flags.map((flag) => [flag.key, flag.enabled]));
  return Object.fromEntries(keys.map((key) => [key, found.get(key) ?? false]));
}
