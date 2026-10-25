import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  closeDb,
  prisma,
  publishStore,
  registerMerchant,
  registerTeamMember,
  truncateAll,
} from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("team invitations", () => {
  it("issues a one-time invite link, accepts it, and never re-exposes the token", async () => {
    const owner = await registerMerchant("invite-owner");
    const base = `/api/stores/${owner.subdomain}`;

    const created = await owner.agent
      .post(`${base}/team`)
      .send({ name: "مدير المتجر", email: "manager@team.test", role: "manager" })
      .expect(201);

    expect(created.body.member).toMatchObject({ email: "manager@team.test", role: "manager", status: "invited" });
    expect(created.body.invite_token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(created.body.invite_url).toContain("/team/invite?token=");
    expect(created.body.expires_at).toBeTruthy();

    const list = await owner.agent.get(`${base}/team`).expect(200);
    expect(list.body.team).toHaveLength(1);
    expect(list.body.team[0]).toMatchObject({ email: "manager@team.test", status: "invited" });
    // The secret is disclosed exactly once, never by list endpoints.
    expect(JSON.stringify(list.body)).not.toContain(created.body.invite_token);
    expect(JSON.stringify(list.body)).not.toContain(created.body.invite_url);

    await owner.agent
      .post(`${base}/team`)
      .send({ name: "مكرر", email: "manager@team.test", role: "staff" })
      .expect(409);

    const preview = await request(app)
      .get(`/api/team/invitations/${created.body.invite_token}`)
      .expect(200);
    expect(preview.body.invitation).toMatchObject({
      email: "manager@team.test",
      role: "manager",
      store_name: owner.store.storeName,
      subdomain: owner.subdomain,
    });

    const teamAgent = request.agent(app);
    const accepted = await teamAgent
      .post("/api/team/invitations/accept")
      .send({ token: created.body.invite_token, password: "TeamPassword123", name: "مدير المتجر" })
      .expect(201);
    expect(accepted.body.scope).toBe("team");
    expect(accepted.body.team_member.status).toBe("active");
    expect(accepted.body.team_member.permissions).toEqual(
      expect.arrayContaining(["store.read", "settings.write", "domain.manage", "audit.read"])
    );

    const me = await teamAgent.get("/api/auth/me").expect(200);
    expect(me.body.principal_type).toBe("team");
    expect(me.body.merchant).toBeNull();
    expect(me.body.team_member.email).toBe("manager@team.test");
    expect(me.body.store.id).toBe(owner.store.id);

    const teamMe = await teamAgent.get("/api/team/me").expect(200);
    expect(teamMe.body.team_member.email).toBe("manager@team.test");

    // A team session cannot use the owner-only team endpoint.
    await owner.agent.get("/api/team/me").expect(403);

    // Re-inviting an accepted member mints a fresh one-time link and closes the
    // old password until the new invitation is accepted.
    const member = await prisma.teamMember.findUniqueOrThrow({ where: { email: "manager@team.test" } });
    const reinvited = await owner.agent
      .patch(`${base}/team/${member.id}`)
      .send({ status: "invited" })
      .expect(200);
    expect(reinvited.body.member.status).toBe("invited");
    expect(reinvited.body.invite_url).toContain("/team/invite?token=");
    expect(reinvited.body.invite_token).not.toBe(created.body.invite_token);

    await request.agent(app)
      .post("/api/team/login")
      .send({ email: "manager@team.test", password: "TeamPassword123" })
      .expect(403);
  });
});

describe("team permissions are enforced by the API", () => {
  it("scopes manager, staff and viewer access without relying on the UI", async () => {
    const owner = await registerMerchant("rbac-owner");
    // Complete onboarding so the manager can exercise the real publish/
    // unpublish lifecycle (publishing requires a completed onboarding).
    await publishStore(owner);
    const manager = await registerTeamMember(owner, "manager", "mgr");
    const staff = await registerTeamMember(owner, "staff", "staff");
    const viewer = await registerTeamMember(owner, "viewer", "viewer");
    const base = `/api/stores/${owner.subdomain}`;

    // Manager: settings, domains and audit are allowed; team identities and
    // billing stay owner-only surfaces.
    const managerSettings = await manager.agent.get(`${base}/settings`).expect(200);
    expect(managerSettings.body.principal_type).toBe("team");
    expect(managerSettings.body.team).toEqual([]);
    expect(managerSettings.body.permissions).toEqual(
      expect.arrayContaining(["settings.write", "domain.manage", "audit.read"])
    );
    await manager.agent.patch(`${base}/settings`).send({ whatsapp: "201111111111" }).expect(200);
    await manager.agent.get(`${base}/audit-logs`).expect(200);
    await manager.agent.get(`${base}/domains`).expect(200);
    await manager.agent.get(`${base}/team`).expect(403);
    await manager.agent.get(`${base}/wallet`).expect(403);
    await manager.agent
      .post(`${base}/subscription-payments`)
      .send({ plan: "monthly", method: "bank_transfer", reference: "RBAC-1" })
      .expect(403);
    await manager.agent.post(`${base}/team`).send({ email: "nope@team.test", role: "viewer" }).expect(403);

    // Publishing is a settings write, so the manager can unpublish and republish.
    const unpublished = await manager.agent
      .post(`${base}/publishing`)
      .send({ action: "unpublish", reason: "تحديث الأسعار" })
      .expect(200);
    expect(unpublished.body.publishing.publish_status).toBe("draft");
    const republished = await manager.agent
      .post(`${base}/publishing`)
      .send({ action: "publish" })
      .expect(200);
    expect(republished.body.publishing.publish_status).toBe("published");

    // Staff: normal operations yes, sensitive surfaces no.
    const staffSettings = await staff.agent.get(`${base}/settings`).expect(200);
    expect(staffSettings.body.team).toEqual([]);
    expect(staffSettings.body.domains).toEqual([]);
    const category = await staff.agent
      .post(`${base}/categories`)
      .send({ nameAr: "ملابس" })
      .expect(201);
    expect(category.body.category.storeId).toBe(owner.store.id);
    await staff.agent.patch(`${base}/settings`).send({ whatsapp: "201222222222" }).expect(403);
    await staff.agent.get(`${base}/audit-logs`).expect(403);
    await staff.agent.get(`${base}/wallet`).expect(403);
    await staff.agent.get(`${base}/domains`).expect(403);

    // Viewer: read-only store access.
    await viewer.agent.get(`${base}/products`).expect(200);
    await viewer.agent.get(`${base}/settings`).expect(200);
    await viewer.agent
      .post(`${base}/categories`)
      .send({ nameAr: "ممنوع" })
      .expect(403);
    await viewer.agent.patch(`${base}/settings`).send({ whatsapp: "201333333333" }).expect(403);

    // Onboarding is owner-only, and team sessions never cross into admin.
    await manager.agent.get("/api/onboarding").expect(403);
    await staff.agent.get("/api/admin/overview").expect(403);

    // The owner retains unrestricted access.
    const ownerSettings = await owner.agent.get(`${base}/settings`).expect(200);
    expect(ownerSettings.body.principal_type).toBe("merchant");
    await owner.agent.get(`${base}/team`).expect(200);
    await owner.agent.get(`${base}/wallet`).expect(200);
  });

  it("applies role changes immediately and revokes sessions on suspension", async () => {
    const owner = await registerMerchant("rbac-live");
    const staff = await registerTeamMember(owner, "staff", "live");
    const base = `/api/stores/${owner.subdomain}`;

    await staff.agent.post(`${base}/categories`).send({ nameAr: "قبل التخفيض" }).expect(201);

    await owner.agent
      .patch(`${base}/team/${staff.member.id}`)
      .send({ role: "viewer" })
      .expect(200);
    await staff.agent.post(`${base}/categories`).send({ nameAr: "بعد التخفيض" }).expect(403);
    await staff.agent.get(`${base}/products`).expect(200);

    await owner.agent
      .patch(`${base}/team/${staff.member.id}`)
      .send({ status: "suspended" })
      .expect(200);
    await staff.agent.get(`${base}/products`).expect(401);
    expect(await prisma.session.count({ where: { teamMemberId: staff.member.id } })).toBe(0);

    await request.agent(app)
      .post("/api/team/login")
      .send({ email: staff.email, password: "TeamPassword123" })
      .expect(403);
  });

  it("attributes team actions to the real team member in the audit trail", async () => {
    const owner = await registerMerchant("audit-team");
    const manager = await registerTeamMember(owner, "manager", "audit");
    const base = `/api/stores/${owner.subdomain}`;

    await manager.agent.post(`${base}/categories`).send({ nameAr: "قسم من الفريق" }).expect(201);

    const logs = await owner.agent.get(`${base}/audit-logs?limit=20`).expect(200);
    const entry = logs.body.logs.find((log: any) => log.action === "category.created");
    expect(entry).toBeTruthy();
    expect(entry.actorType).toBe("team_member");
    expect(entry.teamMemberId).toBe(manager.member.id);
    expect(entry.actor).toMatchObject({ type: "team_member", name: manager.member.name, email: manager.email });
    expect(entry.merchantId).toBeNull();
  });
});
