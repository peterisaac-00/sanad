import { Router } from "express";
import { prisma } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import { subdomainParamSchema, validateParams } from "../validate.js";

export const dashboardRouter = Router();

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

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
    const since14 = new Date(startOfToday.getTime() - 13 * 86_400_000);

    const [
      store,
      total,
      delivered,
      sales,
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
      topItems,
    ] = await prisma.$transaction([
      prisma.store.findUnique({ where: { id: storeId } }),
      prisma.order.count({ where: { storeId } }),
      prisma.order.count({ where: { storeId, status: "delivered" } }),
      prisma.order.aggregate({ where: { storeId }, _sum: { amountEgp: true } }),
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
      prisma.order.aggregate({ where: { storeId, createdAt: { gte: startOfMonth } }, _sum: { amountEgp: true } }),
      prisma.order.findMany({
        where: { storeId, createdAt: { gte: since14 } },
        select: { createdAt: true, amountEgp: true, status: true },
      }),
      prisma.orderItem.groupBy({
        by: ["productId", "name"],
        where: { order: { storeId, status: { notIn: ["cancelled", "returned"] } }, productId: { not: null } },
        _sum: { qty: true, unitPriceEgp: true },
        orderBy: { _sum: { qty: "desc" } },
        take: 5,
      }),
    ]);

    const totalSales = Math.round(sales._sum.amountEgp ?? 0);
    const codCount = methods
      .filter((m) => /cod/i.test(m.paymentMethod) || m.paymentMethod.includes("استلام"))
      .reduce((s, m) => s + m._count._all, 0);

    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(since14.getTime() + i * 86_400_000);
      byDay.set(dayKey(d), { revenue: 0, orders: 0 });
    }
    for (const o of revenueOrders) {
      const key = dayKey(o.createdAt);
      const entry = byDay.get(key);
      if (!entry) continue;
      entry.orders += 1;
      if (o.status !== "cancelled" && o.status !== "returned") entry.revenue += o.amountEgp;
    }

    res.json({
      store,
      kpis: {
        total_orders: total,
        delivered_orders: delivered,
        total_sales_egp: totalSales,
        avg_order_egp: total ? Math.round(totalSales / total) : 0,
        cod_share_percent: total ? Math.round((codCount / total) * 100) : 0,
        orders_today: todayOrders,
        pending_orders: pendingOrders,
        month_sales_egp: Math.round(monthSales._sum.amountEgp ?? 0),
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
        qty: row._sum.qty ?? 0,
        revenue: row._sum.unitPriceEgp ?? 0,
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
