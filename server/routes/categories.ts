import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  categoryBodySchema,
  categoryUpdateSchema,
  idParamSchema,
  paginationQuerySchema,
  reorderSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../validate.js";
import { slugify, writeAudit } from "../services/account.js";

export const categoriesRouter = Router();

async function uniqueCategorySlug(storeId: string, raw: string, ignoreId?: string): Promise<string> {
  const base = slugify(raw) || "category";
  let candidate = base;
  for (let i = 0; i < 30; i++) {
    const found = await prisma.category.findUnique({ where: { storeId_slug: { storeId, slug: candidate } }, select: { id: true } });
    if (!found || found.id === ignoreId) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

categoriesRouter.get(
  "/api/stores/:subdomain/categories",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateQuery(paginationQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search } = req.query as unknown as { page: number; pageSize: number; search?: string };
    const where: Prisma.CategoryWhereInput = { storeId: req.ownedStore!.id };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { nameAr: { contains: search } },
        { nameEn: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }
    const [total, categories] = await prisma.$transaction([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { products: true } } },
      }),
    ]);
    res.json({ categories, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  })
);

categoriesRouter.post(
  "/api/stores/:subdomain/categories",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(categoryBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    const name = b.name || b.nameAr || b.nameEn;
    const slug = await uniqueCategorySlug(storeId, b.slug || name);
    const category = await prisma.category.create({
      data: {
        id: newId("cat_"),
        storeId,
        name,
        nameAr: b.nameAr || name,
        nameEn: b.nameEn || "",
        slug,
        description: b.description,
        imageUrl: b.imageUrl,
        sortOrder: b.sortOrder,
        isActive: b.isActive,
      },
    });
    await writeAudit({ storeId, merchantId: req.auth!.merchantId, action: "category.created", entity: "category", entityId: category.id, ip: req.ip });
    res.status(201).json({ category });
  })
);

// Reorder must be declared before the :id route or Express captures "reorder"
// as a category id.
categoriesRouter.patch(
  "/api/stores/:subdomain/categories/reorder",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const ids = req.body.ids as string[];
    const found = await prisma.category.findMany({ where: { storeId, id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) throw new ApiError(400, "INVALID_ORDER", "One or more categories do not belong to this store.");
    await prisma.$transaction(ids.map((id, index) => prisma.category.update({ where: { id }, data: { sortOrder: index } })));
    res.json({ ok: true });
  })
);

categoriesRouter.patch(
  "/api/stores/:subdomain/categories/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(categoryUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.category.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    const b = req.body;
    let slug = b.slug;
    if (slug !== undefined && slug !== existing.slug) slug = await uniqueCategorySlug(storeId, slug, existing.id);
    const category = await prisma.category.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.nameAr !== undefined ? { nameAr: b.nameAr } : {}),
        ...(b.nameEn !== undefined ? { nameEn: b.nameEn } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.imageUrl !== undefined ? { imageUrl: b.imageUrl } : {}),
        ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
        ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
      },
    });
    await writeAudit({ storeId, merchantId: req.auth!.merchantId, action: "category.updated", entity: "category", entityId: category.id, ip: req.ip });
    res.json({ category });
  })
);

categoriesRouter.delete(
  "/api/stores/:subdomain/categories/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.category.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    await prisma.category.delete({ where: { id: existing.id } });
    await writeAudit({ storeId, merchantId: req.auth!.merchantId, action: "category.deleted", entity: "category", entityId: existing.id, ip: req.ip });
    res.json({ ok: true });
  })
);

