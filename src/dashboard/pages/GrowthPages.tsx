import React, { useState } from "react";
import {
  Link2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { api } from "../../lib/api";
import { dateTime, money, number, percent, safeError, timeAgo } from "../../lib/format";
import { useAsync } from "../../lib/useAsync";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Switch,
  useToast,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { ActivePill, dateInputToIso, isoToDateInput, TableShell, Td, Th } from "../common";
import { getBusinessExamples } from "../businessExamples";

/* --------------------------- abandoned carts --------------------------- */

const CART_STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: "مفتوحة", tone: "bg-warning-soft text-warning border-warning-line" },
  reminded: { label: "تم التذكير", tone: "bg-brand/10 text-brand border-brand-line" },
  recovered: { label: "تم الاسترجاع", tone: "bg-success-soft text-success border-success-line" },
  ignored: { label: "متجاهلة", tone: "bg-surface text-ink-soft border-line" },
};

export function AbandonedCartsPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => api.abandoned.list(subdomain, { page, pageSize: 20, status: status || undefined, search: search || undefined }),
    [subdomain, page, status, search]
  );

  const carts = data?.carts ?? [];
  const summary = data?.summary;
  const currency = store?.currency ?? "EGP";
  const whatsapp = data?.whatsapp;
  const manualWhatsAppOnly = whatsapp?.sendState === "manual_links_only" || !whatsapp?.sendState;
  const templateRequired = whatsapp?.sendState === "template_required";

  const setRecovery = async (cart: any, recoveryStatus: string) => {
    try {
      await api.abandoned.update(subdomain, cart.id, recoveryStatus);
      toast.success("تم تحديث حالة السلة.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const remind = async (cart: any) => {
    setReminding(cart.id);
    try {
      const result = await api.abandoned.remind(subdomain, cart.id);
      if (result.sent) {
        toast.success("تم إرسال التذكير عبر واتساب.");
      } else if (result.whatsapp_url) {
        window.open(result.whatsapp_url, "_blank", "noopener");
        toast.push(result.note ?? "افتح المحادثة لإرسال التذكير يدوياً.");
      } else {
        toast.error(safeError({ message: result.note }));
      }
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setReminding(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.abandoned.remove(subdomain, deleting.id);
      toast.success("تم حذف السلة.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="النمو"
        title="السلات المتروكة"
        description="تابع العملاء الذين أضافوا منتجات ولم يكملوا الطلب، وذكّرهم لاستعادتهم قبل أن يشتروا من مكان آخر."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="سلات مفتوحة" value={number(summary?.openCount ?? 0)} icon={<ShoppingBag className="h-5 w-5" />} accent="warning" />
        <StatCard label="قيمة السلات المفتوحة" value={money(summary?.openValue ?? 0, currency)} accent="brand" />
        <StatCard label="سلات مستعادة" value={number(summary?.recoveredCount ?? 0)} icon={<TrendingUp className="h-5 w-5" />} accent="success" />
      </div>

      <Alert
        tone={whatsapp?.sendState === "auto_send_ready" ? "success" : templateRequired ? "warning" : "info"}
        title={
          whatsapp?.sendState === "auto_send_ready"
            ? "الإرسال التلقائي عبر واتساب متاح"
            : templateRequired
              ? "الإرسال التلقائي يحتاج قالباً معتمداً"
              : "التذكير عبر رابط واتساب يدوي"
        }
      >
        {whatsapp?.sendState === "auto_send_ready"
          ? "يمكن إرسال التذكير مباشرة. مع ذلك، تحقق دائماً من حالة الرسالة قبل اعتبار العميل قد تم تذكيره."
          : templateRequired
            ? "بيانات واتساب محفوظة على الخادم، لكن الإرسال التلقائي لا يعمل قبل اعتماد قالب رسالة. زر التذكير يفتح المحادثة برسالة جاهزة لإرسالها يدوياً."
            : "لا يوجد مزود إرسال تلقائي. زر التذكير يفتح واتساب برسالة جاهزة، وتبقى المسؤولية عليك لإرسالها. لن تُعلَّم السلة كمذكّرة تلقائياً."}
      </Alert>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="ابحث بالاسم أو الهاتف…" className="w-64" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-44">
            <option value="">كل الحالات</option>
            {Object.entries(CART_STATUS).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </Select>
          <Button variant="ghost" size="sm" className="ms-auto" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل السلات">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : carts.length === 0 ? (
          <EmptyState
            title="لا توجد سلات متروكة"
            description="عندما يبدأ عميل بالطلب ويترك سلته، ستظهر هنا تلقائياً مع بيانات التواصل إن توفرت."
            icon={<ShoppingBag className="h-5 w-5" />}
          />
        ) : (
          <>
            <TableShell minWidth={920}>
              <thead>
                <tr className="border-b border-line">
                  <Th>العميل</Th>
                  <Th>المنتجات</Th>
                  <Th>قيمة السلة</Th>
                  <Th>آخر نشاط</Th>
                  <Th>الحالة</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {carts.map((cart: any) => {
                  const meta = CART_STATUS[cart.recoveryStatus] ?? { label: cart.recoveryStatus, tone: "" };
                  const items: any[] = Array.isArray(cart.items) ? cart.items : [];
                  return (
                    <tr key={cart.id} className="border-b border-line transition hover:bg-surface">
                      <Td>
                        <div className="font-semibold text-ink">{cart.customerName || cart.customer?.name || "زائر"}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{cart.phone || cart.email || "—"}</div>
                      </Td>
                      <Td>
                        <div className="max-w-[260px] truncate text-[11px] text-subtle">
                          {items.length ? items.map((item) => `${item.name || item.sku} ×${item.qty}`).join("، ") : "—"}
                        </div>
                      </Td>
                      <Td><span className="font-semibold text-ink">{money(cart.cartValue, currency)}</span></Td>
                      <Td><span className="text-[11px] text-subtle">{timeAgo(cart.lastActivityAt)}</span></Td>
                      <Td><Badge tone={meta.tone}>{meta.label}</Badge></Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          {cart.phone ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={reminding === cart.id}
                              onClick={() => remind(cart)}
                              title={
                                manualWhatsAppOnly
                                  ? "فتح واتساب لإرسال التذكير يدوياً"
                                  : templateRequired
                                    ? "فتح واتساب (الإرسال التلقائي يحتاج قالباً معتمداً)"
                                    : "إرسال تذكير واتساب"
                              }
                              aria-label="تذكير عبر واتساب"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          <Select
                            value={cart.recoveryStatus}
                            onChange={(e) => setRecovery(cart, e.target.value)}
                            className="h-8 w-32 text-[11px]"
                            aria-label="حالة الاسترجاع"
                          >
                            {Object.entries(CART_STATUS).map(([key, statusMeta]) => (
                              <option key={key} value={key}>{statusMeta.label}</option>
                            ))}
                          </Select>
                          <button onClick={() => setDeleting(cart)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
            <Pagination page={page} totalPages={data?.pagination?.totalPages ?? 1} total={data?.pagination?.total} onChange={setPage} />
          </>
        )}
      </Card>

      <Alert tone="info" title="حالة التذكير">
        {templateRequired
          ? "مزود واتساب محفوظ، لكن الإرسال التلقائي يحتاج قالباً معتمداً. الرابط يفتح المحادثة برسالة جاهزة."
          : "التذكير يفتح واتساب برسالة جاهزة لإرسالها يدوياً. لا ندّعي إرسالاً تلقائياً لم يحدث."}
      </Alert>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف السلة المتروكة"
        description={deleting ? `سيتم حذف سلة ${deleting.customerName || deleting.phone || "الزائر"}.` : undefined}
        loading={deleteBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/* ------------------------------- upsells ------------------------------- */

const PLACEMENTS: Record<string, string> = {
  cart: "صفحة السلة",
  product: "صفحة المنتج",
  checkout: "صفحة الدفع",
};

interface UpsellDraft {
  name: string;
  triggerProductId: string;
  offerProductId: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  priority: string;
  placement: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const emptyUpsell: UpsellDraft = {
  name: "",
  triggerProductId: "",
  offerProductId: "",
  discountType: "percentage",
  discountValue: "10",
  priority: "0",
  placement: "cart",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

export function UpsellsPage() {
  const { subdomain, store } = useDashboard();
  const examples = getBusinessExamples(store?.businessType);
  const toast = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UpsellDraft>(emptyUpsell);

  const { data, loading, error, reload } = useAsync(() => api.upsells.list(subdomain), [subdomain]);
  const productsAsync = useAsync(() => api.products.list(subdomain, { pageSize: 100 }), [subdomain]);

  const upsells = data?.upsells ?? [];
  const products = productsAsync.data?.products ?? [];

  const productName = (id: string | null | undefined) => {
    const product = products.find((p: any) => p.id === id);
    return product ? product.nameAr || product.nameEn || product.sku : null;
  };

  const openEditor = (upsell: any | null) => {
    setEditing(upsell);
    setDraft(
      upsell
        ? {
            name: upsell.name ?? "",
            triggerProductId: upsell.triggerProductId ?? "",
            offerProductId: upsell.offerProductId ?? "",
            discountType: upsell.discountType === "fixed" ? "fixed" : "percentage",
            discountValue: String(upsell.discountValue ?? 0),
            priority: String(upsell.priority ?? 0),
            placement: upsell.placement ?? "cart",
            isActive: Boolean(upsell.isActive),
            startsAt: isoToDateInput(upsell.startsAt),
            endsAt: isoToDateInput(upsell.endsAt),
          }
        : emptyUpsell
    );
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.offerProductId) {
      toast.error("اختر المنتج الذي ستعرضه في العرض.");
      return;
    }
    const body: Record<string, unknown> = {
      name: draft.name.trim(),
      offerProductId: draft.offerProductId,
      triggerProductId: draft.triggerProductId || null,
      discountType: draft.discountType,
      discountValue: Number(draft.discountValue) || 0,
      priority: Number(draft.priority) || 0,
      placement: draft.placement,
      isActive: draft.isActive,
      startsAt: dateInputToIso(draft.startsAt) ?? null,
      endsAt: dateInputToIso(draft.endsAt, true) ?? null,
    };
    setSaving(true);
    try {
      if (editing) await api.upsells.update(subdomain, editing.id, body);
      else await api.upsells.create(subdomain, body);
      toast.success(editing ? "تم تحديث العرض." : "تم إنشاء العرض.");
      setEditorOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (upsell: any) => {
    try {
      await api.upsells.update(subdomain, upsell.id, { isActive: !upsell.isActive });
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.upsells.remove(subdomain, deleting.id);
      toast.success("تم حذف العرض.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="النمو"
        title="العروض الإضافية"
        description="اعرض منتجاً بخصم عند إضافة منتج معيّن للسلة أو عند تصفح منتج، لرفع متوسط قيمة الطلب."
        actions={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> عرض جديد</Button>}
      />

      {error ? <Alert tone="error" title="تعذر تحميل العروض">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : upsells.length === 0 ? (
          <EmptyState
            title="لا توجد عروض إضافية"
            description={`مثال: ${examples.relatedAr} بخصم 15%. العروض تظهر داخل صفحة المتجر.`}
            icon={<TrendingUp className="h-5 w-5" />}
            action={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> إنشاء أول عرض</Button>}
          />
        ) : (
          <TableShell minWidth={880}>
            <thead>
              <tr className="border-b border-line">
                <Th>العرض</Th>
                <Th>المنتج المعروض</Th>
                <Th>الخصم</Th>
                <Th>الموضع</Th>
                <Th>التحويلات</Th>
                <Th>الحالة</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {upsells.map((upsell: any) => (
                <tr key={upsell.id} className="border-b border-line transition hover:bg-surface">
                  <Td>
                    <div className="font-semibold text-ink">{upsell.name || "عرض بدون اسم"}</div>
                    {upsell.triggerProductId ? (
                      <div className="mt-0.5 text-[10px] text-subtle">يظهر مع: {productName(upsell.triggerProductId) ?? upsell.triggerProductId}</div>
                    ) : (
                      <div className="mt-0.5 text-[10px] text-subtle">يظهر لكل العملاء في {PLACEMENTS[upsell.placement] ?? upsell.placement}</div>
                    )}
                  </Td>
                  <Td>{upsell.offerProduct?.nameAr || upsell.offerProduct?.nameEn || upsell.offerProduct?.sku || "—"}</Td>
                  <Td>
                    <span className="font-semibold text-success">
                      {upsell.discountType === "percentage" ? percent(upsell.discountValue) : money(upsell.discountValue, upsell.offerProduct ? undefined : "EGP")}
                    </span>
                  </Td>
                  <Td><Badge tone="bg-surface text-ink-soft border-line">{PLACEMENTS[upsell.placement] ?? upsell.placement}</Badge></Td>
                  <Td>
                    <div className="text-[11px] text-ink-soft">{number(upsell.conversions)} / {number(upsell.impressions)}</div>
                    <div className="text-[10px] text-subtle">{percent(upsell.conversionRate)} معدل تحويل</div>
                  </Td>
                  <Td>
                    <button onClick={() => toggleActive(upsell)} aria-label="تبديل التفعيل">
                      <ActivePill active={upsell.isActive} />
                    </button>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditor(upsell)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <button onClick={() => setDeleting(upsell)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
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
        title={editing ? "تعديل العرض الإضافي" : "عرض إضافي جديد"}
        description="يظهر العرض داخل صفحة المتجر حسب الموضع المختار."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>إلغاء</Button>
            <Button loading={saving} onClick={save}>{editing ? "حفظ التعديلات" : "إنشاء العرض"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم العرض" className="sm:col-span-2" hint={`للتنظيم الداخلي فقط، مثال: ${examples.relatedAr}`}>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={examples.relatedAr} />
          </Field>
          <Field label="المنتج المعروض" required hint="المنتج الذي سيظهر كعرض بخصم">
            <Select value={draft.offerProductId} onChange={(e) => setDraft({ ...draft, offerProductId: e.target.value })}>
              <option value="">اختر منتجاً…</option>
              {products.map((product: any) => (
                <option key={product.id} value={product.id}>{product.nameAr || product.nameEn || product.sku}</option>
              ))}
            </Select>
          </Field>
          <Field label="يظهر عند وجود" hint="اتركه فارغاً ليظهر لكل الزوار في الموضع المحدد">
            <Select value={draft.triggerProductId} onChange={(e) => setDraft({ ...draft, triggerProductId: e.target.value })}>
              <option value="">بدون شرط</option>
              {products.map((product: any) => (
                <option key={product.id} value={product.id}>{product.nameAr || product.nameEn || product.sku}</option>
              ))}
            </Select>
          </Field>
          <Field label="نوع الخصم">
            <Select value={draft.discountType} onChange={(e) => setDraft({ ...draft, discountType: e.target.value as UpsellDraft["discountType"] })}>
              <option value="percentage">نسبة %</option>
              <option value="fixed">مبلغ ثابت</option>
            </Select>
          </Field>
          <Field label="قيمة الخصم">
            <Input type="number" min={0} value={draft.discountValue} onChange={(e) => setDraft({ ...draft, discountValue: e.target.value })} />
          </Field>
          <Field label="الموضع">
            <Select value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value })}>
              {Object.entries(PLACEMENTS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="الأولوية" hint="الأعلى يظهر أولاً عند تعدد العروض">
            <Input type="number" min={0} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} />
          </Field>
          <Field label="يبدأ في">
            <Input type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
          </Field>
          <Field label="ينتهي في">
            <Input type="date" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="تفعيل العرض" description="العروض المتوقفة تبقى محفوظة ولا تظهر للعملاء." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف العرض الإضافي"
        description={deleting ? `سيتم حذف «${deleting.name || "العرض"}» نهائياً.` : undefined}
        loading={deleteBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/* --------------------------- related products --------------------------- */

interface RelatedDraft {
  productId: string;
  relatedProductIds: string[];
  sortOrder: string;
  isActive: boolean;
}

const emptyRelated: RelatedDraft = { productId: "", relatedProductIds: [], sortOrder: "0", isActive: true };

export function RelatedProductsPage() {
  const { subdomain } = useDashboard();
  const toast = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterProduct, setFilterProduct] = useState("");
  const [draft, setDraft] = useState<RelatedDraft>(emptyRelated);

  const { data, loading, error, reload } = useAsync(
    () => api.related.list(subdomain, filterProduct || undefined),
    [subdomain, filterProduct]
  );
  const productsAsync = useAsync(() => api.products.list(subdomain, { pageSize: 100 }), [subdomain]);

  const relations = data?.relations ?? [];
  const products = productsAsync.data?.products ?? [];

  const name = (product: any) => product?.nameAr || product?.nameEn || product?.sku || "—";

  const grouped = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const relation of relations) {
      const list = map.get(relation.productId) ?? [];
      list.push(relation);
      map.set(relation.productId, list);
    }
    return [...map.values()];
  }, [relations]);

  const openEditor = (group: any[] | null) => {
    if (group) {
      setEditing(group[0].productId);
      setDraft({
        productId: group[0].productId,
        relatedProductIds: group.map((relation) => relation.relatedProductId),
        sortOrder: String(group[0].sortOrder ?? 0),
        isActive: Boolean(group[0].isActive),
      });
    } else {
      setEditing(null);
      setDraft(emptyRelated);
    }
    setEditorOpen(true);
  };

  const toggleRelated = (id: string) => {
    setDraft((current) => ({
      ...current,
      relatedProductIds: current.relatedProductIds.includes(id)
        ? current.relatedProductIds.filter((x) => x !== id)
        : [...current.relatedProductIds, id],
    }));
  };

  const save = async () => {
    if (editing) {
      // Editing an existing group: keep the linked products fixed, update order/state.
      setSaving(true);
      try {
        for (const relation of relations.filter((r) => r.productId === editing)) {
          await api.related.update(subdomain, relation.id, {
            sortOrder: Number(draft.sortOrder) || 0,
            isActive: draft.isActive,
          });
        }
        toast.success("تم تحديث العلاقات.");
        setEditorOpen(false);
        reload();
      } catch (err: any) {
        toast.error(safeError(err));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!draft.productId || !draft.relatedProductIds.length) {
      toast.error("اختر المنتج الأساسي ومنتجاً مرتبطاً واحداً على الأقل.");
      return;
    }
    setSaving(true);
    try {
      await api.related.create(subdomain, {
        productId: draft.productId,
        relatedProductIds: draft.relatedProductIds,
        sortOrder: Number(draft.sortOrder) || 0,
        isActive: draft.isActive,
      });
      toast.success("تم ربط المنتجات.");
      setEditorOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  const removeRelation = async (relation: any) => {
    try {
      await api.related.remove(subdomain, relation.id);
      toast.success("تم حذف الربط.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const removeGroup = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      for (const relation of deleting as any[]) {
        await api.related.remove(subdomain, relation.id);
      }
      toast.success("تم حذف كل روابط المنتج.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="النمو"
        title="المنتجات المرتبطة"
        description="اقترح منتجات مشابهة أسفل صفحة المنتج ليزيد احتمال إتمام الطلب بمنتجات إضافية."
        actions={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> ربط منتجات</Button>}
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="w-72">
            <option value="">كل المنتجات</option>
            {products.map((product: any) => (
              <option key={product.id} value={product.id}>{name(product)}</option>
            ))}
          </Select>
          <Button variant="ghost" size="sm" className="ms-auto" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل العلاقات">{safeError(error)}</Alert> : null}

      {loading && !data ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : grouped.length === 0 ? (
        <Card>
          <EmptyState
            title="لا توجد منتجات مرتبطة بعد"
            description="اختر منتجاً واربط به منتجات مشابهة. ستظهر تلقائياً في صفحة المنتج داخل متجرك."
            icon={<Link2 className="h-5 w-5" />}
            action={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> ابدأ الربط</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {grouped.map((group) => (
            <Card key={group[0].productId} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-ink">{name(group[0].product)}</div>
                  <div className="mt-0.5 text-[11px] text-subtle">{group.length} منتج مرتبط</div>
                </div>
                <div className="flex items-center gap-1">
                  <ActivePill active={group.every((relation) => relation.isActive)} />
                  <Button variant="ghost" size="sm" onClick={() => openEditor(group)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <button onClick={() => setDeleting(group)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف الكل">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {group.map((relation: any) => (
                  <span key={relation.id} className="inline-flex items-center gap-1.5 rounded-brand-sm border border-line bg-surface px-2 py-1 text-[11px] text-ink-soft">
                    {name(relation.relatedProduct)}
                    <button onClick={() => removeRelation(relation)} className="text-subtle hover:text-danger" aria-label="إزالة">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? "تعديل الروابط" : "ربط منتجات"}
        description={editing ? "يمكنك تعديل الترتيب والتفعيل، أو إزالة منتجات من البطاقات مباشرة." : "اختر المنتج الأساسي ثم المنتجات التي ستظهر معه."}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>إلغاء</Button>
            <Button loading={saving} onClick={save}>{editing ? "حفظ" : "ربط المنتجات"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editing ? (
            <Field label="المنتج الأساسي" required>
              <Select value={draft.productId} onChange={(e) => setDraft({ ...draft, productId: e.target.value, relatedProductIds: [] })}>
                <option value="">اختر منتجاً…</option>
                {products.map((product: any) => (
                  <option key={product.id} value={product.id}>{name(product)}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="rounded-brand border border-line bg-surface p-3 text-xs text-ink-soft">
              المنتج الأساسي: <span className="font-semibold text-ink">{name(grouped.find((g) => g[0].productId === editing)?.[0]?.product)}</span>
            </div>
          )}

          {!editing ? (
            <div>
              <div className="mb-2 text-xs font-semibold text-ink-soft">المنتجات المرتبطة <span className="text-danger">*</span></div>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-brand border border-line p-2">
                {products.filter((product: any) => product.id !== draft.productId).map((product: any) => (
                  <label key={product.id} className="flex cursor-pointer items-center gap-2.5 rounded-brand-sm px-2.5 py-2 text-xs text-ink-soft transition hover:bg-surface">
                    <input
                      type="checkbox"
                      checked={draft.relatedProductIds.includes(product.id)}
                      onChange={() => toggleRelated(product.id)}
                      className="h-4 w-4 rounded border-line bg-card accent-brand"
                    />
                    {name(product)}
                    <span className="ms-auto text-[10px] text-subtle font-mono" dir="ltr">{product.sku}</span>
                  </label>
                ))}
                {products.length === 0 ? <div className="px-3 py-6 text-center text-[11px] text-subtle">أضف منتجات أولاً من صفحة المنتجات.</div> : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ترتيب العرض">
              <Input type="number" min={0} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />
            </Field>
            <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="مفعّلة" description="تظهر في صفحة المنتج." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف كل روابط المنتج"
        description="سيتم حذف جميع المنتجات المرتبطة بهذا المنتج."
        loading={deleteBusy}
        onConfirm={removeGroup}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
