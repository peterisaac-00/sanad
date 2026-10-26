import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import {
  app,
  prisma,
  registerAdmin,
  registerMerchant,
  publishStore,
  truncateAll,
  closeDb,
} from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("platform admin access control", () => {
  it("separates the admin session from merchant sessions", async () => {
    const merchant = await registerMerchant("adm-rbac");

    const anonymous = await request(app).get("/api/admin/overview").expect(401);
    expect(anonymous.body.error.code).toBe("ADMIN_UNAUTHENTICATED");

    const merchantAttempt = await merchant.agent.get("/api/admin/overview").expect(403);
    expect(merchantAttempt.body.error.code).toBe("ADMIN_ACCESS_DENIED");
    await merchant.agent.get("/api/admin/subscription-payments").expect(403);
    await merchant.agent.get("/api/admin/leads").expect(403);

    const admin = await registerAdmin("adm-ok");
    await admin.agent.get("/api/auth/me").expect(401);

    const overview = await admin.agent.get("/api/admin/overview").expect(200);
    expect(overview.body.summary.totalStores).toBe(1);
    expect(overview.body.stores).toHaveLength(1);
    expect(overview.body.stores[0].id).toBe(merchant.store.id);
    expect(overview.body.monthlyVisits).toHaveLength(6);
    expect(overview.body.subscriptionPrices).toEqual({ monthly: 100, annual: 1000 });

    const payments = await admin.agent.get("/api/admin/subscription-payments").expect(200);
    expect(payments.body.payments).toEqual([]);
    expect(payments.body.summary.prices).toEqual({ monthly: 100, annual: 1000 });
  });

  it("enforces administrator roles in the API, not the UI", async () => {
    const merchant = await registerMerchant("admin-role");
    const readonly = await registerAdmin("readonly", "readonly");

    await readonly.agent.get("/api/admin/overview").expect(200);
    await readonly.agent.get("/api/admin/merchants").expect(200);
    const denied = await readonly.agent
      .post(`/api/admin/stores/${merchant.store.id}/approve`)
      .send({ note: "should fail" })
      .expect(403);
    expect(denied.body.error.code).toBe("ADMIN_FORBIDDEN");
    await readonly.agent.patch("/api/admin/feature-flags/wallet_deposits").send({ enabled: false }).expect(403);

    const operations = await registerAdmin("ops", "operations");
    await operations.agent
      .patch("/api/admin/feature-flags/wallet_deposits")
      .send({ enabled: false })
      .expect(200);
    await operations.agent.get("/api/admin/admins").expect(403);
  });
});

