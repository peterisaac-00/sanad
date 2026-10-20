import { Router } from "express";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import { subdomainParamSchema, validateBody, validateParams, walletDepositSchema } from "../validate.js";
import { ensureStoreDefaults, writeAudit } from "../services/account.js";

export const walletRouter = Router();

async function accountFor(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { currency: true } });
  if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  await ensureStoreDefaults(storeId, store.currency);
  const account = await prisma.walletAccount.findUnique({ where: { storeId } });
  if (!account) throw new ApiError(500, "WALLET_UNAVAILABLE", "Wallet could not be initialised.");
  return account;
}

walletRouter.get(
  "/api/stores/:subdomain/wallet",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const account = await accountFor(storeId);
    const [transactions, pending, completed] = await prisma.$transaction([
      prisma.walletTransaction.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.walletTransaction.aggregate({
        where: { storeId, status: "pending", type: "deposit" },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { storeId, status: "completed", type: "deposit" },
        _sum: { amount: true },
      }),
    ]);
    res.json({
      account,
      transactions,
      summary: {
        balance: account.balance,
        pendingDeposits: pending._sum.amount ?? 0,
        completedDeposits: completed._sum.amount ?? 0,
        currency: account.currency,
      },
      note: "طلبات الإيداع تُسجّل بحالة معلّقة ولا تُضاف إلى الرصيد إلا بعد تأكيد التحويل من فريق سند.",
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
    const account = await accountFor(storeId);
    const { amount, reference, note } = req.body as { amount: number; reference: string; note: string };
    const transaction = await prisma.walletTransaction.create({
      data: {
        id: newId("wtx_"),
        storeId,
        accountId: account.id,
        type: "deposit",
        amount,
        balanceBefore: account.balance,
        balanceAfter: account.balance,
        status: "pending",
        reference,
        note,
      },
    });
    await writeAudit({
      storeId,
      merchantId: req.auth!.merchantId,
      action: "wallet.deposit_requested",
      entity: "wallet",
      entityId: transaction.id,
      metadata: { amount, reference },
      ip: req.ip,
    });
    res.status(201).json({
      transaction,
      credited: false,
      note: "تم تسجيل طلب الإيداع. لن يتغير الرصيد حتى يتم التحقق من التحويل.",
    });
  })
);
