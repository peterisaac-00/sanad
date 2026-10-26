import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureBootstrapAdmin, ensurePlatformAdmin } from "../server/services/platformAdmin.js";
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

  it("forces the first administrator to replace the shared setup credentials", async () => {
    const setup = await ensureBootstrapAdmin({
      email: "owner@example.com",
      password: "BootstrapPassword123",
      name: "Bootstrap Owner",
    });
    expect(setup.created).toBe(true);
    expect(setup.admin?.mustChangeCredentials).toBe(true);

    const agent = request.agent(app);
    const login = await agent
      .post("/api/admin/auth/login")
      .send({ email: "owner@example.com", password: "BootstrapPassword123" })
      .expect(200);
    expect(login.body.admin.must_change_credentials).toBe(true);

    const blocked = await agent.get("/api/admin/overview").expect(403);
    expect(blocked.body.error.code).toBe("ADMIN_CREDENTIAL_CHANGE_REQUIRED");

    await agent
      .post("/api/admin/auth/credentials")
      .send({ email: "first.owner@example.com", newPassword: "PrivateOwnerPassword123" })
      .expect(400);
    const wrongCurrent = await agent
      .post("/api/admin/auth/credentials")
      .send({
        email: "first.owner@example.com",
        currentPassword: "WrongBootstrapPassword123",
        newPassword: "PrivateOwnerPassword123",
      })
      .expect(401);
    expect(wrongCurrent.body.error.code).toBe("INVALID_CREDENTIALS");
    await agent
      .post("/api/admin/auth/credentials")
      .send({
        email: "first.owner@example.com",
        currentPassword: "BootstrapPassword123",
        newPassword: "ShortPass1",
      })
      .expect(400);
    await agent
      .post("/api/admin/auth/credentials")
      .send({
        email: "first.owner@example.com",
        currentPassword: "BootstrapPassword123",
        newPassword: "BootstrapPassword123",
      })
      .expect(400);

    const changed = await agent
      .post("/api/admin/auth/credentials")
      .send({
        email: "first.owner@example.com",
        currentPassword: "BootstrapPassword123",
        newPassword: "PrivateOwnerPassword123",
      })
      .expect(200);
    expect(changed.body.admin.email).toBe("first.owner@example.com");
    expect(changed.body.admin.must_change_credentials).toBe(false);

    await agent.get("/api/admin/overview").expect(200);
    await request(app)
      .post("/api/admin/auth/login")
      .send({ email: "owner@example.com", password: "BootstrapPassword123" })
      .expect(401);
    const relogin = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: "first.owner@example.com", password: "PrivateOwnerPassword123" })
      .expect(200);
    expect(relogin.body.admin.must_change_credentials).toBe(false);

    const repeat = await agent
      .post("/api/admin/auth/credentials")
      .send({
        email: "second.owner@example.com",
        currentPassword: "PrivateOwnerPassword123",
        newPassword: "AnotherPrivatePassword123",
      })
      .expect(409);
    expect(repeat.body.error.code).toBe("ADMIN_CREDENTIALS_ALREADY_SET");
  });

  it("marks an existing bootstrap account for credential replacement", async () => {
    const created = await ensurePlatformAdmin({
      email: "owner@example.com",
      password: "BootstrapPassword123",
      name: "Bootstrap Owner",
      role: "super_admin",
    });
    expect(created.admin.mustChangeCredentials).toBe(false);

    const setup = await ensureBootstrapAdmin({
      email: "owner@example.com",
      password: "BootstrapPassword123",
    });
    expect(setup.forced).toBe(true);
    expect(setup.admin?.id).toBe(created.admin.id);
    expect(setup.admin?.mustChangeCredentials).toBe(true);
  });

  it("never recreates the bootstrap identity after its email was replaced", async () => {
    const first = await ensureBootstrapAdmin({
      email: "owner@example.com",
      password: "BootstrapPassword123",
    });
    expect(first.admin).not.toBeNull();
    await prisma.platformAdmin.update({
      where: { id: first.admin!.id },
      data: { email: "first.owner@example.com", mustChangeCredentials: false },
    });

    const second = await ensureBootstrapAdmin({
      email: "owner@example.com",
      password: "BootstrapPassword123",
    });
    expect(second.admin).toBeNull();
    expect(second.skipped).toBe(true);
    expect(await prisma.platformAdmin.count()).toBe(1);
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
