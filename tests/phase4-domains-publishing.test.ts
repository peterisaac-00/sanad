import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  closeDb,
  prisma,
  publishStore,
  registerAdmin,
  registerMerchant,
  truncateAll,
} from "./helpers.js";
import { normalizeHost, isValidHost, resolveCustomDomainHost } from "../server/services/domains.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("custom domain host resolution", () => {
  it("normalizes and validates hosts conservatively", () => {
    expect(normalizeHost("Shop.Example.com:443")).toBe("shop.example.com");
    expect(normalizeHost("shop.example.com.")).toBe("shop.example.com");
    expect(normalizeHost(["shop.example.com", "ignored.example.com"])).toBe("shop.example.com");
    expect(normalizeHost(undefined)).toBe("");
    expect(isValidHost("shop.example.com")).toBe(true);
    expect(isValidHost("localhost")).toBe(false);
    expect(isValidHost("-bad.example.com")).toBe(false);
  });

  it("opens only a verified, published store and exposes TLS state explicitly", async () => {
    const first = await registerMerchant("domain-first");
    const second = await registerMerchant("domain-second");
    await publishStore(first);
    await publishStore(second);
    const admin = await registerAdmin("domain-admin");
    const base = `/api/stores/${first.subdomain}`;

    const created = await first.agent
      .post(`${base}/domains`)
      .send({ domain: "shop.example.com" })
      .expect(201);
    expect(created.body.domain).toMatchObject({ domain: "shop.example.com", status: "pending", tls_status: "pending" });
    expect(created.body.challenge).toEqual({
      type: "TXT",
      name: "_sanad-verification.shop.example.com",
      value: expect.stringContaining("sanad-verify="),
    });

    // The verification token is write-only for merchants.
    const merchantList = await first.agent.get(`${base}/domains`).expect(200);
    expect(JSON.stringify(merchantList.body)).not.toContain("sanad-verify=");

    // An unverified domain never resolves to a store.
    const pendingSite = await request(app)
      .get("/api/site")
      .set("Host", "shop.example.com")
      .expect(200);
    expect(pendingSite.body).toMatchObject({ host: "shop.example.com", mode: "custom_domain", store: null });

    const adminDomains = await admin.agent.get("/api/admin/domains").expect(200);
    const row = adminDomains.body.domains.find((entry: any) => entry.domain === "shop.example.com");
    expect(row.verificationToken).toContain("sanad-verify=");

    // Admin verification binds the exact domain to this store.
    await admin.agent
      .post(`/api/admin/domains/${row.id}/verify`)
      .send({ verified: true })
      .expect(200);
    const stored = await prisma.store.findUniqueOrThrow({ where: { id: first.store.id } });
    expect(stored.customDomain).toBe("shop.example.com");

    const resolved = await resolveCustomDomainHost("shop.example.com");
    expect(resolved).toMatchObject({ storeId: first.store.id, domain: "shop.example.com", tlsStatus: "pending" });

    const site = await request(app)
      .get("/api/site")
      .set("Host", "shop.example.com:443")
      .expect(200);
    expect(site.body.mode).toBe("custom_domain");
    expect(site.body.custom_domain).toBe(true);
    expect(site.body.store).toMatchObject({
      id: first.store.id,
      subdomain: first.subdomain,
      canonical_url: "https://shop.example.com",
      tls_status: "pending",
    });
    expect(site.body.canonical_url).toBe("https://shop.example.com");

    // The public payload uses the custom domain as canonical, not the subdomain.
    const storefront = await request(app).get(`/api/storefront/${first.subdomain}`).expect(200);
    expect(storefront.body.store.canonical_url).toBe("https://shop.example.com");
    expect(storefront.body.store.custom_domain).toBe("shop.example.com");

    // TLS is recorded by the platform, never fabricated by verification.
    await admin.agent
      .post(`/api/admin/domains/${row.id}/tls`)
      .send({ status: "active", error: "" })
      .expect(200);
    const secured = await request(app)
      .get("/api/site")
      .set("Host", "shop.example.com")
      .expect(200);
    expect(secured.body.store.tls_status).toBe("active");
    expect(secured.body.store.id).toBe(first.store.id);

    // X-Forwarded-Host is not trusted; only the raw Host header selects a store.
    const forwarded = await request(app)
      .get("/api/site")
      .set("Host", "localhost")
      .set("X-Forwarded-Host", "shop.example.com")
      .expect(200);
    expect(forwarded.body).toMatchObject({ mode: "platform", custom_domain: false, store: null });

    const unknown = await request(app)
      .get("/api/site")
      .set("Host", "other.example.com")
      .expect(200);
    expect(unknown.body.store).toBeNull();

    // Unpublishing closes the custom host even though DNS/TLS still exist.
    await first.agent
      .post(`${base}/publishing`)
      .send({ action: "unpublish", reason: "توقف مؤقت" })
      .expect(200);
    const closed = await request(app)
      .get("/api/site")
      .set("Host", "shop.example.com")
      .expect(200);
    expect(closed.body.store).toBeNull();

    // A second store cannot claim the same domain.
    await second.agent
      .post(`/api/stores/${second.subdomain}/domains`)
      .send({ domain: "shop.example.com" })
      .expect(409);
    expect(second.store.id).not.toBe(first.store.id);
  });

  it("hides unavailable custom domains and records TLS failures", async () => {
    const merchant = await registerMerchant("domain-tls");
    const admin = await registerAdmin("domain-tls-admin");
    const base = `/api/stores/${merchant.subdomain}`;

    const created = await merchant.agent
      .post(`${base}/domains`)
      .send({ domain: "broken.example.com" })
      .expect(201);
    await admin.agent
      .post(`/api/admin/domains/${created.body.domain.id}/verify`)
      .send({ verified: true })
      .expect(200);
    await admin.agent
      .post(`/api/admin/domains/${created.body.domain.id}/tls`)
      .send({ status: "failed", error: "certificate issuance failed" })
      .expect(200);

    const domains = await merchant.agent.get(`${base}/domains`).expect(200);
    expect(domains.body.domains[0]).toMatchObject({
      tls_status: "failed",
      tls_error: "certificate issuance failed",
    });
    expect(JSON.stringify(domains.body)).not.toContain("sanad-verify=");

    // Unverifying detaches the domain from the store.
    await admin.agent
      .post(`/api/admin/domains/${created.body.domain.id}/verify`)
      .send({ verified: false })
      .expect(200);
    const detached = await prisma.store.findUniqueOrThrow({ where: { id: merchant.store.id } });
    expect(detached.customDomain).toBeNull();
    expect(await resolveCustomDomainHost("broken.example.com")).toBeNull();
  });
});

