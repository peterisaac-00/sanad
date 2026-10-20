import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  abandonedCartUpdateSchema,
  idParamSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../validate.js";
import { whatsappService } from "../services/integrations.js";

export const abandonedRouter = Router();

const listQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["open", "reminded", "recovered", "ignored"]).optional(),
  search: z.string().trim().max(100).optional(),
});

abandonedRouter.get(
  "/api/stores/:subdomain/abandoned-carts",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const { page, pageSize, status, search } = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: string;
      search?: string;
    };
    const storeId = req.ownedStore!.id;
    const where = {
      storeId,
      ...(status ? { recoveryStatus: status } : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, carts, open, recovered] = await prisma.$transaction([
      prisma.abandonedCart.count({ where }),
      prisma.abandonedCart.findMany({
        where,
        orderBy: { lastActivityAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: { select: { id: true, name: true, phone: true } } },
      }),
      prisma.abandonedCart.aggregate({ where: { storeId, recoveryStatus: "open" }, _sum: { cartValue: true }, _count: { _all: true } }),
      prisma.abandonedCart.count({ where: { storeId, recoveryStatus: "recovered" } }),
    ]);
    res.json({
      carts,
      summary: {
        openCount: open._count._all,
        openValue: open._sum.cartValue ?? 0,
        recoveredCount: recovered,
      },
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  })
);

abandonedRouter.patch(
  "/api/stores/:subdomain/abandoned-carts/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(abandonedCartUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.abandonedCart.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "CART_NOT_FOUND", "Abandoned cart not found.");
    const cart = await prisma.abandonedCart.update({
      where: { id: existing.id },
      data: { recoveryStatus: req.body.recoveryStatus },
    });
    res.json({ cart });
  })
);

abandonedRouter.post(
  "/api/stores/:subdomain/abandoned-carts/:id/remind",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const cart = await prisma.abandonedCart.findFirst({ where: { id: req.params.id, storeId } });
    if (!cart) throw new ApiError(404, "CART_NOT_FOUND", "Abandoned cart not found.");
    if (!cart.phone) throw new ApiError(400, "CART_PHONE_MISSING", "This cart has no phone number to message.");
    const message = `مرحباً ${cart.customerName || ""}، تركت منتجات في سلتك. أكمل طلبك من متجرنا.`;
    const sendResult = await whatsappService.send(cart.phone, message);
    if (sendResult.sent) {
      const updated = await prisma.abandonedCart.update({
        where: { id: cart.id },
        data: { recoveryStatus: "reminded", remindedAt: new Date() },
      });
      res.json({ sent: true, cart: updated });
      return;
    }
    res.json({
      sent: false,
      reason: sendResult.reason,
      cart,
      whatsapp_url: whatsappService.link(cart.phone, message),
      note: "الإرسال التلقائي عبر واتساب غير مهيأ. استخدم الرابط لفتح المحادثة وإرسال الرسالة يدوياً.",
    });
  })
);

abandonedRouter.delete(
  "/api/stores/:subdomain/abandoned-carts/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.abandonedCart.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "CART_NOT_FOUND", "Abandoned cart not found.");
    await prisma.abandonedCart.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);