describe("store approval lifecycle", () => {
  it("gates a pending store, records the activation date on approval, and opens it after publishing", async () => {
    const merchant = await registerMerchant("pending", { approve: false });
    const admin = await registerAdmin("approver");
    const publicBase = `/api/storefront/${merchant.subdomain}`;

    expect(merchant.store.status).toBe("pending");
    expect(merchant.store.activatedAt).toBeNull();
    await request(app).get(publicBase).expect(404);

    const before = await admin.agent.get("/api/admin/overview").expect(200);
    expect(before.body.summary.pendingStores).toBe(1);
    const pendingRow = before.body.stores.find((row: any) => row.id === merchant.store.id);
    expect(pendingRow.status).toBe("pending");
    expect(pendingRow.publishStatus).toBe("draft");
    expect(pendingRow.activatedAt).toBeNull();

    const approval = await admin.agent
      .post(`/api/admin/stores/${merchant.store.id}/approve`)
      .send({ note: "بيانات المتجر مكتملة" })
      .expect(200);
    expect(approval.body.store.status).toBe("active");
    expect(approval.body.store.activatedAt).toBeTruthy();
    // Approval does not skip onboarding: the store is active but still draft.
    expect(approval.body.publishing.published).toBe(false);

    const firstActivation = new Date(approval.body.store.activatedAt).getTime();
    const repeat = await admin.agent
      .post(`/api/admin/stores/${merchant.store.id}/approve`)
      .send({ note: "" })
      .expect(200);
    expect(new Date(repeat.body.store.activatedAt).getTime()).toBe(firstActivation);

    const comingSoon = await request(app).get(publicBase).expect(200);
    expect(comingSoon.body.published).toBe(false);
    expect(comingSoon.body.publish_status).toBe("draft");

    const published = await publishStore(merchant, { storeName: "متجر معتمد" });
    expect(published.status).toBe("active");
    expect(published.publishStatus).toBe("published");
    const storefront = await request(app).get(publicBase).expect(200);
    expect(storefront.body.published).toBe(true);
    expect(storefront.body.store.store_name).toBe("متجر معتمد");

    const after = await admin.agent.get("/api/admin/overview").expect(200);
    expect(after.body.summary.activeStores).toBe(1);
    expect(after.body.summary.publishedStores).toBe(1);
    const activeRow = after.body.stores.find((row: any) => row.id === merchant.store.id);
    expect(activeRow.activatedAt).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { storeId: merchant.store.id, action: "store.approved" },
    });
    expect(audit?.actorType).toBe("platform_admin");
    expect(audit?.platformAdminId).toBe(admin.admin.id);
  });

  it("rejects or suspends a store and closes its public gateway", async () => {
    const merchant = await registerMerchant("lifecycle", { approve: false });
    await publishStore(merchant);
    const admin = await registerAdmin("lifecycle-admin");
    const publicBase = `/api/storefront/${merchant.subdomain}`;

    await request(app).get(publicBase).expect(404);

    await admin.agent
      .post(`/api/admin/stores/${merchant.store.id}/reject`)
      .send({ note: "الهوية غير مكتملة" })
      .expect(200);
    let row = await prisma.store.findUniqueOrThrow({ where: { id: merchant.store.id } });
    expect(row.status).toBe("rejected");
    expect(row.publishStatus).toBe("draft");
    expect(row.publishReason).toContain("رفض");
    expect(row.statusReason).toBe("الهوية غير مكتملة");
    await request(app).get(publicBase).expect(404);

    // The rejection must reach the merchant dashboard as an unread bell
    // notification, with the admin note preserved in the body.
    const inbox = await merchant.agent.get(`/api/stores/${merchant.subdomain}/notifications`).expect(200);
    expect(inbox.body.unread).toBeGreaterThan(0);
    const rejection = inbox.body.notifications.find((item: any) => item.type === "approval");
    expect(rejection?.title).toBe("طلب فتح المتجر يحتاج تعديلاً");
    expect(rejection?.body).toBe("الهوية غير مكتملة");

    await admin.agent
      .post(`/api/admin/stores/${merchant.store.id}/approve`)
      .send({ note: "تم التعديل" })
      .expect(200);
    await request(app).get(publicBase).expect(200);

    await admin.agent
      .post(`/api/admin/stores/${merchant.store.id}/suspend`)
      .send({ note: "مخالفة شروط الاستخدام" })
      .expect(200);
    row = await prisma.store.findUniqueOrThrow({ where: { id: merchant.store.id } });
    expect(row.status).toBe("suspended");
    expect(row.publishStatus).toBe("suspended");
    expect(row.publishReason).toContain("تعليق");
    await request(app).get(publicBase).expect(404);
  });
});

describe("admin-managed store identity", () => {
  it("lets the admin edit identity and branding while rejecting owner edits", async () => {
    const merchant = await registerMerchant("identity");
    await publishStore(merchant, { storeName: "الاسم القديم" });
    const admin = await registerAdmin("identity-admin");

    const updated = await admin.agent
      .patch(`/api/admin/stores/${merchant.store.id}/settings`)
      .send({
        storeName: "الاسم الإداري",
        description: "وصف من إدارة المنصة",
        logoUrl: "/uploads/admin-logo.png",
        coverUrl: "/uploads/admin-cover.png",
        primaryColor: "#123ABC",
        secondaryColor: "#0F2A24",
        textColor: "#111827",
        themeMode: "dark",
        arabicFont: "Cairo",
        templateKey: "fashion",
        seoTitle: "عنوان SEO إداري",
        seoDescription: "وصف SEO إداري",
        whatsapp: "201222222222",
        supportEmail: "admin-support@example.com",
      })
      .expect(200);

    expect(updated.body.store.storeName).toBe("الاسم الإداري");
    expect(updated.body.store.description).toBe("وصف من إدارة المنصة");
    expect(updated.body.store.logoUrl).toBe("/uploads/admin-logo.png");
    expect(updated.body.store.coverUrl).toBe("/uploads/admin-cover.png");
    expect(updated.body.store.templateKey).toBe("fashion");
    expect(updated.body.branding.primaryColor).toBe("#123ABC");
    expect(updated.body.branding.themeMode).toBe("dark");
    expect(updated.body.branding.arabicFont).toBe("Cairo");
    expect(updated.body.branding.templateKey).toBe("fashion");

    const detail = await admin.agent.get(`/api/admin/stores/${merchant.store.id}/settings`).expect(200);
    expect(detail.body.store.storeName).toBe("الاسم الإداري");
    expect(detail.body.store.seoTitle).toBe("عنوان SEO إداري");
    expect(detail.body.branding.primaryColor).toBe("#123ABC");
    expect(detail.body.owner.email).toBe(merchant.email);

    const ownerAttempt = await merchant.agent
      .patch(`/api/stores/${merchant.subdomain}/settings`)
      .send({ storeName: "اسم من التاجر" });
    expect(ownerAttempt.status).toBe(409);
    expect(ownerAttempt.body.error.code).toBe("STORE_IDENTITY_ADMIN_ONLY");

    const storefront = await request(app).get(`/api/storefront/${merchant.subdomain}`).expect(200);
    expect(storefront.body.store.store_name).toBe("الاسم الإداري");
    expect(storefront.body.store.logo_url).toBe("/uploads/admin-logo.png");
    expect(storefront.body.branding.primaryColor).toBe("#123ABC");
    expect(storefront.body.store.whatsapp_url).toContain("201222222222");

    await merchant.agent.patch(`/api/admin/stores/${merchant.store.id}/settings`).send({ storeName: "x" }).expect(403);
  });
});

