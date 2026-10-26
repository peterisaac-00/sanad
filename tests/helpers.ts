import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../server/index.js";
import { prisma } from "../server/db.js";
import { hashPasswordArgon2 } from "../server/auth.js";

export { app, prisma };

export function uid(prefix: string): string {
  return `${prefix}${randomUUID().slice(0, 8)}`;
}

/** Resolve the internal order id after a public checkout response (which omits it by design). */
export async function orderIdByNumber(subdomain: string, orderNumber: number): Promise<string> {
  const store = await prisma.store.findUnique({ where: { subdomain }, select: { id: true } });
  if (!store) throw new Error(`Store not found: ${subdomain}`);
  const order = await prisma.order.findUnique({
    where: { storeId_orderNumber: { storeId: store.id, orderNumber } },
    select: { id: true },
  });
  if (!order) throw new Error(`Order not found: ${subdomain}/${orderNumber}`);
  return order.id;
}

/** Wipe all data (FK-safe order). Call in beforeEach for isolation. */
export async function truncateAll(): Promise<void> {
  // rate_limit_buckets has no foreign key to stores/merchants, so CASCADE
  // alone would leave counters behind and leak quota between tests.
  // Audit logs are kept independent of the store FK (SET NULL) and platform
  // admins are a separate identity, so both are truncated explicitly.
  // Feature flags are global (no store FK), so a test that pauses wallet
  // deposits must not leak that state into the next suite.
  await prisma.$executeRawUnsafe(
    'TRUNCATE "merchants", "stores", "platform_admins", "audit_logs", "feature_flags", "rate_limit_buckets" CASCADE'
  );
}

/**
 * Register a fresh merchant+store; returns an authenticated agent + records.
 * Existing suites assume an approved, open storefront, so the helper promotes
 * the store to active by default. Pass `{ approve: false }` for lifecycle tests
 * that need to observe the pending gate.
 */
export async function registerMerchant(
  tag = "",
  options: { approve?: boolean; publish?: boolean } = {}
) {
  const agent = request.agent(app);
  const email = `t${tag}${Date.now().toString(36)}${randomUUID().slice(0, 4)}@test.com`;
  const subdomain = `s${tag}${Date.now().toString(36)}${randomUUID().slice(0, 4)}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  const res = await agent
    .post("/api/auth/register")
    .send({ email, password: "Password123", storeName: `Shop ${tag}`, subdomain })
    .expect(201);
  // Pending stores stay exactly as registered. Approved stores are public by
  // default; pass `publish: false` for approved-but-draft lifecycle tests.
  const store =
    options.approve === false
      ? res.body.store
      : await prisma.store.update({
          where: { id: res.body.store.id },
          data: {
            status: "active",
            activatedAt: new Date(),
            publishStatus: options.publish === false ? "draft" : "published",
            publishReason: "",
            publishedAt: options.publish === false ? null : new Date(),
          },
        });
  return { agent, email, subdomain, merchant: res.body.merchant, store };
}

/** Create a real PlatformAdmin identity and sign it in through the admin API. */
export async function registerAdmin(tag = "", role = "super_admin") {
  const agent = request.agent(app);
  const email = `admin${tag}${Date.now().toString(36)}${randomUUID().slice(0, 4)}@test.com`;
  const admin = await prisma.platformAdmin.create({
    data: {
      id: `padm_${randomUUID().slice(0, 12)}`,
      email,
      name: `Admin ${tag}`,
      passwordHash: await hashPasswordArgon2("AdminPassword123"),
      passwordAlgo: "argon2id",
      role,
      status: "active",
    },
  });
  await agent.post("/api/admin/auth/login").send({ email, password: "AdminPassword123" }).expect(200);
  return { agent, email, admin };
}

/** Create an active team member with a real password and sign it in. */
export async function registerTeamMember(
  session: Pick<Awaited<ReturnType<typeof registerMerchant>>, "store">,
  role: "admin" | "manager" | "staff" | "viewer",
  tag = ""
) {
  const agent = request.agent(app);
  const email = `team${tag}${Date.now().toString(36)}${randomUUID().slice(0, 4)}@test.com`;
  const member = await prisma.teamMember.create({
    data: {
      id: `team_${randomUUID().slice(0, 12)}`,
      storeId: session.store.id,
      name: `Team ${role}`,
      email,
      role,
      status: "active",
      passwordHash: await hashPasswordArgon2("TeamPassword123"),
      passwordAlgo: "argon2id",
      acceptedAt: new Date(),
    },
  });
  await agent.post("/api/team/login").send({ email, password: "TeamPassword123" }).expect(200);
  return { agent, email, member };
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
