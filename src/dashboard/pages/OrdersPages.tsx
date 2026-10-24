import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Download,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { api } from "../../lib/api";
import { dateTime, money, number, ORDER_STATUS, ORDER_TRANSITIONS, PAYMENT_STATUS, PAYMENT_TRANSITIONS, safeError, timeAgo } from "../../lib/format";
import { Link, navigate } from "../../lib/router";
import { useAsync } from "../../lib/useAsync";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { dateInputToIso, PaymentBadge, StatusBadge, TableShell, Td, Th } from "../common";

const enc = encodeURIComponent;

/* ------------------------------- list ------------------------------- */

export function OrdersPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () =>
      api.orders.list(subdomain, {
        page,
        pageSize: 20,
        search: search || undefined,
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        from: dateInputToIso(from),
        to: dateInputToIso(to, true),
      }),
    [subdomain, page, search, status, paymentStatus, from, to]
  );

  useEffect(() => setSelected([]), [data]);

  const orders = data?.orders ?? [];
  const counts = data?.status_counts ?? {};
  const pagination = data?.pagination;

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const allSelected = orders.length > 0 && selected.length === orders.length;

  const runBulk = async () => {
    if (!bulkStatus || !selected.length) return;
    setBulkBusy(true);
    try {
      const result = await api.orders.bulkStatus(subdomain, selected, bulkStatus);
      const failed = (result.results ?? []).filter((r: any) => !r.ok);
      if (failed.length) toast.error(`تعذر تحديث ${failed.length} طلب. الباقي تم بنجاح.`);
      else toast.success(`تم تحديث ${selected.length} طلب إلى «${ORDER_STATUS[bulkStatus]?.label}».`);
      setBulkStatus("");
      setSelected([]);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBulkBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      if (search) params.set("search", search);
      const fromIso = dateInputToIso(from);
      const toIso = dateInputToIso(to, true);
      if (fromIso) params.set("from", fromIso);
      if (toIso) params.set("to", toIso);
      const query = params.toString();
      await api.downloadCsv(`/api/stores/${enc(subdomain)}/orders/export${query ? `?${query}` : ""}`, "orders.csv");
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="المبيعات"
        title="الطلبات"
        description="كل طلب هنا أُنشئ فعلاً من متجرك. غيّر الحالة أو حالة الدفع فوراً، والعدادات محسوبة من قاعدة البيانات."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> تصدير CSV
            </Button>
            <Button onClick={() => setManualOpen(true)}>
              <Plus className="h-4 w-4" /> طلب يدوي
            </Button>
          </>
        }
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => { setStatus(""); setPage(1); }}
              className={`rounded-brand-sm border px-2.5 py-1.5 text-[11px] font-semibold transition ${!status ? "border-brand-line bg-brand/15 text-brand" : "border-line text-subtle hover:text-ink"}`}
            >
              الكل · {number(Object.values(counts).reduce((s: number, v) => s + Number(v), 0))}
            </button>
            {Object.entries(ORDER_STATUS).map(([key, meta]) => {
              const count = Number(counts[key] ?? 0);
              if (!count) return null;
              return (
                <button
                  key={key}
                  onClick={() => { setStatus(key); setPage(1); }}
                  className={`rounded-brand-sm border px-2.5 py-1.5 text-[11px] font-semibold transition ${status === key ? "border-brand-line bg-brand/15 text-brand" : "border-line text-subtle hover:text-ink"}`}
                >
                  <span className={`me-1 inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label} · {number(count)}
                </button>
              );
            })}
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="اسم، هاتف أو منتج…" className="w-56" />
            <Select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} className="w-40">
              <option value="">كل حالات الدفع</option>
              {Object.entries(PAYMENT_STATUS).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </Select>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-36" aria-label="من تاريخ" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-36" aria-label="إلى تاريخ" />
            <Button variant="ghost" size="sm" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {selected.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-brand border border-brand-line bg-brand/[0.07] px-3 py-2 text-[11px] text-brand">
            <span className="font-bold">{selected.length} طلب محدد</span>
            <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="h-8 w-44 py-0 text-xs">
              <option value="">اختر الحالة الجديدة…</option>
              {Object.entries(ORDER_STATUS).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </Select>
            <Button size="sm" loading={bulkBusy} disabled={!bulkStatus} onClick={runBulk}>تطبيق على المحدد</Button>
            <button className="text-brand hover:text-ink" onClick={() => setSelected([])}>إلغاء التحديد</button>
          </div>
        ) : null}
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل الطلبات">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : orders.length === 0 ? (
          <EmptyState
            title="لا توجد طلبات مطابقة"
            description="جرّب تغيير الفلاتر، أو شارك رابط متجرك ليبدأ أول طلب حقيقي في الوصول."
            icon={<Package className="h-5 w-5" />}
            action={<Link href={`/store/${subdomain}`} target="_blank" className="text-[11px] font-bold text-brand">فتح المتجر ←</Link>}
          />
        ) : (
          <>
            <TableShell minWidth={900}>
              <thead>
                <tr className="border-b border-line">
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => setSelected(e.target.checked ? orders.map((o: any) => o.id) : [])}
                      aria-label="تحديد الكل"
                    />
                  </Th>
                  <Th>الطلب</Th>
                  <Th>العميل</Th>
                  <Th>الحالة</Th>
                  <Th>الدفع</Th>
                  <Th>المبلغ</Th>
                  <Th>التاريخ</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-b border-line transition hover:bg-surface"
                    onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                  >
                    <Td>
                      <input
                        type="checkbox"
                        checked={selected.includes(order.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggle(order.id)}
                        aria-label={`تحديد الطلب ${order.orderNumber}`}
                      />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-brand">SND-{order.orderNumber}</span>
                        {order.source === "manual" ? <Badge tone="bg-surface text-subtle border-line">يدوي خارجي</Badge> : null}
                      </div>
                      <div className="mt-0.5 max-w-56 truncate text-[10px] text-subtle">{order.itemsSummary || `${order.items?.length ?? 0} منتج`}</div>
                    </Td>
                    <Td>
                      <div className="font-semibold text-ink">{order.customerName || "بدون اسم"}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{order.customerPhone || "—"}</div>
                    </Td>
                    <Td><StatusBadge status={order.status} /></Td>
                    <Td><PaymentBadge status={order.paymentStatus} /></Td>
                    <Td className="font-bold text-ink">{money(order.amountEgp, store.currency)}</Td>
                    <Td className="whitespace-nowrap text-[10px] text-subtle">{dateTime(order.createdAt)}</Td>
                    <Td><ArrowRight className="h-3.5 w-3.5 text-subtle" /></Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <div className="border-t border-line px-3">
              <Pagination page={page} totalPages={pagination?.totalPages ?? 1} total={pagination?.total} onChange={setPage} />
            </div>
          </>
        )}
      </Card>

      <ManualOrderModal open={manualOpen} onClose={() => setManualOpen(false)} onCreated={() => { setManualOpen(false); reload(); }} subdomain={subdomain} currency={store.currency} />
    </div>
  );
}

function ManualOrderModal({
  open,
  onClose,
  onCreated,
  subdomain,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  subdomain: string;
  currency: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    address: "",
    city: "",
    governorate: "",
    items_summary: "",
    amount_egp: "",
    payment_method: "COD",
    courier: "",
    notes: "",
  });

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.customer_name.trim()) {
      toast.error("اسم العميل مطلوب.");
      return;
    }
    setBusy(true);
    try {
      await api.orders.create(subdomain, {
        ...form,
        amount_egp: Number(form.amount_egp) || 0,
        amount_text: form.amount_egp ? `${form.amount_egp} ${currency}` : "",
        internal_notes: "",
      });
      toast.success("تم إنشاء الطلب يدوياً.");
      setForm({ customer_name: "", customer_phone: "", customer_email: "", address: "", city: "", governorate: "", items_summary: "", amount_egp: "", payment_method: "COD", courier: "", notes: "" });
      onCreated();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تسجيل طلب يدوي خارجي"
      description="سجّل طلباً تم بالفعل عبر واتساب أو الهاتف أو سوق خارجي. هذا السجل خارجي: لا يخصم مخزوناً ولا ينشئ منتجات أو بنود طلب."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button loading={busy} onClick={submit}>تسجيل الطلب</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="warning" title="لن يُخصم من المخزون">
          لا يربط سند هذا الطلب بأي منتج أو مخزون، ولا يعتبره دفعة إلكترونية. أدخل ملخص المنتجات والمبلغ كما تمّا فعلياً.
        </Alert>
        <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم العميل" required>
          <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="مثال: أحمد محمد" />
        </Field>
        <Field label="الهاتف">
          <Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" />
        </Field>
        <Field label="البريد الإلكتروني">
          <Input value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} dir="ltr" />
        </Field>
        <Field label="المحافظة">
          <Input value={form.governorate} onChange={(e) => set("governorate", e.target.value)} placeholder="القاهرة" />
        </Field>
        <Field label="المدينة / المنطقة">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="العنوان">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="ملخص المنتجات" className="sm:col-span-2">
          <Input value={form.items_summary} onChange={(e) => set("items_summary", e.target.value)} placeholder="قميص ×1 + حزام ×2" />
        </Field>
        <Field label={`المبلغ (${currency})`} hint="المبلغ الإجمالي كما تم الاتفاق عليه، وليس محسوباً من أسعار المنتجات.">
          <Input type="number" min={0} value={form.amount_egp} onChange={(e) => set("amount_egp", e.target.value)} dir="ltr" />
        </Field>
        <Field label="طريقة الدفع" hint="كما تمت فعلياً خارج سند.">
          <Select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
            <option value="COD">الدفع عند الاستلام</option>
            <option value="bank_transfer">تحويل بنكي</option>
            <option value="wallet">محفظة إلكترونية</option>
          </Select>
        </Field>
        <Field label="شركة الشحن">
          <Input value={form.courier} onChange={(e) => set("courier", e.target.value)} />
        </Field>
        <Field label="ملاحظات للعميل">
          <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------- detail ------------------------------- */

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.orders.get(subdomain, orderId), [subdomain, orderId]);
  const [nextStatus, setNextStatus] = useState("");
  const [nextPayment, setNextPayment] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const order = data?.order;

  useEffect(() => {
    if (order) {
      setNextStatus("");
      setNextPayment(order.paymentStatus);
    }
  }, [order?.id, order?.status, order?.paymentStatus]);

  const transitions = useMemo(() => (order ? ORDER_TRANSITIONS[order.status] ?? [] : []), [order?.status]);
  const paymentOptions = useMemo(
    () => (order ? [order.paymentStatus, ...(PAYMENT_TRANSITIONS[order.paymentStatus] ?? [])] : []),
    [order?.paymentStatus]
  );

  if (loading && !data) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  }
  if (error || !order) {
    return <Alert tone="error" title="تعذر تحميل الطلب">{safeError(error) || "الطلب غير موجود."}</Alert>;
  }

  const applyStatus = async () => {
    if (!nextStatus) return;
    setBusy(true);
    try {
      await api.orders.setStatus(subdomain, order.id, nextStatus);
      toast.success(`تم تحديث حالة الطلب إلى «${ORDER_STATUS[nextStatus]?.label}».`);
      setNextStatus("");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  const applyPayment = async () => {
    if (nextPayment === order.paymentStatus) return;
    setBusy(true);
    try {
      await api.orders.setPaymentStatus(subdomain, order.id, nextPayment);
      toast.success("تم تحديث حالة الدفع.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await api.orders.addNote(subdomain, order.id, note.trim(), internalNote);
      setNote("");
      toast.success("تمت إضافة الملاحظة إلى سجل الطلب.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const whatsappUrl = order.customerPhone ? `https://wa.me/${String(order.customerPhone).replace(/\D/g, "")}?text=${encodeURIComponent(`مرحباً ${order.customerName}، بخصوص طلبك SND-${order.orderNumber}`)}` : "";

  const requestRefund = async () => {
    const amount = Number(refundAmount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً.");
      return;
    }
    setBusy(true);
    try {
      await api.orders.requestRefund(subdomain, order.id, amount, refundReason);
      toast.success("تم تسجيل طلب الاسترداد بحالة معلّقة.");
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  const finaliseRefund = async (refundId: string, status: "processed" | "cancelled") => {
    try {
      await api.orders.processRefund(subdomain, order.id, refundId, status);
      toast.success(status === "processed" ? "تم تنفيذ الاسترداد." : "تم إلغاء طلب الاسترداد.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const events = [...(order.events ?? [])].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const refunds = order.refunds ?? [];
  const isManual = order.source === "manual";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`SND-${order.orderNumber}`}
        title={order.customerName || "طلب بدون اسم"}
        description={
          isManual
            ? `${dateTime(order.createdAt)} · طلب يدوي خارجي · ${order.paymentMethod || "COD"}`
            : `${dateTime(order.createdAt)} · ${order.items?.length ?? 0} منتج · ${order.paymentMethod || "COD"}`
        }
        actions={
          <>
            <Link href="/dashboard/orders" className="inline-flex h-10 items-center gap-2 rounded-brand border border-line px-4 text-xs font-semibold text-ink hover:bg-surface">
              <ArrowRight className="h-4 w-4" /> كل الطلبات
            </Link>
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-brand bg-success px-4 text-xs font-semibold text-on-success hover:bg-success/90">
                <MessageCircle className="h-4 w-4" /> مراسلة العميل
              </a>
            ) : null}
          </>
        }
      />

      {isManual ? (
        <Alert tone="warning" title="طلب يدوي خارجي">
          سُجّل هذا الطلب من لوحة التحكم لتوثيق عملية تمت خارج سند. لا يخصم من المخزون، ولا يربط منتجات أو أسعاراً بالكتالوج. حدّث حالته يدوياً بحسب ما يحدث فعلاً.
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={order.status} />
              <PaymentBadge status={order.paymentStatus} />
              {isManual ? <Badge tone="border-warning-line bg-warning-soft text-warning">يدوي خارجي</Badge> : null}
              {order.couponCode ? <Badge tone="border-info-line bg-info-soft text-info">كوبون {order.couponCode}</Badge> : null}
              {order.courier ? <Badge>{order.courier}</Badge> : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="الحالة التالية" hint={transitions.length ? undefined : "هذه الحالة نهائية — لا توجد انتقالات مسموحة."}>
                <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} disabled={!transitions.length}>
                  <option value="">اختر…</option>
                  {transitions.map((value) => (
                    <option key={value} value={value}>{ORDER_STATUS[value]?.label ?? value}</option>
                  ))}
                </Select>
              </Field>
              <Field label="حالة الدفع" hint={paymentOptions.length > 1 ? undefined : "الحالة نهائية — تُدار الاستردادات من قسم طلبات الاسترداد."}>
                <Select value={nextPayment} onChange={(e) => setNextPayment(e.target.value)} disabled={paymentOptions.length <= 1}>
                  {paymentOptions.map((key) => (
                    <option key={key} value={key}>{PAYMENT_STATUS[key]?.label ?? key}</option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end gap-2">
                <Button loading={busy} disabled={!nextStatus} onClick={applyStatus} className="flex-1">تحديث الحالة</Button>
                <Button variant="secondary" loading={busy} disabled={nextPayment === order.paymentStatus} onClick={applyPayment}>حفظ الدفع</Button>
              </div>
            </div>
            {transitions.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {transitions.map((value) => (
                  <button
                    key={value}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api.orders.setStatus(subdomain, order.id, value);
                        toast.success(`تم نقل الطلب إلى «${ORDER_STATUS[value]?.label}».`);
                        reload();
                      } catch (err: any) {
                        toast.error(safeError(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded-brand-sm border border-line px-2.5 py-1 text-[10px] font-semibold text-ink-soft transition hover:border-brand-line hover:text-ink"
                  >
                    → {ORDER_STATUS[value]?.label ?? value}
                  </button>
                ))}
              </div>
            ) : null}
          </Card>

          {isManual ? (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-4 py-3 text-sm font-bold text-ink">تفاصيل الطلب اليدوي</div>
              <div className="space-y-3 p-4 text-xs">
                <div>
                  <div className="text-[10px] text-subtle">ملخص المنتجات كما ورد في الطلب</div>
                  <div className="mt-1 whitespace-pre-wrap text-ink">{order.itemsSummary || "—"}</div>
                </div>
                <div className="flex items-center justify-between rounded-brand border border-line bg-surface px-3 py-2">
                  <span className="text-subtle">المبلغ المسجل</span>
                  <span className="font-bold text-ink">{order.amountText || money(order.amountEgp, store.currency)}</span>
                </div>
                <p className="text-[10px] leading-5 text-subtle">
                  هذا السجل خارجي وغير مرتبط بالمخزون. لا توجد بنود منتجات أو أسعار محسوبة من الكتالوج، لذلك لا نعرض جدول منتجات أو إجماليات آلية قد تبدو كأنها خصمت مخزوناً.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-4 py-3 text-sm font-bold text-ink">منتجات الطلب</div>
              <TableShell minWidth={560}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>المنتج</Th>
                    <Th>SKU</Th>
                    <Th>الكمية</Th>
                    <Th>سعر الوحدة</Th>
                    <Th>الإجمالي</Th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items ?? []).map((item: any) => (
                    <tr key={item.id} className="border-b border-line">
                      <Td>
                        <div className="font-semibold text-ink">{item.name}</div>
                        {item.variantLabel ? <div className="mt-0.5 text-[10px] text-subtle">{item.variantLabel}</div> : null}
                      </Td>
                      <Td className="font-mono text-[10px] text-subtle">{item.sku}</Td>
                      <Td>{number(item.qty)}</Td>
                      <Td>{money(item.unitPriceEgp, store.currency)}</Td>
                      <Td className="font-bold text-ink">{money(item.unitPriceEgp * item.qty, store.currency)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
              <div className="space-y-1.5 border-t border-line px-4 py-3 text-xs">
                <Row label="المجموع الفرعي" value={money(order.subtotal, store.currency)} />
                {order.discount ? <Row label="الخصم" value={`- ${money(order.discount, store.currency)}`} tone="text-success" /> : null}
                {order.shippingFee ? <Row label="الشحن" value={money(order.shippingFee, store.currency)} /> : null}
                <Row label="إجمالي الطلب" value={money(order.amountEgp, store.currency)} strong />
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-ink">المدفوعات والاسترداد</div>
              <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
                <RotateCcw className="h-3.5 w-3.5" /> طلب استرداد
              </Button>
            </div>
            {(order.payments ?? []).length === 0 ? (
              <div className="mt-3 text-[11px] text-subtle">لا توجد حركات دفع مسجّلة على هذا الطلب بعد.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {(order.payments ?? []).map((payment: any) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-brand border border-line bg-surface px-3 py-2 text-[11px]">
                    <div>
                      <div className="font-semibold text-ink">{payment.provider} · {payment.method || "—"}</div>
                      <div className="mt-0.5 text-[10px] text-subtle">{dateTime(payment.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{money(payment.amount, payment.currency || store.currency)}</span>
                      <Badge>{payment.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {refunds.length ? (
              <div className="mt-3 space-y-2">
                {refunds.map((refund: any) => (
                  <div key={refund.id} className="rounded-brand border border-line bg-surface px-3 py-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">{money(refund.amount, store.currency)}</span>
                      <Badge tone={refund.status === "processed" ? "border-success-line bg-success-soft text-success" : refund.status === "cancelled" ? "bg-surface text-subtle border-line" : "border-warning-line bg-warning-soft text-warning"}>
                        {refund.status === "processed" ? "منفّذ" : refund.status === "cancelled" ? "ملغي" : "معلّق"}
                      </Badge>
                    </div>
                    {refund.reason ? <div className="mt-1 text-[10px] text-subtle">{refund.reason}</div> : null}
                    {refund.status === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="success" onClick={() => finaliseRefund(refund.id, "processed")}>تنفيذ</Button>
                        <Button size="sm" variant="ghost" onClick={() => finaliseRefund(refund.id, "cancelled")}>إلغاء الطلب</Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-sm font-bold text-ink">بيانات العميل والشحن</div>
            <div className="mt-3 space-y-2.5 text-[11px]">
              <Row label="الاسم" value={order.customerName || "—"} />
              <Row label="الهاتف" value={<span dir="ltr" className="font-mono">{order.customerPhone || "—"}</span>} />
              <Row label="البريد" value={order.customerEmail || "—"} />
              <Row label="المحافظة" value={order.governorate || "—"} />
              <Row label="المدينة" value={order.city || "—"} />
              <Row label="العنوان" value={order.address || "—"} />
              <Row label="شركة الشحن" value={order.courier || "—"} />
            </div>
            {order.customer ? (
              <Link href={`/dashboard/customers?open=${order.customer.id}`} className="mt-3 inline-block text-[11px] font-bold text-brand">عرض ملف العميل ←</Link>
            ) : null}
            {order.notes ? (
              <div className="mt-3 rounded-brand border border-line bg-surface p-3 text-[11px] leading-6 text-ink-soft">
                <div className="mb-1 font-bold text-subtle">ملاحظات العميل</div>
                {order.notes}
              </div>
            ) : null}
          </Card>

          <Card className="p-4">
            <div className="text-sm font-bold text-ink">ملاحظة داخلية</div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: العميل طلب تغيير العنوان قبل الشحن…" className="mt-3 min-h-20" />
            <label className="mt-2 flex items-center gap-2 text-[11px] text-subtle">
              <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} />
              داخلية فقط (لا تظهر للعميل)
            </label>
            <Button size="sm" className="mt-3" disabled={!note.trim()} onClick={addNote}>إضافة للملاحظات</Button>
            {order.internalNotes ? (
              <div className="mt-3 space-y-1 rounded-brand border border-line bg-surface p-3 text-[10px] leading-6 text-subtle">
                {order.internalNotes.split("\n").filter(Boolean).map((line: string, index: number) => <div key={index}>• {line}</div>)}
              </div>
            ) : null}
          </Card>

          <Card className="p-4">
            <div className="text-sm font-bold text-ink">سجل الطلب</div>
            {events.length === 0 ? (
              <div className="mt-3 text-[11px] text-subtle">لا توجد أحداث مسجلة.</div>
            ) : (
              <ol className="mt-3 space-y-3">
                {events.map((event: any) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-ink">{event.message}</div>
                      <div className="mt-0.5 text-[10px] text-subtle">
                        {timeAgo(event.createdAt)} · {event.actor || "النظام"} · {event.type}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="طلب استرداد"
        description="يُسجّل الطلب بحالة معلّقة أولاً، ولا يتغير رصيد أي دفع حتى تنفيذه صراحةً."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundOpen(false)}>إلغاء</Button>
            <Button variant="danger" loading={busy} onClick={requestRefund}>تسجيل الطلب</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={`المبلغ (أقصى حد ${money(order.amountEgp, store.currency)})`} required>
            <Input type="number" min={0} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} dir="ltr" />
          </Field>
          <Field label="سبب الاسترداد">
            <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="min-h-20" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: React.ReactNode; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-subtle">{label}</span>
      <span className={`${strong ? "text-sm font-bold text-ink" : "font-semibold text-ink"} ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

/* Re-exported for the router so every order path resolves. */
export function OrderNotFound() {
  return (
    <EmptyState
      title="الطلب غير موجود"
      description="الرابط قد يكون قديماً أو الطلب لا ينتمي إلى متجرك."
      action={<Link href="/dashboard/orders" className="text-[11px] font-bold text-brand">العودة للطلبات ←</Link>}
    />
  );
}