describe("subscription payments", () => {
  it("computes the price, prevents duplicates, and extends the plan only after admin approval", async () => {
    const merchant = await registerMerchant("subpay");
    const admin = await registerAdmin("subpay-admin");

    const initialWallet = await merchant.agent.get(`/api/stores/${merchant.subdomain}/wallet`).expect(200);
    expect(Number(initialWallet.body.account.balance)).toBe(0);

    const submitted = await merchant.agent
      .post(`/api/stores/${merchant.subdomain}/subscription-payments`)
      .send({
        plan: "monthly",
        method: "bank_transfer",
        reference: "BANK-REF-001",
        payerName: "صاحب المتجر",
        note: "تحويل من بنك مصر",
      })
      .expect(201);
    expect(submitted.body.amount).toBe(100);
    expect(submitted.body.payment.status).toBe("pending");
    expect(submitted.body.payment.currency).toBe("EGP");
    expect(submitted.body.payment.amount).toBe(100);

    const duplicate = await merchant.agent
      .post(`/api/stores/${merchant.subdomain}/subscription-payments`)
      .send({ plan: "annual", method: "instapay", reference: "DUP-001" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("SUBSCRIPTION_PAYMENT_PENDING");

    const payments = await admin.agent.get("/api/admin/subscription-payments").expect(200);
    expect(payments.body.summary.pending).toBe(1);
    const payment = payments.body.payments[0];
    expect(payment.store.id).toBe(merchant.store.id);
    expect(payment.amount).toBe(100);

    await merchant.agent
      .post(`/api/admin/subscription-payments/${payment.id}/review`)
      .send({ decision: "approve" })
      .expect(403);

    const approved = await admin.agent
      .post(`/api/admin/subscription-payments/${payment.id}/review`)
      .send({ decision: "approve", note: "تم التحقق من التحويل" })
      .expect(200);
    expect(approved.body.payment.status).toBe("approved");
    expect(approved.body.payment.reviewNote).toBe("تم التحقق من التحويل");
    expect(approved.body.store.plan).toBe("monthly");
    expect(approved.body.store.subscriptionPaidUntil).toBeTruthy();

    const paidUntil = new Date(approved.body.store.subscriptionPaidUntil).getTime();
    expect(paidUntil).toBeGreaterThan(Date.now() + 27 * 24 * 60 * 60 * 1000);
    expect(paidUntil).toBeLessThan(Date.now() + 32 * 24 * 60 * 60 * 1000);

    const reviewAgain = await admin.agent
      .post(`/api/admin/subscription-payments/${payment.id}/review`)
      .send({ decision: "reject" });
    expect(reviewAgain.status).toBe(409);
    expect(reviewAgain.body.error.code).toBe("SUBSCRIPTION_PAYMENT_ALREADY_REVIEWED");

    const wallet = await merchant.agent.get(`/api/stores/${merchant.subdomain}/wallet`).expect(200);
    expect(Number(wallet.body.account.balance)).toBe(0);
    expect(wallet.body.subscription.plan).toBe("monthly");
    expect(wallet.body.subscription.paid_until).toBeTruthy();
    expect(wallet.body.subscription_payments[0].status).toBe("approved");

    const second = await merchant.agent
      .post(`/api/stores/${merchant.subdomain}/subscription-payments`)
      .send({ plan: "annual", method: "instapay", reference: "INSTA-002" })
      .expect(201);
    expect(second.body.amount).toBe(1000);

    const rejected = await admin.agent
      .post(`/api/admin/subscription-payments/${second.body.payment.id}/review`)
      .send({ decision: "reject", note: "المرجع غير صحيح" })
      .expect(200);
    expect(rejected.body.payment.status).toBe("rejected");
    expect(rejected.body.store.plan).toBe("monthly");

    const afterReject = await prisma.store.findUniqueOrThrow({ where: { id: merchant.store.id } });
    expect(afterReject.plan).toBe("monthly");
    expect(new Date(afterReject.subscriptionPaidUntil!).getTime()).toBe(paidUntil);
  });
});

describe("wallet deposit approvals", () => {
  it("credits the balance only after an admin approves and rejects duplicate reviews", async () => {
    const merchant = await registerMerchant("wallet-admin");
    const admin = await registerAdmin("wallet-reviewer", "finance");
    const base = `/api/stores/${merchant.subdomain}`;

    const submitted = await merchant.agent
      .post(`${base}/wallet/deposits`)
      .send({ amount: 500, reference: "DEP-1", note: "تحويل بنكي" })
      .expect(201);
    expect(submitted.body.transaction.status).toBe("pending");

    const pending = await admin.agent.get("/api/admin/wallet/transactions").expect(200);
    expect(pending.body.summary.pending).toBe(1);
    expect(pending.body.transactions[0].id).toBe(submitted.body.transaction.id);

    await merchant.agent
      .post(`/api/admin/wallet/transactions/${submitted.body.transaction.id}/review`)
      .send({ decision: "approve" })
      .expect(403);

    const approved = await admin.agent
      .post(`/api/admin/wallet/transactions/${submitted.body.transaction.id}/review`)
      .send({ decision: "approve", note: "تم التحقق" })
      .expect(200);
    expect(approved.body.transaction.status).toBe("completed");
    expect(Number(approved.body.transaction.balanceAfter)).toBe(500);

    const wallet = await merchant.agent.get(`${base}/wallet`).expect(200);
    expect(Number(wallet.body.account.balance)).toBe(500);

    await admin.agent
      .post(`/api/admin/wallet/transactions/${submitted.body.transaction.id}/review`)
      .send({ decision: "approve" })
      .expect(409);

    const second = await merchant.agent
      .post(`${base}/wallet/deposits`)
      .send({ amount: 200, reference: "DEP-2" })
      .expect(201);
    await admin.agent
      .post(`/api/admin/wallet/transactions/${second.body.transaction.id}/review`)
      .send({ decision: "reject", note: "مرجع غير صحيح" })
      .expect(200);
    const afterReject = await merchant.agent.get(`${base}/wallet`).expect(200);
    expect(Number(afterReject.body.account.balance)).toBe(500);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "wallet.deposit_approved", entityId: submitted.body.transaction.id },
    });
    expect(audit?.actorType).toBe("platform_admin");
    expect(audit?.platformAdminId).toBe(admin.admin.id);
  });
});

