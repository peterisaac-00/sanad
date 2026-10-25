import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError } from "../errors.js";
import { ORDER_TRANSITIONS } from "../validate.js";
import { csvHeader, csvRow } from "./csv.js";

/**
 * Order lifecycle shared by the merchant dashboard and the public storefront.
 * Status (fulfilment) and payment status are deliberately separate fields.
 */

export const ORDER_DETAIL_INCLUDE = {
  items: true,
  events: { orderBy: { createdAt: "desc" as const } },
  payments: { orderBy: { createdAt: "desc" as const } },
  refunds: { orderBy: { createdAt: "desc" as const } },
  customer: true,
} satisfies Prisma.OrderInclude;

/** Atomically allocate the next per-store order number (SND-{n} in the UI). */
export async function allocateOrderNumber(storeId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ nextOrderNumber: number }[]>`
    UPDATE "stores" SET "next_order_number" = "next_order_number" + 1
    WHERE "id" = ${storeId} RETURNING "next_order_number" AS "nextOrderNumber"`;
  if (rows.length !== 1 || typeof rows[0].nextOrderNumber !== "number") {
    throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  }
  return rows[0].nextOrderNumber;
}

/**
 * Loyalty is earned only when fulfilment reaches `delivered`. The order id is
 * stored on the ledger row (unique per account/order/type) so retries and
 * concurrent status updates can never double-grant or double-reverse points.
 */
