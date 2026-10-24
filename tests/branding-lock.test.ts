import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { app, registerMerchant, publishStore, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

/**
 * Identity and branding (name, description, template, colors, logo, cover and
 * SEO) are chosen once during onboarding. Publishing freezes them; only the
 * platform admin API may change them afterwards.
 */
describe("store identity is admin-managed after onboarding", () => {
  it("rejects branding, template, name and SEO changes after publishing", async () => {
    const a = await registerMerchant("bl");
    const store = await publishStore(a, {
      branding: { primaryColor: "#1d4ed8", logoUrl: "/uploads/logo.png" },
    });
    expect(store.onboardingCompleted).toBe(true);

    const color = await a.agent.patch("/api/onboarding").send({ branding: { primaryColor: "#000000" } });
    expect(color.status).toBe(409);
    expect(color.body.error.code).toBe("STORE_IDENTITY_ADMIN_ONLY");

    const template = await a.agent.patch("/api/onboarding").send({ templateKey: "fashion" });
    expect(template.status).toBe(409);
    expect(template.body.error.code).toBe("STORE_IDENTITY_ADMIN_ONLY");

    const name = await a.agent.patch("/api/onboarding").send({ storeName: "اسم جديد" });
    expect(name.status).toBe(409);
    expect(name.body.error.code).toBe("STORE_IDENTITY_ADMIN_ONLY");
  });

  it("removes the dashboard design endpoint and rejects logo/cover edits elsewhere", async () => {
    const a = await registerMerchant("bd");
    await publishStore(a);

    await a.agent.get(`/api/stores/${a.subdomain}/design`).expect(404);
    await a.agent.patch(`/api/stores/${a.subdomain}/design`).send({ primaryColor: "#000000" }).expect(404);

    const settings = await a.agent.patch(`/api/stores/${a.subdomain}/settings`).send({ logoUrl: "/uploads/evil.png" });
    expect(settings.status).toBe(400);
    expect(settings.body.error.code).toBe("VALIDATION_ERROR");

    const account = await a.agent.patch("/api/account/store").send({ coverUrl: "/uploads/evil.png" });
    expect(account.status).toBe(400);
    expect(account.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks owner identity edits but keeps operational settings editable", async () => {
    const a = await registerMerchant("bo");
    await publishStore(a);

    const identity = await a.agent
      .patch(`/api/stores/${a.subdomain}/settings`)
      .send({ storeName: "اسم جديد", description: "وصف محدّث" });
    expect(identity.status).toBe(409);
    expect(identity.body.error.code).toBe("STORE_IDENTITY_ADMIN_ONLY");

    const operational = await a.agent
      .patch(`/api/stores/${a.subdomain}/settings`)
      .send({ whatsapp: "201111111111", codEnabled: true, supportEmail: "help@example.com" })
      .expect(200);
    expect(operational.body.store.whatsapp).toBe("201111111111");
    expect(operational.body.store.codEnabled).toBe(true);
    expect(operational.body.store.supportEmail).toBe("help@example.com");
  });
});
