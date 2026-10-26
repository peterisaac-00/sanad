import { Router } from "express";
import { prisma } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import { EXCLUDED_REVENUE_STATUSES, subdomainParamSchema, validateParams } from "../validate.js";

export const dashboardRouter = Router();

function dayKey(d: Date) {
  // Bucket by the server's local calendar day. Using toISOString() here would
  // mix UTC dates with the local `startOfToday` boundary and misplace orders
  // around midnight (and across DST changes).
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const revenueWhere = (storeId: string) => ({
  storeId,
  status: { notIn: [...EXCLUDED_REVENUE_STATUSES] },
});

dashboardRouter.get(
  "/api/stores/:subdomain/summary",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const since14 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);

    const [
      store,
      total,
      delivered,
      sales,
      validOrders,
      methods,
      recent,
      productsCount,
      lowStock,
      customersCount,
      newCustomers,
      pendingOrders,
      abandoned,
      wallet,
      byStatus,
      todayOrders,
      monthSales,
      revenueOrders,
      totalRefunds,
      monthRefunds,
    ] = await prisma.$transaction([
      prisma.store.findUnique({ where: { id: storeId } }),
      prisma.order.count({ where: { storeId } }),
      prisma.order.count({ where: { storeId, status: "delivered" } }),
      prisma.order.aggregate({ where: revenueWhere(storeId), _sum: { amountEgp: true } }),
      prisma.order.count({ where: revenueWhere(storeId) }),
      prisma.order.groupBy({ by: ["paymentMethod"], where: { storeId }, _count: { _all: true } }),
      prisma.order.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 8, include: { items: true } }),
      prisma.product.count({ where: { storeId } }),
      prisma.product.count({ where: { storeId, stock: { lte: 5 }, status: "active" } }),
      prisma.customer.count({ where: { storeId } }),
      prisma.customer.count({ where: { storeId, createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { storeId, status: { in: ["pending", "needs_confirmation"] } } }),
      prisma.abandonedCart.count({ where: { storeId, recoveryStatus: "open" } }),
      prisma.walletAccount.findUnique({ where: { storeId } }),
      prisma.order.groupBy({ by: ["status"], where: { storeId }, _count: { _all: true } }),
      prisma.order.count({ where: { storeId, createdAt: { gte: startOfToday } } }),
      prisma.order.aggregate({ where: { ...revenueWhere(storeId), createdAt: { gte: startOfMonth } }, _sum: { amountEgp: true } }),
      prisma.order.findMany({
        where: { storeId, createdAt: { gte: since14 } },
        select: {
          createdAt: true,
          amountEgp: true,
          status: true,
          refunds: { where: { status: "processed" }, select: { amount: true } },
        },
      }),
      prisma.refund.aggregate({
        where: {
          storeId,
          status: "processed",
          order: { status: { notIn: [...EXCLUDED_REVENUE_STATUSES] } },
        },
        _sum: { amount: true },
      }),
      prisma.refund.aggregate({
        where: {
          storeId,
          status: "processed",
          order: {
            status: { notIn: [...EXCLUDED_REVENUE_STATUSES] },
            createdAt: { gte: startOfMonth },
          },
        },
        _sum: { amount: true },
      }),
    ]);

    // groupBy cannot multiply qty × unit price, so aggregate top products in
    // SQL where the multiplication is exact and the result set is already
    // limited to the five best sellers.
    const topItems = await prisma.$queryRaw<
      Array<{ productId: string; name: string; qty: number; revenue: number }>
    >`
      SELECT oi."product_id" AS "productId",
             MAX(oi."name") AS "name",
             SUM(oi."qty")::int AS "qty",
             SUM(
               oi."qty" * oi."unit_price_egp" *
               (1 - LEAST(1.0, COALESCE(r."refunded", 0) / GREATEST(o."amount_egp", 0.01)))
             )::double precision AS "revenue"
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."order_id"
      LEFT JOIN (
        SELECT "order_id", SUM("amount") AS "refunded"
        FROM "refunds"
        WHERE "store_id" = ${storeId} AND "status" = 'processed'
        GROUP BY "order_id"
      ) r ON r."order_id" = o."id"
      WHERE o."store_id" = ${storeId}
        AND o."status" NOT IN ('cancelled', 'returned')
        AND oi."product_id" IS NOT NULL
      GROUP BY oi."product_id"
      ORDER BY "qty" DESC
      LIMIT 5
    `;

    const totalRefunded = totalRefunds._sum.amount ?? 0;
    const totalSales = Math.round((sales._sum.amountEgp ?? 0) - totalRefunded);
    const monthSalesValue = Math.round((monthSales._sum.amountEgp ?? 0) - (monthRefunds._sum.amount ?? 0));
    const codCount = methods
      .filter((m) => /cod/i.test(m.paymentMethod) || m.paymentMethod.includes("استلام"))
      .reduce((s, m) => s + m._count._all, 0);

    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i);
      byDay.set(dayKey(d), { revenue: 0, orders: 0 });
    }
    for (const o of revenueOrders) {
      const key = dayKey(o.createdAt);
      const entry = byDay.get(key);
      if (!entry) continue;
      entry.orders += 1;
      if (o.status !== "cancelled" && o.status !== "returned") {
        const refunded = Math.min(o.amountEgp, o.refunds.reduce((sum, refund) => sum + refund.amount, 0));
        entry.revenue += o.amountEgp - refunded;
      }
    }

    res.json({
      store,
      kpis: {
        total_orders: total,
        delivered_orders: delivered,
        total_sales_egp: totalSales,
        total_refunds_egp: Math.round(totalRefunded * 100) / 100,
        // AOV is net revenue divided by orders that actually count as revenue,
        // never by cancelled/returned orders.
        avg_order_egp: validOrders ? Math.round(totalSales / validOrders) : 0,
        cod_share_percent: total ? Math.round((codCount / total) * 100) : 0,
        orders_today: todayOrders,
        pending_orders: pendingOrders,
        month_sales_egp: monthSalesValue,
        products_count: productsCount,
        low_stock_products: lowStock,
        customers_count: customersCount,
        new_customers_month: newCustomers,
        abandoned_carts: abandoned,
        wallet_balance: wallet?.balance ?? 0,
      },
      orders_by_status: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      revenue_series: [...byDay.entries()].map(([date, value]) => ({ date, ...value })),
      top_products: topItems.map((row) => ({
        productId: row.productId,
        name: row.name,
        qty: Number(row.qty) || 0,
        revenue: Math.round((Number(row.revenue) || 0) * 100) / 100,
      })),
      recent_orders: recent,
    });
  })
);

dashboardRouter.get(
  "/api/stores/:subdomain/notifications",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const [notifications, unread] = await prisma.$transaction([
      prisma.notification.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.notification.count({ where: { storeId, read: false } }),
    ]);
    res.json({ notifications, unread });
  })
);

dashboardRouter.patch(
  "/api/stores/:subdomain/notifications/read",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const id = typeof req.body?.id === "string" ? req.body.id : "";
    if (id) {
      const found = await prisma.notification.findFirst({ where: { id, storeId }, select: { id: true } });
      if (!found) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
      await prisma.notification.update({ where: { id }, data: { read: true } });
    } else {
      await prisma.notification.updateMany({ where: { storeId, read: false }, data: { read: true } });
    }
    res.json({ ok: true });
  })
);
