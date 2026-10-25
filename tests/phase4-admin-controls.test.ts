import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { totpCode } from "../server/totp.js";
import {
  app,
  closeDb,
  prisma,
  registerAdmin,
  registerMerchant,
  registerTeamMember,
  truncateAll,
} from "./helpers.js";

beforeEach(truncateAll);
afterAll(closeDb);

describe("platform administrator authentication", () => {
  it("is a separate identity with its own session cookie and MFA challenge", async () => {
    const merchant = await registerMerchant("admin-sep");
    const team = await registerTeamMember(merchant, "admin", "sep");
    // The legacy merchant role must never grant platform administration.
    await prisma.merchant.update({ where: { id: merchant.merchant.id }, data: { role: "admin" } });

    const anonymous = await request(app).get("/api/admin/overview").expect(401);
    expect(anonymous.body.error.code).toBe("ADMIN_UNAUTHENTICATED");

    const merchantAttempt = await merchant.agent.get("/api/admin/overview").expect(403);
    expect(merchantAttempt.body.error.code).toBe("ADMIN_ACCESS_DENIED");
    await merchant.agent.get("/api/admin/auth/me").expect(403);
    await team.agent.get("/api/admin/overview").expect(403);

    const admin = await registerAdmin("mfa");
    // An admin cookie can never open the merchant console.
    await admin.agent.get("/api/auth/me").expect(401);
    const me = await admin.agent.get("/api/admin/auth/me").expect(200);
    expect(me.body.scope).toBe("platform");
    expect(me.body.admin.permissions).toContain("admins.manage");

    await admin.agent
      .post("/api/admin/auth/2fa/setup")
      .send({ password: "wrong-password" })
      .expect(401);
    const setup = await admin.agent
      .post("/api/admin/auth/2fa/setup")
      .send({ password: "AdminPassword123" })
      .expect(200);
    expect(setup.body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.body.otpauth_url).toContain("otpauth://totp/");

    await admin.agent.post("/api/admin/auth/2fa/enable").send({ code: "000000" }).expect(400);
    const enabled = await admin.agent
      .post("/api/admin/auth/2fa/enable")
      .send({ code: totpCode(setup.body.secret) })
      .expect(200);
    expect(enabled.body.recovery_codes).toHaveLength(10);

    await admin.agent.post("/api/admin/auth/logout").expect(200);
    await admin.agent.get("/api/admin/overview").expect(401);

    const missingCode = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: admin.email, password: "AdminPassword123" })
      .expect(401);
    expect(missingCode.body.error.code).toBe("ADMIN_TWO_FACTOR_REQUIRED");

    const badCode = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: admin.email, password: "AdminPassword123", totp: "000000" })
      .expect(401);
    expect(badCode.body.error.code).toBe("ADMIN_INVALID_TWO_FACTOR");

    const signedIn = request.agent(app);
    const login = await signedIn
      .post("/api/admin/auth/login")
      .send({ email: admin.email, password: "AdminPassword123", totp: totpCode(setup.body.secret) })
      .expect(200);
    expect(login.body.admin.two_factor_enabled).toBe(true);
    const cookie = String(login.headers["set-cookie"] ?? "");
    expect(cookie).toContain("sanad_admin_session=");
    expect(cookie).not.toContain("sanad_session=");

    await signedIn.get("/api/admin/overview").expect(200);
    await signedIn.get("/api/auth/me").expect(401);

    // Recovery codes are one-time credentials, also isolated from merchant 2FA.
    const recovered = request.agent(app);
    await recovered
      .post("/api/admin/auth/login")
      .send({
        email: admin.email,
        password: "AdminPassword123",
        recovery_code: enabled.body.recovery_codes[0],
      })
      .expect(200);
    const reused = request.agent(app);
    const reusedAttempt = await reused
      .post("/api/admin/auth/login")
      .send({
        email: admin.email,
        password: "AdminPassword123",
        recovery_code: enabled.body.recovery_codes[0],
      })
      .expect(401);
    expect(reusedAttempt.body.error.code).toBe("ADMIN_INVALID_TWO_FACTOR");

    const audit = await recovered.get("/api/admin/audit?actorType=platform_admin").expect(200);
    const actions = audit.body.logs.map((log: any) => log.action);
    expect(actions).toEqual(
      expect.arrayContaining(["admin.signed_in", "admin.login_failed", "admin.two_factor_enabled"])
    );
    const failed = audit.body.logs.find((log: any) => log.action === "admin.login_failed");
    expect(failed.platformAdminId).toBe(admin.admin.id);
    expect(failed.metadata.reason).toBe("bad_second_factor");
  });
});

