import React, { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Package, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, mediaUrl } from "../../lib/api";
import { date, money, number, safeError } from "../../lib/format";
import { Link } from "../../lib/router";
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
  Switch,
  Textarea,
  useToast,
} from "../../components/ui";
import { MultiImageUploader } from "../../components/ImageUploader";
import { useDashboard } from "../DashboardShell";
import { ActivePill, TableShell, Td, Th } from "../common";

interface VariantDraft {
  id?: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  optionValues: Record<string, string>;
  imageUrl: string;
  isActive: boolean;
}

interface OptionDraft {
  name: string;
  nameAr: string;
  values: Array<{ value: string; valueAr: string }>;
}

interface ProductDraft {
  sku: string;
  nameAr: string;
  nameEn: string;
  categoryId: string;
  status: "draft" | "active" | "archived";
  isFeatured: boolean;
  basePrice: string;
  compareAtPrice: string;
  costPrice: string;
  stock: string;
  lowStockThreshold: string;
  barcode: string;
  shortDescriptionAr: string;
  descriptionAr: string;
  shortDescriptionEn: string;
  descriptionEn: string;
  seoTitle: string;
  seoDescription: string;
  weight: string;
  width: string;
  height: string;
  length: string;
}

const emptyDraft: ProductDraft = {
  sku: "",
  nameAr: "",
  nameEn: "",
  categoryId: "",
  status: "active",
  isFeatured: false,
  basePrice: "",
  compareAtPrice: "",
  costPrice: "",
  stock: "0",
  lowStockThreshold: "5",
  barcode: "",
  shortDescriptionAr: "",
  descriptionAr: "",
  shortDescriptionEn: "",
  descriptionEn: "",
  seoTitle: "",
  seoDescription: "",
  weight: "",
  width: "",
  height: "",
  length: "",
};

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function ProductsPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState("newest");
  const [editing, setEditing] = useState<any | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () =>
      api.products.list(subdomain, {
        page,
        pageSize: 20,
        search: search || undefined,
        status: status || undefined,
        stock: stock || undefined,
        categoryId: categoryId || undefined,
        sort,
      }),
    [subdomain, page, search, status, stock, categoryId, sort]
  );

  const categories = useAsync(() => api.categories.list(subdomain, { pageSize: 100 }), [subdomain]);

  const products = data?.products ?? [];
  const pagination = data?.pagination;

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.products.remove(subdomain, deleting.id);
      toast.success("تم حذف المنتج.");
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
        eyebrow="الكتالوج"
        title="المنتجات"
        description="أضف منتجاتك بأسعار ومخزون حقيقيين. كل تعديل يُحفظ في قاعدة البيانات ويظهر فوراً في المتجر."
        actions={
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus className="h-4 w-4" /> منتج جديد
          </Button>
        }
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="اسم، SKU أو باركود…" className="w-56" />
          <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="w-40">
            <option value="">كل الفئات</option>
            {(categories.data?.categories ?? []).map((category: any) => (
              <option key={category.id} value={category.id}>{category.nameAr || category.name}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-36">
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="draft">مسودة</option>
            <option value="archived">مؤرشف</option>
          </Select>
          <Select value={stock} onChange={(e) => { setStock(e.target.value); setPage(1); }} className="w-36">
            <option value="">كل المخزون</option>
            <option value="in">متوفر</option>
            <option value="low">منخفض (≤5)</option>
            <option value="out">نفد</option>
          </Select>
          <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="w-40">
            <option value="newest">الأحدث</option>
            <option value="oldest">الأقدم</option>
            <option value="name">الاسم</option>
            <option value="price_asc">السعر تصاعدي</option>
            <option value="price_desc">السعر تنازلي</option>
          </Select>
          <Button variant="ghost" size="sm" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل المنتجات">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : products.length === 0 ? (
          <EmptyState
            title="لا توجد منتجات بعد"
            description="ابدأ بإضافة أول منتج: الاسم، السعر، والمخزون — وستظهر الصورة والتفاصيل في متجرك مباشرة."
            icon={<Package className="h-5 w-5" />}
            action={<Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4" /> إضافة أول منتج</Button>}
          />
        ) : (
          <>
            <TableShell minWidth={860}>
              <thead>
                <tr className="border-b border-line">
                  <Th>المنتج</Th>
                  <Th>SKU</Th>
                  <Th>الفئة</Th>
                  <Th>السعر</Th>
                  <Th>المخزون</Th>
                  <Th>الحالة</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {products.map((product: any) => (
                  <tr key={product.id} className="border-b border-line transition hover:bg-surface">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-brand-sm border border-line bg-canvas">
                          {product.images?.[0]?.url ? (
                            <img src={mediaUrl(product.images[0].url)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-subtle" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="max-w-60 truncate font-semibold text-ink">{product.nameAr || product.nameEn || "بدون اسم"}</span>
                            {product.isFeatured ? <Badge tone="border-warning-line bg-warning-soft text-warning">مميز</Badge> : null}
                          </div>
                          <div className="mt-0.5 text-[10px] text-subtle">{product.variants?.length ? `${product.variants.length} متغير` : "بدون متغيرات"} · {date(product.createdAt)}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="font-mono text-[10px] text-subtle">{product.sku}</Td>
                    <Td className="text-subtle">{product.category?.nameAr || product.category?.name || "—"}</Td>
                    <Td>
                      <div className="font-bold text-ink">{money(product.basePrice, store.currency)}</div>
                      {product.compareAtPrice ? <div className="text-[10px] text-subtle line-through">{money(product.compareAtPrice, store.currency)}</div> : null}
                    </Td>
                    <Td>
                      <span className={product.stock <= 0 ? "font-bold text-danger" : product.stock <= (product.lowStockThreshold ?? 5) ? "font-bold text-warning" : "font-semibold text-ink"}>
                        {number(product.stock)}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <Badge tone={product.status === "active" ? "border-success-line bg-success-soft text-success" : product.status === "draft" ? "border-warning-line bg-warning-soft text-warning" : "bg-surface text-subtle border-line"}>
                          {product.status === "active" ? "نشط" : product.status === "draft" ? "مسودة" : "مؤرشف"}
                        </Badge>
                        {product.variants?.length ? <ActivePill active={(product.variants ?? []).some((v: any) => v.isActive)} /> : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(product); setEditorOpen(true); }} aria-label="تعديل">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(product)} aria-label="حذف">
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </div>
                    </Td>
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

      <ProductEditor
        open={editorOpen}
        product={editing}
        subdomain={subdomain}
        currency={store.currency}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); reload(); }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`حذف «${deleting?.nameAr || deleting?.sku || ""}»؟`}
        description="سيتم حذف المنتج وصوره ومتغيراته نهائياً. الطلبات السابقة تحتفظ ببياناتها."
        loading={deleteBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function ProductEditor({
  open,
  product,
  subdomain,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: any | null;
  subdomain: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"basic" | "images" | "variants" | "seo">("basic");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [images, setImages] = useState<string[]>([]);
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const categories = useAsync(() => api.categories.list(subdomain, { pageSize: 100 }), [subdomain, open]);

  useEffect(() => {
    if (!open) return;
    setTab("basic");
    if (product) {
      setDraft({
        sku: product.sku ?? "",
        nameAr: product.nameAr ?? "",
        nameEn: product.nameEn ?? "",
        categoryId: product.categoryId ?? "",
        status: product.status ?? "active",
        isFeatured: Boolean(product.isFeatured),
        basePrice: String(product.basePrice ?? ""),
        compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : "",
        costPrice: product.costPrice ? String(product.costPrice) : "",
        stock: String(product.stock ?? 0),
        lowStockThreshold: String(product.lowStockThreshold ?? 5),
        barcode: product.barcode ?? "",
        shortDescriptionAr: product.shortDescriptionAr ?? "",
        descriptionAr: product.descriptionAr ?? "",
        shortDescriptionEn: product.shortDescriptionEn ?? "",
        descriptionEn: product.descriptionEn ?? "",
        seoTitle: product.seoTitle ?? "",
        seoDescription: product.seoDescription ?? "",
        weight: product.weight != null ? String(product.weight) : "",
        width: product.width != null ? String(product.width) : "",
        height: product.height != null ? String(product.height) : "",
        length: product.length != null ? String(product.length) : "",
      });
      setImages((product.images ?? []).map((img: any) => img.url));
      setOptions(
        (product.options ?? []).map((option: any) => ({
          name: option.name ?? "",
          nameAr: option.nameAr ?? "",
          values: (option.values ?? []).map((value: any) => ({ value: value.value ?? "", valueAr: value.valueAr ?? "" })),
        }))
      );
      setVariants(
        (product.variants ?? []).map((variant: any) => ({
          id: variant.id,
          sku: variant.sku,
          price: String(variant.price ?? 0),
          compareAtPrice: variant.compareAtPrice ? String(variant.compareAtPrice) : "",
          stock: String(variant.stock ?? 0),
          optionValues: (variant.optionValues ?? {}) as Record<string, string>,
          imageUrl: variant.imageUrl ?? "",
          isActive: variant.isActive !== false,
        }))
      );
    } else {
      setDraft(emptyDraft);
      setImages([]);
      setOptions([]);
      setVariants([]);
    }
  }, [open, product?.id]);

  const set = (key: keyof ProductDraft, value: any) => setDraft((current) => ({ ...current, [key]: value }));

  const optionNames = useMemo(() => options.map((o) => o.nameAr || o.name).filter(Boolean), [options]);

  const buildBody = () => {
    const compare = draft.compareAtPrice ? num(draft.compareAtPrice) : 0;
    const body: Record<string, unknown> = {
      sku: draft.sku.trim(),
      nameAr: draft.nameAr.trim(),
      nameEn: draft.nameEn.trim(),
      categoryId: draft.categoryId || null,
      status: draft.status,
      isFeatured: draft.isFeatured,
      basePrice: num(draft.basePrice),
      compareAtPrice: compare > 0 ? compare : null,
      costPrice: draft.costPrice ? num(draft.costPrice) : null,
      stock: Math.max(0, Math.round(num(draft.stock))),
      lowStockThreshold: Math.max(0, Math.round(num(draft.lowStockThreshold))),
      barcode: draft.barcode.trim(),
      shortDescriptionAr: draft.shortDescriptionAr.trim(),
      descriptionAr: draft.descriptionAr.trim(),
      shortDescriptionEn: draft.shortDescriptionEn.trim(),
      descriptionEn: draft.descriptionEn.trim(),
      seoTitle: draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim(),
      images: images.map((url, index) => ({ url, alt: draft.nameAr.trim(), sortOrder: index })),
      options: options
        .filter((option) => (option.name || option.nameAr) && option.values.length)
        .map((option, index) => ({
          name: option.name || option.nameAr,
          nameAr: option.nameAr || option.name,
          position: index,
          values: option.values
            .filter((value) => value.value)
            .map((value, valueIndex) => ({ value: value.value, valueAr: value.valueAr || value.value, position: valueIndex })),
        })),
      variants: variants
        .filter((variant) => variant.sku.trim())
        .map((variant) => ({
          sku: variant.sku.trim(),
          price: num(variant.price),
          compareAtPrice: variant.compareAtPrice ? num(variant.compareAtPrice) : null,
          stock: Math.max(0, Math.round(num(variant.stock))),
          optionValues: variant.optionValues,
          imageUrl: variant.imageUrl,
          isActive: variant.isActive,
        })),
    };
    if (draft.weight) body.weight = num(draft.weight);
    if (draft.width) body.width = num(draft.width);
    if (draft.height) body.height = num(draft.height);
    if (draft.length) body.length = num(draft.length);
    return body;
  };

  const save = async () => {
    if (!draft.sku.trim()) {
      setTab("basic");
      toast.error("SKU مطلوب لكل منتج.");
      return;
    }
    if (!draft.nameAr.trim() && !draft.nameEn.trim()) {
      setTab("basic");
      toast.error("أدخل اسم المنتج بالعربية أو الإنجليزية.");
      return;
    }
    const compare = draft.compareAtPrice ? num(draft.compareAtPrice) : 0;
    if (compare > 0 && compare <= num(draft.basePrice)) {
      setTab("basic");
      toast.error("سعر المقارنة يجب أن يكون أكبر من سعر البيع.");
      return;
    }
    setBusy(true);
    try {
      if (product) await api.products.update(subdomain, product.id, buildBody());
      else await api.products.create(subdomain, buildBody() as any);
      toast.success(product ? "تم تحديث المنتج." : "تم إنشاء المنتج.");
      onSaved();
    } catch (err: any) {
      const details = Array.isArray(err?.details) ? err.details.map((d: any) => d.path).filter(Boolean).join("، ") : "";
      toast.error(details ? `${safeError(err)} (${details})` : safeError(err));
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: "basic", label: "البيانات الأساسية" },
    { id: "images", label: `الصور (${images.length})` },
    { id: "variants", label: `الخيارات والمتغيرات (${variants.length})` },
    { id: "seo", label: "SEO والشحن" },
  ] as const;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? `تعديل: ${product.nameAr || product.sku}` : "منتج جديد"}
      description={`السعر يُعرض بعملة المتجر (${currency}). المخزون والأسعار يُتحقق منها على الخادم عند كل طلب.`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button loading={busy} onClick={save}>{product ? "حفظ التعديلات" : "إنشاء المنتج"}</Button>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-line pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-brand-sm px-3 py-1.5 text-[11px] font-semibold transition ${tab === item.id ? "bg-brand/15 text-brand ring-1 ring-inset ring-brand/30" : "text-subtle hover:bg-surface"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "basic" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" required hint="معرّف فريد داخل متجرك، يُستخدم في الطلبات والتقارير.">
            <Input value={draft.sku} onChange={(e) => set("sku", e.target.value)} dir="ltr" placeholder="TSHIRT-BLK-L" />
          </Field>
          <Field label="الفئة">
            <Select value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">بدون فئة</option>
              {(categories.data?.categories ?? []).map((category: any) => (
                <option key={category.id} value={category.id}>{category.nameAr || category.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="الاسم بالعربية" required>
            <Input value={draft.nameAr} onChange={(e) => set("nameAr", e.target.value)} placeholder="قميص قطني أسود" />
          </Field>
          <Field label="الاسم بالإنجليزية">
            <Input value={draft.nameEn} onChange={(e) => set("nameEn", e.target.value)} dir="ltr" placeholder="Black Cotton T-Shirt" />
          </Field>
          <Field label={`سعر البيع (${currency})`} required>
            <Input type="number" min={0} step="0.01" value={draft.basePrice} onChange={(e) => set("basePrice", e.target.value)} dir="ltr" />
          </Field>
          <Field label="سعر المقارنة (قبل الخصم)" hint="اتركه فارغاً إن لم يكن هناك خصم.">
            <Input type="number" min={0} step="0.01" value={draft.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} dir="ltr" />
          </Field>
          <Field label={`تكلفة المنتج (${currency})`} hint="تُستخدم لحساب هامش الربح في التقارير.">
            <Input type="number" min={0} step="0.01" value={draft.costPrice} onChange={(e) => set("costPrice", e.target.value)} dir="ltr" />
          </Field>
          <Field label="المخزون" hint="عدد القطع المتاحة حالياً.">
            <Input type="number" min={0} value={draft.stock} onChange={(e) => set("stock", e.target.value)} dir="ltr" />
          </Field>
          <Field label="حد التنبيه للمخزون">
            <Input type="number" min={0} value={draft.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} dir="ltr" />
          </Field>
          <Field label="الباركود">
            <Input value={draft.barcode} onChange={(e) => set("barcode", e.target.value)} dir="ltr" />
          </Field>
          <Field label="الحالة" required>
            <Select value={draft.status} onChange={(e) => set("status", e.target.value as ProductDraft["status"])}>
              <option value="active">نشط — يظهر في المتجر</option>
              <option value="draft">مسودة — مخفي</option>
              <option value="archived">مؤرشف</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={draft.isFeatured} onChange={(v) => set("isFeatured", v)} label="منتج مميز" description="يظهر في قسم المنتجات المميزة بالصفحة الرئيسية للمتجر." />
          </div>
          <Field label="وصف قصير بالعربية" className="sm:col-span-2">
            <Textarea value={draft.shortDescriptionAr} onChange={(e) => set("shortDescriptionAr", e.target.value)} className="min-h-20" placeholder="سطر أو سطران يظهران قرب الاسم." />
          </Field>
          <Field label="الوصف الكامل بالعربية" className="sm:col-span-2">
            <Textarea value={draft.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} className="min-h-32" />
          </Field>
        </div>
      ) : null}

      {tab === "images" ? (
        <div className="space-y-4">
          <MultiImageUploader value={images} onChange={setImages} max={8} />
          <Alert tone="info">الصورة الأولى تظهر في القوائم وبطاقات المنتجات، ويمكنك ترتيبها بزر «اجعلها رئيسية».</Alert>
        </div>
      ) : null}

      {tab === "variants" ? (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-ink">خيارات المنتج</div>
              <Button size="sm" variant="outline" onClick={() => setOptions((current) => [...current, { name: "", nameAr: "", values: [{ value: "", valueAr: "" }] }])}>
                <Plus className="h-3.5 w-3.5" /> خيار
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-subtle">مثل: المقاس، اللون. القيم المستخدمة هنا تظهر عند إضافة المتغيرات.</p>
            {options.length === 0 ? (
              <div className="mt-3 rounded-brand border border-dashed border-line p-4 text-center text-[11px] text-subtle">
                لا توجد خيارات — المنتج يُباع كقطعة واحدة بمخزون المنتج الأساسي.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {options.map((option, optionIndex) => (
                  <div key={optionIndex} className="rounded-brand border border-line bg-surface p-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <Field label="الاسم (عربي)" className="w-40">
                        <Input
                          value={option.nameAr}
                          onChange={(e) => setOptions((current) => current.map((o, i) => (i === optionIndex ? { ...o, nameAr: e.target.value } : o)))}
                          placeholder="المقاس"
                        />
                      </Field>
                      <Field label="الاسم (English)" className="w-40">
                        <Input
                          value={option.name}
                          onChange={(e) => setOptions((current) => current.map((o, i) => (i === optionIndex ? { ...o, name: e.target.value } : o)))}
                          dir="ltr"
                          placeholder="Size"
                        />
                      </Field>
                      <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setOptions((current) => current.filter((_, i) => i !== optionIndex))}>
                        <Trash2 className="h-3.5 w-3.5 text-danger" /> حذف الخيار
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {option.values.map((value, valueIndex) => (
                        <div key={valueIndex} className="flex flex-wrap items-center gap-2">
                          <Input
                            value={value.valueAr}
                            onChange={(e) =>
                              setOptions((current) =>
                                current.map((o, i) =>
                                  i === optionIndex ? { ...o, values: o.values.map((v, vi) => (vi === valueIndex ? { ...v, valueAr: e.target.value } : v)) } : o
                                )
                              )
                            }
                            placeholder="القيمة بالعربية (كبير)"
                            className="w-44"
                          />
                          <Input
                            value={value.value}
                            onChange={(e) =>
                              setOptions((current) =>
                                current.map((o, i) =>
                                  i === optionIndex ? { ...o, values: o.values.map((v, vi) => (vi === valueIndex ? { ...v, value: e.target.value } : v)) } : o
                                )
                              )
                            }
                            placeholder="English value (L)"
                            dir="ltr"
                            className="w-44"
                          />
                          <Button size="sm" variant="ghost" onClick={() => setOptions((current) => current.map((o, i) => (i === optionIndex ? { ...o, values: o.values.filter((_, vi) => vi !== valueIndex) } : o)))}>
                            <Trash2 className="h-3.5 w-3.5 text-subtle" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => setOptions((current) => current.map((o, i) => (i === optionIndex ? { ...o, values: [...o.values, { value: "", valueAr: "" }] } : o)))}>
                        <Plus className="h-3.5 w-3.5" /> قيمة جديدة
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-ink">المتغيرات</div>
              <Button size="sm" variant="outline" onClick={() => setVariants((current) => [...current, { sku: "", price: draft.basePrice || "0", compareAtPrice: "", stock: "0", optionValues: {}, imageUrl: "", isActive: true }])}>
                <Plus className="h-3.5 w-3.5" /> متغير
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-subtle">لكل متغير SKU وسعر ومخزون مستقل. المخزون يُخصم من المتغير عند البيع.</p>
            {variants.length === 0 ? (
              <div className="mt-3 rounded-brand border border-dashed border-line p-4 text-center text-[11px] text-subtle">
                لا توجد متغيرات — يُستخدم مخزون المنتج الأساسي ({number(num(draft.stock))} قطعة).
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {variants.map((variant, variantIndex) => (
                  <div key={variantIndex} className="rounded-brand border border-line bg-surface p-3">
                    <div className="grid gap-2 sm:grid-cols-5">
                      <Field label="SKU" required>
                        <Input
                          value={variant.sku}
                          onChange={(e) => setVariants((current) => current.map((v, i) => (i === variantIndex ? { ...v, sku: e.target.value } : v)))}
                          dir="ltr"
                        />
                      </Field>
                      <Field label="السعر">
                        <Input
                          type="number"
                          min={0}
                          value={variant.price}
                          onChange={(e) => setVariants((current) => current.map((v, i) => (i === variantIndex ? { ...v, price: e.target.value } : v)))}
                          dir="ltr"
                        />
                      </Field>
                      <Field label="سعر المقارنة">
                        <Input
                          type="number"
                          min={0}
                          value={variant.compareAtPrice}
                          onChange={(e) => setVariants((current) => current.map((v, i) => (i === variantIndex ? { ...v, compareAtPrice: e.target.value } : v)))}
                          dir="ltr"
                        />
                      </Field>
                      <Field label="المخزون">
                        <Input
                          type="number"
                          min={0}
                          value={variant.stock}
                          onChange={(e) => setVariants((current) => current.map((v, i) => (i === variantIndex ? { ...v, stock: e.target.value } : v)))}
                          dir="ltr"
                        />
                      </Field>
                      <div className="flex items-end">
                        <Button size="sm" variant="ghost" onClick={() => setVariants((current) => current.filter((_, i) => i !== variantIndex))}>
                          <Trash2 className="h-3.5 w-3.5 text-danger" /> حذف
                        </Button>
                      </div>
                    </div>
                    {optionNames.length ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {optionNames.map((name) => (
                          <Field key={name} label={name} className="w-40">
                            <Input
                              value={variant.optionValues[name] ?? ""}
                              onChange={(e) =>
                                setVariants((current) =>
                                  current.map((v, i) => (i === variantIndex ? { ...v, optionValues: { ...v.optionValues, [name]: e.target.value } } : v))
                                )
                              }
                              placeholder="القيمة"
                            />
                          </Field>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2">
                      <Switch
                        checked={variant.isActive}
                        onChange={(checked) => setVariants((current) => current.map((v, i) => (i === variantIndex ? { ...v, isActive: checked } : v)))}
                        label="متاح للبيع"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Alert tone="info">إذا أضفت متغيرات، يتم تجاهل مخزون المنتج الأساسي في البيع ويُعتمد على مخزون كل متغير.</Alert>
        </div>
      ) : null}

      {tab === "seo" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان SEO" className="sm:col-span-2">
            <Input value={draft.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder="يظهر في نتائج البحث وفي تبويب المتصفح." />
          </Field>
          <Field label="وصف SEO" className="sm:col-span-2">
            <Textarea value={draft.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className="min-h-20" />
          </Field>
          <Field label="الوزن (كجم)">
            <Input type="number" min={0} step="0.01" value={draft.weight} onChange={(e) => set("weight", e.target.value)} dir="ltr" />
          </Field>
          <Field label="الطول (سم)">
            <Input type="number" min={0} step="0.1" value={draft.length} onChange={(e) => set("length", e.target.value)} dir="ltr" />
          </Field>
          <Field label="العرض (سم)">
            <Input type="number" min={0} step="0.1" value={draft.width} onChange={(e) => set("width", e.target.value)} dir="ltr" />
          </Field>
          <Field label="الارتفاع (سم)">
            <Input type="number" min={0} step="0.1" value={draft.height} onChange={(e) => set("height", e.target.value)} dir="ltr" />
          </Field>
          {product ? (
            <div className="sm:col-span-2">
              <Link href={`/store/${subdomain}/products/${product.slug}`} target="_blank" className="text-[11px] font-bold text-brand">
                عرض المنتج في المتجر ←
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