describe("monthly platform visits", () => {
  it("records one row per beacon for published active stores, strips query strings, and reports the month", async () => {
    const merchant = await registerMerchant("visits");
    await publishStore(merchant);
    const admin = await registerAdmin("visits-admin");
    const base = `/api/storefront/${merchant.subdomain}/visit`;

    await request(app).post(base).send({ path: "/products/tee?utm_source=test" }).expect(204);
    await request(app).post(base).send({ path: "/cart" }).expect(204);

    const rows = await prisma.storeVisit.findMany({ where: { storeId: merchant.store.id }, orderBy: { createdAt: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.path)).toEqual(["/products/tee", "/cart"]);
    expect(rows[0]).not.toHaveProperty("ip");
    expect(rows[0]).not.toHaveProperty("userAgent");

    const overview = await admin.agent.get("/api/admin/overview").expect(200);
    expect(overview.body.summary.visitsThisMonth).toBe(2);
    const row = overview.body.stores.find((store: any) => store.id === merchant.store.id);
    expect(row.visitsThisMonth).toBe(2);
    expect(row.visitsTotal).toBe(2);
    expect(overview.body.visitsByStore[0].visits).toBe(2);
    expect(overview.body.monthlyVisits.at(-1).visits).toBe(2);

    const pending = await registerMerchant("visits-pending", { approve: false });
    await request(app).post(`/api/storefront/${pending.subdomain}/visit`).send({ path: "/" }).expect(404);
    expect(await prisma.storeVisit.count({ where: { storeId: pending.store.id } })).toBe(0);

    const draft = await registerMerchant("visits-draft");
    await prisma.store.update({ where: { id: draft.store.id }, data: { publishStatus: "draft" } });
    await request(app).post(`/api/storefront/${draft.subdomain}/visit`).send({ path: "/" }).expect(204);
    expect(await prisma.storeVisit.count({ where: { storeId: draft.store.id } })).toBe(0);
  });
});
