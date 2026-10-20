import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError } from "../errors.js";
import { ORDER_TRANSITIONS } from "../validate.js";

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
      for (const item of current.items) {
        if (item.variantId) {
          await tx.productVariant
            .update({ where: { id: item.variantId }, data: { stock: { increment: item.qty } } })
            .catch(() => null);
        } else if (item.productId) {
          await tx.product
            .update({ where: { id: item.productId }, data: { stock: { increment: item.qty } } })
            .catch(() => null);
        }
      }
      await tx.order.update({ where: { id: current.id }, data: { stockRestored: true } });
    }
    await addOrderEvent(tx, {
      storeId: current.storeId,
      orderId: current.id,
      type: "status_changed",
      message: `تم تغيير الحالة من ${current.status} إلى ${input.target}`,
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

export function ordersToCsv(rows: Array<Record<string, unknown>>): string {
  const columns = [
    "orderNumber",
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
  ];
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => escape(r[c])).join(","))].join("\n");
}
