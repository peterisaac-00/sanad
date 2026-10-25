import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  couponBodySchema,
  couponUpdateSchema,
  idParamSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { auditActor, writeAudit } from "../services/account.js";

export const couponsRouter = Router();

async function validateRefs(storeId: string, productIds: string[], categoryIds: string[]) {
  if (productIds.length) {
    const found = await prisma.product.count({ where: { storeId, id: { in: productIds } } });
    if (found !== productIds.length) throw new ApiError(400, "INVALID_COUPON_SCOPE", "One or more products do not belong to this store.");
  }
  if (categoryIds.length) {
    const found = await prisma.category.count({ where: { storeId, id: { in: categoryIds } } });
    if (found !== categoryIds.length) throw new ApiError(400, "INVALID_COUPON_SCOPE", "One or more categories do not belong to this store.");
  }
}

couponsRouter.get(
  "/api/stores/:subdomain/coupons",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const coupons = await prisma.coupon.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });
    const usageAgg = await prisma.couponUsage.groupBy({
      by: ["couponId"],
      where: { storeId: req.ownedStore!.id },
      _sum: { discount: true },
    });
    const discounts = new Map(usageAgg.map((u) => [u.couponId, u._sum.discount ?? 0]));
    res.json({
      coupons: coupons.map((c) => ({
        ...c,
        usageCount: c._count.usages,
        totalDiscount: discounts.get(c.id) ?? 0,
      })),
    });
  })
);

couponsRouter.post(
  "/api/stores/:subdomain/coupons",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(couponBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    await validateRefs(storeId, b.productIds, b.categoryIds);
    if (b.type === "percentage" && b.value > 100) throw new ApiError(400, "INVALID_COUPON_VALUE", "Percentage cannot exceed 100.");
    try {
      const coupon = await prisma.coupon.create({
        data: {
          id: newId("cpn_"),
          storeId,
          code: b.code,
          type: b.type,
          value: b.value,
          startsAt: b.startsAt ? new Date(b.startsAt) : null,
          endsAt: b.endsAt ? new Date(b.endsAt) : null,
          minOrderValue: b.minOrderValue,
          maxUses: b.maxUses ?? null,
          perCustomerLimit: b.perCustomerLimit ?? null,
          firstOrderOnly: b.firstOrderOnly,
          freeShipping: b.freeShipping || b.type === "free_shipping",
          productIds: b.productIds as Prisma.InputJsonValue,
          categoryIds: b.categoryIds as Prisma.InputJsonValue,
          isActive: b.isActive,
        },
      });
      await writeAudit({
        storeId,
        ...auditActor(req.auth!),
        action: "coupon.created",
        entity: "coupon",
        entityId: coupon.id,
        ip: req.ip,
      });
      res.status(201).json({ coupon });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "COUPON_CODE_TAKEN", "This coupon code already exists in your store.");
      }
      throw e;
    }
  })
);

couponsRouter.patch(
  "/api/stores/:subdomain/coupons/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(couponUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.coupon.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "COUPON_NOT_FOUND", "Coupon not found.");
    const b = req.body;
    await validateRefs(storeId, b.productIds ?? [], b.categoryIds ?? []);
    if (b.type === "percentage" && b.value !== undefined && b.value > 100) {
      throw new ApiError(400, "INVALID_COUPON_VALUE", "Percentage cannot exceed 100.");
    }
    try {
      const coupon = await prisma.coupon.update({
        where: { id: existing.id },
        data: {
          ...(b.code !== undefined ? { code: b.code } : {}),
          ...(b.type !== undefined ? { type: b.type } : {}),
          ...(b.value !== undefined ? { value: b.value } : {}),
          ...(b.startsAt !== undefined ? { startsAt: b.startsAt ? new Date(b.startsAt) : null } : {}),
          ...(b.endsAt !== undefined ? { endsAt: b.endsAt ? new Date(b.endsAt) : null } : {}),
          ...(b.minOrderValue !== undefined ? { minOrderValue: b.minOrderValue } : {}),
          ...(b.maxUses !== undefined ? { maxUses: b.maxUses } : {}),
          ...(b.perCustomerLimit !== undefined ? { perCustomerLimit: b.perCustomerLimit } : {}),
          ...(b.firstOrderOnly !== undefined ? { firstOrderOnly: b.firstOrderOnly } : {}),
          ...(b.freeShipping !== undefined ? { freeShipping: b.freeShipping } : {}),
          ...(b.productIds !== undefined ? { productIds: b.productIds as Prisma.InputJsonValue } : {}),
          ...(b.categoryIds !== undefined ? { categoryIds: b.categoryIds as Prisma.InputJsonValue } : {}),
          ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
        },
      });
      await writeAudit({
        storeId,
        ...auditActor(req.auth!),
        action: "coupon.updated",
        entity: "coupon",
        entityId: coupon.id,
        ip: req.ip,
      });
      res.json({ coupon });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "COUPON_CODE_TAKEN", "This coupon code already exists in your store.");
      }
      throw e;
    }
  })
);

couponsRouter.delete(
  "/api/stores/:subdomain/coupons/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.coupon.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "COUPON_NOT_FOUND", "Coupon not found.");
    await prisma.coupon.delete({ where: { id: existing.id } });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "coupon.deleted",
      entity: "coupon",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);
