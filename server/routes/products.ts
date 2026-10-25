import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  idParamSchema,
  productBodySchema,
  productIdParamSchema,
  productListQuerySchema,
  productUpdateSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../validate.js";
import { auditActor, slugify, writeAudit } from "../services/account.js";

export const productsRouter = Router();

const include = {
  category: true,
  images: { orderBy: { sortOrder: "asc" as const } },
  options: { orderBy: { position: "asc" as const }, include: { values: { orderBy: { position: "asc" as const } } } },
  variants: { orderBy: { sku: "asc" as const } },
};

async function uniqueProductSlug(storeId: string, raw: string): Promise<string> {
  const base = slugify(raw) || "product";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const found = await prisma.product.findFirst({ where: { storeId, slug: candidate }, select: { id: true } });
    if (!found) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function validateCategory(storeId: string, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const category = await prisma.category.findFirst({ where: { id: categoryId, storeId }, select: { id: true } });
  if (!category) throw new ApiError(400, "CATEGORY_NOT_FOUND", "The selected category does not belong to this store.");
}

function mapPrices(body: Record<string, unknown>, storeCurrency: string) {
  const base = body.basePrice as number | undefined;
  let priceEgp = body.price_egp as number | undefined;
  let priceSar = body.price_sar as number | undefined;
  if (base !== undefined) {
    if (storeCurrency === "EGP") priceEgp = base;
    if (storeCurrency === "SAR") priceSar = base;
  }
  const fallback = base ?? (storeCurrency === "SAR" ? priceSar : priceEgp) ?? 0;
  return {
    priceEgp: priceEgp ?? 0,
    priceSar: priceSar ?? 0,
    basePrice: fallback,
  };
}

function names(body: Record<string, unknown>) {
  const nameAr = (body.nameAr ?? body.name_ar ?? "") as string;
  const nameEn = (body.nameEn ?? body.name_en ?? "") as string;
  return { nameAr, nameEn };
}

productsRouter.get(
  "/api/stores/:subdomain/products",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateQuery(productListQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search, categoryId, status, stock, sort } = req.query as unknown as {
      page: number;
      pageSize: number;
      search?: string;
      categoryId?: string;
      status?: string;
      stock?: string;
      sort?: string;
    };
    const storeId = req.ownedStore!.id;
    const where: Prisma.ProductWhereInput = { storeId };
    if (search) {
      where.OR = [
        { sku: { contains: search, mode: "insensitive" } },
        { nameEn: { contains: search, mode: "insensitive" } },
        { nameAr: { contains: search } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (stock === "out") where.stock = { lte: 0 };
    if (stock === "in") where.stock = { gt: 0 };
    if (stock === "low") where.AND = [{ stock: { gt: 0 } }, { stock: { lte: 5 } }];
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === "oldest" ? { createdAt: "asc" } :
      sort === "name" ? { nameAr: "asc" } :
      sort === "price_asc" ? { basePrice: "asc" } :
      sort === "price_desc" ? { basePrice: "desc" } :
      { createdAt: "desc" };
    const [total, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include,
      }),
    ]);
    res.json({ products, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  })
);

productsRouter.get(
  "/api/stores/:subdomain/products/:id",
  asyncHandler(requireAuth),
  validateParams(productIdParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, storeId: req.ownedStore!.id },
      include,
    });
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    res.json({ product });
  })
);

