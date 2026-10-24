import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Ban,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Globe2,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  LogOut,
  Palette,
  RefreshCw,
  Settings2,
  ShieldAlert,
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
import { Link, navigate, usePath } from "../lib/router";
import { useSession } from "../lib/session";
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
import { BrandLogo } from "../components/Brand";
import { TableShell, Td, Th } from "../dashboard/common";

type AdminTab = "overview" | "stores" | "payments" | "visits" | "leads";
type StoreAction = "approve" | "reject" | "suspend";
type PaymentDecision = "approve" | "reject";

const TABS: Array<{ key: AdminTab; href: string; label: string; icon: React.ElementType }> = [
  { key: "overview", href: "/admin", label: "نظرة عامة", icon: LayoutDashboard },
  { key: "stores", href: "/admin/stores", label: "المتاجر والتفعيل", icon: StoreIcon },
  { key: "payments", href: "/admin/payments", label: "دفعات الاشتراك", icon: CreditCard },
  { key: "visits", href: "/admin/visits", label: "الزيارات", icon: BarChart3 },
  { key: "leads", href: "/admin/leads", label: "طلبات المنصة", icon: FileText },
];

const STORE_STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  active: { label: "نشط", tone: "bg-success-soft text-success border-success-line", dot: "bg-success" },
  pending: { label: "بانتظار الموافقة", tone: "bg-warning-soft text-warning border-warning-line", dot: "bg-warning" },
  rejected: { label: "مرفوض", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
  suspended: { label: "موقوف", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
};

const PAYMENT_STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  pending: { label: "قيد المراجعة", tone: "bg-warning-soft text-warning border-warning-line", dot: "bg-warning" },
  approved: { label: "معتمدة", tone: "bg-success-soft text-success border-success-line", dot: "bg-success" },
  rejected: { label: "مرفوضة", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
};

const PLAN_LABEL: Record<string, string> = { monthly: "شهري", annual: "سنوي" };
const PLAN_PERIOD: Record<string, string> = { monthly: "شهر", annual: "سنة" };
const PAYMENT_METHOD: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  instapay: "إنستاباي",
  vodafone_cash: "فودافون كاش",
  wallet: "محفظة إلكترونية",
  other: "طريقة أخرى",
};
const FONT_OPTIONS = ["Cairo", "IBM Plex Sans Arabic", "Tajawal", "Almarai"];
const TEMPLATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "general", label: "عام" },
  { value: "fashion", label: "أزياء" },
  { value: "electronics", label: "إلكترونيات" },
  { value: "restaurant", label: "مطاعم" },
  { value: "beauty", label: "تجميل" },
  { value: "services", label: "خدمات" },
];
const SETTINGS_FIELDS = [
  "storeName",
  "description",
  "logoUrl",
  "coverUrl",
  "primaryColor",
  "secondaryColor",
  "textColor",
  "themeMode",
  "arabicFont",
  "templateKey",
  "seoTitle",
  "seoDescription",
  "supportEmail",
  "whatsapp",
  "phone",
  "countryCode",
] as const;

function tabFromPath(path: string): AdminTab {
  const match = path.match(/^\/admin(?:\/([^/]+))?\/?$/);
  const raw = match?.[1] ?? "overview";
  return TABS.some((tab) => tab.key === raw) ? (raw as AdminTab) : "overview";
}

function storeMeta(status: string) {
  return STORE_STATUS[status] ?? { label: status, tone: "bg-surface text-ink-soft border-line", dot: "bg-subtle" };
}

function paymentMeta(status: string) {
  return PAYMENT_STATUS[status] ?? { label: status, tone: "bg-surface text-ink-soft border-line", dot: "bg-subtle" };
}

function ownerName(owner: any): string {
  if (!owner) return "—";
  return owner.name || [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || "—";
}

function monthLabel(value: string): string {
  const [year, month] = String(value).split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { month: "short", year: "2-digit" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

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
  label,
  hint,
  value,
  storeId,
  onChange,
  aspect = "aspect-square",
}: {
  label: string;
  hint?: string;
  value: string;
  storeId: string;
  onChange: (value: string) => void;
  aspect?: string;
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
      const result = await api.admin.uploadStoreMedia(storeId, {
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      });
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
      <div
        className={cn(
          "group relative flex items-center justify-center overflow-hidden rounded-brand border-2 border-dashed border-line bg-surface",
          aspect
        )}
      >
        {value ? (
          <>
            <img src={mediaUrl(value)} alt={label} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-overlay opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-brand-sm bg-card p-2 text-ink shadow-brand-card"
                title="استبدال الصورة"
              >
                <UploadCloud className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-brand-sm bg-danger p-2 text-on-danger"
                title="حذف الصورة"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin text-brand" /> : <ImagePlus className="h-7 w-7 text-subtle" />}
            <span className="text-xs font-semibold text-ink-soft">{busy ? "جارٍ الرفع…" : "رفع صورة"}</span>
            {hint ? <span className="text-[10px] text-subtle">{hint}</span> : null}
          </button>
        )}
        {busy && value ? (
          <div className="absolute inset-0 flex items-center justify-center bg-overlay">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        ) : null}
      </div>
      {error ? <div className="text-[11px] text-danger">{error}</div> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="أو ألصق رابط الصورة"
        className="input-control h-9 text-[11px]"
        dir="ltr"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#047857"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-brand border border-line bg-card p-1"
          aria-label={label}
        />
        <Input value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} dir="ltr" className="font-mono" />
      </div>
    </Field>
  );
}

function VisitsChart({ rows }: { rows: Array<{ month: string; visits: number }> }) {
  const max = Math.max(...rows.map((row) => row.visits), 1);
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-3" dir="ltr">
      {rows.map((row) => {
        const height = row.visits === 0 ? 3 : Math.max(8, (row.visits / max) * 100);
        return (
          <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="text-[10px] font-semibold text-ink-soft">{number(row.visits)}</div>
            <div className="flex h-32 w-full items-end overflow-hidden rounded-brand-sm bg-surface">
              <div
                className="w-full rounded-brand-sm bg-gradient-to-t from-brand to-brand/55 transition-[height] duration-500"
                style={{ height: `${height}%` }}
              />
            </div>
            <div className="truncate text-[10px] text-subtle" dir="rtl">{monthLabel(row.month)}</div>
          </div>
        );
      })}
    </div>
  );
}

