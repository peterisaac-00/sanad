import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { exportLimiter, requireAuth, requireExportRole, requireStoreOwnership } from "../middleware.js";
import {
  bulkOrderStatusSchema,
  childIdParamSchema,
  idParamSchema,
  merchantOrderBodySchema,
  orderListQuerySchema,
  orderNoteSchema,
  orderPaymentStatusSchema,
  orderStatusSchema,
  PAYMENT_TRANSITIONS,
  refundProcessSchema,
  refundSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../validate.js";
import { customerIdentity, normalizePhone } from "../identity.js";
import {
  ORDER_DETAIL_INCLUDE,
  ORDER_EXPORT_COLUMNS,
  addOrderEvent,
  allocateOrderNumber,
  applyOrderStatus,
  bulkOrderStatus,
  orderExportRow,
} from "../services/orders.js";
import { auditActor, createNotification, writeAudit } from "../services/account.js";
import { assertExportWithinLimit, CSV_BOM, csvHeader } from "../services/csv.js";
import { env } from "../env.js";
import { logger } from "../logger.js";

export const ordersRouter = Router();

function isoRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  return range;
}

interface OrderFilters {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  governorate?: string;
  from?: string;
  to?: string;
  search?: string;
}

/**
 * One source of truth for list, export and status counters. Counters are
 * computed with every filter EXCEPT status so the pills can be used to switch
 * between statuses without showing stale store-wide totals.
 */
function orderWhere(storeId: string, filters: OrderFilters, includeStatus = true): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { storeId };
  if (includeStatus && filters.status) where.status = filters.status;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
  if (filters.governorate) where.governorate = filters.governorate;
  if (filters.search) {
    where.OR = [
      { customerName: { contains: filters.search, mode: "insensitive" } },
      { customerPhone: { contains: filters.search } },
      { itemsSummary: { contains: filters.search } },
    ];
  }
  const range = isoRange(filters.from, filters.to);
  if (range) where.createdAt = range;
  return where;
}

async function scopedOrder(storeId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: ORDER_DETAIL_INCLUDE,
  });
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  return order;
}