describe("administrator role boundaries", () => {
  it("scopes every write permission by role and attributes the real admin in the audit trail", async () => {
    const merchant = await registerMerchant("admin-scope");
    const pending = await registerMerchant("admin-scope-pending", { approve: false });
    const merchantBase = `/api/stores/${merchant.subdomain}`;

    const deposit = await merchant.agent
      .post(`${merchantBase}/wallet/deposits`)
      .send({ amount: 100, reference: "SCOPE-DEP-1" })
      .expect(201);
    const subscription = await merchant.agent
      .post(`${merchantBase}/subscription-payments`)
      .send({ plan: "monthly", method: "bank_transfer", reference: "SCOPE-SUB-1" })
      .expect(201);
    const ticket = await merchant.agent
      .post(`${merchantBase}/support-tickets`)
      .send({ subject: "مشكلة في المتجر", message: "لا يظهر المنتج في الصفحة الرئيسية", category: "technical" })
      .expect(201);

    const readonly = await registerAdmin("scope-readonly", "readonly");
    const operations = await registerAdmin("scope-ops", "operations");
    const finance = await registerAdmin("scope-finance", "finance");
    const support = await registerAdmin("scope-support", "support");
    const superAdmin = await registerAdmin("scope-root", "super_admin");

    // Read-only admins can see every operational surface but no identities.
    for (const path of [
      "/api/admin/overview",
      "/api/admin/stores",
      "/api/admin/merchants",
      "/api/admin/subscription-payments",
      "/api/admin/wallet/transactions",
      "/api/admin/support-tickets",
      "/api/admin/reports",
      "/api/admin/domains",
      "/api/admin/audit",
      "/api/admin/feature-flags",
      "/api/admin/leads",
    ]) {
      await readonly.agent.get(path).expect(200);
    }
    await readonly.agent.get("/api/admin/admins").expect(403);

    const readonlyAttempts: Array<{ label: string; send: () => request.Test }> = [
      {
        label: "approve store",
        send: () => readonly.agent.post(`/api/admin/stores/${pending.store.id}/approve`).send({ note: "" }),
      },
      {
        label: "update flag",
        send: () => readonly.agent.patch("/api/admin/feature-flags/wallet_deposits").send({ enabled: false }),
      },
      {
        label: "review deposit",
        send: () =>
          readonly.agent
            .post(`/api/admin/wallet/transactions/${deposit.body.transaction.id}/review`)
            .send({ decision: "approve" }),
      },
      {
        label: "review subscription",
        send: () =>
          readonly.agent
            .post(`/api/admin/subscription-payments/${subscription.body.payment.id}/review`)
            .send({ decision: "approve" }),
      },
      {
        label: "update ticket",
        send: () =>
          readonly.agent.patch(`/api/admin/support-tickets/${ticket.body.ticket.id}`).send({ status: "resolved" }),
      },
      {
        label: "create admin",
        send: () =>
          readonly.agent.post("/api/admin/admins").send({
            email: "readonly-created@admin.test",
            password: "AdminPassword123",
            role: "readonly",
          }),
      },
    ];
    for (const attempt of readonlyAttempts) {
      const res = await attempt.send().expect(403);
      expect(res.body.error.code, attempt.label).toBe("ADMIN_FORBIDDEN");
    }

    // Operations: stores, domains and flags. Not money, support identities or admins.
    const approvedStore = await operations.agent
      .post(`/api/admin/stores/${pending.store.id}/approve`)
      .send({ note: "بيانات مكتملة" })
      .expect(200);
    expect(approvedStore.body.store.status).toBe("active");
    await operations.agent.get("/api/admin/domains").expect(200);
    await operations.agent.patch("/api/admin/feature-flags/wallet_deposits").send({ enabled: true }).expect(200);
    await operations.agent
      .post(`/api/admin/wallet/transactions/${deposit.body.transaction.id}/review`)
      .send({ decision: "approve" })
      .expect(403);
    await operations.agent
      .post(`/api/admin/subscription-payments/${subscription.body.payment.id}/review`)
      .send({ decision: "approve" })
      .expect(403);
    await operations.agent
      .patch(`/api/admin/support-tickets/${ticket.body.ticket.id}`)
      .send({ status: "resolved" })
      .expect(403);
    await operations.agent.get("/api/admin/admins").expect(403);

    // Finance: money only. Neither support nor catalog operations.
    await finance.agent.get("/api/admin/wallet/transactions").expect(200);
    const reviewedDeposit = await finance.agent
      .post(`/api/admin/wallet/transactions/${deposit.body.transaction.id}/review`)
      .send({ decision: "approve", note: "تحويل مؤكد" })
      .expect(200);
    expect(reviewedDeposit.body.transaction.reviewedByAdminId).toBe(finance.admin.id);
    const reviewedSubscription = await finance.agent
      .post(`/api/admin/subscription-payments/${subscription.body.payment.id}/review`)
      .send({ decision: "approve", note: "تم التحقق" })
      .expect(200);
    expect(reviewedSubscription.body.payment.reviewedById).toBe(finance.admin.id);
    await finance.agent.patch("/api/admin/feature-flags/wallet_deposits").send({ enabled: false }).expect(403);
    await finance.agent.post(`/api/admin/stores/${pending.store.id}/approve`).send({ note: "" }).expect(403);
    await finance.agent
      .patch(`/api/admin/support-tickets/${ticket.body.ticket.id}`)
      .send({ status: "resolved" })
      .expect(403);
    await finance.agent.get("/api/admin/admins").expect(403);

    // Support: ticket triage only.
    const secondDeposit = await merchant.agent
      .post(`${merchantBase}/wallet/deposits`)
      .send({ amount: 50, reference: "SCOPE-DEP-2" })
      .expect(201);
    const updatedTicket = await support.agent
      .patch(`/api/admin/support-tickets/${ticket.body.ticket.id}`)
      .send({ status: "in_progress", priority: "high", resolution: "قيد الفحص", assignToMe: true })
      .expect(200);
    expect(updatedTicket.body.ticket).toMatchObject({
      status: "in_progress",
      priority: "high",
      assignedAdminId: support.admin.id,
    });
    await support.agent
      .post(`/api/admin/wallet/transactions/${secondDeposit.body.transaction.id}/review`)
      .send({ decision: "approve" })
      .expect(403);
    await support.agent
      .post(`/api/admin/subscription-payments/${subscription.body.payment.id}/review`)
      .send({ decision: "approve" })
      .expect(403);
    await support.agent.patch("/api/admin/feature-flags/wallet_deposits").send({ enabled: false }).expect(403);
    await support.agent.post(`/api/admin/stores/${pending.store.id}/approve`).send({ note: "" }).expect(403);
    await support.agent.get("/api/admin/admins").expect(403);

    // Only a super admin manages administrators.
    const admins = await superAdmin.agent.get("/api/admin/admins").expect(200);
    expect(admins.body.admins).toHaveLength(5);
    expect(admins.body.admins.every((row: any) => !("passwordHash" in row))).toBe(true);

    // Every completed admin action is attributed to the admin who performed it.
    const audit = await superAdmin.agent.get("/api/admin/audit?actorType=platform_admin").expect(200);
    const findAction = (action: string) => audit.body.logs.find((log: any) => log.action === action);
    expect(findAction("store.approved")).toMatchObject({
      actorType: "platform_admin",
      platformAdminId: operations.admin.id,
    });
    expect(findAction("admin.feature_flag_updated")).toMatchObject({
      actorType: "platform_admin",
      platformAdminId: operations.admin.id,
    });
    expect(findAction("wallet.deposit_approved")).toMatchObject({
      actorType: "platform_admin",
      platformAdminId: finance.admin.id,
    });
    expect(findAction("subscription_payment.approved")).toMatchObject({
      actorType: "platform_admin",
      platformAdminId: finance.admin.id,
    });
    expect(findAction("support.ticket_updated")).toMatchObject({
      actorType: "platform_admin",
      platformAdminId: support.admin.id,
    });
  });
});

