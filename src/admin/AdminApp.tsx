import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  FileText,
  Flag,
  Globe2,
  Headphones,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Store as StoreIcon,
  Users,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import { api, ApiRequestError, type AdminPayload } from "../lib/api";
import { navigate, usePath } from "../lib/router";
import { Alert, Badge, Button, Card, Field, Input, Spinner, cn, useToast } from "../components/ui";
import { BrandLogo } from "../components/Brand";
import {
  OverviewPanel,
  StoresPanel,
  MerchantsPanel,
  SubscriptionsPanel,
  WalletPanel,
  SupportPanel,
} from "./AdminCommerce";
import {
  ReportsPanel,
  DomainsPanel,
  AuditPanel,
  FlagsPanel,
  AdminsPanel,
  LeadsPanel,
  SecurityPanel,
} from "./AdminOps";
import { ADMIN_ROLE_LABELS, PermissionNote, type AdminPermission } from "./shared";

type AdminTab =
  | "overview"
  | "stores"
  | "merchants"
  | "subscriptions"
  | "wallet"
  | "support"
  | "reports"
  | "domains"
  | "audit"
  | "flags"
  | "admins"
  | "leads"
  | "security";

interface TabDefinition {
  key: AdminTab;
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: AdminPermission;
  group: string;
}

const TABS: TabDefinition[] = [
  { key: "overview", href: "/admin", label: "نظرة عامة", icon: LayoutDashboard, permission: "overview.read", group: "المراقبة" },
  { key: "stores", href: "/admin/stores", label: "المتاجر والنشر", icon: StoreIcon, permission: "stores.read", group: "المراقبة" },
  { key: "merchants", href: "/admin/merchants", label: "التجار", icon: Users, permission: "merchants.read", group: "المراقبة" },
  { key: "subscriptions", href: "/admin/subscriptions", label: "الاشتراكات", icon: CreditCard, permission: "subscriptions.read", group: "التشغيل" },
  { key: "wallet", href: "/admin/wallet", label: "طلبات الإيداع", icon: Wallet, permission: "wallet.read", group: "التشغيل" },
  { key: "support", href: "/admin/support", label: "الدعم", icon: Headphones, permission: "support.read", group: "التشغيل" },
  { key: "reports", href: "/admin/reports", label: "التقارير", icon: BarChart3, permission: "reports.read", group: "التشغيل" },
  { key: "domains", href: "/admin/domains", label: "النطاقات و TLS", icon: Globe2, permission: "domains.read", group: "التشغيل" },
  { key: "audit", href: "/admin/audit", label: "سجل التدقيق", icon: Shield, permission: "audit.read", group: "الحوكمة" },
  { key: "flags", href: "/admin/flags", label: "مفاتيح الميزات", icon: Flag, permission: "flags.read", group: "الحوكمة" },
  { key: "admins", href: "/admin/admins", label: "حسابات الإدارة", icon: UserCog, permission: "admins.manage", group: "الحوكمة" },
  { key: "leads", href: "/admin/leads", label: "طلبات المنصة", icon: FileText, permission: "stores.read", group: "الحوكمة" },
  { key: "security", href: "/admin/security", label: "أمان حسابي", icon: ShieldCheck, group: "الحكومة" },
];

const GROUPS = ["المراقبة", "التشغيل", "الحوكمة", "الحكومة"];

const LEGACY_ALIASES: Record<string, AdminTab> = {
  payments: "subscriptions",
  visits: "reports",
};

function tabFromPath(path: string): AdminTab | null {
  const match = path.match(/^\/admin(?:\/([^/]+))?\/?$/);
  const raw = match?.[1];
  if (!raw) return "overview";
  const key = LEGACY_ALIASES[raw] ?? raw;
  return TABS.some((tab) => tab.key === key) ? (key as AdminTab) : null;
}

function tabByKey(key: AdminTab): TabDefinition {
  return TABS.find((tab) => tab.key === key) ?? TABS[0];
}

