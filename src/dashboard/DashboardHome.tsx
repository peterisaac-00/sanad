import React, { useMemo } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Package,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import { money, number, ORDER_STATUS, PAYMENT_STATUS, date, safeError, statusLabel } from "../lib/format";
import { Link } from "../lib/router";
import { useAsync } from "../lib/useAsync";
import { Alert, Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, cn } from "../components/ui";
import { useDashboard } from "./DashboardShell";

function RevenueChart({ series }: { series: Array<{ date: string; revenue: number; orders: number }> }) {
  const max = Math.max(1, ...series.map((point) => point.revenue));
  const width = 720;
  const height = 200;
  const padding = 8;
  const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : width;
  const points = series.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - (point.revenue / max) * (height - padding * 2);
    return { x, y, ...point };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L ${points[points.length - 1]?.x ?? width} ${height - padding} L ${points[0]?.x ?? padding} ${height - padding} Z`;

  return (
    <div className="mt-4">
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full" role="img" aria-label="منحنى الإيرادات خلال 14 يوماً">
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line key={ratio} x1={padding} x2={width - padding} y1={padding + ratio * (height - padding * 2)} y2={padding + ratio * (height - padding * 2)} stroke="var(--color-border)" strokeOpacity="0.7" strokeDasharray="3 5" />
          ))}
          {series.length > 0 ? <path d={area} fill="url(#revenueFill)" /> : null}
          {series.length > 0 ? <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
          {points.map((point) => (
            <circle key={point.date} cx={point.x} cy={point.y} r={point.revenue > 0 ? 3 : 1.5} fill={point.revenue > 0 ? "var(--color-primary)" : "var(--color-border)"} />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-subtle">
        <span>{date(series[0]?.date)}</span>
        <span>آخر 14 يوماً</span>
        <span>{date(series[series.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function ChecklistItem({ done, title, description, href }: { done: boolean; title: string; description: string; href: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-brand border border-line bg-surface p-3 transition hover:border-brand-line hover:bg-card">
      <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", done ? "bg-success-soft text-success" : "bg-surface text-subtle")}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-xs font-bold", done ? "text-subtle line-through" : "text-ink")}>{title}</span>
        <span className="mt-0.5 block text-[10px] leading-5 text-subtle">{description}</span>
      </span>
      {!done ? <ArrowLeft className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" /> : null}
    </Link>
  );
}

export function DashboardHome() {
  const { subdomain, store, storefrontUrl } = useDashboard();
  const { data, loading, error, reload } = useAsync(() => api.dashboard.summary(subdomain), [subdomain]);

  const kpis = data?.kpis;
  const series = data?.revenue_series ?? [];
  const topProducts = data?.top_products ?? [];
  const recentOrders = data?.recent_orders ?? [];
  const statuses = (data?.orders_by_status ?? {}) as Record<string, number>;
  const totalStatus = useMemo(() => Object.values(statuses).reduce((sum, value) => sum + value, 0), [statuses]);
  const todayRevenue = series.length ? Number(series[series.length - 1]?.revenue ?? 0) : 0;

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <PageHeader title="لوحة التحكم" description="جارٍ تحميل أرقام متجرك الحقيقية…" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }

  const checklist = [
    { done: Number(kpis?.products_count ?? 0) > 0, title: "أضف أول منتج", description: "أدخل منتجاتك بأسعار ومخزون حقيقيين.", href: "/dashboard/products" },
    { done: Number(kpis?.customers_count ?? 0) > 0, title: "استقبل أول عميل", description: "شارك رابط متجرك وابدأ استقبال الطلبات.", href: storefrontUrl },
    { done: Number(kpis?.total_orders ?? 0) > 0, title: "جهّز طلبك الأول", description: "أكد الطلب وغيّر حالته إلى قيد التجهيز.", href: "/dashboard/orders" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="ملخص مباشر"
        title={`مرحباً، ${store.storeName}`}
        description="كل الأرقام أدناه محسوبة من طلبات ومنتجات هذا المتجر فقط. لا توجد بيانات تجريبية."
        actions={
          <>
            <Link href={storefrontUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-brand border border-line px-4 text-xs font-semibold text-ink transition hover:border-brand-line hover:bg-surface">
              <Store className="h-4 w-4 text-brand" /> فتح المتجر
            </Link>
            <Link href="/dashboard/products" className="inline-flex h-10 items-center gap-2 rounded-brand bg-brand px-4 text-xs font-semibold text-on-brand shadow-brand-card transition hover:bg-brand-hover">
              <Package className="h-4 w-4" /> إضافة منتج
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إيرادات اليوم" value={money(todayRevenue, store.currency)} hint={`${number(kpis?.orders_today ?? 0)} طلب اليوم`} icon={<CalendarDays className="h-4 w-4" />} accent="brand" />
        <StatCard label="إجمالي المبيعات" value={money(kpis?.total_sales_egp, store.currency)} hint={`${number(kpis?.total_orders ?? 0)} طلب إجمالاً`} icon={<TrendingUp className="h-4 w-4" />} accent="success" />
        <StatCard label="طلبات بانتظارك" value={number(kpis?.pending_orders ?? 0)} hint="تحتاج تأكيداً أو تجهيزاً" icon={<Clock className="h-4 w-4" />} accent="warning" />
        <StatCard label="مبيعات هذا الشهر" value={money(kpis?.month_sales_egp, store.currency)} hint={`${number(kpis?.new_customers_month ?? 0)} عميل جديد`} icon={<CircleDollarSign className="h-4 w-4" />} accent="info" />
        <StatCard label="متوسط قيمة الطلب" value={money(kpis?.avg_order_egp, store.currency)} hint={`${number(kpis?.cod_share_percent ?? 0)}% دفع عند الاستلام`} icon={<Banknote className="h-4 w-4" />} accent="brand" />
        <StatCard label="العملاء" value={number(kpis?.customers_count ?? 0)} hint="عملاء لديهم طلبات أو بيانات محفوظة" icon={<Users className="h-4 w-4" />} accent="success" />
        <StatCard label="منتجات منخفضة المخزون" value={number(kpis?.low_stock_products ?? 0)} hint={`${number(kpis?.products_count ?? 0)} منتج في الكتالوج`} icon={<Boxes className="h-4 w-4" />} accent="danger" />
        <StatCard label="السلات المتروكة" value={number(kpis?.abandoned_carts ?? 0)} hint="قابلة للمتابعة برسالة واتساب يدوية" icon={<ShoppingBag className="h-4 w-4" />} accent="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-heading text-sm font-bold text-ink">حركة الإيرادات</h2>
              <p className="mt-0.5 text-[11px] text-subtle">الطلبات غير الملغاة والمرتجعة خلال آخر 14 يوماً.</p>
            </div>
            <Badge tone="border-success-line bg-success-soft text-success">{money(series.reduce((sum: number, point: any) => sum + point.revenue, 0), store.currency)}</Badge>
          </div>
          <RevenueChart series={series} />
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold text-ink">حالات الطلبات</h2>
            <Link href="/dashboard/orders" className="text-[10px] font-semibold text-brand hover:text-brand">كل الطلبات ←</Link>
          </div>
          {totalStatus === 0 ? (
            <EmptyState title="لا توجد طلبات بعد" description="عندما يطلب عميل من متجرك ستظهر هنا حالات الطلب وتوزيعها." icon={<ShoppingCart className="h-5 w-5" />} action={<Link href="/dashboard/products" className="text-[11px] font-bold text-brand">جهّز منتجاتك أولاً</Link>} />
          ) : (
            <div className="mt-4 space-y-2.5">
              {Object.entries(ORDER_STATUS).map(([key, meta]) => {
                const count = statuses[key] ?? 0;
                if (!count) return null;
                const width = Math.round((count / totalStatus) * 100);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-ink-soft"><span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />{meta.label}</span>
                      <span className="font-bold text-ink">{number(count)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div className={cn("h-full rounded-full", meta.dot)} style={{ width: `${Math.max(width, 4)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="font-heading text-sm font-bold text-ink">أحدث الطلبات</h2>
            <Link href="/dashboard/orders" className="text-[10px] font-semibold text-brand hover:text-brand">عرض الكل ←</Link>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState title="لم يصل أي طلب بعد" description="شارك رابط متجرك مع عملائك ليبدأ أول طلب حقيقي في الظهور هنا." icon={<ShoppingCart className="h-5 w-5" />} action={<Link href={storefrontUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-brand">فتح رابط المتجر</Link>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wide text-subtle">
                    <th className="px-4 py-2.5 text-start font-semibold">الطلب</th>
                    <th className="px-4 py-2.5 text-start font-semibold">العميل</th>
                    <th className="px-4 py-2.5 text-start font-semibold">الحالة</th>
                    <th className="px-4 py-2.5 text-start font-semibold">المبلغ</th>
                    <th className="px-4 py-2.5 text-start font-semibold">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order: any) => (
                    <tr key={order.id} className="border-b border-line transition hover:bg-surface">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-[11px] font-bold text-brand hover:text-brand">SND-{order.orderNumber}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{order.customerName || "بدون اسم"}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{order.customerPhone || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={ORDER_STATUS[order.status]?.tone} dot={ORDER_STATUS[order.status]?.dot}>{statusLabel(order.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-ink">{money(order.amountEgp, store.currency)}</td>
                      <td className="px-4 py-3 text-[10px] text-subtle">{date(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink"><Sparkles className="h-3.5 w-3.5 text-brand" /> خطوات جاهزية المتجر</div>
            <div className="mt-3 space-y-2">
              {checklist.map((item) => <ChecklistItem key={item.title} {...item} />)}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm font-bold text-ink">الأكثر مبيعاً</h2>
              <Link href="/dashboard/reports" className="text-[10px] font-semibold text-brand">التقرير الكامل</Link>
            </div>
            {topProducts.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-subtle">سيظهر ترتيب المنتجات بعد أول عملية بيع.</div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {topProducts.map((product: any, index: number) => (
                  <div key={`${product.productId}-${index}`} className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-brand-sm bg-surface text-[10px] font-bold text-subtle">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold text-ink">{product.name || "منتج"}</div>
                      <div className="text-[10px] text-subtle">{number(product.qty)} قطعة</div>
                    </div>
                    <div className="text-[11px] font-bold text-ink">{money(product.revenue, store.currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {kpis && Number(kpis.low_stock_products) > 0 ? (
        <Alert tone="warning" title="منتجات تحتاج إعادة تخزين">
          لديك {number(kpis.low_stock_products)} منتجاً نشطاً بمخزون 5 قطع أو أقل. <Link href="/dashboard/products?stock=low" className="font-bold underline">راجع المنتجات</Link>
        </Alert>
      ) : null}
    </div>
  );
}
