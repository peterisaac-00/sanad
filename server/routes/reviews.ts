import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  idParamSchema,
  reviewUpdateSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../validate.js";
import { z } from "zod";
import { writeAudit } from "../services/account.js";

export const reviewsRouter = Router();

const listQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  reported: z.enum(["true", "false"]).optional(),
  search: z.string().trim().max(100).optional(),
});

reviewsRouter.get(
  "/api/stores/:subdomain/reviews",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const { page, pageSize, status, rating, reported, search } = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: string;
      rating?: number;
      reported?: string;
      search?: string;
    };
    const where: Prisma.ReviewWhereInput = { storeId: req.ownedStore!.id };
    if (status) where.status = status;
    if (rating) where.rating = rating;
    if (reported) where.reported = reported === "true";
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { content: { contains: search } },
      ];
    }
    const [total, reviews, aggregate] = await prisma.$transaction([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { product: { select: { id: true, nameAr: true, nameEn: true, images: { take: 1 } } } },
      }),
      prisma.review.aggregate({ where: { storeId: req.ownedStore!.id, status: "approved" }, _avg: { rating: true }, _count: { _all: true } }),
    ]);
    res.json({
      reviews,
      summary: {
        averageRating: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
        approvedCount: aggregate._count._all,
      },
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  })
);

reviewsRouter.patch(
  "/api/stores/:subdomain/reviews/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(reviewUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.review.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
    const b = req.body;
    const review = await prisma.review.update({
      where: { id: existing.id },
      data: {
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.merchantReply !== undefined ? { merchantReply: b.merchantReply } : {}),
        ...(b.reported !== undefined ? { reported: b.reported } : {}),
      },
    });
    await writeAudit({
      storeId,
      merchantId: req.auth!.merchantId,
      action: "review.updated",
      entity: "review",
      entityId: review.id,
      metadata: { status: review.status },
      ip: req.ip,
    });
    res.json({ review });
  })
);

reviewsRouter.delete(
  "/api/stores/:subdomain/reviews/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.review.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
    await prisma.review.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);
