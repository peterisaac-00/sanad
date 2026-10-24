import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../server/index.js";
import { prisma } from "../server/db.js";

export { app, prisma };

export function uid(prefix: string): string {
  return `${prefix}${randomUUID().slice(0, 8)}`;
}

/** Wipe all data (FK-safe order). Call in beforeEach for isolation. */
export async function truncateAll(): Promise<void> {
  // rate_limit_buckets has no foreign key to stores/merchants, so CASCADE
  // alone would leave counters behind and leak quota between tests.
  await prisma.$executeRawUnsafe('TRUNCATE "merchants", "stores", "rate_limit_buckets" CASCADE');
}

/**
 * Register a fresh merchant+store; returns an authenticated agent + records.
 * Existing suites assume an approved, open storefront, so the helper promotes
 * the store to active by default. Pass `{ approve: false }` for lifecycle tests
 * that need to observe the pending gate.
 */
export async function registerMerchant(tag = "", options: { approve?: boolean } = {}) {
  const agent = request.agent(app);
  const email = `t${tag}${Date.now().toString(36)}${randomUUID().slice(0, 4)}@test.com`;
  const subdomain = `s${tag}${Date.now().toString(36)}${randomUUID().slice(0, 4)}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const res = await agent
    .post("/api/auth/register")
    .send({ email, password: "Password123", storeName: `Shop ${tag}`, subdomain })
    .expect(201);
  const store =
    options.approve === false
      ? res.body.store
      : await prisma.store.update({
          where: { id: res.body.store.id },
          data: { status: "active", activatedAt: new Date() },
        });
  return { agent, email, subdomain, merchant: res.body.merchant, store };
}

/** Register a merchant and promote it to platform admin. */
export async function registerAdmin(tag = "") {
  const account = await registerMerchant(tag);
  const merchant = await prisma.merchant.update({
    where: { id: account.merchant.id },
    data: { role: "admin" },
  });
  return { ...account, merchant };
}

export async function closeDb(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Finish the onboarding wizard through the real API so the store becomes
 * publicly visible (`onboardingCompleted` + `publishedAt`).
 */
export async function publishStore(
  session: Pick<Awaited<ReturnType<typeof registerMerchant>>, "agent">,
  overrides: Record<string, unknown> = {}
) {
  const patch = await session.agent
    .patch("/api/onboarding")
    .send({
      step: 5,
      businessType: "other",
      templateKey: "general",
      description: "متجر اختبار",
      whatsapp: "201000000000",
      codEnabled: true,
      ...overrides,
    });
  if (patch.status !== 200) throw new Error(`onboarding patch ${patch.status}: ${JSON.stringify(patch.body)}`);
  const res = await session.agent.post("/api/onboarding/complete").expect(200);
  return res.body.store;
}
