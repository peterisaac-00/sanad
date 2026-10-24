import { Router } from "express";
import { z } from "zod";
import { prisma, newId, nowIso } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { mediaLimiter, requireAuth, requireRole } from "../middleware.js";
import {
  adminIdParamSchema,
  adminStoreReviewSchema,
  adminStoreSettingsSchema,
  adminSubscriptionReviewSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { createNotification, ensureStoreDefaults, writeAudit } from "../services/account.js";
import { storeMedia } from "../services/media.js";

export const adminRouter = Router();

/**
 * Platform admin surface. Every route is gated by the merchant role stored in
 * PostgreSQL; a client cannot elevate itself with a header or query parameter.
 */
adminRouter.use(asyncHandler(requireAuth));
adminRouter.use(requireRole("admin"));

const SUBSCRIPTION_PRICES = { monthly: 100, annual: 1000 } as const;
const SUBSCRIPTION_CURRENCY = "EGP";
const PLAN_LABEL: Record<string, string> = { monthly: "شهري", annual: "سنوي" };

const mediaBodySchema = z.strictObject({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(3).max(100),
  dataBase64: z.string().min(10).max(12_000_000),
});

function utcMonthStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addPlanPeriod(base: Date, plan: string): Date {
  const next = new Date(base);
  if (plan === "annual") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function ownerOf(store: { merchants?: Array<Record<string, unknown>> }) {
  const owner = store.merchants?.[0];
  if (!owner) return null;
  return {
    id: owner.id,
    email: owner.email,
    name: owner.name,
    firstName: owner.firstName,
    lastName: owner.lastName,
    phone: owner.phone,
    role: owner.role,
  };
}

function storeRow(store: any) {
  return {
    id: store.id,
    storeName: store.storeName,
    subdomain: store.subdomain,
    customDomain: store.customDomain,
    description: store.description,
    status: store.status,
    plan: store.plan,
    currency: store.currency,
    countryCode: store.countryCode,
    logoUrl: store.logoUrl,
    coverUrl: store.coverUrl,
    templateKey: store.templateKey,
    seoTitle: store.seoTitle,
    seoDescription: store.seoDescription,
    supportEmail: store.supportEmail,
    whatsapp: store.whatsapp,
    phone: store.phone,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    activatedAt: store.activatedAt,
    subscriptionPaidUntil: store.subscriptionPaidUntil,
    onboardingCompleted: store.onboardingCompleted,
    publishedAt: store.publishedAt,
    owner: ownerOf(store),
    walletBalance: store.wallet?.balance ?? 0,
    paymentCount: store._count?.subscriptionPayments ?? 0,
    visitsTotal: store._count?.visits ?? 0,
  };
}

adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const monthStart = utcMonthStart(now);
    const windows = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - (5 - index), 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      return {
        start,
        end,
        month: start.toISOString().slice(0, 7),
      };
    });

    const [
      stores,
      totalStores,
      activeStores,
      pendingStores,
      suspendedStores,
      rejectedStores,
      visitsThisMonth,
      pendingPaymentCount,
      pendingPaymentAgg,
      approvedPaymentAgg,
      byStore,
      ...monthCounts
    ] = await Promise.all([
      prisma.store.findMany({
        orderBy: { createdAt: "desc" },
        take: 250,
        include: {
          merchants: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
              phone: true,
              role: true,
            },
          },
          wallet: { select: { balance: true } },
          _count: { select: { subscriptionPayments: true, visits: true } },
        },
      }),
      prisma.store.count(),
      prisma.store.count({ where: { status: "active" } }),
      prisma.store.count({ where: { status: "pending" } }),
      prisma.store.count({ where: { status: "suspended" } }),
      prisma.store.count({ where: { status: "rejected" } }),
      prisma.storeVisit.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.subscriptionPayment.count({ where: { status: "pending" } }),
      prisma.subscriptionPayment.aggregate({ where: { status: "pending" }, _sum: { amount: true } }),
      prisma.subscriptionPayment.aggregate({
        where: { status: "approved", reviewedAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.storeVisit.groupBy({
        by: ["storeId"],
        where: { createdAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      ...windows.map((window) =>
        prisma.storeVisit.count({ where: { createdAt: { gte: window.start, lt: window.end } } })
      ),
    ]);

    const visitsByStoreMap = new Map(
      byStore.map((entry) => [entry.storeId, entry._count._all])
    );
    const storeRows = stores.map((store) => ({
      ...storeRow(store),
      visitsThisMonth: visitsByStoreMap.get(store.id) ?? 0,
    }));

    res.json({
      summary: {
        totalStores,
        activeStores,
        pendingStores,
        suspendedStores,
        rejectedStores,
        visitsThisMonth,
        pendingSubscriptionPayments: pendingPaymentCount,
        pendingSubscriptionAmount: pendingPaymentAgg._sum.amount ?? 0,
        approvedSubscriptionAmountThisMonth: approvedPaymentAgg._sum.amount ?? 0,
      },
      stores: storeRows,
      monthlyVisits: windows.map((window, index) => ({
        month: window.month,
        visits: monthCounts[index] ?? 0,
      })),
      visitsByStore: storeRows
        .filter((store) => store.visitsThisMonth > 0)
        .map((store) => ({
          storeId: store.id,
          storeName: store.storeName,
          subdomain: store.subdomain,
          visits: store.visitsThisMonth,
        }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 12),
      subscriptionPrices: SUBSCRIPTION_PRICES,
      subscriptionCurrency: SUBSCRIPTION_CURRENCY,
      generatedAt: nowIso(),
    });
  })
);

adminRouter.get(
  "/subscription-payments",
  asyncHandler(async (req, res) => {
    const requested = typeof req.query.status === "string" ? req.query.status : "";
    const status = ["pending", "approved", "rejected"].includes(requested) ? requested : undefined;
    const where = status ? { status } : {};

    const [payments, pendingCount, rejectedCount, approvedThisMonth] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 300,
        include: {
          store: {
            select: {
              id: true,
              storeName: true,
              subdomain: true,
              status: true,
              plan: true,
              currency: true,
              activatedAt: true,
              subscriptionPaidUntil: true,
              merchants: {
                orderBy: { createdAt: "asc" },
                take: 1,
                select: { id: true, email: true, name: true, firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
      }),
      prisma.subscriptionPayment.count({ where: { status: "pending" } }),
      prisma.subscriptionPayment.count({ where: { status: "rejected" } }),
      prisma.subscriptionPayment.aggregate({
        where: { status: "approved", reviewedAt: { gte: utcMonthStart(new Date()) } },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      payments: payments.map((payment) => ({
        ...payment,
        store: {
          ...payment.store,
          owner: ownerOf(payment.store as any),
        },
      })),
      summary: {
        pending: pendingCount,
        rejected: rejectedCount,
        approvedThisMonth: approvedThisMonth._sum.amount ?? 0,
        prices: SUBSCRIPTION_PRICES,
        currency: SUBSCRIPTION_CURRENCY,
      },
    });
  })
);

adminRouter.post(
  "/subscription-payments/:id/review",
  validateParams(adminIdParamSchema),
  validateBody(adminSubscriptionReviewSchema),
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body;
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: req.params.id },
      include: { store: true },
    });
    if (!payment) throw new ApiError(404, "SUBSCRIPTION_PAYMENT_NOT_FOUND", "Subscription payment not found.");
    if (payment.status !== "pending") {
      throw new ApiError(409, "SUBSCRIPTION_PAYMENT_ALREADY_REVIEWED", "This payment has already been reviewed.");
    }
    if (!["monthly", "annual"].includes(payment.plan)) {
      throw new ApiError(400, "INVALID_SUBSCRIPTION_PLAN", "The payment has an unsupported plan.");
    }

    const reviewedAt = new Date();
    let updatedStore = payment.store;
    const updatedPayment = await prisma.$transaction(async (tx) => {
      // Claim the payment inside the transaction so two admins clicking at the
      // same time cannot both extend the paid-through date.
      const claimed = await tx.subscriptionPayment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: {
          status: decision === "approve" ? "approved" : "rejected",
          reviewNote: note,
          reviewedById: req.auth!.merchantId,
          reviewedAt,
        },
      });
      if (claimed.count !== 1) {
        throw new ApiError(409, "SUBSCRIPTION_PAYMENT_ALREADY_REVIEWED", "This payment has already been reviewed.");
      }
      if (decision === "approve") {
        const current = payment.store.subscriptionPaidUntil;
        const base = current && current.getTime() > reviewedAt.getTime() ? current : reviewedAt;
        updatedStore = await tx.store.update({
          where: { id: payment.storeId },
          data: {
            plan: payment.plan,
            subscriptionPaidUntil: addPlanPeriod(base, payment.plan),
          },
        });
      }
      return tx.subscriptionPayment.findUniqueOrThrow({ where: { id: payment.id } });
    });

    await writeAudit({
      storeId: payment.storeId,
      merchantId: req.auth!.merchantId,
      action: decision === "approve" ? "subscription_payment.approved" : "subscription_payment.rejected",
      entity: "subscription_payment",
      entityId: payment.id,
      metadata: { plan: payment.plan, amount: payment.amount, note },
      ip: req.ip,
    });
    await createNotification({
      storeId: payment.storeId,
      type: "billing",
      title: decision === "approve" ? "تم اعتماد دفعة الاشتراك" : "تم رفض دفعة الاشتراك",
      body:
        decision === "approve"
          ? `تم اعتماد اشتراكك ${PLAN_LABEL[payment.plan] ?? payment.plan} بقيمة ${payment.amount} ${payment.currency}.`
          : note || "راجع بيانات الدفعة ثم أعد إرسالها.",
      link: "/dashboard/wallet",
    });

    res.json({ payment: updatedPayment, store: updatedStore });
  })
);