function StoreTable({
  stores,
  emptyTitle = "لا توجد متاجر",
  emptyDescription = "ستظهر المتاجر هنا بعد تسجيل أول تاجر.",
  onIdentity,
  onAction,
}: {
  stores: any[];
  emptyTitle?: string;
  emptyDescription?: string;
  onIdentity: (store: any) => void;
  onAction: (store: any, action: StoreAction) => void;
}) {
  if (stores.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={<StoreIcon className="h-5 w-5" />} />;
  }
  return (
    <TableShell minWidth={1160}>
      <thead>
        <tr className="border-b border-line bg-surface/60">
          <Th>المتجر</Th>
          <Th>المالك</Th>
          <Th>الحالة</Th>
          <Th>تاريخ التفعيل</Th>
          <Th>الاشتراك</Th>
          <Th>زيارات الشهر</Th>
          <Th>الإجراءات</Th>
        </tr>
      </thead>
      <tbody>
        {stores.map((store) => {
          const meta = storeMeta(store.status);
          return (
            <tr key={store.id} className="border-b border-line align-top transition hover:bg-surface/50">
              <Td>
                <div className="flex items-center gap-2.5">
                  {store.logoUrl ? (
                    <img src={mediaUrl(store.logoUrl)} alt="" className="h-9 w-9 rounded-brand-sm border border-line object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-brand-sm bg-brand-soft text-sm font-bold text-brand">
                      {String(store.storeName ?? "س").trim().charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="max-w-[190px] truncate text-xs font-bold text-ink">{store.storeName}</div>
                    <a
                      href={`/store/${store.subdomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-subtle hover:text-brand"
                      dir="ltr"
                    >
                      /store/{store.subdomain} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              </Td>
              <Td>
                <div className="text-[11px] font-semibold text-ink">{ownerName(store.owner)}</div>
                <div className="mt-0.5 max-w-[180px] truncate font-mono text-[10px] text-subtle" dir="ltr">{store.owner?.email ?? "—"}</div>
              </Td>
              <Td>
                <Badge tone={meta.tone} dot={meta.dot}>{meta.label}</Badge>
                <div className="mt-1 text-[10px] text-subtle">
                  {store.onboardingCompleted ? "أكمل التهيئة" : "لم يكمل التهيئة"}
                </div>
              </Td>
              <Td>
                <div className="text-[11px] text-ink-soft">{store.activatedAt ? dateTime(store.activatedAt) : "لم يُفعّل بعد"}</div>
                <div className="mt-0.5 text-[10px] text-subtle">أُنشئ {date(store.createdAt)}</div>
              </Td>
              <Td>
                <div className="text-[11px] font-semibold text-ink">{PLAN_LABEL[store.plan] ?? store.plan ?? "—"}</div>
                <div className="mt-0.5 text-[10px] text-subtle">
                  {store.subscriptionPaidUntil ? `مدفوع حتى ${date(store.subscriptionPaidUntil)}` : "لا يوجد تجديد معتمد"}
                </div>
                <div className="mt-0.5 text-[10px] text-subtle">دفعات مسجلة: {number(store.paymentCount ?? 0)}</div>
              </Td>
              <Td>
                <div className="text-sm font-bold text-ink">{number(store.visitsThisMonth ?? 0)}</div>
                <div className="mt-0.5 text-[10px] text-subtle">الإجمالي {number(store.visitsTotal ?? 0)}</div>
              </Td>
              <Td>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {store.status !== "active" ? (
                    <Button size="sm" variant="success" onClick={() => onAction(store, "approve")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> تفعيل
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => onAction(store, "suspend")} title="إيقاف المتجر">
                      <Ban className="h-3.5 w-3.5" /> إيقاف
                    </Button>
                  )}
                  {store.status === "pending" ? (
                    <Button size="sm" variant="ghost" onClick={() => onAction(store, "reject")} title="رفض الطلب">
                      <XCircle className="h-3.5 w-3.5" /> رفض
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => onIdentity(store)}>
                    <Settings2 className="h-3.5 w-3.5" /> الهوية
                  </Button>
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}

export function AdminApp() {
  const path = usePath();
  const tab = tabFromPath(path);
  const toast = useToast();
  const { session, merchant, loading, logout } = useSession();
  const isAdmin = merchant?.role === "admin";

  const overview = useAsync(async () => (isAdmin ? api.admin.overview() : null), [isAdmin]);
  const payments = useAsync(async () => (isAdmin ? api.admin.subscriptionPayments() : null), [isAdmin]);
  const leads = useAsync(async () => (isAdmin && tab === "leads" ? api.admin.leads() : null), [isAdmin, tab]);

  const [storeQuery, setStoreQuery] = useState("");
  const [storeStatus, setStoreStatus] = useState("all");
  const [paymentQuery, setPaymentQuery] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");

  const [reviewTarget, setReviewTarget] = useState<{ store: any; action: StoreAction } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  const [paymentTarget, setPaymentTarget] = useState<{ payment: any; decision: PaymentDecision } | null>(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);

  const [settingsStoreId, setSettingsStoreId] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState<any>(null);
  const [settingsForm, setSettingsForm] = useState<Record<string, string> | null>(null);
  const [settingsInitial, setSettingsInitial] = useState<Record<string, string> | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<unknown>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate("/auth/login?next=/admin", { replace: true });
  }, [loading, session]);

  useEffect(() => {
    if (!settingsStoreId) {
      setSettingsData(null);
      setSettingsForm(null);
      setSettingsInitial(null);
      setSettingsError(null);
      return;
    }
    let alive = true;
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsData(null);
    setSettingsForm(null);
    api.admin
      .storeSettings(settingsStoreId)
      .then((data) => {
        if (!alive) return;
        const form = formFromSettings(data);
        setSettingsData(data);
        setSettingsForm(form);
        setSettingsInitial(form);
      })
      .catch((error) => {
        if (alive) setSettingsError(error);
      })
      .finally(() => {
        if (alive) setSettingsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [settingsStoreId]);

  const stores = overview.data?.stores ?? [];
  const paymentsRows = payments.data?.payments ?? [];
  const summary = overview.data?.summary ?? {};
  const pendingPayments = paymentsRows.filter((payment: any) => payment.status === "pending");

  const filteredStores = useMemo(() => {
    const query = storeQuery.trim().toLowerCase();
    return stores.filter((store: any) => {
      if (storeStatus !== "all" && store.status !== storeStatus) return false;
      if (!query) return true;
      const haystack = [
        store.storeName,
        store.subdomain,
        store.owner?.name,
        store.owner?.email,
        store.owner?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [stores, storeQuery, storeStatus]);

  const filteredPayments = useMemo(() => {
    const query = paymentQuery.trim().toLowerCase();
    return paymentsRows.filter((payment: any) => {
      if (paymentStatus !== "all" && payment.status !== paymentStatus) return false;
      if (!query) return true;
      const haystack = [
        payment.store?.storeName,
        payment.store?.subdomain,
        payment.store?.owner?.name,
        payment.store?.owner?.email,
        payment.reference,
        payment.payerName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [paymentsRows, paymentQuery, paymentStatus]);

  const refreshAll = () => {
    overview.reload();
    payments.reload();
    if (tab === "leads") leads.reload();
  };

  const openStoreReview = (store: any, action: StoreAction) => {
    setReviewNote("");
    setReviewTarget({ store, action });
  };

  const runStoreAction = async () => {
    if (!reviewTarget) return;
    setReviewBusy(true);
    try {
      if (reviewTarget.action === "approve") {
        await api.admin.approveStore(reviewTarget.store.id, reviewNote.trim());
        toast.success("تم تفعيل المتجر وتسجيل تاريخ التفعيل.");
      } else if (reviewTarget.action === "reject") {
        await api.admin.rejectStore(reviewTarget.store.id, reviewNote.trim());
        toast.success("تم رفض طلب فتح المتجر.");
      } else {
        await api.admin.suspendStore(reviewTarget.store.id, reviewNote.trim());
        toast.success("تم إيقاف المتجر.");
      }
      setReviewTarget(null);
      setReviewNote("");
      refreshAll();
    } catch (error: any) {
      toast.error(safeError(error));
    } finally {
      setReviewBusy(false);
    }
  };

  const openPaymentReview = (payment: any, decision: PaymentDecision) => {
    setPaymentNote("");
    setPaymentTarget({ payment, decision });
  };

  const runPaymentReview = async () => {
    if (!paymentTarget) return;
    setPaymentBusy(true);
    try {
      await api.admin.reviewSubscriptionPayment(paymentTarget.payment.id, {
        decision: paymentTarget.decision,
        note: paymentNote.trim(),
      });
      toast.success(
        paymentTarget.decision === "approve"
          ? "تم اعتماد الدفعة وتحديث خطة الاشتراك وتاريخ التجديد."
          : "تم رفض الدفعة وإبلاغ التاجر."
      );
      setPaymentTarget(null);
      setPaymentNote("");
      refreshAll();
    } catch (error: any) {
      toast.error(safeError(error));
    } finally {
      setPaymentBusy(false);
    }
  };

  const closeSettings = () => {
    if (settingsSaving) return;
    setSettingsStoreId(null);
  };

  const saveSettings = async () => {
    if (!settingsStoreId || !settingsForm || !settingsInitial) return;
    if (settingsForm.storeName.trim().length < 2) {
      toast.error("اسم المتجر يجب أن يكون حرفين على الأقل.");
      return;
    }
    const patch: Record<string, string> = {};
    for (const field of SETTINGS_FIELDS) {
      const next = String(settingsForm[field] ?? "").trim();
      const previous = String(settingsInitial[field] ?? "").trim();
      if (next !== previous) patch[field] = next;
    }
    if (Object.keys(patch).length === 0) {
      closeSettings();
      return;
    }
    setSettingsSaving(true);
    try {
      await api.admin.updateStoreSettings(settingsStoreId, patch);
      toast.success("تم تحديث هوية المتجر وإعداداته.");
      setSettingsStoreId(null);
      refreshAll();
    } catch (error: any) {
      toast.error(safeError(error));
    } finally {
      setSettingsSaving(false);
    }
  };

  const loginAgain = async () => {
    await logout();
    navigate("/auth/login?next=/admin", { replace: true });
  };

  if (loading) {
    return (
      <div dir="rtl" data-theme="light" className="flex min-h-screen items-center justify-center bg-canvas font-arabic text-ink">
        <div className="flex items-center gap-2 text-sm text-subtle"><Loader2 className="h-5 w-5 animate-spin text-brand" /> جارٍ التحقق من صلاحيات الإدارة…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div dir="rtl" data-theme="light" className="flex min-h-screen items-center justify-center bg-canvas px-4 font-arabic text-ink">
        <Card className="max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-brand" />
          <h1 className="mt-4 font-heading text-xl font-bold">يلزم تسجيل الدخول</h1>
          <p className="mt-2 text-xs leading-6 text-subtle">هذه المنطقة مخصصة لحساب إدارة منصة سند. سيتم تحويلك لتسجيل الدخول.</p>
          <Button className="mt-5" onClick={() => navigate("/auth/login?next=/admin")}>تسجيل الدخول</Button>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div dir="rtl" data-theme="light" className="flex min-h-screen items-center justify-center bg-canvas px-4 font-arabic text-ink">
        <Card className="max-w-lg p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-brand border border-danger-line bg-danger-soft text-danger">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-bold">هذه الصفحة لإدارة المنصة فقط</h1>
          <p className="mt-2 text-sm leading-7 text-subtle">
            حسابك مسجل كتاجر، ولا يملك صلاحية عرض أو تعديل بيانات المتاجر الأخرى. يمكنك العودة إلى لوحة متجرك.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate(session.store?.onboardingCompleted ? "/dashboard" : "/onboarding")}>العودة إلى حسابي</Button>
            <Button variant="outline" onClick={loginAgain}><LogOut className="h-4 w-4" /> تسجيل الخروج</Button>
          </div>
        </Card>
      </div>
    );
  }

  const monthlyVisits = overview.data?.monthlyVisits ?? [];
  const visitsByStore = overview.data?.visitsByStore ?? [];
  const totalVisitsAll = stores.reduce((sum: number, store: any) => sum + Number(store.visitsTotal ?? 0), 0);

  const renderOverview = () => (
    <div className="space-y-5">
      <PageHeader
        eyebrow="إدارة منصة سند"
        title="مركز تحكم المنصة"
        description="راجع المتاجر الجديدة، فعّل الاشتراكات، وتابع حركة الزيارات الشهرية. الوصول هنا محصور بحسابات الإدارة."
        actions={
          <>
            <Button variant="outline" onClick={refreshAll} loading={overview.loading || payments.loading}>
              <RefreshCw className="h-4 w-4" /> تحديث
            </Button>
            <Button onClick={() => navigate("/admin/stores")}>
              <StoreIcon className="h-4 w-4" /> إدارة المتاجر
            </Button>
          </>
        }
      />

      {overview.error ? <Alert tone="error" title="تعذر تحميل بيانات المنصة">{safeError(overview.error)}</Alert> : null}

      {overview.loading && !overview.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="إجمالي المتاجر"
              value={number(summary.totalStores ?? 0)}
              hint={`${number(summary.activeStores ?? 0)} نشط · ${number(summary.pendingStores ?? 0)} بانتظار الموافقة`}
              icon={<Building2 className="h-5 w-5" />}
              accent="brand"
            />
            <StatCard
              label="متاجر نشطة"
              value={number(summary.activeStores ?? 0)}
              hint="واجهة المتجر مفتوحة للعملاء"
              icon={<BadgeCheck className="h-5 w-5" />}
              accent="success"
            />
            <StatCard
              label="بانتظار موافقة الإدارة"
              value={number(summary.pendingStores ?? 0)}
              hint={`${number(summary.rejectedStores ?? 0)} مرفوض · ${number(summary.suspendedStores ?? 0)} موقوف`}
              icon={<Clock className="h-5 w-5" />}
              accent="warning"
            />
            <StatCard
              label="زيارات هذا الشهر"
              value={number(summary.visitsThisMonth ?? 0)}
              hint="عبر كل متاجر المنصة النشطة"
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
              label="اشتراكات معتمدة هذا الشهر"
              value={money(summary.approvedSubscriptionAmountThisMonth ?? 0, "EGP")}
              hint="إجمالي الدفعات المعتمدة من الإدارة"
              icon={<CircleDollarSign className="h-5 w-5" />}
              accent="success"
            />
          </div>

          {(summary.pendingStores ?? 0) > 0 ? (
            <Alert tone="warning" title={`${number(summary.pendingStores)} متجر بانتظار قرارك`}>
              لن تفتح واجهة أي متجر جديد للعملاء قبل موافقتك. راجع بيانات المتجر ثم فعّله أو ارفض الطلب مع توضيح السبب.
              <button type="button" onClick={() => navigate("/admin/stores")} className="ms-1 font-bold underline underline-offset-2">
                فتح قائمة المتاجر
              </button>
            </Alert>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-ink">زيارات آخر 6 أشهر</div>
                  <div className="mt-0.5 text-[10px] text-subtle">إجمالي الزيارات الشهرية عبر جميع المتاجر.</div>
                </div>
                <Badge tone="bg-brand-soft text-brand border-brand-line"><Globe2 className="h-3 w-3" /> {number(summary.visitsThisMonth ?? 0)} هذا الشهر</Badge>
              </div>
              <VisitsChart rows={monthlyVisits} />
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-ink">دفعات بانتظار المراجعة</div>
                  <div className="mt-0.5 text-[10px] text-subtle">اعتماد الدفعة يمدد الاشتراك ولا يغيّر رصيد المحفظة.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin/payments")}>الكل</Button>
              </div>
              {payments.loading && !payments.data ? (
                <div className="space-y-2 p-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16" />)}</div>
              ) : pendingPayments.length === 0 ? (
                <EmptyState
                  title="لا توجد دفعات معلّقة"
                  description="ستظهر هنا دفعات الاشتراك التي يرسلها التجار لمراجعتها."
                  icon={<CreditCard className="h-5 w-5" />}
                />
              ) : (
                <div className="divide-y divide-line">
                  {pendingPayments.slice(0, 4).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-ink">{payment.store?.storeName}</div>
                        <div className="mt-0.5 text-[10px] text-subtle">
                          {PLAN_LABEL[payment.plan] ?? payment.plan} · {money(payment.amount, payment.currency)} · {PAYMENT_METHOD[payment.method] ?? payment.method}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{payment.reference}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate("/admin/payments")}>مراجعة</Button>
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
                <div className="mt-0.5 text-[10px] text-subtle">تاريخ التفعيل يُسجَّل تلقائياً عند أول موافقة من الإدارة.</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/stores")}>عرض كل المتاجر</Button>
            </div>
            <StoreTable stores={stores.slice(0, 8)} onIdentity={(store) => setSettingsStoreId(store.id)} onAction={openStoreReview} />
          </Card>
        </>
      )}
    </div>
  );

  const renderStores = () => (
    <div className="space-y-5">
      <PageHeader
        eyebrow="دورة حياة المتجر"
        title="المتاجر والتفعيل"
        description="كل متجر جديد يبدأ بحالة انتظار. الموافقة تسجّل تاريخ التفعيل وتفتح الواجهة، والرفض أو الإيقاف يغلقها فوراً."
        actions={<Button variant="outline" onClick={refreshAll} loading={overview.loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />

      {overview.error ? <Alert tone="error" title="تعذر تحميل المتاجر">{safeError(overview.error)}</Alert> : null}
      {(summary.pendingStores ?? 0) > 0 ? (
        <Alert tone="warning" title={`${number(summary.pendingStores)} متجر لم يُفعّل بعد`}>
          راجع بيانات المتجر وهويته قبل التفعيل. يمكن للإدارة تعديل الاسم والشعار والألوان عبر زر «الهوية».
        </Alert>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={storeQuery} onChange={setStoreQuery} placeholder="ابحث باسم المتجر أو المالك أو النطاق…" className="w-full sm:w-80" />
          <Select value={storeStatus} onChange={(event) => setStoreStatus(event.target.value)} className="w-full sm:w-44">
            <option value="all">كل الحالات</option>
            <option value="pending">بانتظار الموافقة</option>
            <option value="active">نشط</option>
            <option value="rejected">مرفوض</option>
            <option value="suspended">موقوف</option>
          </Select>
          <div className="ms-auto text-[11px] text-subtle">{number(filteredStores.length)} من {number(stores.length)} متجر</div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {overview.loading && !overview.data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16" />)}</div>
        ) : (
          <StoreTable
            stores={filteredStores}
            emptyTitle="لا توجد متاجر مطابقة"
            emptyDescription="جرّب تغيير البحث أو فلتر الحالة."
            onIdentity={(store) => setSettingsStoreId(store.id)}
            onAction={openStoreReview}
          />
        )}
      </Card>
    </div>
  );

  const renderPayments = () => (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الفوترة والاشتراكات"
        title="دفعات اشتراك المنصة"
        description="راجع دفعات التجار الشهرية والسنوية. اعتماد الدفعة يحدّث خطة المتجر وتاريخ التجديد، ولا يضيف رصيداً إلى محفظته."
        actions={<Button variant="outline" onClick={refreshAll} loading={payments.loading || overview.loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />

      {payments.error ? <Alert tone="error" title="تعذر تحميل دفعات الاشتراك">{safeError(payments.error)}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="دفعات قيد المراجعة" value={number(paymentsRows.filter((payment: any) => payment.status === "pending").length)} icon={<Clock className="h-5 w-5" />} accent="warning" hint="بانتظار قرار الإدارة" />
        <StatCard label="معتمد هذا الشهر" value={money(payments.data?.summary?.approvedThisMonth ?? 0, "EGP")} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" hint="إجمالي قيمة الدفعات المعتمدة" />
        <StatCard label="سعر الاشتراك الشهري" value={money(payments.data?.summary?.prices?.monthly ?? 100, "EGP")} icon={<CreditCard className="h-5 w-5" />} accent="brand" hint="يُحدَّد من المنصة" />
        <StatCard label="سعر الاشتراك السنوي" value={money(payments.data?.summary?.prices?.annual ?? 1000, "EGP")} icon={<CalendarClock className="h-5 w-5" />} accent="brand" hint="يوفّر شهرين مقارنة بالشهري" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={paymentQuery} onChange={setPaymentQuery} placeholder="ابحث باسم المتجر أو المرجع…" className="w-full sm:w-80" />
          <Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="w-full sm:w-44">
            <option value="all">كل الحالات</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">معتمدة</option>
            <option value="rejected">مرفوضة</option>
          </Select>
          <div className="ms-auto text-[11px] text-subtle">{number(filteredPayments.length)} من {number(paymentsRows.length)} دفعة</div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {payments.loading && !payments.data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16" />)}</div>
        ) : filteredPayments.length === 0 ? (
          <EmptyState title="لا توجد دفعات مطابقة" description="ستظهر هنا دفعات الاشتراك التي يسجلها التجار." icon={<CreditCard className="h-5 w-5" />} />
        ) : (
          <TableShell minWidth={1180}>
            <thead>
              <tr className="border-b border-line bg-surface/60">
                <Th>المتجر</Th>
                <Th>المالك</Th>
                <Th>الخطة</Th>
                <Th>المبلغ</Th>
                <Th>طريقة الدفع</Th>
                <Th>المرجع</Th>
                <Th>التاريخ</Th>
                <Th>الحالة</Th>
                <Th>الإجراء</Th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment: any) => {
                const meta = paymentMeta(payment.status);
                return (
                  <tr key={payment.id} className="border-b border-line align-top transition hover:bg-surface/50">
                    <Td>
                      <div className="text-xs font-bold text-ink">{payment.store?.storeName}</div>
                      <a href={`/store/${payment.store?.subdomain}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-subtle hover:text-brand" dir="ltr">
                        /store/{payment.store?.subdomain} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </Td>
                    <Td>
                      <div className="text-[11px] font-semibold text-ink">{ownerName(payment.store?.owner)}</div>
                      <div className="mt-0.5 max-w-[170px] truncate font-mono text-[10px] text-subtle" dir="ltr">{payment.store?.owner?.email ?? "—"}</div>
                    </Td>
                    <Td>
                      <Badge tone={payment.plan === "annual" ? "bg-brand-soft text-brand border-brand-line" : "bg-surface text-ink-soft border-line"}>
                        {PLAN_LABEL[payment.plan] ?? payment.plan}
                      </Badge>
                      <div className="mt-1 text-[10px] text-subtle">المتجر: {PLAN_LABEL[payment.store?.plan] ?? payment.store?.plan ?? "—"}</div>
                    </Td>
                    <Td><span className="font-semibold text-ink">{money(payment.amount, payment.currency ?? "EGP")}</span></Td>
                    <Td><span className="text-[11px] text-ink-soft">{PAYMENT_METHOD[payment.method] ?? payment.method}</span></Td>
                    <Td>
                      <div className="font-mono text-[10px] text-ink-soft" dir="ltr">{payment.reference}</div>
                      <div className="mt-0.5 text-[10px] text-subtle">{payment.payerName || "بدون اسم دافع"}</div>
                      {payment.note ? <div className="mt-1 max-w-[200px] text-[10px] leading-4 text-subtle">{payment.note}</div> : null}
                    </Td>
                    <Td>
                      <div className="text-[11px] text-ink-soft">{dateTime(payment.createdAt)}</div>
                      {payment.reviewedAt ? <div className="mt-0.5 text-[10px] text-subtle">روجعت {dateTime(payment.reviewedAt)}</div> : null}
                    </Td>
                    <Td>
                      <Badge tone={meta.tone} dot={meta.dot}>{meta.label}</Badge>
                      {payment.reviewNote ? <div className="mt-1 max-w-[180px] text-[10px] leading-4 text-subtle">{payment.reviewNote}</div> : null}
                    </Td>
                    <Td>
                      {payment.status === "pending" ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <Button size="sm" variant="success" onClick={() => openPaymentReview(payment, "approve")}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openPaymentReview(payment, "reject")}>
                            <XCircle className="h-3.5 w-3.5" /> رفض
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-subtle">تمت المراجعة</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );

  const renderVisits = () => (
    <div className="space-y-5">
      <PageHeader
        eyebrow="تحليلات المنصة"
        title="الزيارات الشهرية"
        description="إجمالي زيارات واجهات المتاجر المنشورة. تُحتسب زيارة واحدة لكل جلسة تبويب، دون تخزين عنوان IP أو بيانات المتصفح."
        actions={<Button variant="outline" onClick={refreshAll} loading={overview.loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />

      {overview.error ? <Alert tone="error" title="تعذر تحميل الزيارات">{safeError(overview.error)}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="زيارات هذا الشهر" value={number(summary.visitsThisMonth ?? 0)} icon={<BarChart3 className="h-5 w-5" />} accent="brand" hint="الشهر الحالي حتى الآن" />
        <StatCard label="إجمالي الزيارات" value={number(totalVisitsAll)} icon={<Globe2 className="h-5 w-5" />} accent="info" hint="عبر كل المتاجر ومنذ الإطلاق" />
        <StatCard label="متاجر نشطة" value={number(summary.activeStores ?? 0)} icon={<StoreIcon className="h-5 w-5" />} accent="success" hint="هي المتاجر التي تستقبل زيارات حالياً" />
        <StatCard label="متاجر زارها العملاء" value={number(visitsByStore.length)} icon={<Users className="h-5 w-5" />} accent="warning" hint="لديها زيارة واحدة على الأقل هذا الشهر" />
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-ink">حركة الزيارات الشهرية</div>
            <div className="mt-0.5 text-[10px] text-subtle">آخر ستة أشهر ميلادية، بتوقيت UTC.</div>
          </div>
          <Badge tone="bg-info-soft text-info border-info-line"><Clock className="h-3 w-3" /> بدون IP أو User-Agent</Badge>
        </div>
        <VisitsChart rows={monthlyVisits} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="text-sm font-bold text-ink">أكثر المتاجر زيارة هذا الشهر</div>
            <div className="mt-0.5 text-[10px] text-subtle">أعلى 12 متجراً حسب زيارات الشهر الحالي.</div>
          </div>
          {visitsByStore.length === 0 ? (
            <EmptyState title="لا توجد زيارات هذا الشهر" description="ستظهر المتاجر هنا بعد أول زيارة لواجهة منشورة." icon={<BarChart3 className="h-5 w-5" />} />
          ) : (
            <div className="divide-y divide-line">
              {visitsByStore.map((entry: any, index: number) => (
                <div key={entry.storeId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">{number(index + 1)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-ink">{entry.storeName}</div>
                    <a href={`/store/${entry.subdomain}`} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-subtle hover:text-brand" dir="ltr">/store/{entry.subdomain}</a>
                  </div>
                  <div className="text-sm font-bold text-ink">{number(entry.visits)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="text-sm font-bold text-ink">زيارات المتاجر</div>
            <div className="mt-0.5 text-[10px] text-subtle">الشهر الحالي والإجمالي التراكمي لكل متجر.</div>
          </div>
          {stores.length === 0 ? (
            <EmptyState title="لا توجد متاجر" description="ستظهر إحصاءات الزيارات بعد تسجيل المتاجر." icon={<StoreIcon className="h-5 w-5" />} />
          ) : (
            <TableShell minWidth={680}>
              <thead>
                <tr className="border-b border-line bg-surface/60">
                  <Th>المتجر</Th>
                  <Th>هذا الشهر</Th>
                  <Th>الإجمالي</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {[...stores]
                  .sort((a: any, b: any) => Number(b.visitsThisMonth ?? 0) - Number(a.visitsThisMonth ?? 0))
                  .map((store: any) => {
                    const meta = storeMeta(store.status);
                    return (
                      <tr key={store.id} className="border-b border-line hover:bg-surface/50">
                        <Td>
                          <div className="max-w-[200px] truncate text-xs font-semibold text-ink">{store.storeName}</div>
                          <div className="font-mono text-[10px] text-subtle" dir="ltr">{store.subdomain}</div>
                        </Td>
                        <Td><span className="font-bold text-ink">{number(store.visitsThisMonth ?? 0)}</span></Td>
                        <Td><span className="text-ink-soft">{number(store.visitsTotal ?? 0)}</span></Td>
                        <Td><Badge tone={meta.tone} dot={meta.dot}>{meta.label}</Badge></Td>
                      </tr>
                    );
                  })}
              </tbody>
            </TableShell>
          )}
        </Card>
      </div>
    </div>
  );

  const renderLeads = () => (
    <div className="space-y-5">
      <PageHeader
        eyebrow="طلبات المنصة"
        title="العملاء المحتملون"
        description="آخر الطلبات والرسائل الواردة من نماذج المنصة والمتاجر. هذه البيانات للعرض فقط."
        actions={<Button variant="outline" onClick={refreshAll} loading={leads.loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />
      {leads.error ? <Alert tone="error" title="تعذر تحميل الطلبات">{safeError(leads.error)}</Alert> : null}
      <Card className="overflow-hidden">
        {leads.loading && !leads.data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
        ) : (leads.data?.leads ?? []).length === 0 ? (
          <EmptyState title="لا توجد طلبات بعد" description="ستظهر هنا الطلبات القادمة من نماذج المنصة." icon={<FileText className="h-5 w-5" />} />
        ) : (
          <TableShell minWidth={820}>
            <thead>
              <tr className="border-b border-line bg-surface/60">
                <Th>التاريخ</Th>
                <Th>النوع</Th>
                <Th>المتجر</Th>
                <Th>البيانات</Th>
              </tr>
            </thead>
            <tbody>
              {(leads.data?.leads ?? []).map((lead: any) => (
                <tr key={lead.id} className="border-b border-line align-top hover:bg-surface/50">
                  <Td><span className="text-[11px] text-subtle">{dateTime(lead.createdAt)}</span></Td>
                  <Td><Badge tone="bg-surface text-ink-soft border-line">{lead.type}</Badge></Td>
                  <Td>
                    {lead.store ? (
                      <>
                        <div className="text-[11px] font-semibold text-ink">{lead.store.storeName}</div>
                        <div className="font-mono text-[10px] text-subtle" dir="ltr">{lead.store.subdomain}</div>
                      </>
                    ) : <span className="text-[11px] text-subtle">عام</span>}
                  </Td>
                  <Td>
                    <pre className="max-w-[520px] whitespace-pre-wrap break-all rounded-brand-sm bg-surface p-2 font-mono text-[10px] leading-5 text-ink-soft" dir="ltr">
                      {JSON.stringify(lead.payload ?? {}, null, 2)}
                    </pre>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );

  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];
  const ActiveTabIcon = activeTab.icon;

  return (
    <div dir="rtl" data-theme="light" className="min-h-screen bg-canvas font-arabic text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" aria-label="إدارة سند"><BrandLogo size="sm" showTagline={false} /></Link>
            <Badge tone="bg-brand-soft text-brand border-brand-line"><ShieldCheck className="h-3 w-3" /> إدارة المنصة</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="hidden text-end sm:block">
              <div className="text-[11px] font-semibold text-ink">{merchant?.name || merchant?.email}</div>
              <div className="font-mono text-[9px] text-subtle" dir="ltr">{merchant?.email}</div>
            </div>
            {session.store ? (
              <Link href="/dashboard" className="hidden rounded-brand-sm px-3 py-2 text-xs font-semibold text-subtle transition hover:bg-surface hover:text-ink sm:inline-flex">
                لوحة التاجر
              </Link>
            ) : null}
            <Link href="/" className="hidden rounded-brand-sm px-3 py-2 text-xs font-semibold text-subtle transition hover:bg-surface hover:text-ink sm:inline-flex">
              الموقع
            </Link>
            <Button variant="ghost" size="sm" onClick={loginAgain} title="تسجيل الخروج">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-5 px-4 py-5 sm:px-6">
        <aside className="hidden w-[236px] shrink-0 lg:block">
          <Card className="sticky top-[84px] p-2">
            <nav className="space-y-1">
              {TABS.map((item) => {
                const Icon = item.icon;
                const active = item.key === tab;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-brand px-3 py-2.5 text-xs font-semibold transition",
                      active ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-surface hover:text-ink"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.key === "payments" && pendingPayments.length > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[10px] font-bold text-on-warning">
                        {number(pendingPayments.length)}
                      </span>
                    ) : null}
                    {item.key === "stores" && Number(summary.pendingStores ?? 0) > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[10px] font-bold text-on-warning">
                        {number(summary.pendingStores)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-3 rounded-brand border border-line bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-soft"><ShieldCheck className="h-3.5 w-3.5 text-brand" /> صلاحيات محمية</div>
              <p className="mt-1 text-[10px] leading-5 text-subtle">كل طلبات هذه الصفحة تتحقق من دور الإدارة في قاعدة البيانات.</p>
            </div>
          </Card>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          <div className="flex gap-1 overflow-x-auto rounded-brand border border-line bg-card p-1 lg:hidden">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = item.key === tab;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-brand-sm px-3 py-2 text-[11px] font-semibold transition",
                    active ? "bg-brand-soft text-brand" : "text-subtle hover:bg-surface hover:text-ink"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-subtle lg:hidden">
            <ActiveTabIcon className="h-3 w-3" /> {activeTab.label}
          </div>

          {tab === "overview" ? renderOverview() : null}
          {tab === "stores" ? renderStores() : null}
          {tab === "payments" ? renderPayments() : null}
          {tab === "visits" ? renderVisits() : null}
          {tab === "leads" ? renderLeads() : null}

          {overview.data?.generatedAt ? (
            <div className="pb-6 text-center text-[10px] text-subtle">آخر تحديث للبيانات: {dateTime(overview.data.generatedAt)}</div>
          ) : null}
        </main>
      </div>

      <Modal
        open={Boolean(reviewTarget)}
        onClose={() => (reviewBusy ? undefined : setReviewTarget(null))}
        title={
          reviewTarget?.action === "approve"
            ? "تفعيل المتجر"
            : reviewTarget?.action === "reject"
              ? "رفض طلب فتح المتجر"
              : "إيقاف المتجر"
        }
        description={reviewTarget?.store?.storeName}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewTarget(null)} disabled={reviewBusy}>إلغاء</Button>
            <Button
              variant={reviewTarget?.action === "approve" ? "success" : "danger"}
              loading={reviewBusy}
              onClick={runStoreAction}
            >
              {reviewTarget?.action === "approve" ? "تفعيل الآن" : reviewTarget?.action === "reject" ? "رفض الطلب" : "إيقاف المتجر"}
            </Button>
          </>
        }
      >
        {reviewTarget ? (
          <div className="space-y-4">
            {reviewTarget.action === "approve" ? (
              <Alert tone="success" title="سيتم فتح المتجر للعملاء">
                ستُسجَّل لحظة الموافقة كتاريخ تفعيل المتجر، ما لم يكن مفعّلاً سابقاً. تأكد من مراجعة الهوية والبيانات قبل المتابعة.
              </Alert>
            ) : reviewTarget.action === "reject" ? (
              <Alert tone="warning" title="لن يظهر المتجر للعملاء">
                يُفضّل كتابة سبب الرفض ليعرف التاجر ما يجب تعديله. يمكنك تفعيل المتجر لاحقاً بعد التعديل.
              </Alert>
            ) : (
              <Alert tone="error" title="سيتم إغلاق واجهة المتجر">
                لن يتمكن العملاء من الوصول إلى المتجر بعد الإيقاف. يمكنك إعادة تفعيله لاحقاً في أي وقت.
              </Alert>
            )}
            <div className="grid gap-2 rounded-brand border border-line bg-surface p-3 text-[11px] text-ink-soft sm:grid-cols-2">
              <div><span className="text-subtle">الحالة الحالية:</span> {storeMeta(reviewTarget.store.status).label}</div>
              <div><span className="text-subtle">تاريخ الإنشاء:</span> {date(reviewTarget.store.createdAt)}</div>
              <div><span className="text-subtle">المالك:</span> {ownerName(reviewTarget.store.owner)}</div>
              <div><span className="text-subtle">تاريخ التفعيل:</span> {reviewTarget.store.activatedAt ? dateTime(reviewTarget.store.activatedAt) : "لم يُفعّل"}</div>
            </div>
            {!reviewTarget.store.onboardingCompleted && reviewTarget.action === "approve" ? (
              <Alert tone="warning" title="المتجر لم يكمل التهيئة بعد">
                التفعيل سيفتح الصفحة العامة، لكنها ستعرض حالة «قريباً» حتى يكمل التاجر خطوات التهيئة وينشر منتجاته.
              </Alert>
            ) : null}
            <Field label="ملاحظة الإدارة" hint="تظهر للتاجر في إشعار داخل لوحة التحكم.">
              <Textarea rows={3} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="سبب الرفض أو ملاحظة للتفعيل…" />
            </Field>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(paymentTarget)}
        onClose={() => (paymentBusy ? undefined : setPaymentTarget(null))}
        title={paymentTarget?.decision === "approve" ? "اعتماد دفعة الاشتراك" : "رفض دفعة الاشتراك"}
        description={paymentTarget ? `${paymentTarget.payment.store?.storeName} · ${PLAN_LABEL[paymentTarget.payment.plan] ?? paymentTarget.payment.plan}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaymentTarget(null)} disabled={paymentBusy}>إلغاء</Button>
            <Button
              variant={paymentTarget?.decision === "approve" ? "success" : "danger"}
              loading={paymentBusy}
              onClick={runPaymentReview}
            >
              {paymentTarget?.decision === "approve" ? "اعتماد الدفعة" : "رفض الدفعة"}
            </Button>
          </>
        }
      >
        {paymentTarget ? (
          <div className="space-y-4">
            {paymentTarget.decision === "approve" ? (
              <Alert tone="success" title="سيتم تمديد الاشتراك">
                ستُحدَّث خطة المتجر إلى {PLAN_LABEL[paymentTarget.payment.plan] ?? paymentTarget.payment.plan} وتُمدَّد مدة الاشتراك {PLAN_PERIOD[paymentTarget.payment.plan] ?? ""} من تاريخ الاعتماد أو من نهاية الفترة الحالية. لا يتغير رصيد المحفظة.
              </Alert>
            ) : (
              <Alert tone="error" title="لن تُحدَّث خطة الاشتراك">
                سيرى التاجر الدفعة مرفوضة ويمكنه إرسال دفعة جديدة. اكتب سبباً واضحاً إن أمكن.
              </Alert>
            )}
            <div className="grid gap-2 rounded-brand border border-line bg-surface p-3 text-[11px] text-ink-soft sm:grid-cols-2">
              <div><span className="text-subtle">المبلغ:</span> {money(paymentTarget.payment.amount, paymentTarget.payment.currency ?? "EGP")}</div>
              <div><span className="text-subtle">طريقة الدفع:</span> {PAYMENT_METHOD[paymentTarget.payment.method] ?? paymentTarget.payment.method}</div>
              <div className="sm:col-span-2"><span className="text-subtle">المرجع:</span> <span className="font-mono" dir="ltr">{paymentTarget.payment.reference}</span></div>
              <div><span className="text-subtle">الدافع:</span> {paymentTarget.payment.payerName || "—"}</div>
              <div><span className="text-subtle">تاريخ الإرسال:</span> {dateTime(paymentTarget.payment.createdAt)}</div>
              <div className="sm:col-span-2"><span className="text-subtle">مدفوع حالياً حتى:</span> {paymentTarget.payment.store?.subscriptionPaidUntil ? date(paymentTarget.payment.store.subscriptionPaidUntil) : "لا يوجد تجديد معتمد"}</div>
            </div>
            <Field label="ملاحظة الإدارة" hint="تظهر للتاجر في سجل الدفعات.">
              <Textarea rows={3} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="سبب الرفض أو ملاحظة الاعتماد…" />
            </Field>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(settingsStoreId)}
        onClose={closeSettings}
        title="هوية المتجر وإعداداته"
        description={settingsData?.store?.storeName ? `${settingsData.store.storeName} · /store/${settingsData.store.subdomain}` : "تحميل بيانات المتجر…"}
        size="xl"
        footer={
          settingsForm ? (
            <>
              <Button variant="ghost" onClick={closeSettings} disabled={settingsSaving}>إلغاء</Button>
              <Button loading={settingsSaving} onClick={saveSettings}><CheckCircle2 className="h-4 w-4" /> حفظ التغييرات</Button>
            </>
          ) : undefined
        }
      >
        {settingsLoading && !settingsForm ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20" />)}</div>
        ) : settingsError ? (
          <Alert tone="error" title="تعذر تحميل إعدادات المتجر">{safeError(settingsError)}</Alert>
        ) : settingsForm && settingsStoreId ? (
          <div className="space-y-6">
            <Alert tone="info" title="هذه الحقول محمية من التاجر">
              تعديلات الاسم والوصف والشعار والغلاف والألوان والقالب وSEO من هنا فقط. تظهر للتاجر كبيانات للعرض داخل لوحة تحكمه.
            </Alert>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-ink"><StoreIcon className="h-4 w-4 text-brand" /> الهوية الأساسية</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم المتجر" required className="sm:col-span-2">
                  <Input value={settingsForm.storeName} onChange={(event) => setSettingsForm({ ...settingsForm, storeName: event.target.value })} />
                </Field>
                <Field label="وصف المتجر" className="sm:col-span-2">
                  <Textarea rows={3} value={settingsForm.description} onChange={(event) => setSettingsForm({ ...settingsForm, description: event.target.value })} />
                </Field>
                <AdminImageField
                  label="شعار المتجر"
                  hint="مربع، يفضّل 512×512"
                  value={settingsForm.logoUrl}
                  storeId={settingsStoreId}
                  onChange={(value) => setSettingsForm({ ...settingsForm, logoUrl: value })}
                  aspect="aspect-square"
                />
                <AdminImageField
                  label="غلاف المتجر"
                  hint="عريض، يفضّل 1600×600"
                  value={settingsForm.coverUrl}
                  storeId={settingsStoreId}
                  onChange={(value) => setSettingsForm({ ...settingsForm, coverUrl: value })}
                  aspect="aspect-[16/7]"
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-ink"><Palette className="h-4 w-4 text-brand" /> الألوان والقالب</div>
              <div className="grid gap-4 sm:grid-cols-3">
                <ColorField label="اللون الأساسي" value={settingsForm.primaryColor} onChange={(value) => setSettingsForm({ ...settingsForm, primaryColor: value })} />
                <ColorField label="اللون الثانوي" value={settingsForm.secondaryColor} onChange={(value) => setSettingsForm({ ...settingsForm, secondaryColor: value })} />
                <ColorField label="لون النص" value={settingsForm.textColor} onChange={(value) => setSettingsForm({ ...settingsForm, textColor: value })} />
                <Field label="وضع السمة">
                  <Select value={settingsForm.themeMode} onChange={(event) => setSettingsForm({ ...settingsForm, themeMode: event.target.value })}>
                    <option value="light">فاتح</option>
                    <option value="dark">داكن</option>
                    <option value="system">حسب النظام</option>
                  </Select>
                </Field>
                <Field label="الخط العربي">
                  <Select value={settingsForm.arabicFont} onChange={(event) => setSettingsForm({ ...settingsForm, arabicFont: event.target.value })}>
                    {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
                  </Select>
                </Field>
                <Field label="قالب المتجر">
                  <Select value={settingsForm.templateKey} onChange={(event) => setSettingsForm({ ...settingsForm, templateKey: event.target.value })}>
                    {TEMPLATE_OPTIONS.map((template) => <option key={template.value} value={template.value}>{template.label}</option>)}
                  </Select>
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-ink"><Globe2 className="h-4 w-4 text-brand" /> تحسين محركات البحث</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="عنوان الصفحة" hint="حتى 200 حرف." className="sm:col-span-2">
                  <Input value={settingsForm.seoTitle} onChange={(event) => setSettingsForm({ ...settingsForm, seoTitle: event.target.value })} />
                </Field>
                <Field label="وصف الصفحة" hint="حتى 400 حرف." className="sm:col-span-2">
                  <Textarea rows={2} value={settingsForm.seoDescription} onChange={(event) => setSettingsForm({ ...settingsForm, seoDescription: event.target.value })} />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-ink"><Wallet className="h-4 w-4 text-brand" /> بيانات تشغيلية وتواصل</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="رقم الهاتف">
                  <Input value={settingsForm.phone} onChange={(event) => setSettingsForm({ ...settingsForm, phone: event.target.value })} dir="ltr" />
                </Field>
                <Field label="واتساب">
                  <Input value={settingsForm.whatsapp} onChange={(event) => setSettingsForm({ ...settingsForm, whatsapp: event.target.value })} dir="ltr" />
                </Field>
                <Field label="بريد الدعم">
                  <Input value={settingsForm.supportEmail} onChange={(event) => setSettingsForm({ ...settingsForm, supportEmail: event.target.value })} dir="ltr" />
                </Field>
                <Field label="كود الدولة">
                  <Input value={settingsForm.countryCode} onChange={(event) => setSettingsForm({ ...settingsForm, countryCode: event.target.value.toUpperCase().slice(0, 2) })} dir="ltr" />
                </Field>
              </div>
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
