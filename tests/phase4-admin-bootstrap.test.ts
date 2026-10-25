import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensurePlatformAdmin } from "../server/services/platformAdmin.js";
import { app, closeDb, prisma, truncateAll } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("first platform administrator bootstrap", () => {
  it("creates a super admin with a real password and no merchant identity", async () => {
    const result = await ensurePlatformAdmin({
      email: "  Owner@Example.com ",
      password: "BootstrapPassword123",
      name: "Bootstrap Owner",
      role: "super_admin",
    });

    expect(result.created).toBe(true);
    expect(result.admin.email).toBe("owner@example.com");
    expect(result.admin.role).toBe("super_admin");
    expect(result.admin.status).toBe("active");
    expect(result.admin.passwordHash).toMatch(/^\$argon2id\$/);
    expect(result.admin.passwordHash).not.toContain("BootstrapPassword123");
    expect(await prisma.merchant.count()).toBe(0);

    const agent = request.agent(app);
    const login = await agent
      .post("/api/admin/auth/login")
      .send({ email: "owner@example.com", password: "BootstrapPassword123" })
      .expect(200);
    expect(login.body.scope).toBe("platform");
    expect(login.body.admin.permissions).toContain("admins.manage");
    await agent.get("/api/admin/overview").expect(200);
  });

  it("is idempotent and never resets an existing password, name, or role", async () => {
    const first = await ensurePlatformAdmin({
      email: "owner@example.com",
      password: "FirstBootstrapPassword123",
      name: "First Owner",
      role: "super_admin",
    });
    expect(first.created).toBe(true);

    const second = await ensurePlatformAdmin({
      email: "OWNER@EXAMPLE.COM",
      password: "SecondBootstrapPassword456",
      name: "Replacement Owner",
      role: "readonly",
    });
    expect(second.created).toBe(false);
    expect(second.admin.id).toBe(first.admin.id);
    expect(second.admin.email).toBe("owner@example.com");
    expect(second.admin.name).toBe("First Owner");
    expect(second.admin.role).toBe("super_admin");
    expect(await prisma.platformAdmin.count()).toBe(1);

    await request(app)
      .post("/api/admin/auth/login")
      .send({ email: "owner@example.com", password: "FirstBootstrapPassword123" })
      .expect(200);
    await request(app)
      .post("/api/admin/auth/login")
      .send({ email: "owner@example.com", password: "SecondBootstrapPassword456" })
      .expect(401);
  });
});