adminRouter.post(
  "/stores/:id/approve",
  validateParams(adminIdParamSchema),
  validateBody(adminStoreReviewSchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const activatedAt = store.activatedAt ?? new Date();
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { status: "active", activatedAt },
    });
    await writeAudit({
      storeId: store.id,
      merchantId: req.auth!.merchantId,
      action: "store.approved",
      entity: "store",
      entityId: store.id,
      metadata: { note: req.body.note ?? "", activated_at: activatedAt.toISOString() },
      ip: req.ip,
    });
    await createNotification({
      storeId: store.id,
      type: "approval",
      title: "تم تفعيل متجرك",
      body: store.onboardingCompleted
        ? "وافق فريق سند على متجرك. يمكنك الآن مشاركة رابط المتجر مع عملائك."
        : "وافق فريق سند على متجرك. أكمل تهيئة المتجر ونشره من لوحة التحكم ليظهر للعملاء.",
      link: store.onboardingCompleted ? "/dashboard" : "/onboarding",
    });
    res.json({ store: updated });
  })
);

adminRouter.post(
  "/stores/:id/reject",
  validateParams(adminIdParamSchema),
  validateBody(adminStoreReviewSchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { status: "rejected" },
    });
    await writeAudit({
      storeId: store.id,
      merchantId: req.auth!.merchantId,
      action: "store.rejected",
      entity: "store",
      entityId: store.id,
      metadata: { note: req.body.note ?? "" },
      ip: req.ip,
    });
    await createNotification({
      storeId: store.id,
      type: "approval",
      title: "طلب فتح المتجر يحتاج تعديلاً",
      body: req.body.note || "راجع بيانات متجرك ثم تواصل مع إدارة سند.",
      link: "/dashboard/settings",
    });
    res.json({ store: updated });
  })
);

