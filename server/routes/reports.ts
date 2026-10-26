import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import { EXCLUDED_REVENUE_STATUSES, subdomainParamSchema, validateParams, validateQuery } from "../validate.js";

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
        include: { items: true, refunds: { where: { status: "processed" }, select: { amount: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.product.count({ where: { storeId } }),
      prisma.customer.count({ where: { storeId } }),
      prisma.abandonedCart.findMany({ where: { storeId, createdAt: range } }),
      prisma.couponUsage.findMany({
        where: {
          storeId,
          createdAt: range,
          order: { status: { notIn: [...EXCLUDED_REVENUE_STATUSES] } },
        },
        include: { coupon: true },
      }),
      prisma.affiliateAttribution.findMany({
        where: {
          storeId,
          createdAt: range,
          order: { status: { notIn: [...EXCLUDED_REVENUE_STATUSES] } },
        },
      }),
      // Expenses must be scoped to the same selected period as revenue,
      // otherwise estimatedNet changes when the report range changes.
      prisma.walletTransaction.aggregate({
        where: { storeId, status: "completed", type: { in: ["fee", "withdrawal"] }, createdAt: range },
        _sum: { amount: true },
      }),
    ]);

    const valid = orders.filter((o) => !EXCLUDED_REVENUE_STATUSES.includes(o.status as (typeof EXCLUDED_REVENUE_STATUSES)[number]));
    const refundedAmount = (order: { amountEgp: number; refunds: Array<{ amount: number }> }) =>
      Math.min(order.amountEgp, order.refunds.reduce((sum, refund) => sum + refund.amount, 0));
    const grossRevenue = valid.reduce((s, o) => s + o.amountEgp, 0);
    const refunds = valid.reduce((s, o) => s + refundedAmount(o), 0);
    const revenue = Math.round((grossRevenue - refunds) * 100) / 100;
    const buckets = new Map<string, { grossRevenue: number; refunds: number; revenue: number; orders: number; discounts: number }>();
    for (const order of orders) {
      const key = bucketKey(order.createdAt, groupBy);
      const entry = buckets.get(key) ?? { grossRevenue: 0, refunds: 0, revenue: 0, orders: 0, discounts: 0 };
      entry.orders += 1;
      if (!EXCLUDED_REVENUE_STATUSES.includes(order.status as (typeof EXCLUDED_REVENUE_STATUSES)[number])) {
        const refunded = refundedAmount(order);
        entry.grossRevenue += order.amountEgp;
        entry.refunds += refunded;
        entry.revenue += order.amountEgp - refunded;
        entry.discounts += order.discount;
      }
      buckets.set(key, entry);
    }
    const productMap = new Map<string, { name: string; qty: number; grossRevenue: number; revenue: number }>();
    for (const order of valid) {
      // Attribute the order's processed refund to its products proportionally.
      // This keeps top-product revenue consistent with the net total instead of
      // silently reporting pre-refund merchandise revenue.
      const refundRatio = order.amountEgp > 0 ? Math.min(1, refundedAmount(order) / order.amountEgp) : 0;
      for (const item of order.items) {
        const key = item.productId ?? item.sku;
        const row = productMap.get(key) ?? { name: item.name || item.sku, qty: 0, grossRevenue: 0, revenue: 0 };
        row.qty += item.qty;
        const gross = item.qty * item.unitPriceEgp;
        row.grossRevenue += gross;
        row.revenue += gross * (1 - refundRatio);
        productMap.set(key, row);
      }
    }
    const topProducts = [...productMap.values()]
      .map((row) => ({
        ...row,
        grossRevenue: Math.round(row.grossRevenue * 100) / 100,
        revenue: Math.round(row.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    const customerMap = new Map<string, { name: string; phone: string; orders: number; revenue: number }>();
    for (const order of valid) {
      const key = order.customerPhone || order.customerName;
      if (!key) continue;
      const row = customerMap.get(key) ?? { name: order.customerName, phone: order.customerPhone, orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += order.amountEgp - refundedAmount(order);
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
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        refunds: Math.round(refunds * 100) / 100,
        revenue,
        averageOrderValue: valid.length ? Math.round(revenue / valid.length) : 0,
        discounts: valid.reduce((s, o) => s + o.discount, 0),
        shippingCollected: valid.reduce((s, o) => s + o.shippingFee, 0),
        cancelled: orders.filter((o) => o.status === "cancelled").length,
        returned: orders.filter((o) => o.status === "returned").length,
        products,
        customers,
        abandonedCarts: carts.length,
        recoveredCarts: carts.filter((c) => c.recoveryStatus === "recovered").length,
        couponDiscounts: coupons.reduce((s, c) => s + c.discount, 0),
        affiliateCommission: affiliates.reduce((s, a) => s + a.commissionAmount, 0),
        completedExpenses: expenses._sum.amount ?? 0,
        estimatedNet: Math.round((revenue - (expenses._sum.amount ?? 0)) * 100) / 100,
      },
      series: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => ({ period, ...value })),
      orders_by_status: statuses,
      orders_by_payment_status: payments,
      top_products: topProducts,
      top_customers: topCustomers,
      note: "الإيرادات صافية بعد المبالغ المستردة المعالجة. صافي الربح تقديري: الإيرادات ناقص المصروفات المسجلة في المحفظة فقط. لا تشمل تكلفة البضاعة إلا إذا سجلتها.",
    });
  })
);