productsRouter.post(
  "/api/stores/:subdomain/products",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(productBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { currency: true } });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const b = req.body;
    await validateCategory(storeId, b.categoryId);
    const { nameAr, nameEn } = names(b);
    const prices = mapPrices(b, store.currency);
    const slugRaw = b.slug || nameAr || nameEn || b.sku;
    const slug = await uniqueProductSlug(storeId, slugRaw);
    try {
      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            id: newId("prod_"),
            storeId,
            categoryId: b.categoryId || null,
            sku: b.sku,
            slug,
            nameAr,
            nameEn,
            shortDescriptionAr: b.shortDescriptionAr ?? "",
            shortDescriptionEn: b.shortDescriptionEn ?? "",
            descriptionAr: b.descriptionAr ?? "",
            descriptionEn: b.descriptionEn ?? "",
            ...prices,
            compareAtPrice: b.compareAtPrice ?? null,
            costPrice: b.costPrice ?? null,
            stock: b.stock,
            lowStockThreshold: b.lowStockThreshold ?? 5,
            barcode: b.barcode ?? "",
            weight: b.weight ?? null,
            width: b.width ?? null,
            height: b.height ?? null,
            length: b.length ?? null,
            status: b.status ?? "active",
            isFeatured: b.isFeatured ?? false,
            seoTitle: b.seoTitle ?? "",
            seoDescription: b.seoDescription ?? "",
          },
        });
        if (b.images?.length) {
          await tx.productImage.createMany({
            data: b.images.map((img: { url: string; alt?: string; sortOrder?: number }, i: number) => ({
              id: newId("img_"),
              storeId,
              productId: created.id,
              url: img.url,
              alt: img.alt ?? "",
              sortOrder: img.sortOrder ?? i,
            })),
          });
        }
        for (const [oi, opt] of (b.options ?? []).entries()) {
          const option = await tx.productOption.create({
            data: {
              id: newId("opt_"),
              storeId,
              productId: created.id,
              name: opt.name,
              nameAr: opt.nameAr ?? "",
              position: opt.position ?? oi,
            },
          });
          if (opt.values?.length) {
            await tx.productOptionValue.createMany({
              data: opt.values.map((v: { value: string; valueAr?: string; position?: number }, vi: number) => ({
                id: newId("optv_"),
                storeId,
                optionId: option.id,
                value: v.value,
                valueAr: v.valueAr ?? "",
                position: v.position ?? vi,
              })),
            });
          }
        }
        if (b.variants?.length) {
          await tx.productVariant.createMany({
            data: b.variants.map((v: { sku: string; price: number; compareAtPrice?: number | null; stock: number; optionValues: Record<string, string>; imageUrl: string; isActive: boolean }) => ({
              id: newId("var_"),
              storeId,
              productId: created.id,
              sku: v.sku,
              price: v.price,
              compareAtPrice: v.compareAtPrice ?? null,
              stock: v.stock,
              optionValues: v.optionValues as Prisma.InputJsonValue,
              imageUrl: v.imageUrl,
              isActive: v.isActive,
            })),
          });
        }
        return tx.product.findUnique({ where: { id: created.id }, include });
      });
      await writeAudit({ storeId, ...auditActor(req.auth!), action: "product.created", entity: "product", entityId: product!.id, ip: req.ip });
      res.status(201).json({ product });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "SKU_TAKEN", "A product or variant with this SKU already exists in your store.");
      }
      throw e;
    }
  })
);

