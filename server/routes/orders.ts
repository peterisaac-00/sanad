import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  bulkOrderStatusSchema,
  childIdParamSchema,
  idParamSchema,
  merchantOrderBodySchema,
  orderListQuerySchema,
  orderNoteSchema,
  orderPaymentStatusSchema,
  orderStatusSchema,
  refundProcessSchema,
  refundSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../validate.js";
import {
  ORDER_DETAIL_INCLUDE,
  addOrderEvent,
  allocateOrderNumber,
  applyOrderStatus,
  bulkOrderStatus,
  ordersToCsv,
} from "../services/orders.js";
import { createNotification, writeAudit } from "../services/account.js";

export const ordersRouter = Router();

function isoRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  return range;
}

async function scopedOrder(storeId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: ORDER_DETAIL_INCLUDE,
  });
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  return order;
}

// IMPORTANT: static routes must precede /orders/:id.
ordersRouter.get(
  "/api/stores/:subdomain/orders/export",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateQuery(orderListQuerySchema),
  asyncHandler(async (req, res) => {
    const { status, paymentStatus, paymentMethod, governorate, from, to, search } = req.query as unknown as {
      status?: string;
      paymentStatus?: string;
      paymentMethod?: string;
      governorate?: string;
      from?: string;
      to?: string;
      search?: string;
    };
    const where: Prisma.OrderWhereInput = { storeId: req.ownedStore!.id };
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (governorate) where.governorate = governorate;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
        { itemsSummary: { contains: search } },
      ];
    }
    const range = isoRange(from, to);
    if (range) where.createdAt = range;
    const rows = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 10000 });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="orders-${Date.now()}.csv"`);
    // UTF-8 BOM so Excel opens Arabic text correctly.
    res.send("\uFEFF" + ordersToCsv(rows as unknown as Array<Record<string, unknown>>));
  })
);

ordersRouter.patch(
  "/api/stores/:subdomain/orders/bulk-status",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(bulkOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const { ids, status } = req.body as { ids: string[]; status: string };
    const results = await bulkOrderStatus({
      storeId: req.ownedStore!.id,
      ids,
      target: status,
      actor: req.auth!.email,
    });
    await writeAudit({
      storeId: req.ownedStore!.id,
      merchantId: req.auth!.merchantId,
      action: "order.bulk_status",
      entity: "order",
      metadata: { status, ids, results },
      ip: req.ip,
    });
    res.json({ results });
  })
);

ordersRouter.get(
  "/api/stores/:subdomain/orders",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateQuery(orderListQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, status, paymentStatus, paymentMethod, governorate, from, to, search } =
      req.query as unknown as {
        page: number;
        pageSize: number;
        status?: string;
        paymentStatus?: string;
        paymentMethod?: string;
        governorate?: string;
        from?: string;
        to?: string;
        search?: string;
      };
    const where: Prisma.OrderWhereInput = { storeId: req.ownedStore!.id };
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (governorate) where.governorate = governorate;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
        { itemsSummary: { contains: search } },
      ];
    }
    const range = isoRange(from, to);
    if (range) where.createdAt = range;
    const [total, rows, counts] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true, customer: true },
      }),
      prisma.order.groupBy({ by: ["status"], where: { storeId: req.ownedStore!.id }, _count: { _all: true } }),
    ]);
    res.json({
      orders: rows,
      status_counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  })
);

ordersRouter.get(
  "/api/stores/:subdomain/orders/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const order = await scopedOrder(req.ownedStore!.id, req.params.id);
    res.json({ order });
  })
);

ordersRouter.get(
  "/api/stores/:subdomain/orders/:id/timeline",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const order = await scopedOrder(req.ownedStore!.id, req.params.id);
    res.json({ events: order.events });
  })
);

ordersRouter.patch(
  "/api/stores/:subdomain/orders/:id/status",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(orderStatusSchema),
  asyncHandler(async (req, res) => {
    const target = req.body.status as string;
    const order = await applyOrderStatus({
      storeId: req.ownedStore!.id,
      orderId: req.params.id,
      target,
      actor: req.auth!.email,
    });
    await writeAudit({
      storeId: req.ownedStore!.id,
      merchantId: req.auth!.merchantId,
      action: "order.status_changed",
      entity: "order",
      entityId: req.params.id,
      metadata: { status: target },
      ip: req.ip,
    });
    res.json({ order });
  })
);

ordersRouter.patch(
  "/api/stores/:subdomain/orders/:id/payment-status",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(orderPaymentStatusSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const current = await scopedOrder(storeId, req.params.id);
    const paymentStatus = req.body.paymentStatus as string;
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { currency: true } });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: current.id }, data: { paymentStatus } });
      if (paymentStatus === "paid") {
        await tx.payment.create({
          data: {
            id: newId("pay_"),
            storeId,
            orderId: current.id,
            provider: "manual",
            amount: current.amountEgp,
            currency: store?.currency ?? "EGP",
            status: "succeeded",
            method: current.paymentMethod,
          },
        });
      }
      await addOrderEvent(tx, {
        storeId,
        orderId: current.id,
        type: "payment_status_changed",
        message: `حالة الدفع: ${paymentStatus}`,
        actor: req.auth!.email,
        metadata: { from: current.paymentStatus, to: paymentStatus },
      });
      return tx.order.findUnique({ where: { id: current.id }, include: ORDER_DETAIL_INCLUDE });
    });
    await writeAudit({
      storeId,
      merchantId: req.auth!.merchantId,
      action: "order.payment_status_changed",
      entity: "order",
      entityId: current.id,
      metadata: { paymentStatus },
      ip: req.ip,
    });
    res.json({ order: updated });
  })
);

ordersRouter.post(
  "/api/stores/:subdomain/orders/:id/notes",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(orderNoteSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const order = await scopedOrder(storeId, req.params.id);
    const { note, internal } = req.body as { note: string; internal: boolean };
    const event = await prisma.$transaction(async (tx) => {
      if (internal) {
        await tx.order.update({
          where: { id: order.id },
          data: { internalNotes: [order.internalNotes, note].filter(Boolean).join("\n").slice(-4000) },
        });
      }
      const created = await tx.orderEvent.create({
        data: {
          id: newId("evt_"),
          storeId,
          orderId: order.id,
          type: "note",
          message: note,
          actor: req.auth!.email,
          metadata: { internal } as Prisma.InputJsonValue,
        },
      });
      return created;
    });
    res.status(201).json({ event });
  })
);

ordersRouter.get(
  "/api/stores/:subdomain/orders/:id/refunds",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const order = await scopedOrder(req.ownedStore!.id, req.params.id);
    res.json({ refunds: order.refunds });
  })
);

ordersRouter.post(
  "/api/stores/:subdomain/orders/:id/refunds",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(refundSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const order = await scopedOrder(storeId, req.params.id);
    const { amount, reason } = req.body as { amount: number; reason: string };
    const reserved = order.refunds
      .filter((r) => r.status !== "cancelled")
      .reduce((sum, r) => sum + r.amount, 0);
    if (reserved + amount > order.amountEgp + 0.001) {
      throw new ApiError(400, "REFUND_EXCEEDS_ORDER", "Refund total cannot exceed the order amount.");
    }
    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: { id: newId("rfd_"), storeId, orderId: order.id, amount, reason, status: "pending" },
      });
      await addOrderEvent(tx, {
        storeId,
        orderId: order.id,
        type: "refund_requested",
        message: `طلب استرداد بمبلغ ${amount}`,
        actor: req.auth!.email,
        metadata: { refundId: created.id, amount, reason },
      });
      return created;
    });
    await writeAudit({
      storeId,
      merchantId: req.auth!.merchantId,
      action: "order.refund_requested",
      entity: "refund",
      entityId: refund.id,
      metadata: { orderId: order.id, amount },
      ip: req.ip,
    });
    res.status(201).json({ refund });
  })
);

ordersRouter.patch(
  "/api/stores/:subdomain/orders/:id/refunds/:childId",
  asyncHandler(requireAuth),
  validateParams(childIdParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(refundProcessSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const order = await scopedOrder(storeId, req.params.id);
    const refund = order.refunds.find((r) => r.id === req.params.childId);
    if (!refund) throw new ApiError(404, "REFUND_NOT_FOUND", "Refund not found.");
    if (refund.status !== "pending") throw new ApiError(409, "REFUND_ALREADY_FINAL", "Refund was already finalised.");
    const status = req.body.status as "processed" | "cancelled";
    if (status === "processed" && !["paid", "partially_refunded"].includes(order.paymentStatus)) {
      throw new ApiError(409, "REFUND_REQUIRES_PAYMENT", "Mark the order as paid before processing a refund.");
    }
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.refund.update({
        where: { id: refund.id },
        data: { status, processedAt: status === "processed" ? new Date() : null },
      });
      if (status === "processed") {
        const processedTotal = order.refunds
          .filter((r) => r.status === "processed" || r.id === refund.id)
          .reduce((sum, r) => sum + r.amount, 0);
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: processedTotal >= order.amountEgp - 0.001 ? "refunded" : "partially_refunded" },
        });
      }
      await addOrderEvent(tx, {
        storeId,
        orderId: order.id,
        type: "refund_" + status,
        message: status === "processed" ? "تم تنفيذ الاسترداد" : "تم إلغاء طلب الاسترداد",
        actor: req.auth!.email,
        metadata: { refundId: refund.id },
      });
      return row;
    });
    res.json({ refund: updated });
  })
);

ordersRouter.post(
  "/api/stores/:subdomain/orders",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(merchantOrderBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body as {
      customer_name: string;
      customer_phone: string;
      customer_email: string;
      address: string;
      city: string;
      governorate: string;
      items_summary: string;
      amount_text: string;
      amount_egp: number;
      payment_method: string;
      status: string;
      courier: string;
      notes: string;
      internal_notes: string;
    };
    const orderNumber = await allocateOrderNumber(storeId);
    try {
      const order = await prisma.$transaction(async (tx) => {
        let customerId: string | null = null;
        if (b.customer_phone || b.customer_email) {
          const existing = await tx.customer.findFirst({
            where: {
              storeId,
              ...(b.customer_phone ? { phone: b.customer_phone } : { email: b.customer_email }),
            },
          });
          const customer = existing
            ? await tx.customer.update({
                where: { id: existing.id },
                data: { name: b.customer_name || existing.name },
              })
            : await tx.customer.create({
                data: {
                  id: newId("cus_"),
                  storeId,
                  name: b.customer_name,
                  phone: b.customer_phone,
                  email: b.customer_email,
                },
              });
          customerId = customer.id;
        }
        const created = await tx.order.create({
          data: {
            id: newId("ord_"),
            storeId,
            orderNumber,
            customerId,
            customerName: b.customer_name,
            customerPhone: b.customer_phone,
            customerEmail: b.customer_email,
            address: b.address,
            city: b.city,
            governorate: b.governorate,
            itemsSummary: b.items_summary,
            amountText: b.amount_text,
            amountEgp: b.amount_egp,
            subtotal: b.amount_egp,
            paymentMethod: b.payment_method,
            status: b.status,
            courier: b.courier,
            notes: b.notes,
            internalNotes: b.internal_notes,
          },
        });
        await addOrderEvent(tx, {
          storeId,
          orderId: created.id,
          type: "created",
          message: "تم إنشاء الطلب يدوياً من لوحة التحكم",
          actor: req.auth!.email,
        });
        return tx.order.findUnique({ where: { id: created.id }, include: ORDER_DETAIL_INCLUDE });
      });
      await createNotification({
        storeId,
        merchantId: req.auth!.merchantId,
        type: "order",
        title: "طلب جديد",
        body: `تم إنشاء طلب يدوي رقم SND-${orderNumber}`,
        link: "/dashboard/orders",
      });
      res.status(201).json({ order });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "ORDER_CONFLICT", "Order number collision, please retry.");
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
      }
      throw e;
    }
  })
);