describe("feature flags and support desk", () => {
  it("pauses wallet deposits and support intake without losing the review trail", async () => {
    const merchant = await registerMerchant("admin-flags");
    const base = `/api/stores/${merchant.subdomain}`;
    const admin = await registerAdmin("flags-root", "super_admin");

    const initialWallet = await merchant.agent.get(`${base}/wallet`).expect(200);
    expect(initialWallet.body.deposits_enabled).toBe(true);

    await admin.agent.patch("/api/admin/feature-flags/wallet_deposits").send({ enabled: false }).expect(200);
    const pausedWallet = await merchant.agent.get(`${base}/wallet`).expect(200);
    expect(pausedWallet.body.deposits_enabled).toBe(false);
    expect(pausedWallet.body.note).toContain("متوقف");
    const pausedDeposit = await merchant.agent
      .post(`${base}/wallet/deposits`)
      .send({ amount: 100, reference: "FLAG-DEP-1" })
      .expect(503);
    expect(pausedDeposit.body.error.code).toBe("WALLET_DEPOSITS_DISABLED");

    // A ticket opened while support is enabled remains visible to the desk after
    // intake is paused, so operators can still resolve the backlog.
    const ticket = await merchant.agent
      .post(`${base}/support-tickets`)
      .send({ subject: "طلب دعم", message: "أحتاج مساعدة في إعداد النطاق", category: "domains" })
      .expect(201);
    const openTickets = await admin.agent.get("/api/admin/support-tickets").expect(200);
    expect(openTickets.body.tickets.some((row: any) => row.id === ticket.body.ticket.id)).toBe(true);

    await admin.agent.patch("/api/admin/feature-flags/support_center").send({ enabled: false }).expect(200);
    const hidden = await merchant.agent.get(`${base}/support-tickets`).expect(200);
    expect(hidden.body.enabled).toBe(false);
    expect(hidden.body.tickets).toEqual([]);
    const closedIntake = await merchant.agent
      .post(`${base}/support-tickets`)
      .send({ subject: "طلب آخر", message: "لن يتم قبوله الآن", category: "other" })
      .expect(503);
    expect(closedIntake.body.error.code).toBe("SUPPORT_CENTER_DISABLED");
    const resolved = await admin.agent
      .patch(`/api/admin/support-tickets/${ticket.body.ticket.id}`)
      .send({ status: "resolved", resolution: "تم التحقق من إعدادات النطاق" })
      .expect(200);
    expect(resolved.body.ticket.status).toBe("resolved");

    const flags = await admin.agent.get("/api/admin/feature-flags").expect(200);
    expect(flags.body.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "wallet_deposits", enabled: false }),
        expect.objectContaining({ key: "support_center", enabled: false }),
      ])
    );

    // Re-enabling deposits returns to the pending-approval workflow: no balance
    // changes until an administrator explicitly approves the request.
    await admin.agent.patch("/api/admin/feature-flags/wallet_deposits").send({ enabled: true }).expect(200);
    const deposit = await merchant.agent
      .post(`${base}/wallet/deposits`)
      .send({ amount: 250, reference: "FLAG-DEP-2" })
      .expect(201);
    expect(deposit.body.transaction.status).toBe("pending");
    const before = await merchant.agent.get(`${base}/wallet`).expect(200);
    expect(Number(before.body.account.balance)).toBe(0);
    const approved = await admin.agent
      .post(`/api/admin/wallet/transactions/${deposit.body.transaction.id}/review`)
      .send({ decision: "approve", note: "تم التحقق" })
      .expect(200);
    expect(Number(approved.body.transaction.balanceAfter)).toBe(250);
    const after = await merchant.agent.get(`${base}/wallet`).expect(200);
    expect(Number(after.body.account.balance)).toBe(250);

    await admin.agent.patch("/api/admin/feature-flags/support_center").send({ enabled: true }).expect(200);
    const reopened = await merchant.agent.get(`${base}/support-tickets`).expect(200);
    expect(reopened.body.enabled).toBe(true);

    const audit = await admin.agent.get("/api/admin/audit?actorType=platform_admin").expect(200);
    const flagLog = audit.body.logs.find((log: any) => log.action === "admin.feature_flag_updated");
    expect(flagLog.platformAdminId).toBe(admin.admin.id);
    expect(audit.body.logs.some((log: any) => log.action === "support.ticket_updated")).toBe(true);
    expect(audit.body.logs.some((log: any) => log.action === "wallet.deposit_approved")).toBe(true);
  });
});

