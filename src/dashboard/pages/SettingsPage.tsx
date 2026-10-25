import React, { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  Globe,
  Globe2,
  KeyRound,
  MailCheck,
  RefreshCw,
  Rocket,
  ScrollText,
  Shield,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { api, mediaUrl, type StorePermission } from "../../lib/api";
import { COUNTRIES_DATA } from "../../data/countries";
import { CURRENCIES, dateTime, number, safeError } from "../../lib/format";
import { Link } from "../../lib/router";
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
  Textarea,
  useToast,
  cn,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { useSession } from "../../lib/session";
import { TableShell, Td, Th } from "../common";

const TABS = [
  { key: "general", label: "بيانات المتجر", icon: Building2 },
  { key: "notifications", label: "الإشعارات", icon: Bell },
  { key: "domains", label: "النطاقات المخصصة", icon: Globe },
  { key: "team", label: "الفريق", icon: Users },
  { key: "security", label: "الأمان والحساب", icon: Shield },
  { key: "audit", label: "سجل النشاط", icon: ScrollText },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TAB_ACCESS: Record<TabKey, StorePermission | "owner" | "read"> = {
  general: "read",
  notifications: "settings.write",
  domains: "domain.manage",
  team: "team.manage",
  security: "owner",
  audit: "audit.read",
};

const PUBLISH_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "غير منشور", tone: "bg-surface text-ink-soft border-line" },
  ready: { label: "جاهز للمراجعة", tone: "bg-info-soft text-info border-info-line" },
  published: { label: "منشور", tone: "bg-success-soft text-success border-success-line" },
  suspended: { label: "نشر موقوف", tone: "bg-danger-soft text-danger border-danger-line" },
};

const TLS_STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "HTTPS مفعّل", tone: "bg-success-soft text-success border-success-line" },
  pending: { label: "HTTPS بانتظار الوكيل", tone: "bg-warning-soft text-warning border-warning-line" },
  failed: { label: "فشل تهيئة TLS", tone: "bg-danger-soft text-danger border-danger-line" },
};

function tlsMeta(status: string | null | undefined) {
  return TLS_STATUS[status ?? "pending"] ?? { label: status ?? "—", tone: "bg-surface text-ink-soft border-line" };
}

const TIME_ZONES = [
  "Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar",
  "Asia/Amman", "Asia/Beirut", "Asia/Baghdad", "Africa/Casablanca", "Africa/Tunis", "UTC",
];

const ROLES: Record<string, string> = { admin: "مدير عام", manager: "مدير", staff: "موظف", viewer: "مشاهدة فقط" };
const TEAM_STATUS: Record<string, string> = { invited: "مدعو", active: "نشط", suspended: "موقوف" };

const INTEGRATION_LABELS: Record<string, string> = {
  ai: "المساعد الذكي",
  payments: "الدفع الإلكتروني",
  whatsapp: "واتساب",
  shipping: "الشحن",
  storage: "تخزين الوسائط",
};

const SUCCESS_TONE = "bg-success-soft text-success border-success-line";
const INFO_TONE = "bg-info-soft text-info border-info-line";
const NEUTRAL_TONE = "bg-surface text-subtle border-line";

function integrationBadge(key: string, value: any): { text: string; tone: string } {
  if (key === "storage") return { text: "تخزين محلي", tone: NEUTRAL_TONE };
  if (key === "shipping") return { text: "شحن يدوي", tone: INFO_TONE };
  if (key === "payments") {
    return value?.selectable
      ? { text: "مهيأ", tone: SUCCESS_TONE }
      : { text: "غير متاح", tone: NEUTRAL_TONE };
  }
  if (key === "whatsapp") {
    if (!value?.autoSendConfigured) return { text: "روابط يدوية", tone: INFO_TONE };
    if (!value?.autoSendAvailable) return { text: "قالب مطلوب", tone: INFO_TONE };
    return { text: "إرسال تلقائي", tone: SUCCESS_TONE };
  }
  return value?.configured
    ? { text: "مهيأ", tone: SUCCESS_TONE }
    : { text: "غير مهيأ", tone: NEUTRAL_TONE };
}

