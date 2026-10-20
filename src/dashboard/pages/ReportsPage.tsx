import React, { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { api } from "../../lib/api";
import { dateTime, money, number, percent, safeError, statusLabel, paymentLabel } from "../../lib/format";
import { useAsync } from "../../lib/useAsync";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  useToast,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { TableShell, Td, Th } from "../common";

type Preset = "7" | "30" | "90" | "custom";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function ReportsPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const currency = store?.currency ?? "EGP";

  const [preset, setPreset] = useState<Preset>("30");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : isoDaysAgo(30),
        to: customTo ? new Date(`${customTo}T23:59:59`).toISOString() : new Date().toISOString(),
      };
    }
    const days = Number(preset);
    return { from: isoDaysAgo(days), to: new Date().toISOString() };
  }, [preset, customFrom, customTo]);

  const { data, loading, error, reload } = useAsync(
    () => api.reports.get(subdomain, { from: range.from, to: range.to, groupBy }),
    [subdomain, range.from, range.to, groupBy]
  );

  const totals = data?.totals;
  const series: any[] = data?.series ?? [];
  const maxRevenue = Math.max(1, ...series.map((point) => Number(point.revenue) || 0));

  const exportOrders = async () => {
    try {
      await api.downloadCsv(
        `/api/stores/${encodeURIComponent(subdomain)}/orders/export?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
        "orders.csv"
      );
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="نظرة عامة"
        title="التقارير"
        description="أداء متجرك في الفترة المختارة: الإيرادات، الطلبات، الاسترجاع، وأفضل المنتجات والعملاء."
        actions={
          <>
            <Button variant="outline" onClick={exportOrders}><Download className="h-4 w-4" /> تصدير الطلبات CSV</Button>
            <Button variant="ghost" size="sm" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
          </>
        }
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="الفترة" className="w-40">
            <Select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
              <option value="7">آخر 7 أيام</option>
              <option value="30">آخر 30 يوماً</option>
              <option value="90">آخر 90 يوماً</option>
              <option value="custom">فترة مخصصة</option>
            </Select>
          </Field>
          {preset === "custom" ? (
            <>
              <Field label="من" className="w-44">
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </Field>
              <Field label="إلى" className="w-44">
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </Field>
            </>
          ) : null}
          <Field label="التجميع" className="w-40">
            <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}>
              <option value="day">يومي</option>
              <option value="week">أسبوعي</option>
              <option value="month">شهري</option>
            </Select>
          </Field>
          <div className="ms-auto text-[11px] text-subtle">
            {data ? `من ${dateTime(data.range.from)} إلى ${dateTime(data.range.to)}` : ""}
          </div>
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل التقرير">{safeError(error)}</Alert> : null}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="الإيرادات" value={money(totals?.revenue ?? 0, currency)} icon={<TrendingUp className="h-5 w-5" />} accent="success" hint={`${number(totals?.validOrders ?? 0)} طلب فعّال`} />
            <StatCard label="طلبات الفترة" value={number(totals?.orders ?? 0)} icon={<ShoppingCart className="h-5 w-5" />} accent="brand" hint={`${number(totals?.cancelled ?? 0)} ملغي · ${number(totals?.returned ?? 0)} مرتجع`} />
            <StatCard label="متوسط قيمة الطلب" value={money(totals?.averageOrderValue ?? 0, currency)} accent="info" />
            <StatCard label="عملاء مسجّلون" value={number(totals?.customers ?? 0)} icon={<Users className="h-5 w-5" />} accent="warning" hint={`${number(totals?.products ?? 0)} منتج في المتجر`} />
            <StatCard label="الخصومات" value={money(totals?.discounts ?? 0, currency)} accent="danger" hint={`كوبونات: ${money(totals?.couponDiscounts ?? 0, currency)}`} />
            <StatCard label="الشحن المحصّل" value={money(totals?.shippingCollected ?? 0, currency)} accent="brand" />
            <StatCard label="عمولات التسويق" value={money(totals?.affiliateCommission ?? 0, currency)} accent="info" />
            <StatCard label="صافي تقديري" value={money(totals?.estimatedNet ?? 0, currency)} icon={<Wallet className="h-5 w-5" />} accent="success" hint={`مصروفات محفظة: ${money(totals?.completedExpenses ?? 0, currency)}`} />
          </div>

          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink"><BarChart3 className="h-3.5 w-3.5 text-brand" /> الإيرادات حسب الفترة</div>
              <div className="text-[10px] text-subtle">الأعمدة تمثل الإيرادات، والنقاط أسفلها عدد الطلبات</div>
            </div>
            {series.length === 0 ? (
              <EmptyState title="لا توجد بيانات في هذه الفترة" description="جرّب توسيع الفترة الزمنية أو حدّث الصفحة." />
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-fit items-end gap-1.5" style={{ height: 200 }}>
                  {series.map((point: any) => {
                    const height = Math.max(4, Math.round(((Number(point.revenue) || 0) / maxRevenue) * 160));
                    return (
                      <div key={point.period} className="group flex w-14 shrink-0 flex-col items-center gap-1" title={`${point.period} — ${money(point.revenue, currency)} · ${point.orders} طلب`}>
                        <div className="text-[9px] text-subtle opacity-0 transition group-hover:opacity-100">{money(point.revenue, currency)}</div>
                        <div className="w-full rounded-t-md bg-gradient-to-t from-brand/70 to-brand/90 transition group-hover:from-brand group-hover:to-brand-on-dark" style={{ height }} />
                        <div className="text-[9px] font-mono text-subtle" dir="ltr">{point.period.slice(5)}</div>
                        <div className="text-[9px] text-subtle">{point.orders} طلب</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">الطلبات حسب الحالة</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data?.orders_by_status ?? {}).map(([status, count]) => (
                  <Badge key={status} tone="bg-surface text-ink-soft border-line">{statusLabel(status)}: {number(count as number)}</Badge>
                ))}
                {Object.keys(data?.orders_by_status ?? {}).length === 0 ? <span className="text-[11px] text-subtle">لا توجد طلبات في الفترة.</span> : null}
              </div>
              <div className="mb-3 mt-5 text-xs font-bold text-ink">الطلبات حسب حالة الدفع</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data?.orders_by_payment_status ?? {}).map(([status, count]) => (
                  <Badge key={status} tone="bg-surface text-ink-soft border-line">{paymentLabel(status)}: {number(count as number)}</Badge>
                ))}
                {Object.keys(data?.orders_by_payment_status ?? {}).length === 0 ? <span className="text-[11px] text-subtle">لا توجد بيانات دفع.</span> : null}
              </div>
              <div className="mt-5 grid gap-2 text-[11px] text-subtle">
                <div className="flex items-center justify-between"><span>سلات متروكة في الفترة</span><span className="font-semibold text-ink">{number(totals?.abandonedCarts ?? 0)}</span></div>
                <div className="flex items-center justify-between"><span>سلات مستعادة</span><span className="font-semibold text-success">{number(totals?.recoveredCarts ?? 0)}</span></div>
                <div className="flex items-center justify-between">
                  <span>معدل الاسترجاع</span>
                  <span className="font-semibold text-ink">
                    {percent(totals?.abandonedCarts ? ((totals?.recoveredCarts ?? 0) / totals.abandonedCarts) * 100 : 0)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-line px-4 py-3 text-xs font-bold text-ink">أفضل المنتجات</div>
              {(data?.top_products ?? []).length === 0 ? (
                <EmptyState title="لا توجد مبيعات بعد" description="عند وصول أول طلب فعّال ستظهر هنا أفضل منتجاتك." />
              ) : (
                <TableShell minWidth={480}>
                  <thead>
                    <tr className="border-b border-line">
                      <Th>#</Th>
                      <Th>المنتج</Th>
                      <Th>الكمية</Th>
                      <Th>الإيراد</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.top_products ?? []).map((product: any, index: number) => (
                      <tr key={`${product.name}-${index}`} className="border-b border-line">
                        <Td><span className="text-subtle">{index + 1}</span></Td>
                        <Td><span className="font-semibold text-ink">{product.name}</span></Td>
                        <Td><span className="text-[11px] text-ink-soft">{number(product.qty)}</span></Td>
                        <Td><span className="text-[11px] font-semibold text-success">{money(product.revenue, currency)}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3 text-xs font-bold text-ink">أفضل العملاء</div>
            {(data?.top_customers ?? []).length === 0 ? (
              <EmptyState title="لا يوجد عملاء بعد" description="ستظهر هنا أعلى العملاء قيمة عند تسجيل الطلبات." />
            ) : (
              <TableShell minWidth={640}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>العميل</Th>
                    <Th>الهاتف</Th>
                    <Th>الطلبات</Th>
                    <Th>إجمالي الإنفاق</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.top_customers ?? []).map((customer: any, index: number) => (
                    <tr key={`${customer.name}-${index}`} className="border-b border-line">
                      <Td><span className="font-semibold text-ink">{customer.name || "—"}</span></Td>
                      <Td><span className="font-mono text-[10px] text-subtle" dir="ltr">{customer.phone || "—"}</span></Td>
                      <Td><span className="text-[11px] text-ink-soft">{number(customer.orders)}</span></Td>
                      <Td><span className="text-[11px] font-semibold text-success">{money(customer.revenue, currency)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Card>

          {data?.note ? <Alert tone="info" title="ملاحظة عن الأرقام">{data.note}</Alert> : null}
        </>
      )}
    </div>
  );
}