/** Serialise money mutations (refunds, payment status) for one order. */
async function lockOrder(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`order:${orderId}`}, 0))`;
}

// IMPORTANT: static routes must precede /orders/:id.
ordersRouter.get(
  "/api/stores/:subdomain/orders/export",
  asyncHandler(requireAuth),
  exportLimiter,
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  requireExportRole,
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
    const storeId = req.ownedStore!.id;
    const where = orderWhere(storeId, {
      status,
      paymentStatus,
      paymentMethod,
      governorate,
      from,
      to,
      search,
    });
    const total = await prisma.order.count({ where });
    // Validate before streaming: once headers are sent a JSON 413 is impossible.
    assertExportWithinLimit(total, env.exportMaxRows);

    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "order.exported",
      entity: "order",
      metadata: {
        format: "csv",
        rows: total,
        filters: { status, paymentStatus, paymentMethod, governorate, from, to, search },
      },
      ip: req.ip,
    });

    const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.write(CSV_BOM + csvHeader([...ORDER_EXPORT_COLUMNS]) + "\n");

    const select = {
      id: true,
      orderNumber: true,
      source: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      governorate: true,
      city: true,
      address: true,
      subtotal: true,
      discount: true,
      shippingFee: true,
      amountEgp: true,
      couponCode: true,
      itemsSummary: true,
    } satisfies Prisma.OrderSelect;

    let cursor: string | undefined;
    let written = 0;
    try {
      for (;;) {
        const rows = await prisma.order.findMany({
          where,
          select,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (rows.length === 0) break;
        for (const row of rows) {
          const { id, ...values } = row;
          res.write(orderExportRow(values as unknown as Record<string, unknown>) + "\n");
          written++;
          if (written > env.exportMaxRows) {
            throw new ApiError(413, "EXPORT_TOO_LARGE", "The export grew beyond the configured row limit while streaming.");
          }
        }
        cursor = rows[rows.length - 1].id;
        if (rows.length < 500) break;
      }
      res.end();
    } catch (err) {
      // The client already owns a partial file; never append JSON to it.
      logger.error({ err, storeId, written }, "order export stream failed");
      res.destroy();
    }
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
      ...auditActor(req.auth!),
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
    const filters: OrderFilters = { status, paymentStatus, paymentMethod, governorate, from, to, search };
    const where = orderWhere(req.ownedStore!.id, filters);
    const countsWhere = orderWhere(req.ownedStore!.id, filters, false);
    const [total, rows, counts] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true, customer: true },
      }),
      prisma.order.groupBy({ by: ["status"], where: countsWhere, _count: { _all: true } }),
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
      ...auditActor(req.auth!),
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
    const paymentStatus = req.body.paymentStatus as string;
    const existing = await scopedOrder(storeId, req.params.id);
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { currency: true } });

    const updated = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, existing.id);
      const current = await tx.order.findFirst({ where: { id: existing.id, storeId } });
      if (!current) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");

      // A retry that asks for the current status is a no-op, not a duplicate
      // payment ledger entry.
      if (current.paymentStatus === paymentStatus) {
        return tx.order.findUnique({ where: { id: current.id }, include: ORDER_DETAIL_INCLUDE });
      }
      const allowed = PAYMENT_TRANSITIONS[current.paymentStatus] ?? [];
      if (!allowed.includes(paymentStatus)) {
        throw new ApiError(
          409,
          "INVALID_PAYMENT_TRANSITION",
          `Cannot move payment from '${current.paymentStatus}' to '${paymentStatus}'.`
        );
      }

      if (paymentStatus === "paid") {
        // Reuse the pending COD/provider payment when present; otherwise
        // create one manual ledger entry. Never create a second succeeded
        // payment for the same order.
        const succeeded = await tx.payment.findFirst({
          where: { orderId: current.id, status: "succeeded" },
          select: { id: true },
        });
        if (!succeeded) {
          const pending = await tx.payment.findFirst({
            where: { orderId: current.id, status: "pending" },
            orderBy: { createdAt: "desc" },
          });
          if (pending) {
            await tx.payment.update({
              where: { id: pending.id },
              data: { status: "succeeded", providerRef: pending.providerRef || `manual:${req.auth!.actorId}` },
            });
          } else {
            await tx.payment.create({
              data: {
                id: newId("pay_"),
                storeId,
                orderId: current.id,
                provider: "manual",
                providerRef: `manual:${req.auth!.actorId}`,
                amount: current.amountEgp,
                currency: store?.currency ?? "EGP",
                status: "succeeded",
                method: current.paymentMethod,
              },
            });
          }
        }
      }
      if (paymentStatus === "failed") {
        await tx.payment.updateMany({
          where: { orderId: current.id, status: "pending" },
          data: { status: "failed" },
        });
      }

      await tx.order.update({ where: { id: current.id }, data: { paymentStatus } });
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
      ...auditActor(req.auth!),
      action: "order.payment_status_changed",
      entity: "order",
      entityId: existing.id,
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
    const refund = await prisma.$transaction(async (tx) => {
      // The aggregate + insert must be atomic; otherwise two concurrent
      // requests can both observe the same old total and over-refund.
      await lockOrder(tx, order.id);
      const fresh = await tx.order.findFirst({
        where: { id: order.id, storeId },
        select: { id: true, amountEgp: true },
      });
      if (!fresh) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
      const reservedAgg = await tx.refund.aggregate({
        where: { orderId: order.id, status: { not: "cancelled" } },
        _sum: { amount: true },
      });
      const reserved = reservedAgg._sum.amount ?? 0;
      if (reserved + amount > fresh.amountEgp + 0.001) {
        throw new ApiError(400, "REFUND_EXCEEDS_ORDER", "Refund total cannot exceed the order amount.");
      }
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
      ...auditActor(req.auth!),
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
    const status = req.body.status as "processed" | "cancelled";
    const updated = await prisma.$transaction(async (tx) => {
      // Serialise with other refund / payment mutations on this order, then
      // read the child row and payment state from inside the lock. Using the
      // pre-transaction snapshot would let a concurrent request finalise the
      // same refund twice or compute a stale processed total.
      await lockOrder(tx, order.id);
      const refund = await tx.refund.findFirst({
        where: { id: req.params.childId, orderId: order.id, storeId },
      });
      if (!refund) throw new ApiError(404, "REFUND_NOT_FOUND", "Refund not found.");
      if (refund.status !== "pending") {
        throw new ApiError(409, "REFUND_ALREADY_FINAL", "Refund was already finalised.");
      }
      const current = await tx.order.findFirst({
        where: { id: order.id, storeId },
        select: { id: true, amountEgp: true, paymentStatus: true },
      });
      if (!current) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
      if (status === "processed" && !["paid", "partially_refunded"].includes(current.paymentStatus)) {
        throw new ApiError(409, "REFUND_REQUIRES_PAYMENT", "Mark the order as paid before processing a refund.");
      }
      const row = await tx.refund.update({
        where: { id: refund.id },
        data: { status, processedAt: status === "processed" ? new Date() : null },
      });
      if (status === "processed") {
        const processedAgg = await tx.refund.aggregate({
          where: { orderId: current.id, status: "processed" },
          _sum: { amount: true },
        });
        const processedTotal = processedAgg._sum.amount ?? 0;
        await tx.order.update({
          where: { id: current.id },
          data: { paymentStatus: processedTotal >= current.amountEgp - 0.001 ? "refunded" : "partially_refunded" },
        });
      }
      await addOrderEvent(tx, {
        storeId,
        orderId: current.id,
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
    const phone = normalizePhone(b.customer_phone);
    const email = String(b.customer_email ?? "").trim().toLowerCase();
    const identity = customerIdentity({ phone, email });
    try {
      const order = await prisma.$transaction(async (tx) => {
        // Serialise customer upserts with storefront checkout so a manual
        // order and a simultaneous online order cannot create two rows for
        // the same shopper.
        if (identity) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer:${storeId}:${identity}`}, 0))`;
        }
        let customerId: string | null = null;
        if (phone || email) {
          const identityFilters: Prisma.CustomerWhereInput[] = [];
          if (phone) identityFilters.push({ phone });
          if (email) identityFilters.push({ email });
          const existing = await tx.customer.findFirst({
            where: { storeId, OR: identityFilters },
          });
          const customer = existing
            ? await tx.customer.update({
                where: { id: existing.id },
                data: {
                  name: b.customer_name || existing.name,
                  ...(email && !existing.email ? { email } : {}),
                  ...(phone && !existing.phone ? { phone } : {}),
                },
              })
            : await tx.customer.create({
                data: {
                  id: newId("cus_"),
                  storeId,
                  name: b.customer_name,
                  phone,
                  email,
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
            customerPhone: phone,
            customerEmail: email,
            address: b.address,
            city: b.city,
            governorate: b.governorate,
            itemsSummary: b.items_summary,
            amountText: b.amount_text.trim() || (b.amount_egp ? `${b.amount_egp} ${req.ownedStore!.currency}` : ""),
            amountEgp: b.amount_egp,
            subtotal: b.amount_egp,
            paymentMethod: b.payment_method,
            // External/manual record: it never reserves stock and has no
            // OrderItem rows or server-calculated gross/discount/shipping split.
            source: "manual",
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
        ...auditActor(req.auth!),
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