const ADMIN_ERRORS: Record<string, string> = {
  ADMIN_INVALID_CREDENTIALS: "بيانات الدخول غير صحيحة.",
  ADMIN_DISABLED: "حساب الإدارة معطّل. تواصل مع مدير المنصة.",
  ADMIN_TWO_FACTOR_REQUIRED: "أدخل رمز المصادقة الثنائية للمتابعة.",
  ADMIN_INVALID_TWO_FACTOR: "رمز المصادقة غير صحيح أو مستخدم سابقاً.",
  ADMIN_FORBIDDEN: "دورك الحالي لا يسمح بهذا الإجراء.",
  ADMIN_SELF_EDIT: "لا يمكنك تعديل دورك أو تعطيل حسابك الحالي.",
};

function adminError(error: unknown): string {
  if (error instanceof ApiRequestError && ADMIN_ERRORS[error.code]) return ADMIN_ERRORS[error.code];
  if (error instanceof Error && error.message) return error.message;
  return "تعذر إكمال العملية. حاول مرة أخرى.";
}

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */

type AuthState =
  | { status: "loading"; admin: null }
  | { status: "signed_out"; admin: null }
  | { status: "denied"; admin: null }
  | { status: "ready"; admin: AdminPayload };

export function AdminApp() {
  const path = usePath();
  const toast = useToast();
  const [auth, setAuth] = useState<AuthState>({ status: "loading", admin: null });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const currentTab = tabFromPath(path);

  const loadAdmin = async () => {
    try {
      const result = await api.admin.auth.me();
      setAuth({ status: "ready", admin: result.admin });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 403 && error.code === "ADMIN_ACCESS_DENIED") {
        setAuth({ status: "denied", admin: null });
        return;
      }
      setAuth((current) => (current.status === "ready" ? current : { status: "signed_out", admin: null }));
    }
  };

  useEffect(() => {
    void loadAdmin();
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [path]);

  const logout = async () => {
    try {
      await api.admin.auth.logout();
    } catch {
      // The admin session may already be gone; local state must still clear.
    }
    setAuth({ status: "signed_out", admin: null });
    navigate("/admin", { replace: true });
  };

  if (auth.status === "loading") {
    return (
      <div dir="rtl" data-theme="light" className="flex min-h-screen items-center justify-center bg-canvas font-arabic text-ink">
        <Spinner label="جارٍ التحقق من جلسة إدارة المنصة…" />
      </div>
    );
  }

  if (auth.status === "signed_out") {
    return <AdminLogin onSignedIn={(admin) => setAuth({ status: "ready", admin })} />;
  }

  if (auth.status === "denied") {
    return <AdminDenied onUseAdminLogin={() => setAuth({ status: "signed_out", admin: null })} />;
  }

  const admin = auth.admin;
  const can = (permission: AdminPermission) => admin.permissions.includes(permission);
  const visibleTabs = TABS.filter((tab) => !tab.permission || can(tab.permission));

  const renderPanel = () => {
    if (!currentTab) {
      return (
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
          <h1 className="mt-3 font-heading text-xl font-bold text-ink">قسم إداري غير معروف</h1>
          <p className="mt-2 text-xs leading-6 text-subtle">المسار المطلوب غير موجود داخل لوحة إدارة المنصة.</p>
          <Button className="mt-4" onClick={() => navigate("/admin")}>العودة إلى النظرة العامة</Button>
        </Card>
      );
    }
    const tab = tabByKey(currentTab);
    if (tab.permission && !can(tab.permission)) {
      return (
        <div className="space-y-4">
          <Card className="p-8 text-center">
            <ShieldAlert className="mx-auto h-9 w-9 text-danger" />
            <h1 className="mt-3 font-heading text-xl font-bold text-ink">لا تملك صلاحية هذا القسم</h1>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-subtle">
              دورك «{ADMIN_ROLE_LABELS[admin.role] ?? admin.role}» لا يمنح صلاحية الوصول إلى «{tab.label}».
              الخادم يرفض الطلب أيضاً، وليس الإخفاء في الواجهة فقط.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {visibleTabs.slice(0, 3).map((entry) => (
                <Button key={entry.key} variant="outline" onClick={() => navigate(entry.href)}>{entry.label}</Button>
              ))}
            </div>
          </Card>
          <PermissionNote>
            الصلاحيات الممنوحة لحسابك: {admin.permissions.length ? admin.permissions.join(" · ") : "لا توجد صلاحيات قراءة"}.
          </PermissionNote>
        </div>
      );
    }

    switch (currentTab) {
      case "overview":
        return <OverviewPanel can={can} />;
      case "stores":
        return <StoresPanel can={can} />;
      case "merchants":
        return <MerchantsPanel />;
      case "subscriptions":
        return <SubscriptionsPanel can={can} />;
      case "wallet":
        return <WalletPanel can={can} />;
      case "support":
        return <SupportPanel can={can} />;
      case "reports":
        return <ReportsPanel can={can} />;
      case "domains":
        return <DomainsPanel can={can} />;
      case "audit":
        return <AuditPanel can={can} />;
      case "flags":
        return <FlagsPanel can={can} />;
      case "admins":
        return <AdminsPanel can={can} admin={admin} />;
      case "leads":
        return <LeadsPanel can={can} />;
      case "security":
        return <SecurityPanel can={can} admin={admin} onAdminUpdated={loadAdmin} />;
      default:
        return null;
    }
  };

  const nav = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 pb-5">
      {GROUPS.map((group) => {
        const items = visibleTabs.filter((tab) => tab.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className="pt-3">
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{group}</div>
            {items.map((tab) => {
              const active = currentTab === tab.key;
              const Icon = tab.icon;
              return (
                <a
                  key={tab.key}
                  href={tab.href}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(tab.href);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-brand px-2.5 py-2 text-xs font-semibold transition",
                    active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className={cn("rounded-brand-sm p-1.5", active ? "bg-brand/20 text-brand" : "text-white/45 group-hover:text-white/80")}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{tab.label}</span>
                  {active ? <span className="ms-auto h-1.5 w-1.5 rounded-full bg-brand" /> : null}
                </a>
              );
            })}
          </div>
        );
      })}
      <div className="mt-auto rounded-brand border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/70"><ShieldCheck className="h-3 w-3 text-brand" /> حدود إدارية</div>
        <p className="mt-1.5 text-[10px] leading-5 text-white/45">
          جلسة الإدارة منفصلة عن جلسة التاجر. كل إجراء يُسجَّل باسمك ونوع حسابك في سجل التدقيق.
        </p>
      </div>
    </nav>
  );

  return (
    <div dir="rtl" data-theme="light" className="min-h-screen bg-canvas font-arabic text-ink">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[280px] flex-col bg-secondary lg:flex">
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-4">
          <BrandLogo dark size="sm" showTagline={false} tagline="إدارة المنصة" />
          <Badge tone="border-white/15 bg-white/10 text-white">إدارة</Badge>
        </div>
        <div className="border-b border-white/10 px-4 py-3">
          <div className="truncate text-[11px] font-semibold text-white">{admin.name || admin.email}</div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-white/45" dir="ltr">{admin.email}</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge tone="border-white/15 bg-white/10 text-white/80">{ADMIN_ROLE_LABELS[admin.role] ?? admin.role}</Badge>
            {admin.two_factor_enabled ? <Badge tone="border-success/30 bg-success/15 text-success">2FA</Badge> : <Badge tone="border-warning/30 bg-warning/15 text-warning">2FA غير مفعّلة</Badge>}
          </div>
        </div>
        <div className="min-h-0 flex-1">{nav}</div>
        <div className="border-t border-white/10 p-3">
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-brand px-2.5 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/5 hover:text-white">
            <LogOut className="h-4 w-4" /> تسجيل خروج الإدارة
          </button>
        </div>
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-[292px] flex-col bg-secondary">
            <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-4">
              <BrandLogo dark size="sm" showTagline={false} />
              <button onClick={() => setDrawerOpen(false)} className="rounded-brand-sm p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="إغلاق القائمة">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-white/10 px-4 py-3">
              <div className="truncate text-[11px] font-semibold text-white">{admin.name || admin.email}</div>
              <div className="mt-0.5 truncate text-[10px] text-white/45">{ADMIN_ROLE_LABELS[admin.role] ?? admin.role}</div>
            </div>
            <div className="min-h-0 flex-1">{nav}</div>
          </aside>
        </div>
      ) : null}

      <div className="lg:ps-[280px]">
        <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur-xl">
          <div className="flex h-[76px] items-center gap-2 px-4 sm:px-6">
            <button onClick={() => setDrawerOpen(true)} className="rounded-brand-sm p-2 text-subtle hover:bg-surface hover:text-ink lg:hidden" aria-label="فتح القائمة">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] text-subtle">
                <span>إدارة منصة سند</span>
                <span>/</span>
                <span className="text-ink-soft">{currentTab ? tabByKey(currentTab).label : "غير معروف"}</span>
              </div>
              <h1 className="truncate font-heading text-base font-bold text-ink sm:text-lg">
                {currentTab ? tabByKey(currentTab).label : "قسم غير معروف"}
              </h1>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Badge tone="bg-secondary text-white border-secondary">{ADMIN_ROLE_LABELS[admin.role] ?? admin.role}</Badge>
              <Button variant="ghost" size="sm" onClick={loadAdmin} aria-label="تحديث جلسة الإدارة"><RefreshCw className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" onClick={logout}><LogOut className="h-3.5 w-3.5" /> خروج</Button>
            </div>
            <div className="relative sm:hidden">
              <Button variant="ghost" size="sm" onClick={logout} aria-label="تسجيل الخروج"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => navigate(tab.href)}
                className={cn(
                  "shrink-0 rounded-brand-sm px-2.5 py-1.5 text-[10px] font-semibold transition",
                  currentTab === tab.key ? "bg-brand text-on-brand" : "bg-surface text-subtle"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-5 sm:px-6">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin login                                                         */
/* ------------------------------------------------------------------ */

function AdminLogin({ onSignedIn }: { onSignedIn: (admin: AdminPayload) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [secondFactor, setSecondFactor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("أدخل البريد الإلكتروني وكلمة المرور.");
      return;
    }
    if (needsSecondFactor && !secondFactor.trim()) {
      setError(useRecovery ? "أدخل أحد رموز الاسترداد." : "أدخل رمز المصادقة.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.admin.auth.login(
        email.trim(),
        password,
        needsSecondFactor
          ? useRecovery
            ? { recovery_code: secondFactor.trim() }
            : { totp: secondFactor.trim() }
          : undefined
      );
      toast.success("تم تسجيل الدخول إلى إدارة المنصة.");
      onSignedIn(result.admin);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "ADMIN_TWO_FACTOR_REQUIRED") {
        setNeedsSecondFactor(true);
        setError("");
        return;
      }
      setError(adminError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" data-theme="light" className="min-h-screen bg-secondary font-arabic text-ink">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[1fr_460px]">
        <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
          <div className="absolute -start-24 top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
          <div className="absolute -end-16 bottom-10 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
          <BrandLogo dark size="lg" tagline="مركز إدارة منصة سند" />
          <div className="relative max-w-md">
            <h1 className="font-heading text-3xl font-bold leading-snug text-white">مساحة إدارة منفصلة تماماً عن حسابات التجار.</h1>
            <p className="mt-3 text-xs leading-7 text-white/55">
              جلسة الإدارة بكوكي مستقل، وصلاحيات يفرضها الخادم حسب الدور، وسجل تدقيق لكل إجراء. لا يمنح حساب التاجر أي وصول إلى هذه المنطقة.
            </p>
            <div className="mt-6 grid gap-2 text-[11px] text-white/60">
              <div className="flex items-center gap-2 rounded-brand border border-white/10 bg-white/[0.03] px-3 py-2.5"><ShieldCheck className="h-4 w-4 text-brand" /> أدوار: مدير أعلى، تشغيل، مالية، دعم، قراءة فقط</div>
              <div className="flex items-center gap-2 rounded-brand border border-white/10 bg-white/[0.03] px-3 py-2.5"><ShieldAlert className="h-4 w-4 text-brand" /> التحقق الثنائي مدعوم بالكامل مع رموز استرداد</div>
            </div>
          </div>
          <div className="relative text-[10px] text-white/35">© سند للتجارة — وصول إداري مُدقَّق</div>
        </div>

        <div className="flex items-center justify-center bg-canvas px-4 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="lg:hidden"><BrandLogo size="md" showTagline={false} /></div>
            <div className="mt-5 flex items-center gap-2">
              <Badge tone="bg-secondary text-white border-secondary"><ShieldCheck className="h-3 w-3" /> وصول إداري</Badge>
            </div>
            <h2 className="mt-3 font-heading text-2xl font-bold text-ink">دخول إدارة المنصة</h2>
            <p className="mt-1 text-[11px] leading-6 text-subtle">هذه البوابة لحسابات إدارة سند فقط. حسابات التجار تُدخل من بوابة المتجر.</p>

            {error ? <div className="mt-4"><Alert tone="error" title="تعذر تسجيل الدخول">{error}</Alert></div> : null}

            <form onSubmit={submit} className="mt-4 space-y-4">
              <Field label="البريد الإلكتروني" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  dir="ltr"
                  autoComplete="username"
                  autoFocus
                  disabled={busy || needsSecondFactor}
                />
              </Field>
              <Field label="كلمة المرور" required>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  dir="ltr"
                  autoComplete="current-password"
                  disabled={busy || needsSecondFactor}
                />
              </Field>

              {needsSecondFactor ? (
                <div className="rounded-brand border border-brand-line bg-brand-soft/40 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
                    <ShieldCheck className="h-3.5 w-3.5" /> مطلوب التحقق الثنائي
                  </div>
                  <div className="mt-2">
                    <Field label={useRecovery ? "رمز الاسترداد" : "رمز المصادقة"} required hint={useRecovery ? "أحد الرموز المحفوظة" : "6 أرقام من تطبيق المصادقة"}>
                      <Input
                        value={secondFactor}
                        onChange={(event) => setSecondFactor(event.target.value)}
                        dir="ltr"
                        inputMode={useRecovery ? "text" : "numeric"}
                        autoComplete="one-time-code"
                        autoFocus
                        className={useRecovery ? "font-mono" : "font-mono tracking-[0.35em]"}
                        placeholder={useRecovery ? "XXXX-XXXX" : "123456"}
                        maxLength={useRecovery ? 32 : 6}
                      />
                    </Field>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-brand underline underline-offset-2"
                      onClick={() => {
                        setUseRecovery((value) => !value);
                        setSecondFactor("");
                        setError("");
                      }}
                    >
                      {useRecovery ? "استخدام رمز التطبيق" : "استخدام رمز استرداد"}
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-subtle underline underline-offset-2"
                      onClick={() => {
                        setNeedsSecondFactor(false);
                        setSecondFactor("");
                        setUseRecovery(false);
                        setError("");
                      }}
                    >
                      تغيير بيانات الدخول
                    </button>
                  </div>
                </div>
              ) : null}

              <Button type="submit" className="w-full" loading={busy}>
                {needsSecondFactor ? "تأكيد الدخول" : "تسجيل الدخول"}
              </Button>
            </form>

            <div className="mt-5 border-t border-line pt-4 text-center text-[11px] text-subtle">
              <a href="/auth/login" onClick={(event) => { event.preventDefault(); navigate("/auth/login"); }} className="font-semibold text-brand hover:underline">
                الدخول كتاجر
              </a>
              <span className="mx-1.5">·</span>
              <a href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }} className="hover:text-ink">العودة للموقع</a>
            </div>
            <div className="mt-4 rounded-brand border border-line bg-surface px-3 py-2 text-[10px] leading-5 text-subtle">
              حساب التاجر لا يفتح هذه الصفحة ولا يمنح أي صلاحية إدارية، حتى لو كان مالك متجر.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Merchant-session denial                                             */
/* ------------------------------------------------------------------ */

function AdminDenied({ onUseAdminLogin }: { onUseAdminLogin: () => void }) {
  return (
    <div dir="rtl" data-theme="light" className="flex min-h-screen items-center justify-center bg-canvas px-4 font-arabic text-ink">
      <Card className="max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-brand border border-danger-line bg-danger-soft text-danger">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-heading text-2xl font-bold">هذا الحساب ليس حساب إدارة منصة</h1>
        <p className="mt-2 text-sm leading-7 text-subtle">
          أنت مسجّل الدخول بحساب تاجر. حسابات التجار وأعضاء الفريق لا تملك وصولاً إلى <code className="font-mono text-ink" dir="ltr">/admin</code>.
          إدارة المنصة تستخدم هوية وجلسة منفصلتين تماماً.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate("/dashboard")}>العودة إلى لوحة متجري</Button>
          <Button variant="outline" onClick={onUseAdminLogin}>الدخول بحساب إدارة</Button>
        </div>
        <div className="mt-4 text-[10px] leading-5 text-subtle">
          تسجيل دخول الإدارة لا يستخدم جلستك الحالية ولن يمنح حساب التاجر أي صلاحية إضافية.
        </div>
      </Card>
    </div>
  );
}