export function SettingsPage() {
  const { subdomain } = useDashboard();
  const { refresh, can, isOwner } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>("general");

  const { data, loading, error, reload } = useAsync(() => api.settings.get(subdomain), [subdomain]);
  const canWriteSettings = can("settings.write");
  const canManagePublishing = canWriteSettings;
  const allowedTabs = TABS.filter((entry) => {
    const access = TAB_ACCESS[entry.key];
    if (access === "read") return true;
    if (access === "owner") return isOwner;
    return can(access);
  });
  const publishing = data?.publishing ?? null;
  const publishStatus = publishing?.publish_status ?? data?.store?.publishStatus ?? "draft";
  const publishMeta = PUBLISH_STATUS[publishStatus] ?? { label: publishStatus, tone: "bg-surface text-ink-soft border-line" };
  const publishReason = publishing?.publish_reason || data?.store?.publishReason || "";
  const publicVisible = Boolean(publishing?.public_visible);
  const canPublish = Boolean(publishing?.can_publish);
  const tabAllowed = allowedTabs.some((entry) => entry.key === tab);

  /* ---- publishing ---- */
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [unpublishReason, setUnpublishReason] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);

  const publishNow = async () => {
    setPublishBusy(true);
    try {
      await api.settings.publish(subdomain);
      toast.success("تم نشر المتجر وأصبح ظاهراً للعملاء.");
      setPublishOpen(false);
      await refresh();
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setPublishBusy(false);
    }
  };

  const unpublishNow = async () => {
    setPublishBusy(true);
    try {
      await api.settings.unpublish(subdomain, unpublishReason.trim());
      toast.success("تم إيقاف نشر المتجر. المنتجات والطلبات محفوظة.");
      setUnpublishOpen(false);
      setUnpublishReason("");
      await refresh();
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setPublishBusy(false);
    }
  };

  /* ---- general form ---- */
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.store || form) return;
    const s = data.store;
    setForm({
      storeName: s.storeName ?? "",
      phone: s.phone ?? "",
      countryCode: s.countryCode ?? "EG",
      storeCurrency: s.currency ?? "EGP",
      description: s.description ?? "",
      supportEmail: s.supportEmail ?? "",
      seoTitle: s.seoTitle ?? "",
      seoDescription: s.seoDescription ?? "",
      whatsapp: s.whatsapp ?? "",
      codEnabled: Boolean(s.codEnabled),
      onlinePaymentEnabled: Boolean(s.onlinePaymentEnabled && Boolean(data?.online_payments_available ?? data?.integrations?.payments?.selectable)),
      primaryLanguage: s.primaryLanguage === "en" ? "en" : "ar",
      timeZone: s.timeZone ?? "Africa/Cairo",
    });
  }, [data, form]);

  const saveGeneral = async () => {
    if (!form) return;
    if (!canWriteSettings) {
      toast.error("دورك الحالي لا يسمح بتعديل إعدادات المتجر.");
      return;
    }
    if (form.storeName.trim().length < 2) {
      toast.error("اسم المتجر قصير جداً.");
      return;
    }
    setSaving(true);
    try {
      await api.settings.update(subdomain, {
        phone: form.phone.trim(),
        countryCode: form.countryCode,
        storeCurrency: form.storeCurrency,
        supportEmail: form.supportEmail.trim(),
        whatsapp: form.whatsapp.trim(),
        codEnabled: form.codEnabled,
        onlinePaymentEnabled: onlinePaymentsAvailable ? form.onlinePaymentEnabled : false,
        primaryLanguage: form.primaryLanguage,
        timeZone: form.timeZone,
      });
      toast.success("تم حفظ بيانات المتجر.");
      await refresh();
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---- notification prefs ---- */
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);

  useEffect(() => {
    if (!data?.store || prefs) return;
    const stored = (data.store.notificationPrefs ?? {}) as Record<string, unknown>;
    setPrefs({
      newOrders: stored.newOrders !== false,
      lowStock: stored.lowStock !== false,
      abandonedCarts: stored.abandonedCarts !== false,
      reviews: stored.reviews !== false,
      marketing: stored.marketing === true,
    });
  }, [data, prefs]);

  const savePrefs = async (next: Record<string, boolean>) => {
    setPrefs(next);
    setPrefsBusy(true);
    try {
      await api.settings.notificationPrefs(subdomain, next);
      toast.success("تم تحديث تفضيلات الإشعارات.");
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setPrefsBusy(false);
    }
  };

  /* ---- domains ---- */
  const [domainInput, setDomainInput] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [domainChallenges, setDomainChallenges] = useState<
    Record<string, { type: "TXT"; name: string; value: string }>
  >({});
  const [deletingDomain, setDeletingDomain] = useState<any | null>(null);

  const rememberChallenge = (domainId: string, challenge: { type: "TXT"; name: string; value: string }) => {
    setDomainChallenges((current) => ({ ...current, [domainId]: challenge }));
  };

  const addDomain = async () => {
    if (!domainInput.trim()) return;
    setDomainBusy(true);
    try {
      const result = await api.settings.addDomain(subdomain, domainInput.trim().toLowerCase());
      rememberChallenge(result.domain.id, result.challenge);
      toast.success("تمت إضافة النطاق. أضف سجل TXT الظاهر للتحقق.");
      setDomainInput("");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDomainBusy(false);
    }
  };

  const verifyDomain = async (domain: any) => {
    setVerifyingId(domain.id);
    try {
      const result = await api.settings.verifyDomain(subdomain, domain.id);
      if (result.verified) toast.success("تم التحقق من النطاق بنجاح.");
      else toast.error(result.instructions || "لم يتم العثور على سجل التحقق بعد. تأكد من إضافته ثم أعد المحاولة.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setVerifyingId(null);
    }
  };

  const rotateDomainChallenge = async (domain: any) => {
    setRotatingId(domain.id);
    try {
      const result = await api.settings.rotateDomainChallenge(subdomain, domain.id);
      rememberChallenge(domain.id, result.challenge);
      toast.success("تم إصدار قيمة تحقق جديدة. استبدل السجل القديم في DNS.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setRotatingId(null);
    }
  };

  /* ---- team ---- */
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamDraft, setTeamDraft] = useState({ name: "", email: "", role: "staff" });
  const [teamBusy, setTeamBusy] = useState(false);
  const [deletingMember, setDeletingMember] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [teamInvite, setTeamInvite] = useState<{
    url: string;
    email: string;
    expiresAt: string | null;
    note: string;
    emailSent: boolean;
  } | null>(null);

  const inviteMember = async () => {
    if (!teamDraft.email.trim()) {
      toast.error("أدخل البريد الإلكتروني.");
      return;
    }
    setTeamBusy(true);
    try {
      const result = await api.settings.invite(subdomain, {
        name: teamDraft.name.trim(),
        email: teamDraft.email.trim(),
        role: teamDraft.role,
      });
      toast.success(result.note ?? "تم إنشاء الدعوة.");
      setTeamInvite({
        url: result.invite_url,
        email: result.member?.email ?? teamDraft.email.trim(),
        expiresAt: result.expires_at ?? null,
        note: result.note ?? "",
        emailSent: Boolean(result.email_sent),
      });
      setTeamOpen(false);
      setTeamDraft({ name: "", email: "", role: "staff" });
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setTeamBusy(false);
    }
  };

  const updateMember = async (member: any, body: Record<string, unknown>) => {
    try {
      const result = await api.settings.updateMember(subdomain, member.id, body);
      if (result.invite_url) {
        setTeamInvite({
          url: result.invite_url,
          email: result.member?.email ?? member.email,
          expiresAt: result.expires_at ?? null,
          note: "أُصدرت دعوة جديدة لهذا العضو. شارك الرابط قبل انتهاء صلاحيته.",
          emailSent: false,
        });
      }
      toast.success("تم تحديث عضو الفريق.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  /* ---- security ---- */
  const [passwordDraft, setPasswordDraft] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);

  const changePassword = async () => {
    if (passwordDraft.next.length < 8) {
      toast.error("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (passwordDraft.next !== passwordDraft.confirm) {
      toast.error("كلمتا المرور غير متطابقتين.");
      return;
    }
    setPasswordBusy(true);
    try {
      await api.changePassword(passwordDraft.current, passwordDraft.next);
      toast.success("تم تغيير كلمة المرور.");
      setPasswordDraft({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDraft, setDeleteDraft] = useState({ password: "", confirmation: "" });
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);

  /* ---- two-factor authentication ---- */
  const twoFactorEnabled = Boolean(data?.merchant?.two_factor_enabled);
  const emailVerified = Boolean(data?.merchant?.email_verified);
  const [twoFactorStart, setTwoFactorStart] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableDraft, setDisableDraft] = useState({ password: "", code: "" });
  const [disableBusy, setDisableBusy] = useState(false);

  const startTwoFactor = async () => {
    if (!twoFactorPassword) {
      toast.error("أدخل كلمة المرور الحالية للمتابعة.");
      return;
    }
    setTwoFactorBusy(true);
    try {
      const result = await api.twoFactor.setup(twoFactorPassword);
      setTwoFactorSetup({ secret: result.secret, otpauth_url: result.otpauth_url });
      setTwoFactorPassword("");
      setTwoFactorCode("");
      toast.success("امسح الرمز أو أدخله يدوياً في تطبيق المصادقة.");
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const enableTwoFactor = async () => {
    const code = twoFactorCode.replace(/\D/g, "");
    if (code.length !== 6) {
      toast.error("أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة.");
      return;
    }
    setTwoFactorBusy(true);
    try {
      const result = await api.twoFactor.enable(code);
      setRecoveryCodes(result.recovery_codes || []);
      setTwoFactorSetup(null);
      setTwoFactorCode("");
      toast.success("تم تفعيل المصادقة الثنائية. احفظ رموز الاسترداد الآن.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!disableDraft.password) {
      toast.error("أدخل كلمة المرور الحالية.");
      return;
    }
    if (!disableDraft.code.trim()) {
      toast.error("أدخل رمز المصادقة أو أحد رموز الاسترداد.");
      return;
    }
    setDisableBusy(true);
    try {
      await api.twoFactor.disable(disableDraft.password, disableDraft.code.trim());
      toast.success("تم تعطيل المصادقة الثنائية.");
      setDisableOpen(false);
      setDisableDraft({ password: "", code: "" });
      setRecoveryCodes([]);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDisableBusy(false);
    }
  };

  /* ---- sessions & email verification ---- */
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [debugVerifyToken, setDebugVerifyToken] = useState("");

  const revokeOtherSessions = async () => {
    setRevokeBusy(true);
    try {
      const result = await api.revokeOtherSessions();
      toast.success(result.revoked > 0 ? `تم إنهاء ${result.revoked} جلسة أخرى.` : "لا توجد جلسات أخرى نشطة.");
      setRevokeOpen(false);
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setRevokeBusy(false);
    }
  };

  const resendVerification = async () => {
    const email = data?.merchant?.email;
    if (!email) return;
    setVerificationBusy(true);
    try {
      const result = await api.resendVerification(email);
      if (result.already_verified) {
        toast.success("بريدك مؤكد بالفعل.");
      } else if (result.sent) {
        toast.success("تم إرسال رابط التحقق إلى بريدك.");
      } else if (!result.email_configured) {
        toast.error("إرسال البريد غير مهيأ على الخادم، لذا لم يُرسل رابط فعلي.");
      } else {
        toast.error("تعذر إرسال البريد حالياً. حاول لاحقاً.");
      }
      setDebugVerifyToken(result.debug_token || "");
      if (result.already_verified) reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setVerificationBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteDraft.confirmation !== "DELETE") {
      toast.error("اكتب DELETE بالضبط للتأكيد.");
      return;
    }
    setDeleteAccountBusy(true);
    try {
      await api.deleteAccount(deleteDraft.password);
      toast.success("تم حذف الحساب.");
      window.location.href = "/";
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteAccountBusy(false);
    }
  };

  const integrations = data?.integrations ?? {};
  const onlinePaymentsAvailable = Boolean(data?.online_payments_available ?? integrations.payments?.selectable);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="التشغيل"
        title="الإعدادات"
        description="بيانات المتجر، النشر، الإشعارات، النطاقات المخصصة، الفريق، والأمان في مكان واحد — مع إخفاء الأقسام التي لا يسمح بها دورك."
        actions={<Button variant="ghost" size="sm" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>}
      />

      {!canWriteSettings ? (
        <Alert tone="info" title="وضع القراءة فقط">
          دورك الحالي يسمح بعرض إعدادات المتجر دون تعديلها. أزرار الحفظ والنشر وتغيير الفريق معطّلة، والخادم يرفض أي محاولة تعديل.
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-1 rounded-brand border border-line bg-card p-1 text-xs font-semibold">
        {allowedTabs.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.key}
              onClick={() => setTab(entry.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-brand-sm px-3 py-2 transition",
                tab === entry.key ? "bg-brand text-on-brand" : "text-subtle hover:text-ink"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {entry.label}
            </button>
          );
        })}
      </div>

      {error ? <Alert tone="error" title="تعذر تحميل الإعدادات">{safeError(error)}</Alert> : null}

      {loading && !data ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : !tabAllowed ? (
        <Card className="p-6">
          <EmptyState
            title="هذا القسم غير متاح لدورك"
            description="القائمة تعرض الأقسام المسموح بها فقط. إذا احتجت صلاحية إضافية فاطلب من مالك المتجر تعديل دورك."
            icon={<Shield className="h-5 w-5" />}
          />
        </Card>
      ) : tab === "general" && form ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-ink">حالة النشر والظهور</div>
                  <div className="mt-0.5 text-[10px] text-subtle">النشر يتحكم في ظهور الواجهة للعملاء، منفصلاً عن اعتماد المتجر من الإدارة.</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={publishMeta.tone}>{publishMeta.label}</Badge>
                  <Badge tone={publicVisible ? "bg-success-soft text-success border-success-line" : "bg-warning-soft text-warning border-warning-line"}>
                    {publicVisible ? "ظاهر للعملاء" : "غير ظاهر للعملاء"}
                  </Badge>
                </div>
              </div>

              <div className="rounded-brand border border-line bg-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-ink">
                      {publicVisible
                        ? "واجهة متجرك منشورة وتستقبل الزيارات."
                        : canPublish
                          ? "المتجر جاهز للنشر. لن يظهر للعملاء حتى تضغط «نشر المتجر»."
                          : "لا يمكن النشر الآن."}
                    </div>
                    <p className="mt-1 text-[10px] leading-5 text-subtle">
                      {publishReason || (publicVisible ? "كل التغييرات محفوظة وتظهر للعملاء." : "راجع حالة الاعتماد وأكمل بيانات المتجر قبل النشر.")}
                    </p>
                    {publishing?.published_at ? (
                      <div className="mt-1 text-[10px] text-subtle">أول نشر: {dateTime(publishing.published_at)}</div>
                    ) : null}
                  </div>
                  {canManagePublishing ? (
                    <div className="flex flex-wrap gap-1.5">
                      {publicVisible ? (
                        <Button variant="outline" size="sm" onClick={() => setUnpublishOpen(true)}>
                          <ShieldOff className="h-3.5 w-3.5" /> إيقاف النشر
                        </Button>
                      ) : (
                        <Button size="sm" disabled={!canPublish} onClick={() => setPublishOpen(true)}>
                          <Rocket className="h-3.5 w-3.5" /> نشر المتجر
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {data?.store?.status === "pending" ? (
                <div className="mt-3">
                  <Alert tone="warning" title="الاعتماد مطلوب أولاً">
                    يبقى المتجر غير منشور حتى تعتمده إدارة سند. بعد الاعتماد يمكنك النشر من هنا فوراً.
                  </Alert>
                </div>
              ) : null}
              {data?.store?.status === "rejected" || data?.store?.status === "suspended" ? (
                <div className="mt-3">
                  <Alert tone="error" title="الاعتماد يمنع النشر">
                    لا يمكن نشر متجر مرفوض أو موقوف. تواصل مع إدارة سند لحل الحالة أولاً.
                  </Alert>
                </div>
              ) : null}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-ink">الهوية</div>
                <Badge tone="bg-brand-soft text-brand border-brand-line">تُدار من إدارة سند</Badge>
              </div>
              <Alert tone="info" title="تعديل الهوية متاح للإدارة فقط">
                اسم المتجر والوصف والشعار والغلاف والألوان والقالب وإعدادات SEO تُعدَّل من لوحة إدارة المنصة. تواصل مع فريق سند لأي تغيير.
              </Alert>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="اسم المتجر" hint="يُعدَّل عبر إدارة سند فقط.">
                  <Input value={form.storeName} disabled />
                </Field>
                <Field label="رابط المتجر" hint="النطاق الفرعي لا يتغير من هنا للحفاظ على الروابط المنشورة.">
                  <Input value={`/store/${subdomain}`} disabled dir="ltr" className="font-mono" />
                </Field>
                <Field label="وصف المتجر" hint="يُعدَّل عبر إدارة سند فقط." className="sm:col-span-2">
                  <Textarea rows={3} value={form.description} disabled />
                </Field>
                <div className="sm:col-span-2 rounded-brand border border-line bg-surface px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    {data?.store?.logoUrl || data?.store?.coverUrl ? (
                      <div className="flex items-center gap-2">
                        {data.store.logoUrl ? (
                          <img src={mediaUrl(data.store.logoUrl)} alt="شعار المتجر" className="h-10 w-10 rounded-brand-sm border border-line object-cover" />
                        ) : null}
                        {data.store.coverUrl ? (
                          <img src={mediaUrl(data.store.coverUrl)} alt="غلاف المتجر" className="h-10 w-16 rounded-brand-sm border border-line object-cover" />
                        ) : null}
                      </div>
                    ) : null}
                    <p className="flex-1 text-[11px] leading-5 text-subtle">
                      الهوية البصرية — الشعار والغلاف والألوان والقالب — تُضبط من إدارة سند، وتبقى محمية داخل متجرك.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">البيع والتواصل</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="واتساب الدعم" hint="يظهر في متجرك وفي روابط تأكيد الطلب">
                  <Input value={form.whatsapp} disabled={!canWriteSettings} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} dir="ltr" placeholder="+2010…" />
                </Field>
                <Field label="هاتف المتجر">
                  <Input value={form.phone} disabled={!canWriteSettings} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
                </Field>
                <Field label="بريد الدعم">
                  <Input type="email" value={form.supportEmail} disabled={!canWriteSettings} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} dir="ltr" />
                </Field>
                <Field label="عملة المتجر" hint="تغيير العملة يؤثر على عرض الأسعار الجديدة.">
                  <Select value={form.storeCurrency} disabled={!canWriteSettings} onChange={(e) => setForm({ ...form, storeCurrency: e.target.value })}>
                    {Object.entries(CURRENCIES).map(([code, meta]) => (
                      <option key={code} value={code}>{meta.label} ({code})</option>
                    ))}
                  </Select>
                </Field>
                <Field label="الدولة">
                  <Select value={form.countryCode} disabled={!canWriteSettings} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}>
                    {COUNTRIES_DATA.map((country) => (
                      <option key={country.code} value={country.code}>{country.flag} {country.name_ar}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="المنطقة الزمنية">
                  <Select value={form.timeZone} disabled={!canWriteSettings} onChange={(e) => setForm({ ...form, timeZone: e.target.value })}>
                    {TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                  </Select>
                </Field>
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                  <Switch checked={form.codEnabled} disabled={!canWriteSettings} onChange={(v) => setForm({ ...form, codEnabled: v })} label="الدفع عند الاستلام" description="الطريقة الأساسية للتجارة الإلكترونية في المنطقة." />
                  <Switch
                    checked={onlinePaymentsAvailable && form.onlinePaymentEnabled}
                    onChange={(v) => setForm({ ...form, onlinePaymentEnabled: v })}
                    disabled={!canWriteSettings || !onlinePaymentsAvailable}
                    label={onlinePaymentsAvailable ? "الدفع الإلكتروني" : "الدفع الإلكتروني — قريباً"}
                    description={
                      onlinePaymentsAvailable
                        ? "البوابة مهيأة على الخادم."
                        : "غير متاح: لا يوجد محوّل دفع مثبت. يبقى الدفع عند الاستلام هو الخيار الفعلي."
                    }
                  />
                </div>
                {!onlinePaymentsAvailable ? (
                  <p className="mt-3 rounded-brand border border-line bg-surface px-3 py-2 text-[10px] leading-5 text-subtle sm:col-span-2">
                    لن نسمح باختيار الدفع الإلكتروني في المتجر حتى يتوفر مزود دفع فعلي مع Webhooks ومعالجة إعادة المحاولة. لا تُظهر هذه الصفحة خياراً مدفوعاً غير قابل للتنفيذ.
                  </p>
                ) : null}
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-ink">تحسين محركات البحث (SEO)</div>
                <Badge tone="bg-surface text-ink-soft border-line">العنوان والوصف من الإدارة</Badge>
              </div>
              <div className="grid gap-4">
                <Field label="عنوان الصفحة" hint="يُعدَّل عبر إدارة سند فقط.">
                  <Input value={form.seoTitle} disabled />
                </Field>
                <Field label="وصف الصفحة" hint="يُعدَّل عبر إدارة سند فقط.">
                  <Textarea rows={2} value={form.seoDescription} disabled />
                </Field>
                <Field label="اللغة الأساسية">
                  <Select value={form.primaryLanguage} disabled={!canWriteSettings} onChange={(e) => setForm({ ...form, primaryLanguage: e.target.value })}>
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </Select>
                </Field>
              </div>
            </Card>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => { setForm(null); reload(); }}>استعادة القيم</Button>
              <Button loading={saving} disabled={!canWriteSettings} onClick={saveGeneral}>حفظ الإعدادات</Button>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">استخدام المتجر</div>
              <div className="space-y-2 text-[11px] text-subtle">
                <div className="flex justify-between"><span>المنتجات</span><span className="font-semibold text-ink">{number(data?.usage?.products ?? 0)}</span></div>
                <div className="flex justify-between"><span>الطلبات</span><span className="font-semibold text-ink">{number(data?.usage?.orders ?? 0)}</span></div>
                <div className="flex justify-between"><span>العملاء</span><span className="font-semibold text-ink">{number(data?.usage?.customers ?? 0)}</span></div>
                <div className="flex justify-between"><span>أعضاء الفريق</span><span className="font-semibold text-ink">{number((data?.team ?? []).length)}</span></div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">حالة التكاملات</div>
              <div className="space-y-2 text-[11px]">
                {Object.entries(integrations).map(([key, value]: [string, any]) => {
                  const badge = integrationBadge(key, value);
                  return (
                    <div key={key} className="rounded-brand-sm border border-line bg-surface px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-subtle">{INTEGRATION_LABELS[key] ?? key}</span>
                        <Badge tone={badge.tone}>{badge.text}</Badge>
                      </div>
                      {value?.reason ? (
                        <p className="mt-1 text-[10px] leading-5 text-subtle">{value.reason}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-[10px] leading-5 text-subtle">
                التكاملات غير المهيأة تعمل بوضع يدوي بشفافية، ولن ندّعي إرسالاً أو ربطاً لم يحدث فعلاً.
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-2 text-xs font-bold text-ink">حساب التاجر</div>
              <div className="text-[11px] text-subtle">{data?.merchant?.email}</div>
              <div className="mt-1 text-[10px] text-subtle">
                {[data?.merchant?.firstName, data?.merchant?.lastName].filter(Boolean).join(" ") || data?.merchant?.name || ""}
              </div>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setTab("security")}>إدارة الأمان</Button>
              </div>
            </Card>
          </div>
        </div>
      ) : tab === "notifications" && prefs ? (
        <Card className="max-w-2xl p-4">
          <div className="mb-3 text-xs font-bold text-ink">تفضيلات الإشعارات</div>
          <div className="grid gap-3">
            <Switch checked={prefs.newOrders} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, newOrders: v })} label="الطلبات الجديدة" description="إشعار فوري عند وصول أي طلب جديد." />
            <Switch checked={prefs.lowStock} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, lowStock: v })} label="تنبيه المخزون المنخفض" description="عند اقتراب أي منتج من النفاد." />
            <Switch checked={prefs.abandonedCarts} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, abandonedCarts: v })} label="السلات المتروكة" description="عند ترك عميل لمنتج في السلة." />
            <Switch checked={prefs.reviews} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, reviews: v })} label="التقييمات الجديدة" description="عند إرسال عميل تقييماً يحتاج مراجعة." />
            <Switch checked={prefs.marketing} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, marketing: v })} label="رسائل سند التسويقية" description="نصائح وعروض من فريق سند." />
          </div>
        </Card>
      ) : tab === "domains" ? (
        <div className="space-y-3">
          <Alert tone="info" title="النطاقات المخصصة تعمل بعد توثيق DNS">
            بعد إضافة النطاق وتوثيق ملكيته بسجل TXT، وجّه سجلات DNS (A أو AAAA أو CNAME) إلى خادم سند. عندها يفتح النطاق واجهة متجرك مباشرة بنفس المحتوى. شهادة HTTPS تُنهى عند الوكيل الخارجي، وتظهر حالة TLS لكل نطاق أدناه بدلاً من افتراض أنها تعمل تلقائياً.
          </Alert>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3 text-xs font-bold text-ink">النطاقات المسجلة</div>
            {(data?.domains ?? []).length === 0 ? (
              <EmptyState
                title="لا توجد نطاقات مسجلة"
                description="أضف نطاقاً ووثّق ملكيته عبر DNS، ثم وجّه سجلاته إلى خادم سند ليفتح متجرك مباشرة."
                icon={<Globe className="h-5 w-5" />}
              />
            ) : (
              <div className="divide-y divide-line">
                {(data?.domains ?? []).map((domain: any) => (
                  <div key={domain.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink" dir="ltr">{domain.domain}</span>
                        {domain.status === "verified" ? (
                          <Badge tone="bg-success-soft text-success border-success-line"><CheckCircle2 className="h-3 w-3" /> موثّق</Badge>
                        ) : (
                          <Badge tone="bg-warning-soft text-warning border-warning-line">بانتظار التحقق</Badge>
                        )}
                      </div>
                      {domain.status !== "verified" ? (
                        <div className="mt-1.5 space-y-1 text-[10px] leading-5 text-subtle">
                          {domainChallenges[domain.id] ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>
                                سجل TXT على{" "}
                                <span className="font-mono" dir="ltr">{domainChallenges[domain.id].name}</span> بالقيمة:
                              </span>
                              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink" dir="ltr">
                                {domainChallenges[domain.id].value}
                              </code>
                              <CopyButton value={domainChallenges[domain.id].value} label="" />
                            </div>
                          ) : (
                            <div>
                              لأسباب أمنية لا تُعرض قيمة التحقق مرة أخرى بعد مغادرة الصفحة. أصدر قيمة جديدة إن احتجت.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1.5 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-subtle">
                            <span>تم التوثيق {dateTime(domain.verifiedAt)}</span>
                            <Badge tone={tlsMeta(domain.tls_status).tone}>{tlsMeta(domain.tls_status).label}</Badge>
                          </div>
                          {domain.tls_status === "active" && domain.tls_provisioned_at ? (
                            <div className="text-[10px] text-subtle">آخر تهيئة HTTPS: {dateTime(domain.tls_provisioned_at)}</div>
                          ) : (
                            <div className="text-[10px] leading-5 text-subtle">
                              {domain.tls_status === "failed"
                                ? domain.tls_error || "تعذرت تهيئة HTTPS. راجع سجلات الوكيل أو تواصل مع إدارة سند."
                                : "النطاق موثّق، لكن HTTPS لم يُسجَّل كمفعّل بعد. لا تعتمد عليه في استقبال العملاء حتى تصبح الحالة «HTTPS مفعّل»."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {domain.status !== "verified" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={rotatingId === domain.id}
                            onClick={() => rotateDomainChallenge(domain)}
                          >
                            قيمة تحقق جديدة
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={verifyingId === domain.id}
                            onClick={() => verifyDomain(domain)}
                          >
                            تحقق الآن
                          </Button>
                        </>
                      ) : null}
                      <button onClick={() => setDeletingDomain(domain)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 text-xs font-bold text-ink">إضافة نطاق</div>
            <div className="space-y-3">
              <Field label="النطاق" hint="مثال: shop.example.com">
                <Input value={domainInput} onChange={(e) => setDomainInput(e.target.value)} dir="ltr" className="font-mono" placeholder="shop.example.com" />
              </Field>
              <Button className="w-full" loading={domainBusy} onClick={addDomain}>إضافة النطاق</Button>
              <div className="text-[10px] leading-5 text-subtle">
                بعد الإضافة سنعرض لك قيمة TXT مرة واحدة فقط. نتحقق منها فعلياً عبر DNS، ولن يظهر النطاق كموثّق قبل ذلك. إن فقدت القيمة يمكنك إصدار قيمة جديدة من القائمة. بعد التوثيق وجّه سجلات DNS إلى خادم سند ليفتح النطاق متجرك مباشرة، وتُسجَّل حالة HTTPS من إدارة سند بعد تهيئة الوكيل الخارجي.
              </div>
            </div>
          </Card>
          </div>
        </div>
      ) : tab === "team" ? (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <div className="text-xs font-bold text-ink">فريق المتجر</div>
              <div className="mt-0.5 text-[11px] text-subtle">
                {data?.invitation_email_configured ? "دعوات البريد مفعّلة." : "إرسال دعوات البريد غير مهيأ بعد — تُنشأ الدعوة داخل النظام فقط."}
              </div>
            </div>
            <Button onClick={() => setTeamOpen(true)}><UserPlus className="h-4 w-4" /> دعوة عضو</Button>
          </Card>
          {teamInvite ? (
            <Card className="border-info-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink">رابط دعوة {teamInvite.email}</div>
                  <div className="mt-0.5 text-[10px] leading-5 text-subtle">
                    {teamInvite.note || "شارك هذا الرابط مع العضو. لن يظهر مرة أخرى بعد إغلاق الصفحة."}
                    {teamInvite.expiresAt ? ` تنتهي الصلاحية في ${dateTime(teamInvite.expiresAt)}.` : ""}
                  </div>
                </div>
                <Badge tone={teamInvite.emailSent ? "bg-success-soft text-success border-success-line" : "bg-warning-soft text-warning border-warning-line"}>
                  {teamInvite.emailSent ? "أُرسلت بالبريد" : "تسليم يدوي"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-brand border border-line bg-surface p-2.5">
                <a href={teamInvite.url} className="min-w-0 flex-1 break-all font-mono text-[10px] text-brand underline" dir="ltr">
                  {teamInvite.url}
                </a>
                <CopyButton value={teamInvite.url} label="نسخ الرابط" />
                <Button variant="ghost" size="sm" onClick={() => setTeamInvite(null)}>إخفاء</Button>
              </div>
              <p className="mt-2 text-[10px] leading-5 text-subtle">
                هذا الرابط يعمل مرة واحدة وينشئ جلسة فريق منفصلة عن جلسة المالك. لا تشاركه في مكان عام.
              </p>
            </Card>
          ) : null}
          <Card className="overflow-hidden">
            {(data?.team ?? []).length === 0 ? (
              <EmptyState
                title="لا يوجد أعضاء بعد"
                description="ادعُ موظفاً ليساعدك في إدارة الطلبات والمنتجات."
                icon={<Users className="h-5 w-5" />}
                action={<Button onClick={() => setTeamOpen(true)}><UserPlus className="h-4 w-4" /> دعوة أول عضو</Button>}
              />
            ) : (
              <TableShell minWidth={780}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>العضو</Th>
                    <Th>البريد</Th>
                    <Th>الدور</Th>
                    <Th>الحالة</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {(data?.team ?? []).map((member: any) => (
                    <tr key={member.id} className="border-b border-line">
                      <Td><span className="font-semibold text-ink">{member.name || "—"}</span></Td>
                      <Td><span className="font-mono text-[10px] text-subtle" dir="ltr">{member.email}</span></Td>
                      <Td>
                        <Select
                          value={member.role}
                          onChange={(e) => updateMember(member, { role: e.target.value })}
                          className="h-8 w-32 text-[11px]"
                          aria-label="الدور"
                        >
                          {Object.entries(ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </Select>
                      </Td>
                      <Td>
                        <Select
                          value={member.status}
                          onChange={(e) => updateMember(member, { status: e.target.value })}
                          className="h-8 w-28 text-[11px]"
                          aria-label="الحالة"
                        >
                          {Object.entries(TEAM_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </Select>
                      </Td>
                      <Td>
                        <div className="flex justify-end">
                          <button onClick={() => setDeletingMember(member)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="إزالة">
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
        </div>
      ) : tab === "security" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink"><KeyRound className="h-3.5 w-3.5 text-brand" /> تغيير كلمة المرور</div>
            <div className="space-y-3">
              <Field label="كلمة المرور الحالية" required>
                <Input type="password" value={passwordDraft.current} onChange={(e) => setPasswordDraft({ ...passwordDraft, current: e.target.value })} dir="ltr" autoComplete="current-password" />
              </Field>
              <Field label="كلمة المرور الجديدة" required hint="8 أحرف على الأقل">
                <Input type="password" value={passwordDraft.next} onChange={(e) => setPasswordDraft({ ...passwordDraft, next: e.target.value })} dir="ltr" autoComplete="new-password" />
              </Field>
              <Field label="تأكيد كلمة المرور" required>
                <Input type="password" value={passwordDraft.confirm} onChange={(e) => setPasswordDraft({ ...passwordDraft, confirm: e.target.value })} dir="ltr" autoComplete="new-password" />
              </Field>
              <Button loading={passwordBusy} onClick={changePassword}>تحديث كلمة المرور</Button>
              <p className="text-[10px] leading-5 text-subtle">
                عند التغيير تبقى جلستك الحالية فقط، وتُنهى جميع الجلسات الأخرى تلقائياً.
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <Smartphone className="h-3.5 w-3.5 text-brand" /> المصادقة الثنائية (2FA)
              </div>
              <Badge tone={twoFactorEnabled ? "bg-success-soft text-success border-success-line" : "bg-surface text-subtle border-line"}>
                {twoFactorEnabled ? "مفعّلة" : "غير مفعّلة"}
              </Badge>
            </div>

            {recoveryCodes.length > 0 ? (
              <div className="space-y-3">
                <Alert tone="warning" title="احفظ رموز الاسترداد الآن">
                  تُعرض هذه الرموز مرة واحدة فقط. كل رمز يعمل مرة واحدة إذا فقدت تطبيق المصادقة. لا نستطيع عرضها مرة أخرى.
                </Alert>
                <div className="grid grid-cols-2 gap-2 rounded-brand border border-line bg-surface p-3">
                  {recoveryCodes.map((recoveryCode) => (
                    <code key={recoveryCode} className="font-mono text-[11px] text-ink" dir="ltr">{recoveryCode}</code>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={recoveryCodes.join("\n")} label="نسخ الرموز" />
                  <Button variant="outline" size="sm" onClick={() => setRecoveryCodes([])}>حفظتها — إخفاء</Button>
                </div>
              </div>
            ) : twoFactorEnabled ? (
              <div className="space-y-3">
                <p className="text-[11px] leading-6 text-subtle">
                  تسجيل الدخول يتطلب رمزاً من تطبيق المصادقة أو أحد رموز الاسترداد. تعطيلها يوقف الحماية الإضافية لحسابك.
                </p>
                <Button variant="outline" onClick={() => { setDisableDraft({ password: "", code: "" }); setDisableOpen(true); }}>
                  تعطيل المصادقة الثنائية
                </Button>
              </div>
            ) : twoFactorSetup ? (
              <div className="space-y-3">
                <p className="text-[11px] leading-6 text-subtle">
                  أضف الحساب إلى تطبيق مصادقة (Google Authenticator أو Authy أو 1Password) ثم أدخل الرمز الظاهر.
                </p>
                <div className="flex flex-wrap items-center gap-2 rounded-brand border border-line bg-surface p-3">
                  <span className="text-[10px] text-subtle">المفتاح اليدوي:</span>
                  <code className="break-all font-mono text-[11px] text-ink" dir="ltr">{twoFactorSetup.secret}</code>
                  <CopyButton value={twoFactorSetup.secret} label="" />
                </div>
                <a
                  href={twoFactorSetup.otpauth_url}
                  className="inline-flex text-[10px] font-semibold text-brand underline"
                  dir="ltr"
                >
                  فتح في تطبيق المصادقة
                </a>
                <Field label="رمز التحقق" required hint="6 أرقام من التطبيق">
                  <Input
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="font-mono tracking-[0.35em]"
                    placeholder="123456"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button loading={twoFactorBusy} onClick={enableTwoFactor}>تفعيل المصادقة</Button>
                  <Button variant="ghost" onClick={() => { setTwoFactorSetup(null); setTwoFactorCode(""); }}>إلغاء</Button>
                </div>
              </div>
            ) : twoFactorStart ? (
              <div className="space-y-3">
                <p className="text-[11px] leading-6 text-subtle">
                  أدخل كلمة المرور الحالية لتأكيد هويتك، ثم سنعرض مفتاحاً لإضافته إلى تطبيق المصادقة.
                </p>
                <Field label="كلمة المرور الحالية" required>
                  <Input
                    type="password"
                    value={twoFactorPassword}
                    onChange={(e) => setTwoFactorPassword(e.target.value)}
                    dir="ltr"
                    autoComplete="current-password"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button loading={twoFactorBusy} onClick={startTwoFactor}>بدء التفعيل</Button>
                  <Button variant="ghost" onClick={() => { setTwoFactorStart(false); setTwoFactorPassword(""); }}>إلغاء</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] leading-6 text-subtle">
                  أضف طبقة حماية ثانية: حتى لو عُرفت كلمة المرور، لن يتمكن أحد من الدخول بدون رمز تطبيق المصادقة.
                </p>
                <Button onClick={() => setTwoFactorStart(true)}>تفعيل المصادقة الثنائية</Button>
              </div>
            )}
          </Card>

          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink">
              <ShieldCheck className="h-3.5 w-3.5 text-brand" /> الجلسات والبريد
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-brand border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                    <MailCheck className="h-3.5 w-3.5 text-subtle" /> البريد الإلكتروني
                  </div>
                  <Badge tone={emailVerified ? "bg-success-soft text-success border-success-line" : "bg-warning-soft text-warning border-warning-line"}>
                    {emailVerified ? "مؤكد" : "بانتظار التأكيد"}
                  </Badge>
                </div>
                <div className="mt-2 text-[11px] text-subtle" dir="ltr">{data?.merchant?.email || "—"}</div>
                {!emailVerified ? (
                  <div className="mt-3 space-y-2">
                    <Button variant="outline" size="sm" loading={verificationBusy} onClick={resendVerification}>
                      إعادة إرسال رابط التحقق
                    </Button>
                    {debugVerifyToken ? (
                      <div className="text-[10px] leading-5 text-warning">
                        بيئة تطوير فقط —{" "}
                        <Link href={`/auth/verify-email?token=${encodeURIComponent(debugVerifyToken)}`} className="underline">
                          افتح رابط التحقق
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-[10px] leading-5 text-subtle">تم تأكيد ملكية هذا البريد.</div>
                )}
              </div>

              <div className="rounded-brand border border-line bg-surface p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                  <Shield className="h-3.5 w-3.5 text-subtle" /> الجلسات النشطة
                </div>
                <p className="mt-2 text-[10px] leading-5 text-subtle">
                  إنهاء كل الجلسات الأخرى يحمي حسابك إذا استخدمت جهازاً مشتركاً أو شككت في تسريب كلمة المرور. تبقى جلستك الحالية نشطة.
                </p>
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => setRevokeOpen(true)}>إنهاء الجلسات الأخرى</Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-danger-line p-4 lg:col-span-2">
            <div className="mb-3 text-xs font-bold text-danger">حذف الحساب نهائياً</div>
            <p className="text-[11px] leading-6 text-subtle">
              سيتم حذف حسابك وبيانات تسجيل الدخول. إذا كنت التاجر الوحيد على المتجر فسيُحذف المتجر معه هو وكل بياناته.
              لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="mt-3">
              <Button variant="danger" onClick={() => { setDeleteDraft({ password: "", confirmation: "" }); setDeleteOpen(true); }}>
                <Trash2 className="h-4 w-4" /> حذف الحساب
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-xs font-bold text-ink">آخر أنشطة المتجر (سجل تدقيق)</div>
          <AuditLogs subdomain={subdomain} />
        </Card>
      )}

      {/* publish / unpublish */}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="نشر المتجر"
        description="سيصبح المتجر ظاهراً للعملاء على رابطه الحالي."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>إلغاء</Button>
            <Button loading={publishBusy} onClick={publishNow}><Rocket className="h-4 w-4" /> نشر الآن</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[11px] leading-6 text-subtle">
            تأكد من أن المنتجات والأسعار وطرق الدفع والشحن جاهزة. يمكنك إيقاف النشر في أي وقت دون حذف أي بيانات.
          </p>
          <Alert tone="info" title="ما الذي يتغير؟">
            تصبح واجهة المتجر متاحة للزوار، ويظل اعتماد المتجر من إدارة سند منفصلاً عن قرار النشر.
          </Alert>
        </div>
      </Modal>

      <Modal
        open={unpublishOpen}
        onClose={() => setUnpublishOpen(false)}
        title="إيقاف نشر المتجر"
        description="سيتوقف ظهور واجهة المتجر للعملاء مؤقتاً."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnpublishOpen(false)}>إلغاء</Button>
            <Button variant="outline" loading={publishBusy} onClick={unpublishNow}>إيقاف النشر</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="سبب إيقاف النشر" hint="يظهر في حالة المتجر، ويمكن أن يكون فارغاً.">
            <Textarea rows={3} value={unpublishReason} onChange={(e) => setUnpublishReason(e.target.value)} maxLength={300} placeholder="مثال: تحديث الأسعار قبل إعادة النشر." />
          </Field>
          <Alert tone="warning">
            المنتجات والطلبات والعملاء يبقون محفوظين. لن يتمكن الزوار من فتح واجهة المتجر حتى تعيد النشر.
          </Alert>
        </div>
      </Modal>

      {/* invite modal */}
      <Modal
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        title="دعوة عضو جديد"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTeamOpen(false)}>إلغاء</Button>
            <Button loading={teamBusy} onClick={inviteMember}>إرسال الدعوة</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="الاسم">
            <Input value={teamDraft.name} onChange={(e) => setTeamDraft({ ...teamDraft, name: e.target.value })} />
          </Field>
          <Field label="البريد الإلكتروني" required>
            <Input type="email" value={teamDraft.email} onChange={(e) => setTeamDraft({ ...teamDraft, email: e.target.value })} dir="ltr" />
          </Field>
          <Field label="الدور">
            <Select value={teamDraft.role} onChange={(e) => setTeamDraft({ ...teamDraft, role: e.target.value })}>
              {Object.entries(ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </Field>
          <Alert tone={data?.invitation_email_configured ? "info" : "warning"} title="ملاحظة صادقة">
            {data?.invitation_email_configured
              ? "ستُرسل الدعوة إلى البريد المحدد بعد الإنشاء."
              : "إرسال البريد غير مهيأ حالياً، لذا ستُنشأ الدعوة داخل النظام فقط ولن نؤكد إرسال بريد لم يحدث."}
          </Alert>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="تأكيد حذف الحساب"
        description="إجراء نهائي لا يمكن التراجع عنه."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button variant="danger" loading={deleteAccountBusy} onClick={deleteAccount}>حذف نهائي</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="كلمة المرور" required>
            <Input type="password" value={deleteDraft.password} onChange={(e) => setDeleteDraft({ ...deleteDraft, password: e.target.value })} dir="ltr" />
          </Field>
          <Field label="اكتب DELETE للتأكيد" required>
            <Input value={deleteDraft.confirmation} onChange={(e) => setDeleteDraft({ ...deleteDraft, confirmation: e.target.value })} dir="ltr" className="font-mono" placeholder="DELETE" />
          </Field>
          <Alert tone="error" title="تحذير">
            سيتم حذف الحساب وجلساتك، وقد يُحذف المتجر وبياناته إن لم يتبقَّ تجار آخرون عليه.
          </Alert>
        </div>
      </Modal>

      <Modal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="تعطيل المصادقة الثنائية"
        description="أكد كلمة المرور ورمز المصادقة الحالي. يمكنك استخدام أحد رموز الاسترداد بدلاً من رمز التطبيق."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisableOpen(false)}>إلغاء</Button>
            <Button variant="danger" loading={disableBusy} onClick={disableTwoFactor}>تعطيل المصادقة</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="كلمة المرور الحالية" required>
            <Input
              type="password"
              value={disableDraft.password}
              onChange={(e) => setDisableDraft({ ...disableDraft, password: e.target.value })}
              dir="ltr"
              autoComplete="current-password"
            />
          </Field>
          <Field label="رمز المصادقة أو الاسترداد" required>
            <Input
              value={disableDraft.code}
              onChange={(e) => setDisableDraft({ ...disableDraft, code: e.target.value })}
              dir="ltr"
              autoComplete="one-time-code"
              className="font-mono"
              placeholder="123456"
            />
          </Field>
          <Alert tone="warning">
            بعد التعطيل لن يُطلب رمز إضافي عند تسجيل الدخول. ستظل جلستك الحالية فقط نشطة وتُنهى الجلسات الأخرى.
          </Alert>
        </div>
      </Modal>

      <ConfirmDialog
        open={revokeOpen}
        title="إنهاء الجلسات الأخرى"
        description="سيتم تسجيل الخروج من كل الأجهزة والمتصفحات الأخرى، وتبقى جلستك الحالية نشطة."
        confirmLabel="إنهاء الجلسات"
        loading={revokeBusy}
        onConfirm={revokeOtherSessions}
        onClose={() => setRevokeOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deletingDomain)}
        title="حذف النطاق"
        description={deletingDomain ? `سيتم فصل النطاق ${deletingDomain.domain}.` : undefined}
        confirmLabel="فصل النطاق"
        loading={false}
        onConfirm={async () => {
          if (!deletingDomain) return;
          try {
            await api.settings.removeDomain(subdomain, deletingDomain.id);
            toast.success("تم فصل النطاق.");
          } catch (err: any) {
            toast.error(safeError(err));
          } finally {
            setDeletingDomain(null);
            reload();
          }
        }}
        onClose={() => setDeletingDomain(null)}
      />

      <ConfirmDialog
        open={Boolean(deletingMember)}
        title="إزالة عضو الفريق"
        description={deletingMember ? `سيتم إلغاء وصول ${deletingMember.email}.` : undefined}
        confirmLabel="إزالة العضو"
        loading={deleteBusy}
        onConfirm={async () => {
          if (!deletingMember) return;
          setDeleteBusy(true);
          try {
            await api.settings.removeMember(subdomain, deletingMember.id);
            toast.success("تمت إزالة العضو.");
          } catch (err: any) {
            toast.error(safeError(err));
          } finally {
            setDeleteBusy(false);
            setDeletingMember(null);
            reload();
          }
        }}
        onClose={() => setDeletingMember(null)}
      />
    </div>
  );
}

function AuditLogs({ subdomain }: { subdomain: string }) {
  const { data, loading, error, reload } = useAsync(() => api.settings.auditLogs(subdomain, 60), [subdomain]);
  const logs = data?.logs ?? [];

  if (loading && !data) {
    return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  }
  if (error && !data) {
    return <div className="p-4"><Alert tone="error" title="تعذر تحميل سجل التدقيق">تعذر جلب النشاط الآن. حاول مرة أخرى.<Button size="sm" variant="outline" className="ms-3" onClick={() => void reload()}>إعادة المحاولة</Button></Alert></div>;
  }
  if (logs.length === 0) {
    return <EmptyState title="لا يوجد نشاط مسجّل" description="ستظهر هنا كل العمليات المهمة على المتجر مثل تعديل المنتجات والطلبات والإعدادات." icon={<ScrollText className="h-5 w-5" />} />;
  }
  return (
    <TableShell minWidth={720}>
      <thead>
        <tr className="border-b border-line">
          <Th>التاريخ</Th>
          <Th>العملية</Th>
          <Th>الكيان</Th>
          <Th>بواسطة</Th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log: any) => (
          <tr key={log.id} className="border-b border-line">
            <Td><span className="text-[11px] text-subtle">{dateTime(log.createdAt)}</span></Td>
            <Td><Badge tone="bg-surface text-ink-soft border-line">{log.action}</Badge></Td>
            <Td><span className="font-mono text-[10px] text-subtle" dir="ltr">{log.entity || "—"}</span></Td>
            <Td>
              <div className="text-[11px] text-ink">
                {log.actor?.name || log.merchant?.name || log.merchant?.email || "—"}
              </div>
              <div className="font-mono text-[10px] text-subtle" dir="ltr">
                {log.actor?.email || log.merchant?.email || ""}
              </div>
              <div className="mt-0.5 text-[10px] text-subtle">
                {log.actorType === "team_member" ? "عضو فريق" : log.actorType === "platform_admin" ? "إدارة سند" : "مالك المتجر"}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