productsRouter.put(
  "/api/stores/:subdomain/products/:id",
  asyncHandler(requireAuth),
  validateParams(productIdParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { currency: true } });
    const b = req.body;
    await validateCategory(storeId, b.categoryId);
    const { nameAr, nameEn } = names(b);
    const hasBase = b.basePrice !== undefined || b.price_egp !== undefined || b.price_sar !== undefined;
    const prices = hasBase
      ? mapPrices({ ...b, basePrice: b.basePrice ?? (store?.currency === "SAR" ? b.price_sar : b.price_egp) }, store?.currency ?? "EGP")
      : {};
    try {
      const product = await prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id: existing.id },
          data: {
            ...(b.sku !== undefined ? { sku: b.sku } : {}),
            ...(b.slug !== undefined ? { slug: await uniqueProductSlug(storeId, b.slug) } : {}),
            ...(b.categoryId !== undefined ? { categoryId: b.categoryId || null } : {}),
            ...(nameAr ? { nameAr } : {}),
            ...(nameEn ? { nameEn } : {}),
            ...(b.shortDescriptionAr !== undefined ? { shortDescriptionAr: b.shortDescriptionAr } : {}),
            ...(b.shortDescriptionEn !== undefined ? { shortDescriptionEn: b.shortDescriptionEn } : {}),
            ...(b.descriptionAr !== undefined ? { descriptionAr: b.descriptionAr } : {}),
            ...(b.descriptionEn !== undefined ? { descriptionEn: b.descriptionEn } : {}),
            ...prices,
            ...(b.compareAtPrice !== undefined ? { compareAtPrice: b.compareAtPrice } : {}),
            ...(b.costPrice !== undefined ? { costPrice: b.costPrice } : {}),
            ...(b.stock !== undefined ? { stock: b.stock } : {}),
            ...(b.lowStockThreshold !== undefined ? { lowStockThreshold: b.lowStockThreshold } : {}),
            ...(b.barcode !== undefined ? { barcode: b.barcode } : {}),
            ...(b.weight !== undefined ? { weight: b.weight } : {}),
            ...(b.width !== undefined ? { width: b.width } : {}),
            ...(b.height !== undefined ? { height: b.height } : {}),
            ...(b.length !== undefined ? { length: b.length } : {}),
            ...(b.status !== undefined ? { status: b.status } : {}),
            ...(b.isFeatured !== undefined ? { isFeatured: b.isFeatured } : {}),
            ...(b.seoTitle !== undefined ? { seoTitle: b.seoTitle } : {}),
            ...(b.seoDescription !== undefined ? { seoDescription: b.seoDescription } : {}),
          },
        });
        if (b.images) {
          await tx.productImage.deleteMany({ where: { productId: updated.id, storeId } });
          if (b.images.length) {
            await tx.productImage.createMany({
              data: b.images.map((img: { url: string; alt?: string; sortOrder?: number }, i: number) => ({
                id: newId("img_"),
                storeId,
                productId: updated.id,
                url: img.url,
                alt: img.alt ?? "",
                sortOrder: img.sortOrder ?? i,
              })),
            });
          }
        }
        if (b.options) {
          await tx.productOption.deleteMany({ where: { productId: updated.id, storeId } });
          for (const [oi, opt] of b.options.entries()) {
            const option = await tx.productOption.create({
              data: {
                id: newId("opt_"),
                storeId,
                productId: updated.id,
                name: opt.name,
                nameAr: opt.nameAr ?? "",
                position: opt.position ?? oi,
              },
            });
            if (opt.values?.length) {
              await tx.productOptionValue.createMany({
                data: opt.values.map((v: { value: string; valueAr?: string; position?: number }, vi: number) => ({
                  id: newId("optv_"),
                  storeId,
                  optionId: option.id,
                  value: v.value,
                  valueAr: v.valueAr ?? "",
                  position: v.position ?? vi,
                })),
              });
            }
          }
        }
        if (b.variants) {
          await tx.productVariant.deleteMany({ where: { productId: updated.id, storeId } });
          if (b.variants.length) {
            await tx.productVariant.createMany({
              data: b.variants.map((v: { sku: string; price: number; compareAtPrice?: number | null; stock: number; optionValues: Record<string, string>; imageUrl: string; isActive: boolean }) => ({
                id: newId("var_"),
                storeId,
                productId: updated.id,
                sku: v.sku,
                price: v.price,
                compareAtPrice: v.compareAtPrice ?? null,
                stock: v.stock,
                optionValues: v.optionValues as Prisma.InputJsonValue,
                imageUrl: v.imageUrl,
                isActive: v.isActive,
              })),
            });
          }
        }
        return tx.product.findUnique({ where: { id: updated.id }, include });
      });
      await writeAudit({ storeId, ...auditActor(req.auth!), action: "product.updated", entity: "product", entityId: existing.id, ip: req.ip });
      res.json({ product });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "SKU_TAKEN", "A product or variant with this SKU already exists in your store.");
      }
      throw e;
    }
  })
);

productsRouter.delete(
  "/api/stores/:subdomain/products/:id",
  asyncHandler(requireAuth),
  validateParams(productIdParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    await prisma.product.delete({ where: { id: existing.id } });
    await writeAudit({ storeId, ...auditActor(req.auth!), action: "product.deleted", entity: "product", entityId: existing.id, ip: req.ip });
    res.json({ ok: true });
  })
);