describe("publishing lifecycle", () => {
  it("moves draft/ready/published through onboarding and approval without leaking a draft storefront", async () => {
    const pending = await registerMerchant("publish-pending", { approve: false });
    const base = `/api/stores/${pending.subdomain}`;
    const admin = await registerAdmin("publish-admin");

    const draft = await pending.agent.get(`${base}/settings`).expect(200);
    expect(draft.body.publishing).toMatchObject({
      publish_status: "draft",
      published: false,
      public_visible: false,
      can_publish: false,
    });

    const early = await pending.agent
      .post(`${base}/publishing`)
      .send({ action: "publish" })
      .expect(409);
    expect(early.body.error.code).toBe("ONBOARDING_INCOMPLETE");

    // Completing onboarding on a pending store only marks it ready for review.
    const readyStore = await publishStore(pending);
    expect(readyStore.status).toBe("pending");
    expect(readyStore.publishStatus).toBe("ready");

    const ready = await pending.agent.get(`${base}/settings`).expect(200);
    expect(ready.body.publishing).toMatchObject({
      publish_status: "ready",
      published: false,
      public_visible: false,
      can_publish: false,
    });
    expect(ready.body.publishing.publish_reason).toContain("موافقة");
    await request(app).get(`/api/storefront/${pending.subdomain}`).expect(404);

    // Approval publishes a store whose onboarding is already complete.
    const approved = await admin.agent
      .post(`/api/admin/stores/${pending.store.id}/approve`)
      .send({ note: "جاهز" })
      .expect(200);
    expect(approved.body.store.status).toBe("active");
    expect(approved.body.publishing.publish_status).toBe("published");
    expect(approved.body.publishing.public_visible).toBe(true);
    const open = await request(app).get(`/api/storefront/${pending.subdomain}`).expect(200);
    expect(open.body.published).toBe(true);
  });

  it("unpublishes and republishes a store with a visible reason and audit trail", async () => {
    const merchant = await registerMerchant("publish-owner");
    await publishStore(merchant);
    const base = `/api/stores/${merchant.subdomain}`;

    const unpublished = await merchant.agent
      .post(`${base}/publishing`)
      .send({ action: "unpublish", reason: "تحديث الأسعار قبل إعادة النشر" })
      .expect(200);
    expect(unpublished.body.publishing).toMatchObject({
      publish_status: "draft",
      published: false,
      public_visible: false,
      publish_reason: "تحديث الأسعار قبل إعادة النشر",
    });

    const comingSoon = await request(app).get(`/api/storefront/${merchant.subdomain}`).expect(200);
    expect(comingSoon.body.published).toBe(false);
    expect(comingSoon.body.publish_status).toBe("draft");
    expect(comingSoon.body.publish_reason).toBe("تحديث الأسعار قبل إعادة النشر");
    await request(app).get(`/api/storefront/${merchant.subdomain}/products`).expect(404);

    const republished = await merchant.agent
      .post(`${base}/publishing`)
      .send({ action: "publish" })
      .expect(200);
    expect(republished.body.publishing.publish_status).toBe("published");
    expect(republished.body.publishing.published).toBe(true);
    const open = await request(app).get(`/api/storefront/${merchant.subdomain}`).expect(200);
    expect(open.body.published).toBe(true);

    const logs = await merchant.agent.get(`${base}/audit-logs?limit=20`).expect(200);
    expect(logs.body.logs.some((log: any) => log.action === "store.unpublished")).toBe(true);
    expect(logs.body.logs.some((log: any) => log.action === "store.published")).toBe(true);
  });

  it("blocks publishing a rejected or suspended store", async () => {
    const merchant = await registerMerchant("publish-blocked", { approve: false });
    await publishStore(merchant);
    const admin = await registerAdmin("publish-blocked-admin");
    const base = `/api/stores/${merchant.subdomain}`;

    await admin.agent
      .post(`/api/admin/stores/${merchant.store.id}/reject`)
      .send({ note: "بيانات ناقصة" })
      .expect(200);
    const rejected = await merchant.agent
      .post(`${base}/publishing`)
      .send({ action: "publish" })
      .expect(409);
    expect(rejected.body.error.code).toBe("STORE_NOT_PUBLISHABLE");

    await admin.agent
      .post(`/api/admin/stores/${merchant.store.id}/approve`)
      .send({ note: "تم التعديل" })
      .expect(200);
    await admin.agent
      .post(`/api/admin/stores/${merchant.store.id}/suspend`)
      .send({ note: "مخالفة" })
      .expect(200);
    const suspended = await merchant.agent
      .post(`${base}/publishing`)
      .send({ action: "publish" })
      .expect(409);
    expect(suspended.body.error.code).toBe("STORE_NOT_PUBLISHABLE");
    await request(app).get(`/api/storefront/${merchant.subdomain}`).expect(404);
  });
});