async function grantLoyaltyForOrder(
  tx: Prisma.TransactionClient,
  order: { id: string; storeId: string; customerId: string | null; amountEgp: number; orderNumber: number }
) {
  if (!order.customerId) return;
  const alreadyEarned = await tx.loyaltyTransaction.findFirst({
    where: { orderId: order.id, type: "earn" },
    select: { id: true },
  });
  if (alreadyEarned) return;

  const rule = await tx.loyaltyRule.findFirst({
    where: { storeId: order.storeId, type: "earn", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!rule || order.amountEgp < rule.minOrderValue) return;
  const earned = Math.floor(order.amountEgp / Math.max(rule.perAmount, 0.01)) * rule.points;
  if (earned <= 0) return;

  const account = await tx.loyaltyAccount.upsert({
    where: { customerId: order.customerId },
    create: { id: newId("lac_"), storeId: order.storeId, customerId: order.customerId, points: 0 },
    update: {},
  });
  await tx.loyaltyTransaction.create({
    data: {
      id: newId("ltx_"),
      storeId: order.storeId,
      accountId: account.id,
      orderId: order.id,
      points: earned,
      type: "earn",
      note: `طلب SND-${order.orderNumber}`,
    },
  });
  await tx.loyaltyAccount.update({ where: { id: account.id }, data: { points: { increment: earned } } });
}

async function revokeLoyaltyForOrder(tx: Prisma.TransactionClient, orderId: string) {
  const earn = await tx.loyaltyTransaction.findFirst({
    where: { orderId, type: "earn" },
    select: { id: true, accountId: true, points: true, storeId: true },
  });
  if (!earn) return;
  const alreadyRevoked = await tx.loyaltyTransaction.findFirst({
    where: { orderId, type: "revoke" },
    select: { id: true },
  });
  if (alreadyRevoked) return;
  await tx.loyaltyTransaction.create({
    data: {
      id: newId("ltx_"),
      storeId: earn.storeId,
      accountId: earn.accountId,
      orderId,
      points: -earn.points,
      type: "revoke",
      note: "إلغاء/إرجاع الطلب",
    },
  });
  await tx.loyaltyAccount.update({
    where: { id: earn.accountId },
    data: { points: { decrement: earn.points } },
  });
}

export async function addOrderEvent(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    storeId: string;
    orderId: string;
    type: string;
    message?: string;
    actor?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await tx.orderEvent.create({
    data: {
      id: newId("evt_"),
      storeId: input.storeId,
      orderId: input.orderId,
      type: input.type,
      message: input.message ?? "",
      actor: input.actor ?? "merchant",
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Apply a status transition with optimistic concurrency. Only one concurrent
 * caller can win; losers receive ORDER_CONFLICT. Entering cancelled/returned
 * restores reserved stock exactly once (stockRestored flag).
 */
export async function applyOrderStatus(input: {
  storeId: string;
  orderId: string;
  target: string;
  actor?: string;
  note?: string;
}) {
  const current = await prisma.order.findFirst({
    where: { id: input.orderId, storeId: input.storeId },
    include: { items: true },
  });
  if (!current) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  if (current.status === input.target) {
    throw new ApiError(409, "INVALID_TRANSITION", `Order is already '${input.target}'.`);
  }
  const allowed = ORDER_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(input.target)) {
    throw new ApiError(
      409,
      "INVALID_TRANSITION",
      `Cannot move order from '${current.status}' to '${input.target}'. Allowed: ${allowed.join(", ") || "none"}.`
    );
  }

  return prisma.$transaction(async (tx) => {
    const wrote = await tx.order.updateMany({
      where: { id: current.id, storeId: current.storeId, status: current.status },
      data: { status: input.target },
    });
    if (wrote.count !== 1) {
      throw new ApiError(409, "ORDER_CONFLICT", "Order changed concurrently, please retry.");
    }
    if ((input.target === "cancelled" || input.target === "returned") && !current.stockRestored) {
      const failures: Array<{ itemId: string; sku: string; qty: number; reason: string }> = [];
      for (const item of current.items) {
        if (item.variantId) {
          const restored = await tx.productVariant.updateMany({
            where: { id: item.variantId, storeId: current.storeId },
            data: { stock: { increment: item.qty } },
          });
          if (restored.count !== 1) {
            failures.push({ itemId: item.id, sku: item.sku, qty: item.qty, reason: "variant_not_found" });
          }
        } else if (item.productId) {
          const restored = await tx.product.updateMany({
            where: { id: item.productId, storeId: current.storeId },
            data: { stock: { increment: item.qty } },
          });
          if (restored.count !== 1) {
            failures.push({ itemId: item.id, sku: item.sku, qty: item.qty, reason: "product_not_found" });
          }
        } else if (item.sku) {
          // Product deletion uses SET NULL so historical orders remain readable.
          // Try the immutable SKU snapshot before giving up and record the
          // unrecoverable reservation explicitly instead of silently losing stock.
          const restored = await tx.product.updateMany({
            where: { storeId: current.storeId, sku: item.sku },
            data: { stock: { increment: item.qty } },
          });
          if (restored.count !== 1) {
            failures.push({ itemId: item.id, sku: item.sku, qty: item.qty, reason: "product_not_found" });
          }
        }
      }
      if (failures.length) {
        // The order must still move to its terminal status, but the merchant
        // gets an explicit timeline event instead of a silent stock drift.
        await addOrderEvent(tx, {
          storeId: current.storeId,
          orderId: current.id,
          type: "stock_restore_failed",
          message: "",
          actor: input.actor ?? "system",
          metadata: { failures },
        });
      }
      await tx.order.update({ where: { id: current.id }, data: { stockRestored: true } });
    }

    if (input.target === "delivered") {
      await grantLoyaltyForOrder(tx, current);
    }
    if (input.target === "cancelled" || input.target === "returned") {
      await revokeLoyaltyForOrder(tx, current.id);
    }

    await addOrderEvent(tx, {
      storeId: current.storeId,
      orderId: current.id,
      type: "status_changed",
      message: "",
      actor: input.actor ?? "merchant",
      metadata: { from: current.status, to: input.target, note: input.note ?? "" },
    });
    return tx.order.findUnique({ where: { id: current.id }, include: ORDER_DETAIL_INCLUDE });
  });
}

/** Bulk transition; returns per-order success/failure instead of failing all. */
export async function bulkOrderStatus(input: {
  storeId: string;
  ids: string[];
  target: string;
  actor?: string;
}) {
  const results: { id: string; ok: boolean; code?: string; message?: string }[] = [];
  for (const id of input.ids) {
    try {
      await applyOrderStatus({ storeId: input.storeId, orderId: id, target: input.target, actor: input.actor });
      results.push({ id, ok: true });
    } catch (err) {
      const e = err as ApiError;
      results.push({ id, ok: false, code: e.code ?? "ERROR", message: e.message ?? "failed" });
    }
  }
  return results;
}

export const ORDER_EXPORT_COLUMNS = [
  "orderNumber",
  "source",
  "createdAt",
  "status",
  "paymentStatus",
  "paymentMethod",
  "customerName",
  "customerPhone",
  "customerEmail",
  "governorate",
  "city",
  "address",
  "subtotal",
  "discount",
  "shippingFee",
  "amountEgp",
  "couponCode",
  "itemsSummary",
] as const;

export function orderExportRow(row: Record<string, unknown>): string {
  return csvRow(ORDER_EXPORT_COLUMNS.map((column) => row[column]));
}

export function ordersToCsv(rows: Array<Record<string, unknown>>): string {
  return [csvHeader([...ORDER_EXPORT_COLUMNS]), ...rows.map(orderExportRow)].join("\n");
}
