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
  await prisma.session.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.store.deleteMany();
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
