import { Router } from "express";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  dropshipProductBodySchema,
  dropshipProductUpdateSchema,
  idParamSchema,
  subdomainParamSchema,
  supplierBodySchema,
  supplierUpdateSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { auditActor, writeAudit } from "../services/account.js";
import { integrationStatus } from "../services/integrations.js";

export const dropshippingRouter = Router();

dropshippingRouter.get(
  "/api/stores/:subdomain/dropshipping",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const [suppliers, products] = await prisma.$transaction([
      prisma.supplier.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } }),
      prisma.dropshipProduct.findMany({
        where: { storeId },
        orderBy: { updatedAt: "desc" },
        include: {
          product: { select: { id: true, sku: true, nameAr: true, nameEn: true, basePrice: true, stock: true } },
          supplier: { select: { id: true, name: true, status: true } },
        },
      }),
    ]);
    res.json({
      suppliers,
      products,
      integrations: integrationStatus(),
      note: "ربط الموردين الآلي غير مفعّل. يمكنك إدارة الموردين وبيانات الدروبشيبينغ يدوياً؛ لن يتم إنشاء حالات شحن وهمية.",
    });
  })
);

dropshippingRouter.post(
  "/api/stores/:subdomain/suppliers",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(supplierBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    const supplier = await prisma.supplier.create({
      data: {
        id: newId("sup_"),
        storeId,
        name: b.name,
        contactName: b.contactName,
        email: b.email,
        phone: b.phone,
        integrationKey: b.integrationKey ?? null,
        status: b.status,
        notes: b.notes,
      },
    });
    res.status(201).json({ supplier });
  })
);

dropshippingRouter.patch(
  "/api/stores/:subdomain/suppliers/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(supplierUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    const b = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.contactName !== undefined ? { contactName: b.contactName } : {}),
        ...(b.email !== undefined ? { email: b.email } : {}),
        ...(b.phone !== undefined ? { phone: b.phone } : {}),
        ...(b.integrationKey !== undefined ? { integrationKey: b.integrationKey } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.notes !== undefined ? { notes: b.notes } : {}),
      },
    });
    res.json({ supplier });
  })
);

dropshippingRouter.delete(
  "/api/stores/:subdomain/suppliers/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    await prisma.supplier.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);

dropshippingRouter.post(
  "/api/stores/:subdomain/dropship-products",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(dropshipProductBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    const [product, supplier] = await Promise.all([
      prisma.product.findFirst({ where: { id: b.productId, storeId }, select: { id: true } }),
      prisma.supplier.findFirst({ where: { id: b.supplierId, storeId }, select: { id: true } }),
    ]);
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    if (!supplier) throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    const existing = await prisma.dropshipProduct.findUnique({ where: { storeId_productId: { storeId, productId: b.productId } } });
    if (existing) throw new ApiError(409, "DROPSHIP_EXISTS", "This product is already linked to a supplier.");
    const dropship = await prisma.dropshipProduct.create({
      data: {
        id: newId("dsp_"),
        storeId,
        productId: b.productId,
        supplierId: b.supplierId,
        costPrice: b.costPrice,
        suggestedPrice: b.suggestedPrice,
        fulfillmentStatus: b.fulfillmentStatus,
      },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "dropship.created",
      entity: "dropship_product",
      entityId: dropship.id,
      ip: req.ip,
    });
    res.status(201).json({ dropship });
  })
);

dropshippingRouter.patch(
  "/api/stores/:subdomain/dropship-products/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(dropshipProductUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.dropshipProduct.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "DROPSHIP_NOT_FOUND", "Dropship product not found.");
    const b = req.body;
    if (b.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: b.supplierId, storeId }, select: { id: true } });
      if (!supplier) throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
    }
    const dropship = await prisma.dropshipProduct.update({
      where: { id: existing.id },
      data: {
        ...(b.supplierId !== undefined ? { supplierId: b.supplierId } : {}),
        ...(b.costPrice !== undefined ? { costPrice: b.costPrice } : {}),
        ...(b.suggestedPrice !== undefined ? { suggestedPrice: b.suggestedPrice } : {}),
        ...(b.fulfillmentStatus !== undefined ? { fulfillmentStatus: b.fulfillmentStatus } : {}),
      },
    });
    res.json({ dropship });
  })
);

dropshippingRouter.delete(
  "/api/stores/:subdomain/dropship-products/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.dropshipProduct.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "DROPSHIP_NOT_FOUND", "Dropship product not found.");
    await prisma.dropshipProduct.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);
