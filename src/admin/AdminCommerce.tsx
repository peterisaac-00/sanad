import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  ExternalLink,
  Globe2,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  Palette,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Store as StoreIcon,
  Trash2,
  UploadCloud,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { api, mediaUrl } from "../lib/api";
import { date, dateTime, money, number, safeError } from "../lib/format";
import { navigate } from "../lib/router";
import { useAsync } from "../lib/useAsync";
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
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Textarea,
  cn,
  useToast,
} from "../components/ui";
import { TableShell, Td, Th } from "../dashboard/common";
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PLAN_LABEL,
  PLAN_PERIOD,
  StoreTable,
  WALLET_STATUS,
  VisitsChart,
  ownerName,
  publishMeta,
  storeMeta,
  storeUrl,
  type AdminPanelProps,
  type StoreReviewAction,
} from "./shared";

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function OverviewPanel({ can }: AdminPanelProps) {
  const { data, loading, error, reload } = useAsync(() => api.admin.overview(), []);
  const summary = data?.summary ?? {};
  const stores = data?.stores ?? [];
  const visitsByStore = data?.visitsByStore ?? [];
  const monthlyVisits = data?.monthlyVisits ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="إدارة منصة سند"
        title="مركز تحكم المنصة"
        description="حالة المتاجر والنشر والاشتراكات والمحفظة في مكان واحد. كل رقم هنا مقروء من قاعدة البيانات لحظة التحميل."
        actions={
          <Button variant="outline" onClick={reload} loading={loading}>
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
        }
      />

      {error ? <Alert tone="error" title="تعذر تحميل بيانات المنصة">{safeError(error)}</Alert> : null}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-32" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="إجمالي المتاجر"
              value={number(summary.totalStores ?? 0)}
              hint={`${number(summary.activeStores ?? 0)} نشط · ${number(summary.pendingStores ?? 0)} بانتظار الموافقة`}
              icon={<Building2 className="h-5 w-5" />}
              accent="brand"
            />
            <StatCard
              label="متاجر منشورة"
              value={number(summary.publishedStores ?? 0)}
              hint={`${number(summary.draftStores ?? 0)} معتمد وغير منشور`}
              icon={<Globe2 className="h-5 w-5" />}
              accent="success"
            />
            <StatCard
              label="زيارات هذا الشهر"
              value={number(summary.visitsThisMonth ?? 0)}
              hint={`${number(visitsByStore.length)} متجر استقبل زيارات`}
              icon={<BarChart3 className="h-5 w-5" />}
              accent="info"
            />
            <StatCard
              label="دفعات اشتراك معلّقة"
              value={number(summary.pendingSubscriptionPayments ?? 0)}
              hint={`${money(summary.pendingSubscriptionAmount ?? 0, "EGP")} بانتظار المراجعة`}
              icon={<CreditCard className="h-5 w-5" />}
              accent="warning"
            />
            <StatCard
              label="إيداعات محفظة معلّقة"
              value={number(summary.pendingWalletDeposits ?? 0)}
              hint={`${money(summary.pendingWalletAmount ?? 0, "EGP")} بانتظار الاعتماد`}
              icon={<Wallet className="h-5 w-5" />}
              accent="warning"
            />
            <StatCard
              label="اشتراكات معتمدة هذا الشهر"
              value={money(summary.approvedSubscriptionAmountThisMonth ?? 0, "EGP")}
              hint="إجمالي الدفعات المعتمدة من الإدارة"
              icon={<CircleDollarSign className="h-5 w-5" />}
              accent="success"
            />
            <StatCard
              label="بانتظار الموافقة"
              value={number(summary.pendingStores ?? 0)}
              hint={`${number(summary.rejectedStores ?? 0)} مرفوض · ${number(summary.suspendedStores ?? 0)} موقوف`}
              icon={<Clock className="h-5 w-5" />}
              accent="warning"
            />
          </div>

          {(summary.pendingStores ?? 0) > 0 ? (
            <Alert tone="warning" title={`${number(summary.pendingStores)} متجر بانتظار قرارك`}>
              الموافقة لا تنشر المتجر تلقائياً إن لم يكتمل إعداد المتجر. راجع حالة النشر قبل أن تشارك الرابط مع التاجر.
              <button type="button" onClick={() => navigate("/admin/stores")} className="ms-1 font-bold underline underline-offset-2">
                فتح قائمة المتاجر
              </button>
            </Alert>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-ink">زيارات آخر 6 أشهر</div>
                  <div className="mt-0.5 text-[10px] text-subtle">إجمالي الزيارات الشهرية عبر جميع المتاجر المنشورة.</div>
                </div>
                <Badge tone="bg-brand-soft text-brand border-brand-line"><Globe2 className="h-3 w-3" /> {number(summary.visitsThisMonth ?? 0)} هذا الشهر</Badge>
              </div>
              <VisitsChart rows={monthlyVisits} />
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <div className="text-sm font-bold text-ink">أكثر المتاجر زيارة</div>
                <div className="mt-0.5 text-[10px] text-subtle">الشهر الحالي، دون تخزين عنوان IP أو بيانات المتصفح.</div>
              </div>
              {visitsByStore.length === 0 ? (
                <EmptyState title="لا توجد زيارات هذا الشهر" description="ستظهر المتاجر هنا بعد أول زيارة لواجهة منشورة." icon={<BarChart3 className="h-5 w-5" />} />
              ) : (
                <div className="divide-y divide-line">
                  {visitsByStore.slice(0, 8).map((entry: any, index: number) => (
                    <div key={entry.storeId} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand">{number(index + 1)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-ink">{entry.storeName}</div>
                        <a href={`/store/${entry.subdomain}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-subtle hover:text-brand" dir="ltr">/store/{entry.subdomain}</a>
                      </div>
                      <div className="text-sm font-bold text-ink">{number(entry.visits)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <div className="text-sm font-bold text-ink">أحدث المتاجر</div>
                <div className="mt-0.5 text-[10px] text-subtle">الاعتماد والنشر حالتان منفصلتان: المتجر لا يظهر للعملاء إلا إذا كان معتمداً ومنشوراً.</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/stores")}>عرض كل المتاجر</Button>
            </div>
            <StoreTable stores={stores.slice(0, 8)} />
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { href: "/admin/stores", label: "المتاجر والنشر", description: "اعتماد، إيقاف، ونشر", icon: StoreIcon, show: can("stores.read") },
              { href: "/admin/subscriptions", label: "دفعات الاشتراك", description: "مراجعة واعتماد", icon: CreditCard, show: can("subscriptions.read") },
              { href: "/admin/wallet", label: "إيداعات المحفظة", description: "اعتماد أو رفض", icon: Wallet, show: can("wallet.read") },
            ].filter((entry) => entry.show).map((entry) => {
              const Icon = entry.icon;
              return (
                <button key={entry.href} type="button" onClick={() => navigate(entry.href)} className="flex items-center gap-3 rounded-brand border border-line bg-card p-4 text-start transition hover:border-brand-line hover:bg-surface">
                  <span className="rounded-brand bg-brand-soft p-2 text-brand"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-ink">{entry.label}</span>
                    <span className="mt-0.5 block text-[10px] text-subtle">{entry.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

export function StoresPanel({ can }: AdminPanelProps) {
  const toast = useToast();
  const storesAsync = useAsync(() => api.admin.stores(), []);
  const overviewAsync = useAsync(() => api.admin.overview(), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [publishFilter, setPublishFilter] = useState("all");
  const [review, setReview] = useState<{ store: any; action: StoreReviewAction } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [publishTarget, setPublishTarget] = useState<{ store: any; action: "publish" | "unpublish" } | null>(null);
  const [publishNote, setPublishNote] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);
  const [identityId, setIdentityId] = useState<string | null>(null);

  const stores = storesAsync.data?.stores ?? [];
  const summary = overviewAsync.data?.summary ?? {};

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((store: any) => {
      if (status !== "all" && store.status !== status) return false;
      if (publishFilter !== "all" && store.publishStatus !== publishFilter) return false;
      if (!q) return true;
      return [store.storeName, store.subdomain, store.customDomain, store.owner?.name, store.owner?.email, store.owner?.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [stores, query, status, publishFilter]);

  const reloadAll = () => {
    storesAsync.reload();
    overviewAsync.reload();
  };

  const runReview = async () => {
    if (!review) return;
    setReviewBusy(true);
    try {
      if (review.action === "approve") await api.admin.approveStore(review.store.id, reviewNote.trim());
      else if (review.action === "reject") await api.admin.rejectStore(review.store.id, reviewNote.trim());
      else await api.admin.suspendStore(review.store.id, reviewNote.trim());
      toast.success(review.action === "approve" ? "تم اعتماد المتجر." : review.action === "reject" ? "تم رفض الطلب." : "تم إيقاف المتجر.");
      setReview(null);
      setReviewNote("");
      reloadAll();
    } catch (error: any) {
      toast.error(safeError(error));
    } finally {
      setReviewBusy(false);
    }
  };

  const runPublish = async () => {
    if (!publishTarget) return;
    setPublishBusy(true);
    try {
      await api.admin.setStorePublishing(publishTarget.store.id, publishTarget.action, publishNote.trim());
      toast.success(publishTarget.action === "publish" ? "تم نشر المتجر." : "تم إيقاف نشر المتجر.");
      setPublishTarget(null);
      setPublishNote("");
      reloadAll();
    } catch (error: any) {
      toast.error(safeError(error));
    } finally {
      setPublishBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="دورة حياة المتجر"
        title="المتاجر والاعتماد والنشر"
        description="الاعتماد يفتح لوحة التاجر، والنشر يفتح الواجهة العامة. يمكن إيقاف النشر دون إيقاف المتجر."
        actions={<Button variant="outline" onClick={reloadAll} loading={storesAsync.loading || overviewAsync.loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />

      {storesAsync.error ? <Alert tone="error" title="تعذر تحميل المتاجر">{safeError(storesAsync.error)}</Alert> : null}
      {(summary.pendingStores ?? 0) > 0 ? (
        <Alert tone="warning" title={`${number(summary.pendingStores)} متجر بانتظار الاعتماد`}>
          راجع بيانات المتجر وهويته قبل الاعتماد. المتجر الذي لم يكتمل إعداده يبقى غير منشور حتى ينشر التاجر أو تنشره الإدارة.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="كل المتاجر" value={number(stores.length)} icon={<StoreIcon className="h-5 w-5" />} accent="brand" hint="حتى 500 متجر" />
        <StatCard label="منشورة للعملاء" value={number(stores.filter((store: any) => store.publishStatus === "published" && store.status === "active").length)} icon={<Globe2 className="h-5 w-5" />} accent="success" hint="معتمدة ومنشورة" />
        <StatCard label="معتمدة وغير منشورة" value={number(stores.filter((store: any) => store.status === "active" && store.publishStatus !== "published").length)} icon={<Clock className="h-5 w-5" />} accent="warning" hint="تحتاج نشراً أو إكمال تهيئة" />
        <StatCard label="بانتظار الاعتماد" value={number(stores.filter((store: any) => store.status === "pending").length)} icon={<ShieldCheck className="h-5 w-5" />} accent="info" hint="لم تُفتح لوحة تشغيلها بعد" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث باسم المتجر أو المالك أو النطاق…" className="w-full sm:w-80" />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full sm:w-40">
            <option value="all">كل حالات الاعتماد</option>
            <option value="pending">بانتظار الموافقة</option>
            <option value="active">نشط</option>
            <option value="rejected">مرفوض</option>
            <option value="suspended">موقوف</option>
          </Select>
          <Select value={publishFilter} onChange={(event) => setPublishFilter(event.target.value)} className="w-full sm:w-40">
            <option value="all">كل حالات النشر</option>
            <option value="draft">غير منشور</option>
            <option value="ready">جاهز للمراجعة</option>
            <option value="published">منشور</option>
            <option value="suspended">نشر موقوف</option>
          </Select>
          <div className="ms-auto text-[11px] text-subtle">{number(filtered.length)} من {number(stores.length)} متجر</div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {storesAsync.loading && !storesAsync.data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16" />)}</div>
        ) : (
          <StoreTable
            stores={filtered}
            emptyTitle="لا توجد متاجر مطابقة"
            emptyDescription="جرّب تغيير البحث أو الفلاتر."
            onIdentity={can("stores.write") ? (store) => setIdentityId(store.id) : undefined}
            onAction={can("stores.write") ? (store, action) => { setReviewNote(""); setReview({ store, action }); } : undefined}
            onPublish={can("stores.write") ? (store, action) => { setPublishNote(""); setPublishTarget({ store, action }); } : undefined}
          />
        )}
      </Card>

      <Modal
        open={Boolean(review)}
        onClose={() => (reviewBusy ? undefined : setReview(null))}
        title={review?.action === "approve" ? "اعتماد المتجر" : review?.action === "reject" ? "رفض طلب فتح المتجر" : "إيقاف المتجر"}
        description={review?.store?.storeName}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReview(null)} disabled={reviewBusy}>إلغاء</Button>
            <Button variant={review?.action === "approve" ? "success" : "danger"} loading={reviewBusy} onClick={runReview}>
              {review?.action === "approve" ? "اعتماد الآن" : review?.action === "reject" ? "رفض الطلب" : "إيقاف المتجر"}
            </Button>
          </>
        }
      >
        {review ? (
          <div className="space-y-4">
            <Alert tone={review.action === "approve" ? "success" : review.action === "reject" ? "warning" : "error"} title={review.action === "approve" ? "سيُفتح وصول التاجر للوحة التحكم" : review.action === "reject" ? "لن يظهر المتجر للعملاء" : "سيُغلق المتجر فوراً"}>
              {review.action === "approve"
                ? "الاعتماد يسجل تاريخ التفعيل. إن أكمل التاجر التهيئة مسبقاً فسيُنشر المتجر، وإلا يبقى غير منشور حتى يكملها."
                : review.action === "reject"
                  ? "اكتب سبباً واضحاً ليتمكن التاجر من تصحيح بياناته. يمكن اعتماد المتجر لاحقاً."
                  : "إيقاف المتجر يمنع الوصول للوحة والواجهة. يمكن إعادة تفعيله لاحقاً."}
            </Alert>
            <div className="grid gap-2 rounded-brand border border-line bg-surface p-3 text-[11px] text-ink-soft sm:grid-cols-2">
              <div><span className="text-subtle">الحالة الحالية:</span> {storeMeta(review.store.status).label}</div>
              <div><span className="text-subtle">النشر الحالي:</span> {publishMeta(review.store.publishStatus).label}</div>
              <div><span className="text-subtle">المالك:</span> {ownerName(review.store.owner)}</div>
              <div><span className="text-subtle">التهيئة:</span> {review.store.onboardingCompleted ? "مكتملة" : "غير مكتملة"}</div>
            </div>
            <Field label="ملاحظة الإدارة" hint="تظهر للتاجر كإشعار داخل لوحة التحكم.">
              <Textarea rows={3} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="سبب الرفض أو ملاحظة للاعتماد…" />
            </Field>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(publishTarget)}
        onClose={() => (publishBusy ? undefined : setPublishTarget(null))}
        title={publishTarget?.action === "publish" ? "نشر المتجر" : "إيقاف نشر المتجر"}
        description={publishTarget?.store?.storeName}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishTarget(null)} disabled={publishBusy}>إلغاء</Button>
            <Button variant={publishTarget?.action === "publish" ? "success" : "danger"} loading={publishBusy} onClick={runPublish}>
              {publishTarget?.action === "publish" ? "نشر الآن" : "إيقاف النشر"}
            </Button>
          </>
        }
      >
        {publishTarget ? (
          <div className="space-y-4">
            <Alert tone={publishTarget.action === "publish" ? "success" : "warning"} title={publishTarget.action === "publish" ? "ستفتح الواجهة للعملاء" : "ستُغلق الواجهة العامة"}>
              {publishTarget.action === "publish"
                ? "لا يمكن نشر متجر غير معتمد أو لم يكمل التهيئة. الرابط العام سيظل محجوباً إذا لم تتحقق الشروط."
                : "سيبقى التاجر قادراً على العمل في لوحة التحكم، لكن العملاء لن يروا المتجر."}
            </Alert>
            <Field label={publishTarget.action === "publish" ? "ملاحظة (اختياري)" : "سبب إيقاف النشر"} hint="يظهر للتاجر في الإشعار وسجل الحالة.">
              <Textarea rows={3} value={publishNote} onChange={(event) => setPublishNote(event.target.value)} />
            </Field>
          </div>
        ) : null}
      </Modal>

      {identityId ? (
        <StoreSettingsModal storeId={identityId} onClose={() => setIdentityId(null)} onSaved={reloadAll} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Store identity settings                                             */
/* ------------------------------------------------------------------ */

const FONT_OPTIONS = ["Cairo", "IBM Plex Sans Arabic", "Tajawal", "Almarai"];
const TEMPLATE_OPTIONS = [
  { value: "general", label: "عام" },
  { value: "fashion", label: "أزياء" },
  { value: "electronics", label: "إلكترونيات" },
  { value: "restaurant", label: "مطاعم" },
  { value: "beauty", label: "تجميل" },
  { value: "services", label: "خدمات" },
];
const SETTINGS_FIELDS = [
  "storeName", "description", "logoUrl", "coverUrl", "primaryColor", "secondaryColor", "textColor",
  "themeMode", "arabicFont", "templateKey", "seoTitle", "seoDescription", "supportEmail", "whatsapp", "phone", "countryCode",
] as const;

function formFromSettings(data: any): Record<string, string> {
  const store = data?.store ?? {};
  const branding = data?.branding ?? {};
  return {
    storeName: store.storeName ?? "",
    description: store.description ?? "",
    logoUrl: store.logoUrl ?? "",
    coverUrl: store.coverUrl ?? "",
    primaryColor: branding.primaryColor ?? "#047857",
    secondaryColor: branding.secondaryColor ?? "#0F2A24",
    textColor: branding.textColor ?? "#0F172A",
    themeMode: branding.themeMode ?? "light",
    arabicFont: branding.arabicFont ?? "IBM Plex Sans Arabic",
    templateKey: branding.templateKey ?? store.templateKey ?? "general",
    seoTitle: store.seoTitle ?? "",
    seoDescription: store.seoDescription ?? "",
    supportEmail: store.supportEmail ?? "",
    whatsapp: store.whatsapp ?? "",
    phone: store.phone ?? "",
    countryCode: store.countryCode ?? "EG",
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));
    reader.readAsDataURL(file);
  });
}

function AdminImageField({
  label, hint, value, storeId, onChange, aspect = "aspect-square",
}: {
  label: string; hint?: string; value: string; storeId: string; onChange: (value: string) => void; aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setError("استخدم صورة JPG أو PNG أو WebP أو GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const result = await api.admin.uploadStoreMedia(storeId, { fileName: file.name, mimeType: file.type, dataBase64 });
      onChange(result.media.url);
    } catch (err: any) {
      setError(safeError(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-ink-soft">{label}</div>
      <div className={cn("group relative flex items-center justify-center overflow-hidden rounded-brand border-2 border-dashed border-line bg-surface", aspect)}>
        {value ? (
          <>
            <img src={mediaUrl(value)} alt={label} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-overlay opacity-0 transition group-hover:opacity-100">
              <button type="button" onClick={() => inputRef.current?.click()} className="rounded-brand-sm bg-card p-2 text-ink shadow-brand-card" title="استبدال الصورة">
                <UploadCloud className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onChange("")} className="rounded-brand-sm bg-danger p-2 text-on-danger" title="حذف الصورة">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            {busy ? <Loader2 className="h-6 w-6 animate-spin text-brand" /> : <ImagePlus className="h-7 w-7 text-subtle" />}
            <span className="text-xs font-semibold text-ink-soft">{busy ? "جارٍ الرفع…" : "رفع صورة"}</span>
            {hint ? <span className="text-[10px] text-subtle">{hint}</span> : null}
          </button>
        )}
        {busy && value ? <div className="absolute inset-0 flex items-center justify-center bg-overlay"><Loader2 className="h-6 w-6 animate-spin text-white" /></div> : null}
      </div>
      {error ? <div className="text-[11px] text-danger">{error}</div> : null}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="أو ألصق رابط الصورة" className="input-control h-9 text-[11px]" dir="ltr" />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#047857"} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-brand border border-line bg-card p-1" aria-label={label} />
        <Input value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} dir="ltr" className="font-mono" />
      </div>
    </Field>
  );
}

function StoreSettingsModal({ storeId, onClose, onSaved }: { storeId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [initial, setInitial] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.admin.storeSettings(storeId)
      .then((result) => {
        if (!alive) return;
        const next = formFromSettings(result);
        setData(result);
        setForm(next);
        setInitial(next);
      })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [storeId]);

  const save = async () => {
    if (!form || !initial) return;
    if (form.storeName.trim().length < 2) {
      toast.error("اسم المتجر يجب أن يكون حرفين على الأقل.");
      return;
    }
    const patch: Record<string, string> = {};
    for (const field of SETTINGS_FIELDS) {
      const next = String(form[field] ?? "").trim();
      if (next !== String(initial[field] ?? "").trim()) patch[field] = next;
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await api.admin.updateStoreSettings(storeId, patch);
      toast.success("تم تحديث هوية المتجر.");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => (saving ? undefined : onClose())}
      title="هوية المتجر وإعداداته"
      description={data?.store?.storeName ? `${data.store.storeName} · ${data.public_url ?? storeUrl(data.store)}` : "تحميل بيانات المتجر…"}
      size="xl"
      footer={form ? (
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button loading={saving} onClick={save}><CheckCircle2 className="h-4 w-4" /> حفظ التغييرات</Button>
        </>
      ) : undefined}
    >
      {loading && !form ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20" />)}</div>
      ) : error ? (
        <Alert tone="error" title="تعذر تحميل إعدادات المتجر">{safeError(error)}</Alert>
      ) : form ? (
        <div className="space-y-6">
          <Alert tone="info" title="هذه الحقول محمية من التاجر">
            الاسم والوصف والشعار والغلاف والألوان والقالب وSEO تُعدَّل من هنا فقط، وتظهر للتاجر كبيانات للعرض.
          </Alert>
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-ink"><StoreIcon className="h-4 w-4 text-brand" /> الهوية الأساسية</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اسم المتجر" required className="sm:col-span-2">
                <Input value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} />
              </Field>
              <Field label="وصف المتجر" className="sm:col-span-2">
                <Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </Field>
              <AdminImageField label="شعار المتجر" hint="مربع، يفضّل 512×512" value={form.logoUrl} storeId={storeId} onChange={(value) => setForm({ ...form, logoUrl: value })} />
              <AdminImageField label="غلاف المتجر" hint="عريض، يفضّل 1600×600" value={form.coverUrl} storeId={storeId} onChange={(value) => setForm({ ...form, coverUrl: value })} aspect="aspect-[16/7]" />
            </div>
          </section>
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-ink"><Palette className="h-4 w-4 text-brand" /> الألوان والقالب</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField label="اللون الأساسي" value={form.primaryColor} onChange={(value) => setForm({ ...form, primaryColor: value })} />
              <ColorField label="اللون الثانوي" value={form.secondaryColor} onChange={(value) => setForm({ ...form, secondaryColor: value })} />
              <ColorField label="لون النص" value={form.textColor} onChange={(value) => setForm({ ...form, textColor: value })} />
              <Field label="وضع السمة">
                <Select value={form.themeMode} onChange={(event) => setForm({ ...form, themeMode: event.target.value })}>
                  <option value="light">فاتح</option>
                  <option value="dark">داكن</option>
                  <option value="system">حسب النظام</option>
                </Select>
              </Field>
              <Field label="الخط العربي">
                <Select value={form.arabicFont} onChange={(event) => setForm({ ...form, arabicFont: event.target.value })}>
                  {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
                </Select>
              </Field>
              <Field label="قالب المتجر">
                <Select value={form.templateKey} onChange={(event) => setForm({ ...form, templateKey: event.target.value })}>
                  {TEMPLATE_OPTIONS.map((template) => <option key={template.value} value={template.value}>{template.label}</option>)}
                </Select>
              </Field>
            </div>
          </section>
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-ink"><Globe2 className="h-4 w-4 text-brand" /> تحسين محركات البحث</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="عنوان الصفحة" hint="حتى 200 حرف." className="sm:col-span-2">
                <Input value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} />
              </Field>
              <Field label="وصف الصفحة" hint="حتى 400 حرف." className="sm:col-span-2">
                <Textarea rows={2} value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} />
              </Field>
            </div>
          </section>
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-ink"><Users className="h-4 w-4 text-brand" /> بيانات تشغيلية وتواصل</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="رقم الهاتف"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} dir="ltr" /></Field>
              <Field label="واتساب"><Input value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} dir="ltr" /></Field>
              <Field label="بريد الدعم"><Input value={form.supportEmail} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} dir="ltr" /></Field>
              <Field label="كود الدولة"><Input value={form.countryCode} onChange={(event) => setForm({ ...form, countryCode: event.target.value.toUpperCase().slice(0, 2) })} dir="ltr" /></Field>
            </div>
          </section>
          {Array.isArray(data?.domains) && data.domains.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-ink"><Globe2 className="h-4 w-4 text-brand" /> النطاقات المرتبطة</div>
              <div className="flex flex-wrap gap-1.5">
                {data.domains.map((domain: any) => (
                  <Badge key={domain.id} tone={domain.status === "verified" ? "bg-success-soft text-success border-success-line" : "bg-warning-soft text-warning border-warning-line"}>
                    {domain.domain} · {domain.status === "verified" ? "موثّق" : "بانتظار التحقق"}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Merchants                                                           */
/* ------------------------------------------------------------------ */

export function MerchantsPanel() {
  const { data, loading, error, reload } = useAsync(() => api.admin.merchants(), []);
  const [query, setQuery] = useState("");
  const merchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.merchants ?? []).filter((merchant: any) => {
      if (!q) return true;
      return [merchant.name, merchant.email, merchant.first_name, merchant.last_name, merchant.store?.storeName, merchant.store?.subdomain]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [data, query]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الهويات"
        title="حسابات التجار"
        description="قراءة فقط لهويات التجار ودورها في المتجر. حسابات الإدارة منفصلة تماماً ولا تظهر هنا."
        actions={<Button variant="outline" onClick={reload} loading={loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />
      {error ? <Alert tone="error" title="تعذر تحميل التجار">{safeError(error)}</Alert> : null}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث بالبريد أو الاسم أو المتجر…" className="w-full sm:w-80" />
          <div className="ms-auto text-[11px] text-subtle">{number(merchants.length)} حساب</div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
        ) : merchants.length === 0 ? (
          <EmptyState title="لا توجد حسابات مطابقة" description="جرّب تغيير البحث." icon={<Users className="h-5 w-5" />} />
        ) : (
          <TableShell minWidth={920}>
            <thead>
              <tr className="border-b border-line bg-surface/60">
                <Th>التاجر</Th>
                <Th>التواصل</Th>
                <Th>المتجر</Th>
                <Th>الأمان</Th>
                <Th>تاريخ التسجيل</Th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant: any) => {
                const meta = storeMeta(merchant.store?.status ?? "");
                return (
                  <tr key={merchant.id} className="border-b border-line align-top hover:bg-surface/50">
                    <Td>
                      <div className="text-xs font-bold text-ink">{ownerName(merchant)}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{merchant.email}</div>
                      <div className="mt-0.5 text-[10px] text-subtle">دور المتجر: {merchant.role}</div>
                    </Td>
                    <Td><span className="text-[11px] text-ink-soft" dir="ltr">{merchant.phone || "—"}</span></Td>
                    <Td>
                      {merchant.store ? (
                        <>
                          <div className="text-[11px] font-semibold text-ink">{merchant.store.storeName}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">/store/{merchant.store.subdomain}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge tone={meta.tone} dot={meta.dot}>{meta.label}</Badge>
                            <Badge tone={publishMeta(merchant.store.publishStatus).tone}>{publishMeta(merchant.store.publishStatus).label}</Badge>
                          </div>
                        </>
                      ) : <span className="text-[11px] text-subtle">بلا متجر</span>}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={merchant.email_verified ? "bg-success-soft text-success border-success-line" : "bg-warning-soft text-warning border-warning-line"}>
                          {merchant.email_verified ? "بريد مؤكد" : "بريد غير مؤكد"}
                        </Badge>
                        <Badge tone={merchant.two_factor_enabled ? "bg-brand-soft text-brand border-brand-line" : "bg-surface text-ink-soft border-line"}>
                          {merchant.two_factor_enabled ? "2FA مفعّلة" : "2FA غير مفعّلة"}
                        </Badge>
                      </div>
                    </Td>
                    <Td><span className="text-[11px] text-subtle">{date(merchant.created_at)}</span></Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

type PaymentDecision = "approve" | "reject";

export function SubscriptionsPanel({ can }: AdminPanelProps) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.admin.subscriptionPayments(), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [target, setTarget] = useState<{ payment: any; decision: PaymentDecision } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = data?.payments ?? [];
  const summary = data?.summary ?? {};
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((payment: any) => {
      if (status !== "all" && payment.status !== status) return false;
      if (!q) return true;
      return [payment.store?.storeName, payment.store?.subdomain, payment.store?.owner?.name, payment.store?.owner?.email, payment.reference, payment.payerName]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [rows, query, status]);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.admin.reviewSubscriptionPayment(target.payment.id, { decision: target.decision, note: note.trim() });
      toast.success(target.decision === "approve" ? "تم اعتماد الدفعة وتمديد الاشتراك." : "تم رفض الدفعة.");
      setTarget(null);
      setNote("");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الفوترة والاشتراكات"
        title="دفعات اشتراك المنصة"
        description="اعتماد الدفعة يحدّث خطة المتجر وتاريخ التجديد. لا يغيّر رصيد المحفظة ولا يمس إيداعاتها."
        actions={<Button variant="outline" onClick={reload} loading={loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />
      {error ? <Alert tone="error" title="تعذر تحميل دفعات الاشتراك">{safeError(error)}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="قيد المراجعة" value={number(summary.pending ?? 0)} icon={<Clock className="h-5 w-5" />} accent="warning" hint="بانتظار قرار الإدارة" />
        <StatCard label="معتمد هذا الشهر" value={money(summary.approvedThisMonth ?? 0, summary.currency ?? "EGP")} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" hint="قيمة الدفعات المعتمدة" />
        <StatCard label="السعر الشهري" value={money(summary.prices?.monthly ?? 100, summary.currency ?? "EGP")} icon={<CreditCard className="h-5 w-5" />} accent="brand" hint="قيمة ثابتة من المنصة" />
        <StatCard label="السعر السنوي" value={money(summary.prices?.annual ?? 1000, summary.currency ?? "EGP")} icon={<CalendarClock className="h-5 w-5" />} accent="brand" hint="يوفّر شهرين" />
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث بالمتجر أو المرجع…" className="w-full sm:w-80" />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full sm:w-44">
            <option value="all">كل الحالات</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">معتمدة</option>
            <option value="rejected">مرفوضة</option>
          </Select>
          <div className="ms-auto text-[11px] text-subtle">{number(filtered.length)} من {number(rows.length)} دفعة</div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="لا توجد دفعات مطابقة" description="ستظهر هنا دفعات الاشتراك التي يسجلها التجار." icon={<CreditCard className="h-5 w-5" />} />
        ) : (
          <TableShell minWidth={1180}>
            <thead>
              <tr className="border-b border-line bg-surface/60">
                <Th>المتجر</Th><Th>الخطة</Th><Th>المبلغ</Th><Th>الطريقة</Th><Th>المرجع</Th><Th>التاريخ</Th><Th>الحالة</Th><Th>الإجراء</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((payment: any) => {
                const meta = PAYMENT_STATUS[payment.status] ?? { label: payment.status, tone: "bg-surface text-ink-soft border-line", dot: "bg-subtle" };
                return (
                  <tr key={payment.id} className="border-b border-line align-top hover:bg-surface/50">
                    <Td>
                      <div className="text-xs font-bold text-ink">{payment.store?.storeName}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">/store/{payment.store?.subdomain}</div>
                      <div className="mt-0.5 text-[10px] text-subtle">{ownerName(payment.store?.owner)}</div>
                    </Td>
                    <Td><Badge tone={payment.plan === "annual" ? "bg-brand-soft text-brand border-brand-line" : "bg-surface text-ink-soft border-line"}>{PLAN_LABEL[payment.plan] ?? payment.plan}</Badge></Td>
                    <Td><span className="font-semibold text-ink">{money(payment.amount, payment.currency ?? "EGP")}</span></Td>
                    <Td><span className="text-[11px] text-ink-soft">{PAYMENT_METHOD[payment.method] ?? payment.method}</span></Td>
                    <Td>
                      <div className="font-mono text-[10px] text-ink-soft" dir="ltr">{payment.reference}</div>
                      <div className="mt-0.5 text-[10px] text-subtle">{payment.payerName || "بدون اسم دافع"}</div>
                    </Td>
                    <Td>
                      <span className="text-[11px] text-ink-soft">{dateTime(payment.createdAt)}</span>
                      {payment.store?.subscriptionPaidUntil ? (
                        <div className={`mt-1 text-[10px] ${new Date(payment.store.subscriptionPaidUntil).getTime() <= Date.now() ? "text-danger" : "text-success"}`}>
                          {new Date(payment.store.subscriptionPaidUntil).getTime() <= Date.now() ? "الاشتراك منتهي" : `متبقي ${Math.ceil((new Date(payment.store.subscriptionPaidUntil).getTime() - Date.now()) / 86400000)} يوم`}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={meta.tone} dot={meta.dot}>{meta.label}</Badge>
                      {payment.reviewNote ? <div className="mt-1 max-w-[170px] text-[10px] leading-4 text-subtle">{payment.reviewNote}</div> : null}
                    </Td>
                    <Td>
                      {payment.status === "pending" && can("subscriptions.write") ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <Button size="sm" variant="success" onClick={() => { setNote(""); setTarget({ payment, decision: "approve" }); }}><CheckCircle2 className="h-3.5 w-3.5" /> اعتماد</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setNote(""); setTarget({ payment, decision: "reject" }); }}><XCircle className="h-3.5 w-3.5" /> رفض</Button>
                        </div>
                      ) : <span className="text-[10px] text-subtle">{payment.status === "pending" ? "لا تملك صلاحية" : "تمت المراجعة"}</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal
        open={Boolean(target)}
        onClose={() => (busy ? undefined : setTarget(null))}
        title={target?.decision === "approve" ? "اعتماد دفعة الاشتراك" : "رفض دفعة الاشتراك"}
        description={target ? `${target.payment.store?.storeName} · ${PLAN_LABEL[target.payment.plan] ?? target.payment.plan}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>إلغاء</Button>
            <Button variant={target?.decision === "approve" ? "success" : "danger"} loading={busy} onClick={submit}>
              {target?.decision === "approve" ? "اعتماد الدفعة" : "رفض الدفعة"}
            </Button>
          </>
        }
      >
        {target ? (
          <div className="space-y-4">
            <Alert tone={target.decision === "approve" ? "success" : "error"} title={target.decision === "approve" ? "سيتم تمديد الاشتراك" : "لن تُحدَّث خطة الاشتراك"}>
              {target.decision === "approve"
                ? `ستُحدَّث الخطة إلى ${PLAN_LABEL[target.payment.plan] ?? target.payment.plan} وتُمدَّد ${PLAN_PERIOD[target.payment.plan] ?? ""} من نهاية الفترة الحالية.`
                : "سيرى التاجر الدفعة مرفوضة ويمكنه إرسال دفعة جديدة. اكتب سبباً واضحاً."}
            </Alert>
            <div className="grid gap-2 rounded-brand border border-line bg-surface p-3 text-[11px] text-ink-soft sm:grid-cols-2">
              <div><span className="text-subtle">المبلغ:</span> {money(target.payment.amount, target.payment.currency ?? "EGP")}</div>
              <div><span className="text-subtle">المرجع:</span> <span className="font-mono" dir="ltr">{target.payment.reference}</span></div>
              <div><span className="text-subtle">الدافع:</span> {target.payment.payerName || "—"}</div>
              <div><span className="text-subtle">أُرسلت:</span> {dateTime(target.payment.createdAt)}</div>
            </div>
            <Field label="ملاحظة الإدارة" hint="تظهر للتاجر في سجل الدفعات.">
              <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="سبب الرفض أو ملاحظة الاعتماد…" />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wallet approvals                                                    */
/* ------------------------------------------------------------------ */

export function WalletPanel({ can }: AdminPanelProps) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.admin.walletTransactions(), []);
  const [status, setStatus] = useState("pending");
  const [target, setTarget] = useState<{ transaction: any; decision: PaymentDecision } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = data?.transactions ?? [];
  const summary = data?.summary ?? {};
  const filtered = status === "all" ? rows : rows.filter((row: any) => row.status === status);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.admin.reviewWalletTransaction(target.transaction.id, { decision: target.decision, note: note.trim() });
      toast.success(target.decision === "approve" ? "تم اعتماد الإيداع وإضافته للرصيد." : "تم رفض طلب الإيداع.");
      setTarget(null);
      setNote("");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="المحفظة"
        title="إيداعات المحفظة"
        description="طلبات الإيداع لا تغيّر الرصيد عند إنشائها. الاعتماد هنا هو الإجراء الوحيد الذي يضيف المبلغ، ويُسجَّل في سجل التدقيق."
        actions={<Button variant="outline" onClick={reload} loading={loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />
      {error ? <Alert tone="error" title="تعذر تحميل إيداعات المحفظة">{safeError(error)}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="طلبات معلّقة" value={number(summary.pending ?? 0)} icon={<Clock className="h-5 w-5" />} accent="warning" hint="بانتظار قرار مالي" />
        <StatCard label="قيمة المعلّق" value={money(summary.pendingAmount ?? 0, "EGP")} icon={<Wallet className="h-5 w-5" />} accent="warning" hint="لم تُضف إلى أي رصيد بعد" />
        <StatCard label="سياسة الإيداع" value="موافقة إدارية" icon={<ShieldCheck className="h-5 w-5" />} accent="success" hint="يمكن إيقاف الاستقبال من مفاتيح الميزات" />
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full sm:w-48">
            <option value="pending">قيد المراجعة</option>
            <option value="completed">معتمدة</option>
            <option value="rejected">مرفوضة</option>
            <option value="all">كل الحالات</option>
          </Select>
          <div className="ms-auto text-[11px] text-subtle">{number(filtered.length)} من {number(rows.length)} طلب</div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="لا توجد طلبات في هذا التصنيف" description="ستظهر طلبات الإيداع التي ينشئها التجار." icon={<Wallet className="h-5 w-5" />} />
        ) : (
          <TableShell minWidth={1000}>
            <thead>
              <tr className="border-b border-line bg-surface/60">
                <Th>المتجر</Th><Th>المبلغ</Th><Th>المرجع</Th><Th>أُنشئ</Th><Th>رصيد قبل/بعد</Th><Th>الحالة</Th><Th>الإجراء</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((transaction: any) => {
                const meta = WALLET_STATUS[transaction.status] ?? { label: transaction.status, tone: "bg-surface text-ink-soft border-line", dot: "bg-subtle" };
                return (
                  <tr key={transaction.id} className="border-b border-line align-top hover:bg-surface/50">
                    <Td>
                      <div className="text-xs font-bold text-ink">{transaction.store?.storeName}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">/store/{transaction.store?.subdomain}</div>
                    </Td>
                    <Td><span className="font-semibold text-ink">{money(transaction.amount, transaction.store?.currency ?? "EGP")}</span></Td>
                    <Td>
                      <div className="max-w-[220px] truncate font-mono text-[10px] text-ink-soft" dir="ltr">{transaction.reference || "—"}</div>
                      {transaction.note ? <div className="mt-0.5 max-w-[220px] text-[10px] leading-4 text-subtle">{transaction.note}</div> : null}
                    </Td>
                    <Td><span className="text-[11px] text-subtle">{dateTime(transaction.createdAt)}</span></Td>
                    <Td><span className="text-[11px] text-subtle">{money(transaction.balanceBefore ?? 0, "EGP")} → {money(transaction.balanceAfter ?? 0, "EGP")}</span></Td>
                    <Td>
                      <Badge tone={meta.tone} dot={meta.dot}>{meta.label}</Badge>
                      {transaction.reviewNote ? <div className="mt-1 max-w-[170px] text-[10px] leading-4 text-subtle">{transaction.reviewNote}</div> : null}
                    </Td>
                    <Td>
                      {transaction.status === "pending" && can("wallet.write") ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <Button size="sm" variant="success" onClick={() => { setNote(""); setTarget({ transaction, decision: "approve" }); }}><CheckCircle2 className="h-3.5 w-3.5" /> اعتماد</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setNote(""); setTarget({ transaction, decision: "reject" }); }}><XCircle className="h-3.5 w-3.5" /> رفض</Button>
                        </div>
                      ) : <span className="text-[10px] text-subtle">{transaction.status === "pending" ? "لا تملك صلاحية" : "تمت المراجعة"}</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal
        open={Boolean(target)}
        onClose={() => (busy ? undefined : setTarget(null))}
        title={target?.decision === "approve" ? "اعتماد إيداع المحفظة" : "رفض إيداع المحفظة"}
        description={target ? `${target.transaction.store?.storeName} · ${money(target.transaction.amount, target.transaction.store?.currency ?? "EGP")}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>إلغاء</Button>
            <Button variant={target?.decision === "approve" ? "success" : "danger"} loading={busy} onClick={submit}>
              {target?.decision === "approve" ? "اعتماد وإضافة الرصيد" : "رفض الطلب"}
            </Button>
          </>
        }
      >
        {target ? (
          <div className="space-y-4">
            <Alert tone={target.decision === "approve" ? "success" : "error"} title={target.decision === "approve" ? "سيُضاف المبلغ للرصيد" : "لن يتغير الرصيد"}>
              {target.decision === "approve"
                ? "تأكد من وصول المبلغ فعلياً قبل الاعتماد. يُسجَّل اسمك ووقت المراجعة في سجل التدقيق."
                : "اكتب سبب الرفض ليظهر للتاجر. يمكنه إرسال طلب جديد بعد تصحيح البيانات."}
            </Alert>
            <div className="grid gap-2 rounded-brand border border-line bg-surface p-3 text-[11px] text-ink-soft sm:grid-cols-2">
              <div><span className="text-subtle">المرجع:</span> <span className="font-mono" dir="ltr">{target.transaction.reference || "—"}</span></div>
              <div><span className="text-subtle">أُنشئ:</span> {dateTime(target.transaction.createdAt)}</div>
              <div className="sm:col-span-2"><span className="text-subtle">ملاحظة التاجر:</span> {target.transaction.note || "—"}</div>
            </div>
            <Field label="ملاحظة المراجعة" hint="تظهر للتاجر وتُحفظ في سجل التدقيق.">
              <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="رقم العملية البنكية أو سبب الرفض…" />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
