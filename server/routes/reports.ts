import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import { subdomainParamSchema, validateParams, validateQuery } from "../validate.js";

export const reportsRouter = Router();

const querySchema = z.strictObject({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
});

function bucketKey(date: Date, groupBy: "day" | "week" | "month") {
  if (groupBy === "month") return date.toISOString().slice(0, 7);
  if (groupBy === "week") {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - ((day + 1) % 7));
    return d.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

reportsRouter.get(
  "/api/stores/:subdomain/reports",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const { from, to, groupBy } = req.query as unknown as { from?: string; to?: string; groupBy: "day" | "week" | "month" };
    const start = from ? new Date(from) : new Date(Date.now() - 29 * 86_400_000);
    const end = to ? new Date(to) : new Date();
    const range = { gte: start, lte: end };
    const [orders, products, customers, carts, coupons, affiliates, expenses] = await prisma.$transaction([
      prisma.order.findMany({
        where: { storeId, createdAt: range },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.product.count({ where: { storeId } }),
      prisma.customer.count({ where: { storeId } }),
      prisma.abandonedCart.findMany({ where: { storeId, createdAt: range } }),
      prisma.couponUsage.findMany({ where: { storeId, createdAt: range }, include: { coupon: true } }),
      prisma.affiliateAttribution.findMany({ where: { storeId, createdAt: range } }),
      prisma.walletTransaction.aggregate({ where: { storeId, status: "completed", type: { in: ["fee", "withdrawal"] } }, _sum: { amount: true } }),
    ]);

    const valid = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned");
    const revenue = valid.reduce((s, o) => s + o.amountEgp, 0);
    const buckets = new Map<string, { revenue: number; orders: number; discounts: number }>();
    for (const order of orders) {
      const key = bucketKey(order.createdAt, groupBy);
      const entry = buckets.get(key) ?? { revenue: 0, orders: 0, discounts: 0 };
      entry.orders += 1;
      if (order.status !== "cancelled" && order.status !== "returned") entry.revenue += order.amountEgp;
      entry.discounts += order.discount;
      buckets.set(key, entry);
    }
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const order of valid) {
      for (const item of order.items) {
        const key = item.productId ?? item.sku;
        const row = productMap.get(key) ?? { name: item.name || item.sku, qty: 0, revenue: 0 };
        row.qty += item.qty;
        row.revenue += item.qty * item.unitPriceEgp;
        productMap.set(key, row);
      }
    }
    const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const customerMap = new Map<string, { name: string; phone: string; orders: number; revenue: number }>();
    for (const order of valid) {
      const key = order.customerPhone || order.customerName;
      if (!key) continue;
      const row = customerMap.get(key) ?? { name: order.customerName, phone: order.customerPhone, orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += order.amountEgp;
      customerMap.set(key, row);
    }
    const topCustomers = [...customerMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const statuses: Record<string, number> = {};
    const payments: Record<string, number> = {};
    for (const order of orders) {
      statuses[order.status] = (statuses[order.status] ?? 0) + 1;
      payments[order.paymentStatus] = (payments[order.paymentStatus] ?? 0) + 1;
    }
    res.json({
      range: { from: start.toISOString(), to: end.toISOString(), groupBy },
      totals: {
        orders: orders.length,
        validOrders: valid.length,
        revenue,
        averageOrderValue: valid.length ? Math.round(revenue / valid.length) : 0,
        discounts: orders.reduce((s, o) => s + o.discount, 0),
        shippingCollected: orders.reduce((s, o) => s + o.shippingFee, 0),
        cancelled: orders.filter((o) => o.status === "cancelled").length,
        returned: orders.filter((o) => o.status === "returned").length,
        products,
        customers,
        abandonedCarts: carts.length,
        recoveredCarts: carts.filter((c) => c.recoveryStatus === "recovered").length,
        couponDiscounts: coupons.reduce((s, c) => s + c.discount, 0),
        affiliateCommission: affiliates.reduce((s, a) => s + a.commissionAmount, 0),
        completedExpenses: expenses._sum.amount ?? 0,
        estimatedNet: Math.round(revenue - (expenses._sum.amount ?? 0)),
      },
      series: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => ({ period, ...value })),
      orders_by_status: statuses,
      orders_by_payment_status: payments,
      top_products: topProducts,
      top_customers: topCustomers,
      note: "صافي الربح تقديري: الإيرادات ناقص المصروفات المسجلة في المحفظة فقط. لا تشمل تكلفة البضاعة إلا إذا سجلتها.",
    });
  })
);
