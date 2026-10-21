import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { app, registerMerchant, publishStore, truncateAll, closeDb } from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

/**
 * Branding (template, colors, logo, cover) is chosen once during onboarding.
 * Publishing freezes it: the dashboard no longer offers a design page, and the
 * API must reject any attempt to change it afterwards.
 */
describe("branding is set once during onboarding", () => {
  it("rejects branding and template changes after publishing", async () => {
    const a = await registerMerchant("bl");
    const store = await publishStore(a, {
      branding: { primaryColor: "#1d4ed8", logoUrl: "/uploads/logo.png" },
    });
    expect(store.onboardingCompleted).toBe(true);

    const color = await a.agent.patch("/api/onboarding").send({ branding: { primaryColor: "#000000" } });
    expect(color.status).toBe(409);
    expect(color.body.error.code).toBe("BRANDING_LOCKED");

    const template = await a.agent.patch("/api/onboarding").send({ templateKey: "fashion" });
    expect(template.status).toBe(409);
    expect(template.body.error.code).toBe("BRANDING_LOCKED");
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

  it("keeps the rest of the store settings editable", async () => {
    const a = await registerMerchant("bo");
    await publishStore(a);

    const res = await a.agent
      .patch(`/api/stores/${a.subdomain}/settings`)
      .send({ storeName: "اسم جديد", description: "وصف محدّث" })
      .expect(200);
    expect(res.body.store.storeName).toBe("اسم جديد");
    expect(res.body.store.description).toBe("وصف محدّث");
  });
});
