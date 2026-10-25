import { Router } from "express";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  idParamSchema,
  loyaltyAdjustSchema,
  loyaltyRuleBodySchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { auditActor, writeAudit } from "../services/account.js";

export const loyaltyRouter = Router();

loyaltyRouter.get(
  "/api/stores/:subdomain/loyalty",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const [rules, accounts, transactions] = await prisma.$transaction([
      prisma.loyaltyRule.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } }),
      prisma.loyaltyAccount.findMany({
        where: { storeId },
        orderBy: { points: "desc" },
        take: 100,
        include: { customer: { select: { id: true, name: true, phone: true, email: true } } },
      }),
      prisma.loyaltyTransaction.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    res.json({
      rules,
      accounts,
      transactions,
      totals: {
        members: accounts.length,
        pointsIssued: accounts.reduce((s, a) => s + a.points, 0),
      },
    });
  })
);

loyaltyRouter.post(
  "/api/stores/:subdomain/loyalty/rules",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(loyaltyRuleBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    const rule = await prisma.loyaltyRule.create({
      data: {
        id: newId("loy_"),
        storeId,
        name: b.name,
        type: b.type,
        points: b.points,
        perAmount: b.perAmount,
        minOrderValue: b.minOrderValue,
        isActive: b.isActive,
      },
    });
    res.status(201).json({ rule });
  })
);

loyaltyRouter.patch(
  "/api/stores/:subdomain/loyalty/rules/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(loyaltyRuleBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.loyaltyRule.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "LOYALTY_RULE_NOT_FOUND", "Loyalty rule not found.");
    const b = req.body;
    const rule = await prisma.loyaltyRule.update({
      where: { id: existing.id },
      data: {
        name: b.name,
        type: b.type,
        points: b.points,
        perAmount: b.perAmount,
        minOrderValue: b.minOrderValue,
        isActive: b.isActive,
      },
    });
    res.json({ rule });
  })
);

loyaltyRouter.delete(
  "/api/stores/:subdomain/loyalty/rules/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.loyaltyRule.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "LOYALTY_RULE_NOT_FOUND", "Loyalty rule not found.");
    await prisma.loyaltyRule.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);

loyaltyRouter.post(
  "/api/stores/:subdomain/loyalty/adjust",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(loyaltyAdjustSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const { customerId, points, note } = req.body as { customerId: string; points: number; note: string };
    const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId }, select: { id: true } });
    if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    const result = await prisma.$transaction(async (tx) => {
      let account = await tx.loyaltyAccount.findUnique({ where: { customerId } });
      if (!account) {
        account = await tx.loyaltyAccount.create({
          data: { id: newId("lac_"), storeId, customerId, points: 0 },
        });
      }
      if (account.points + points < 0) {
        throw new ApiError(400, "INSUFFICIENT_POINTS", "The customer does not have enough points.");
      }
      const updated = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: { increment: points } },
      });
      await tx.loyaltyTransaction.create({
        data: {
          id: newId("ltx_"),
          storeId,
          accountId: account.id,
          points,
          type: points >= 0 ? "adjustment" : "redeem",
          note,
        },
      });
      return updated;
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "loyalty.adjusted",
      entity: "loyalty_account",
      entityId: result.id,
      metadata: { points, note },
      ip: req.ip,
    });
    res.json({ account: result });
  })
);
