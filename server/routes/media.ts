import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../errors.js";
import { ApiError } from "../errors.js";
import { mediaLimiter, requireAuth, requireStorePermission } from "../middleware.js";
import { validateBody } from "../validate.js";
import { storeMedia } from "../services/media.js";
import { prisma } from "../db.js";

export const mediaRouter = Router();

const mediaBodySchema = z.strictObject({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(3).max(100),
  dataBase64: z.string().min(10).max(12_000_000),
});

mediaRouter.post(
  "/",
  asyncHandler(requireAuth),
  asyncHandler(requireStorePermission("operations.write")),
  mediaLimiter,
  validateBody(mediaBodySchema),
  asyncHandler(async (req, res) => {
    if (!req.auth!.storeId) throw new ApiError(404, "STORE_NOT_FOUND", "No store linked to this account.");
    const { fileName, mimeType, dataBase64 } = req.body;
    const result = await storeMedia({ storeId: req.auth!.storeId, fileName, mimeType, dataBase64 });
    res.status(201).json(result);
  })
);

mediaRouter.get(
  "/",
  asyncHandler(requireAuth),
  asyncHandler(requireStorePermission("store.read")),
  asyncHandler(async (req, res) => {
    if (!req.auth!.storeId) throw new ApiError(404, "STORE_NOT_FOUND", "No store linked to this account.");
    const media = await prisma.mediaAsset.findMany({
      where: { storeId: req.auth!.storeId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ media });
  })
);
