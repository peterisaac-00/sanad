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
  await prisma.$executeRawUnsafe('TRUNCATE "merchants", "stores" CASCADE');
}

/** Register a fresh merchant+store; returns an authenticated agent + records. */
export async function registerMerchant(tag = "") {
  const agent = request.agent(app);
  const email = `t${tag}${Date.now().toString(36)}${randomUUID().slice(0, 4)}@test.com`;
  const subdomain = `s${tag}${Date.now().toString(36)}${randomUUID().slice(0, 4)}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const res = await agent
    .post("/api/auth/register")
    .send({ email, password: "Password123", storeName: `Shop ${tag}`, subdomain })
    .expect(201);
  return { agent, email, subdomain, merchant: res.body.merchant, store: res.body.store };
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
