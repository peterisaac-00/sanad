import { Router } from "express";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  subscriptionPaymentSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
  walletDepositSchema,
} from "../validate.js";
import { auditActor, ensureStoreDefaults, writeAudit } from "../services/account.js";
import { isFeatureEnabled } from "../services/features.js";

export const walletRouter = Router();

/**
 * Deposits are real requests that only change the balance after an admin
 * approval. The feature flag lets operations pause intake without deleting the
 * review trail. Subscription billing is separate: it never mutates the wallet.
 */
export const SUBSCRIPTION_PRICES = { monthly: 100, annual: 1000 } as const;
export const SUBSCRIPTION_CURRENCY = "EGP";

async function storeFor(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, currency: true, plan: true, subscriptionPaidUntil: true, status: true },
  });
  if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  await ensureStoreDefaults(storeId, store.currency);
  const account = await prisma.walletAccount.findUnique({ where: { storeId } });
  if (!account) throw new ApiError(500, "WALLET_UNAVAILABLE", "Wallet could not be initialised.");
  return { store, account };
}

walletRouter.get(
  "/api/stores/:subdomain/wallet",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const { store, account } = await storeFor(storeId);
    const depositsEnabled = await isFeatureEnabled("wallet_deposits", true);
    const [transactions, pending, completed, subscriptionPayments] = await prisma.$transaction([
      prisma.walletTransaction.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.walletTransaction.aggregate({
        where: { storeId, status: "pending", type: "deposit" },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { storeId, status: "completed", type: "deposit" },
        _sum: { amount: true },
      }),
      prisma.subscriptionPayment.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: 24,
      }),
    ]);
    res.json({
      account,
      transactions,
      deposits_enabled: depositsEnabled,
      summary: {
        balance: account.balance,
        pendingDeposits: pending._sum.amount ?? 0,
        completedDeposits: completed._sum.amount ?? 0,
        currency: account.currency,
      },
      subscription: {
        plan: store.plan,
        status: store.status,
        paid_until: store.subscriptionPaidUntil,
        prices: SUBSCRIPTION_PRICES,
        currency: SUBSCRIPTION_CURRENCY,
        pending_payment: subscriptionPayments.find((payment) => payment.status === "pending") ?? null,
      },
      subscription_payments: subscriptionPayments,
      note: depositsEnabled
        ? "طلبات الإيداع تخضع لمراجعة إدارة سند قبل إضافتها إلى الرصيد. لا يُضاف أي مبلغ تلقائياً."
        : "الإيداع في المحفظة متوقف مؤقتاً من إدارة المنصة. يمكنك متابعة الاشتراك والطلبات الحالية.",
    });
  })
);

walletRouter.post(
  "/api/stores/:subdomain/subscription-payments",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(subscriptionPaymentSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const { store } = await storeFor(storeId);
    const pending = await prisma.subscriptionPayment.findFirst({
      where: { storeId, status: "pending" },
      select: { id: true },
    });
    if (pending) {
      throw new ApiError(
        409,
        "SUBSCRIPTION_PAYMENT_PENDING",
        "لديك دفعة اشتراك قيد المراجعة. انتظر قرار الإدارة قبل إرسال دفعة جديدة."
      );
    }

    const amount = SUBSCRIPTION_PRICES[req.body.plan as "monthly" | "annual"];
    const payment = await prisma.subscriptionPayment.create({
      data: {
        id: newId("subpay_"),
        storeId,
        plan: req.body.plan,
        amount,
        currency: SUBSCRIPTION_CURRENCY,
        method: req.body.method,
        reference: req.body.reference,
        payerName: req.body.payerName,
        note: req.body.note,
        submittedById: req.auth!.actorId,
        status: "pending",
      },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "subscription_payment.submitted",
      entity: "subscription_payment",
      entityId: payment.id,
      metadata: { plan: payment.plan, amount: payment.amount, method: payment.method },
      ip: req.ip,
    });
    res.status(201).json({
      payment,
      amount,
      currency: SUBSCRIPTION_CURRENCY,
      note: "تم تسجيل دفعة الاشتراك. ستراجعها إدارة سند وتحدّث حالة الاشتراك عند الاعتماد.",
    });
  })
);

walletRouter.post(
  "/api/stores/:subdomain/wallet/deposits",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(walletDepositSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    if (!(await isFeatureEnabled("wallet_deposits", true))) {
      throw new ApiError(
        503,
        "WALLET_DEPOSITS_DISABLED",
        "الإيداع في المحفظة متوقف مؤقتاً من إدارة المنصة. لا تُحوّل أي مبلغ على أساس هذا الخيار."
      );
    }
    const { account } = await storeFor(storeId);
    const amount = Math.round(Number(req.body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) {
      throw new ApiError(400, "INVALID_DEPOSIT_AMOUNT", "Deposit amount must be between 1 and 1,000,000.");
    }
    const transaction = await prisma.walletTransaction.create({
      data: {
        id: newId("wtx_"),
        storeId,
        accountId: account.id,
        type: "deposit",
        amount,
        status: "pending",
        reference: req.body.reference,
        note: req.body.note,
        balanceBefore: account.balance,
        balanceAfter: account.balance,
      },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "wallet.deposit_requested",
      entity: "wallet_transaction",
      entityId: transaction.id,
      metadata: { amount, method: req.body.method, reference: req.body.reference },
      ip: req.ip,
    });
    res.status(201).json({
      transaction,
      deposits_enabled: true,
      currency: account.currency,
      note: "تم تسجيل طلب الإيداع. سيُضاف المبلغ إلى الرصيد فقط بعد اعتماد إدارة سند. رصيدك الحالي لم يتغير.",
    });
  })
);
