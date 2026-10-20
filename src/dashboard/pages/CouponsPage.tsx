import React, { useMemo, useState } from "react";
import { BadgePercent, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { date, money, number, safeError } from "../../lib/format";
import { useAsync } from "../../lib/useAsync";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  useToast,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { ActivePill, dateInputToIso, isoToDateInput, TableShell, Td, Th } from "../common";

const COUPON_TYPES: Record<string, string> = {
  percentage: "نسبة مئوية %",
  fixed: "مبلغ ثابت",
  free_shipping: "شحن مجاني",
};

interface CouponDraft {
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: string;
  startsAt: string;
  endsAt: string;
  minOrderValue: string;
  maxUses: string;
  perCustomerLimit: string;
  firstOrderOnly: boolean;
  freeShipping: boolean;
  productIds: string[];
  categoryIds: string[];
  isActive: boolean;
}

const emptyCoupon: CouponDraft = {
  code: "",
  type: "percentage",
  value: "10",
  startsAt: "",
  endsAt: "",
  minOrderValue: "0",
  maxUses: "",
  perCustomerLimit: "",
  firstOrderOnly: false,
  freeShipping: false,
  productIds: [],
  categoryIds: [],
  isActive: true,
};

export function CouponsPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CouponDraft>(emptyCoupon);

  const { data, loading, error, reload } = useAsync(() => api.coupons.list(subdomain), [subdomain]);
  const productsAsync = useAsync(() => api.products.list(subdomain, { pageSize: 100 }), [subdomain]);
  const categoriesAsync = useAsync(() => api.categories.list(subdomain, { pageSize: 100 }), [subdomain]);

  const currency = store?.currency ?? "EGP";
  const products = productsAsync.data?.products ?? [];
  const categories = categoriesAsync.data?.categories ?? [];

  const coupons = useMemo(() => {
    const list = data?.coupons ?? [];
    if (statusFilter === "active") return list.filter((coupon: any) => coupon.isActive);
    if (statusFilter === "paused") return list.filter((coupon: any) => !coupon.isActive);
    return list;
  }, [data, statusFilter]);

  const openEditor = (coupon: any | null) => {
    setEditing(coupon);
    setDraft(
      coupon
        ? {
            code: coupon.code ?? "",
            type: coupon.type ?? "percentage",
            value: String(coupon.value ?? 0),
            startsAt: isoToDateInput(coupon.startsAt),
            endsAt: isoToDateInput(coupon.endsAt),
            minOrderValue: String(coupon.minOrderValue ?? 0),
            maxUses: coupon.maxUses != null ? String(coupon.maxUses) : "",
            perCustomerLimit: coupon.perCustomerLimit != null ? String(coupon.perCustomerLimit) : "",
            firstOrderOnly: Boolean(coupon.firstOrderOnly),
            freeShipping: Boolean(coupon.freeShipping),
            productIds: Array.isArray(coupon.productIds) ? coupon.productIds : [],
            categoryIds: Array.isArray(coupon.categoryIds) ? coupon.categoryIds : [],
            isActive: Boolean(coupon.isActive),
          }
        : emptyCoupon
    );
    setEditorOpen(true);
  };

  const save = async () => {
    if (draft.code.trim().length < 2) {
      toast.error("أدخل كوداً من حرفين على الأقل.");
      return;
    }
    if (draft.type === "percentage" && Number(draft.value) > 100) {
      toast.error("نسبة الخصم لا يمكن أن تتجاوز 100%.");
      return;
    }
    const body: Record<string, unknown> = {
      code: draft.code.trim().toUpperCase(),
      type: draft.type,
      value: draft.type === "free_shipping" ? 0 : Number(draft.value) || 0,
      startsAt: dateInputToIso(draft.startsAt) ?? null,
      endsAt: dateInputToIso(draft.endsAt, true) ?? null,
      minOrderValue: Number(draft.minOrderValue) || 0,
      maxUses: draft.maxUses ? Number(draft.maxUses) : null,
      perCustomerLimit: draft.perCustomerLimit ? Number(draft.perCustomerLimit) : null,
      firstOrderOnly: draft.firstOrderOnly,
      freeShipping: draft.freeShipping || draft.type === "free_shipping",
      productIds: draft.productIds,
      categoryIds: draft.categoryIds,
      isActive: draft.isActive,
    };
    setSaving(true);
    try {
      if (editing) await api.coupons.update(subdomain, editing.id, body);
      else await api.coupons.create(subdomain, body);
      toast.success(editing ? "تم تحديث الكوبون." : "تم إنشاء الكوبون.");
      setEditorOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon: any) => {
    try {
      await api.coupons.update(subdomain, coupon.id, { isActive: !coupon.isActive });
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.coupons.remove(subdomain, deleting.id);
      toast.success("تم حذف الكوبون.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleId = (key: "productIds" | "categoryIds", id: string) => {
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((x) => x !== id) : [...current[key], id],
    }));
  };

  const scopeLabel = (coupon: any) => {
    const productCount = Array.isArray(coupon.productIds) ? coupon.productIds.length : 0;
    const categoryCount = Array.isArray(coupon.categoryIds) ? coupon.categoryIds.length : 0;
    if (!productCount && !categoryCount) return "كل المنتجات";
    const parts: string[] = [];
    if (productCount) parts.push(`${productCount} منتج`);
    if (categoryCount) parts.push(`${categoryCount} فئة`);
    return parts.join(" + ");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="النمو"
        title="الكوبونات"
        description="أنشئ أكواد خصم لتشجيع الشراء. تُتحقق كل كوبون على الخادم عند الدفع ويمكنك تحديد نطاقه وحدود استخدامه."
        actions={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> كوبون جديد</Button>}
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
            <option value="">كل الكوبونات</option>
            <option value="active">المفعّلة فقط</option>
            <option value="paused">المتوقفة فقط</option>
          </Select>
          <Button variant="ghost" size="sm" className="ms-auto" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل الكوبونات">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : coupons.length === 0 ? (
          <EmptyState
            title="لا توجد كوبونات"
            description="جرّب كوبون ترحيبي مثل WELCOME10 يعطي 10% للعملاء الجدد."
            icon={<BadgePercent className="h-5 w-5" />}
            action={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> إنشاء أول كوبون</Button>}
          />
        ) : (
          <TableShell minWidth={960}>
            <thead>
              <tr className="border-b border-slate-800/70">
                <Th>الكود</Th>
                <Th>الخصم</Th>
                <Th>النطاق</Th>
                <Th>الاستخدامات</Th>
                <Th>الفترة</Th>
                <Th>الحالة</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon: any) => (
                <tr key={coupon.id} className="border-b border-slate-800/40 transition hover:bg-slate-800/20">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-2 py-1 font-mono text-[11px] font-bold text-blue-200" dir="ltr">{coupon.code}</span>
                      <CopyButton value={coupon.code} label="" />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {coupon.firstOrderOnly ? <Badge tone="bg-violet-500/10 text-violet-300 border-violet-500/25">أول طلب فقط</Badge> : null}
                      {coupon.freeShipping ? <Badge tone="bg-emerald-500/10 text-emerald-300 border-emerald-500/25">شحن مجاني</Badge> : null}
                    </div>
                  </Td>
                  <Td>
                    <span className="font-semibold text-slate-100">
                      {coupon.type === "percentage"
                        ? `${number(coupon.value)}%`
                        : coupon.type === "fixed"
                          ? money(coupon.value, currency)
                          : "شحن مجاني"}
                    </span>
                    {coupon.minOrderValue > 0 ? <div className="mt-0.5 text-[10px] text-slate-500">حد أدنى {money(coupon.minOrderValue, currency)}</div> : null}
                  </Td>
                  <Td><span className="text-[11px] text-slate-400">{scopeLabel(coupon)}</span></Td>
                  <Td>
                    <div className="text-[11px] text-slate-300">{number(coupon.usageCount ?? 0)}{coupon.maxUses ? ` / ${number(coupon.maxUses)}` : ""}</div>
                    <div className="text-[10px] text-slate-500">خصومات {money(coupon.totalDiscount ?? 0, currency)}</div>
                  </Td>
                  <Td>
                    <div className="text-[11px] text-slate-400">{date(coupon.startsAt)} ← {date(coupon.endsAt)}</div>
                    {coupon.perCustomerLimit ? <div className="mt-0.5 text-[10px] text-slate-500">الحد لكل عميل: {number(coupon.perCustomerLimit)}</div> : null}
                  </Td>
                  <Td>
                    <button onClick={() => toggleActive(coupon)} aria-label="تبديل التفعيل">
                      <ActivePill active={coupon.isActive} />
                    </button>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditor(coupon)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <button onClick={() => setDeleting(coupon)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300" title="حذف">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? `تعديل الكوبون ${editing.code}` : "كوبون جديد"}
        description="الكوبون يُطبّق تلقائياً عند إدخال الكود في السلة أو صفحة الدفع."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>إلغاء</Button>
            <Button loading={saving} onClick={save}>{editing ? "حفظ التعديلات" : "إنشاء الكوبون"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الكود" required hint="أحرف وأرقام بدون مسافات، مثال: WELCOME10">
            <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} dir="ltr" className="font-mono" />
          </Field>
          <Field label="النوع">
            <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CouponDraft["type"] })}>
              {Object.entries(COUPON_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          {draft.type !== "free_shipping" ? (
            <Field label={draft.type === "percentage" ? "نسبة الخصم (%)" : `قيمة الخصم (${currency})`} required>
              <Input type="number" min={0} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
            </Field>
          ) : null}
          <Field label={`الحد الأدنى للطلب (${currency})`}>
            <Input type="number" min={0} value={draft.minOrderValue} onChange={(e) => setDraft({ ...draft, minOrderValue: e.target.value })} />
          </Field>
          <Field label="يبدأ في">
            <Input type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
          </Field>
          <Field label="ينتهي في">
            <Input type="date" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
          </Field>
          <Field label="الحد الأقصى للاستخدام" hint="اتركه فارغاً لاستخدام غير محدود">
            <Input type="number" min={1} value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })} />
          </Field>
          <Field label="الحد لكل عميل" hint="يعتمد على رقم هاتف العميل">
            <Input type="number" min={1} value={draft.perCustomerLimit} onChange={(e) => setDraft({ ...draft, perCustomerLimit: e.target.value })} />
          </Field>

          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <Switch checked={draft.firstOrderOnly} onChange={(v) => setDraft({ ...draft, firstOrderOnly: v })} label="أول طلب فقط" description="يُقبل فقط للعملاء الذين لم يشتروا سابقاً." />
            <Switch checked={draft.freeShipping || draft.type === "free_shipping"} onChange={(v) => setDraft({ ...draft, freeShipping: v })} disabled={draft.type === "free_shipping"} label="شحن مجاني" description="يصفر رسوم الشحن عند استخدام الكوبون." />
          </div>

          <Field label="يقتصر على منتجات" hint="اتركه فارغاً لتشمل كل المنتجات">
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-800 p-2">
              {products.map((product: any) => (
                <label key={product.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={draft.productIds.includes(product.id)}
                    onChange={() => toggleId("productIds", product.id)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-blue-600"
                  />
                  <span className="truncate">{product.nameAr || product.nameEn || product.sku}</span>
                </label>
              ))}
              {products.length === 0 ? <div className="px-2 py-4 text-center text-[10px] text-slate-500">لا توجد منتجات بعد.</div> : null}
            </div>
          </Field>
          <Field label="يقتصر على فئات" hint="اتركه فارغاً لتشمل كل الفئات">
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-800 p-2">
              {categories.map((category: any) => (
                <label key={category.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={draft.categoryIds.includes(category.id)}
                    onChange={() => toggleId("categoryIds", category.id)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-blue-600"
                  />
                  <span className="truncate">{category.nameAr || category.nameEn || category.name}</span>
                </label>
              ))}
              {categories.length === 0 ? <div className="px-2 py-4 text-center text-[10px] text-slate-500">لا توجد فئات بعد.</div> : null}
            </div>
          </Field>

          <div className="sm:col-span-2">
            <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="تفعيل الكوبون" description="الكوبونات المتوقفة لا تُقبل عند الدفع." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف الكوبون"
        description={deleting ? `سيتم حذف الكوبون ${deleting.code} نهائياً.` : undefined}
        loading={deleteBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