adminRouter.post(
  "/stores/:id/suspend",
  validateParams(adminIdParamSchema),
  validateBody(adminStoreReviewSchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { status: "suspended" },
    });
    await writeAudit({
      storeId: store.id,
      merchantId: req.auth!.merchantId,
      action: "store.suspended",
      entity: "store",
      entityId: store.id,
      metadata: { note: req.body.note ?? "" },
      ip: req.ip,
    });
    await createNotification({
      storeId: store.id,
      type: "approval",
      title: "تم إيقاف المتجر مؤقتاً",
      body: req.body.note || "تم إيقاف المتجر من إدارة منصة سند.",
      link: "/dashboard/settings",
    });
    res.json({ store: updated });
  })
);

adminRouter.get(
  "/stores/:id/settings",
  validateParams(adminIdParamSchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({
      where: { id: req.params.id },
      include: {
        branding: true,
        merchants: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { id: true, email: true, name: true, firstName: true, lastName: true, phone: true, role: true },
        },
      },
    });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    res.json({ store: storeRow(store), branding: store.branding, owner: ownerOf(store), public_url: `/store/${store.subdomain}` });
  })
);

adminRouter.patch(
  "/stores/:id/settings",
  validateParams(adminIdParamSchema),
  validateBody(adminStoreSettingsSchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.params.id }, select: { id: true, currency: true } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const b = req.body;
    await ensureStoreDefaults(store.id, store.currency);

    const brandingData = {
      ...(b.primaryColor !== undefined ? { primaryColor: b.primaryColor } : {}),
      ...(b.secondaryColor !== undefined ? { secondaryColor: b.secondaryColor } : {}),
      ...(b.textColor !== undefined ? { textColor: b.textColor } : {}),
      ...(b.themeMode !== undefined ? { themeMode: b.themeMode } : {}),
      ...(b.arabicFont !== undefined ? { arabicFont: b.arabicFont } : {}),
      ...(b.templateKey !== undefined ? { templateKey: b.templateKey } : {}),
    };

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.store.update({
        where: { id: store.id },
        data: {
          ...(b.storeName !== undefined ? { storeName: b.storeName } : {}),
          ...(b.description !== undefined ? { description: b.description } : {}),
          ...(b.logoUrl !== undefined ? { logoUrl: b.logoUrl } : {}),
          ...(b.coverUrl !== undefined ? { coverUrl: b.coverUrl } : {}),
          ...(b.templateKey !== undefined ? { templateKey: b.templateKey } : {}),
          ...(b.seoTitle !== undefined ? { seoTitle: b.seoTitle } : {}),
          ...(b.seoDescription !== undefined ? { seoDescription: b.seoDescription } : {}),
          ...(b.supportEmail !== undefined ? { supportEmail: b.supportEmail } : {}),
          ...(b.whatsapp !== undefined ? { whatsapp: b.whatsapp } : {}),
          ...(b.phone !== undefined ? { phone: b.phone } : {}),
          ...(b.countryCode !== undefined ? { countryCode: b.countryCode } : {}),
        },
      });
      const branding = await tx.storeBranding.upsert({
        where: { storeId: store.id },
        create: { id: newId("brand_"), storeId: store.id, ...brandingData },
        update: brandingData,
      });
      return { store: updated, branding };
    });

    await writeAudit({
      storeId: store.id,
      merchantId: req.auth!.merchantId,
      action: "admin.store_settings_updated",
      entity: "store",
      entityId: store.id,
      metadata: { fields: Object.keys(b) },
      ip: req.ip,
    });
    await createNotification({
      storeId: store.id,
      type: "settings",
      title: "تم تحديث هوية متجرك",
      body: "حدّث فريق سند بيانات الهوية أو العلامة التجارية لمتجرك.",
      link: "/dashboard/settings",
    });
    res.json({ store: result.store, branding: result.branding });
  })
);

adminRouter.post(
  "/stores/:id/media",
  mediaLimiter,
  validateParams(adminIdParamSchema),
  validateBody(mediaBodySchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const result = await storeMedia({
      storeId: store.id,
      fileName: req.body.fileName,
      mimeType: req.body.mimeType,
      dataBase64: req.body.dataBase64,
    });
    await writeAudit({
      storeId: store.id,
      merchantId: req.auth!.merchantId,
      action: "admin.store_media_uploaded",
      entity: "store",
      entityId: store.id,
      metadata: { url: result.media.url },
      ip: req.ip,
    });
    res.status(201).json(result);
  })
);

// Existing admin capability preserved at the same URL.
adminRouter.get(
  "/leads",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { store: { select: { storeName: true, subdomain: true } } },
    });
    res.json({ leads: rows });
  })
);