describe("super admin management", () => {
  it("creates admins, applies role changes immediately, and revokes disabled sessions", async () => {
    const admin = await registerAdmin("manage-root", "super_admin");
    const merchant = await registerMerchant("manage");
    const base = `/api/stores/${merchant.subdomain}`;
    const deposit = await merchant.agent
      .post(`${base}/wallet/deposits`)
      .send({ amount: 75, reference: "MANAGE-DEP-1" })
      .expect(201);
    const ticket = await merchant.agent
      .post(`${base}/support-tickets`)
      .send({ subject: "استفسار", message: "كيف أعدل بيانات المتجر؟", category: "account" })
      .expect(201);

    const created = await admin.agent
      .post("/api/admin/admins")
      .send({ email: "finance-created@admin.test", password: "AdminPassword123", name: "ممول", role: "finance" })
      .expect(201);
    expect(created.body.admin.permissions).toEqual(
      expect.arrayContaining(["wallet.write", "subscriptions.write"])
    );
    expect(created.body.admin.permissions).not.toContain("admins.manage");
    await admin.agent
      .post("/api/admin/admins")
      .send({ email: "finance-created@admin.test", password: "AdminPassword123", role: "readonly" })
      .expect(409);

    const newAdmin = request.agent(app);
    await newAdmin
      .post("/api/admin/auth/login")
      .send({ email: "finance-created@admin.test", password: "AdminPassword123" })
      .expect(200);
    await newAdmin
      .post(`/api/admin/wallet/transactions/${deposit.body.transaction.id}/review`)
      .send({ decision: "approve" })
      .expect(200);
    await newAdmin
      .patch(`/api/admin/support-tickets/${ticket.body.ticket.id}`)
      .send({ status: "resolved" })
      .expect(403);

    // Role updates take effect on the next request without re-login.
    const promoted = await admin.agent
      .patch(`/api/admin/admins/${created.body.admin.id}`)
      .send({ role: "support" })
      .expect(200);
    expect(promoted.body.admin.permissions).toContain("support.write");
    expect(promoted.body.admin.permissions).not.toContain("wallet.write");
    const nextMe = await newAdmin.get("/api/admin/auth/me").expect(200);
    expect(nextMe.body.admin.role).toBe("support");
    await newAdmin
      .patch(`/api/admin/support-tickets/${ticket.body.ticket.id}`)
      .send({ status: "in_progress" })
      .expect(200);

    const secondDeposit = await merchant.agent
      .post(`${base}/wallet/deposits`)
      .send({ amount: 25, reference: "MANAGE-DEP-2" })
      .expect(201);
    await newAdmin
      .post(`/api/admin/wallet/transactions/${secondDeposit.body.transaction.id}/review`)
      .send({ decision: "approve" })
      .expect(403);

    // A super admin cannot demote or disable itself.
    const selfEdit = await admin.agent
      .patch(`/api/admin/admins/${admin.admin.id}`)
      .send({ role: "readonly" })
      .expect(409);
    expect(selfEdit.body.error.code).toBe("ADMIN_SELF_EDIT");

    await admin.agent
      .patch(`/api/admin/admins/${created.body.admin.id}`)
      .send({ status: "disabled" })
      .expect(200);
    await newAdmin.get("/api/admin/auth/me").expect(401);
    const disabledLogin = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: "finance-created@admin.test", password: "AdminPassword123" })
      .expect(403);
    expect(disabledLogin.body.error.code).toBe("ADMIN_DISABLED");

    const audit = await admin.agent.get("/api/admin/audit?actorType=platform_admin").expect(200);
    const createdLog = audit.body.logs.find((log: any) => log.action === "admin.created");
    expect(createdLog.platformAdminId).toBe(admin.admin.id);
    const updatedLog = audit.body.logs.find((log: any) => log.action === "admin.updated");
    expect(updatedLog.metadata.status).toBe("disabled");
  });
});
