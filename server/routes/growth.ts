import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  idParamSchema,
  relatedProductBodySchema,
  relatedProductUpdateSchema,
  subdomainParamSchema,
  upsellBodySchema,
  upsellUpdateSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { auditActor, writeAudit } from "../services/account.js";

export const growthRouter = Router();

const productMini = { select: { id: true, sku: true, nameAr: true, nameEn: true, basePrice: true } };

async function ensureProducts(storeId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const found = await prisma.product.count({ where: { storeId, id: { in: unique } } });
  if (found !== unique.length) throw new ApiError(400, "PRODUCT_NOT_FOUND", "One or more products do not belong to this store.");
}

// ---- upsells / cross-sells ----
growthRouter.get(
  "/api/stores/:subdomain/upsells",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const upsells = await prisma.upsellRule.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: { offerProduct: productMini, triggerProduct: productMini },
    });
    res.json({
      upsells: upsells.map((u) => ({
        ...u,
        conversionRate: u.impressions > 0 ? Math.round((u.conversions / u.impressions) * 1000) / 10 : 0,
      })),
    });
  })
);

growthRouter.post(
  "/api/stores/:subdomain/upsells",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(upsellBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    await ensureProducts(storeId, [b.offerProductId, ...(b.triggerProductId ? [b.triggerProductId] : [])]);
    if (b.discountType === "percentage" && b.discountValue > 100) {
      throw new ApiError(400, "INVALID_DISCOUNT", "Percentage discount cannot exceed 100.");
    }
    const upsell = await prisma.upsellRule.create({
      data: {
        id: newId("ups_"),
        storeId,
        name: b.name,
        triggerProductId: b.triggerProductId ?? null,
        offerProductId: b.offerProductId,
        discountType: b.discountType,
        discountValue: b.discountValue,
        priority: b.priority,
        isActive: b.isActive,
        placement: b.placement,
        startsAt: b.startsAt ? new Date(b.startsAt) : null,
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
      },
      include: { offerProduct: productMini, triggerProduct: productMini },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "upsell.created",
      entity: "upsell",
      entityId: upsell.id,
      ip: req.ip,
    });
    res.status(201).json({ upsell });
  })
);

growthRouter.patch(
  "/api/stores/:subdomain/upsells/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(upsellUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.upsellRule.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "UPSELL_NOT_FOUND", "Upsell rule not found.");
    const b = req.body;
    await ensureProducts(storeId, [b.offerProductId, ...(b.triggerProductId ? [b.triggerProductId] : [])].filter((v): v is string => Boolean(v)));
    const upsell = await prisma.upsellRule.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.triggerProductId !== undefined ? { triggerProductId: b.triggerProductId } : {}),
        ...(b.offerProductId !== undefined ? { offerProductId: b.offerProductId } : {}),
        ...(b.discountType !== undefined ? { discountType: b.discountType } : {}),
        ...(b.discountValue !== undefined ? { discountValue: b.discountValue } : {}),
        ...(b.priority !== undefined ? { priority: b.priority } : {}),
        ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
        ...(b.placement !== undefined ? { placement: b.placement } : {}),
        ...(b.startsAt !== undefined ? { startsAt: b.startsAt ? new Date(b.startsAt) : null } : {}),
        ...(b.endsAt !== undefined ? { endsAt: b.endsAt ? new Date(b.endsAt) : null } : {}),
      },
      include: { offerProduct: productMini, triggerProduct: productMini },
    });
    res.json({ upsell });
  })
);

growthRouter.delete(
  "/api/stores/:subdomain/upsells/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.upsellRule.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "UPSELL_NOT_FOUND", "Upsell rule not found.");
    await prisma.upsellRule.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);

// ---- related products ----
growthRouter.get(
  "/api/stores/:subdomain/related-products",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    const relations = await prisma.relatedProduct.findMany({
      where: { storeId: req.ownedStore!.id, ...(productId ? { productId } : {}) },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { product: productMini, relatedProduct: productMini },
    });
    res.json({ relations });
  })
);

growthRouter.post(
  "/api/stores/:subdomain/related-products",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(relatedProductBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    const targetIds: string[] = b.relatedProductIds?.length
      ? b.relatedProductIds
      : b.relatedProductId
        ? [b.relatedProductId]
        : [];
    const ids = [...new Set<string>(targetIds)].filter((id) => id !== b.productId);
    if (!ids.length) throw new ApiError(400, "INVALID_RELATION", "Choose at least one different product.");
    await ensureProducts(storeId, [b.productId, ...ids]);
    const created = await prisma.$transaction(
      ids.map((relatedProductId, index) =>
        prisma.relatedProduct.create({
          data: {
            id: newId("rel_"),
            storeId,
            productId: b.productId,
            relatedProductId,
            sortOrder: b.sortOrder + index,
            isActive: b.isActive,
          },
          include: { product: productMini, relatedProduct: productMini },
        })
      )
    );
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "related.created",
      entity: "related_product",
      metadata: { productId: b.productId, ids },
      ip: req.ip,
    });
    res.status(201).json({ relations: created });
  })
);

growthRouter.patch(
  "/api/stores/:subdomain/related-products/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(relatedProductUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.relatedProduct.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "RELATION_NOT_FOUND", "Relation not found.");
    const b = req.body;
    const relation = await prisma.relatedProduct.update({
      where: { id: existing.id },
      data: {
        ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
        ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
      },
      include: { product: productMini, relatedProduct: productMini },
    });
    res.json({ relation });
  })
);

growthRouter.delete(
  "/api/stores/:subdomain/related-products/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.relatedProduct.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "RELATION_NOT_FOUND", "Relation not found.");
    await prisma.relatedProduct.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);
