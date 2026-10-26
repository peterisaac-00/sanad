import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  BadgePercent,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Boxes,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  Gift,
  GraduationCap,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  Newspaper,
  Package,
  Percent,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tags,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api, mediaUrl, type StorePermission } from "../lib/api";
import { storefrontLabel as publicStorefrontLabel, storefrontUrl as publicStorefrontUrl } from "../lib/urls";
import { safeError, timeAgo } from "../lib/format";
import { Link, navigate, usePath } from "../lib/router";
import { useSession } from "../lib/session";
import { useTheme, ThemeToggle } from "../lib/theme";
import { useAsync } from "../lib/useAsync";
import { BrandLogo } from "../components/Brand";
import { Alert, Badge, Spinner, cn, useToast } from "../components/ui";
import { StoreApprovalGate } from "./FeatureGate";
import { isFeatureVisible, resolveFeature } from "./features";

export interface DashboardContextValue {
  store: any;
  subdomain: string;
  section: string;
  storefrontUrl: string;
  storefrontLabel: string;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardShell");
  return ctx;
}

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ label: string; caption?: string; path: string; icon: React.ElementType }>;
}> = [
  {
    label: "نظرة عامة",
    items: [
      { label: "لوحة التحكم", path: "/dashboard", icon: LayoutDashboard },
      { label: "الطلبات", path: "/dashboard/orders", icon: ShoppingCart },
      { label: "التقارير", path: "/dashboard/reports", icon: BarChart3 },
    ],
  },
  {
    label: "المتجر",
    items: [
      { label: "المنتجات", path: "/dashboard/products", icon: Package },
      { label: "الفئات", path: "/dashboard/categories", icon: Tags },
      { label: "العملاء", path: "/dashboard/customers", icon: Users },
      { label: "مناطق الشحن", path: "/dashboard/shipping", icon: Truck },
      { label: "التقييمات", path: "/dashboard/reviews", icon: Star },
    ],
  },
  {
    label: "النمو والتسويق",
    items: [
      { label: "السلات المتروكة", path: "/dashboard/abandoned-carts", icon: ShoppingBag },
      { label: "العروض الإضافية", path: "/dashboard/upsells", icon: Percent },
      { label: "المنتجات المرتبطة", path: "/dashboard/related-products", icon: Link2 },
      { label: "الكوبونات", path: "/dashboard/coupons", icon: BadgePercent },
      { label: "التسويق بالعمولة", path: "/dashboard/affiliates", icon: Megaphone },
      { label: "برنامج الولاء", path: "/dashboard/loyalty", icon: Gift },
      { label: "مساعد التسويق", path: "/dashboard/assistant", icon: Sparkles },
    ],
  },
  {
    label: "المحتوى",
    items: [
      { label: "الصفحات", path: "/dashboard/pages", icon: FileText },
      { label: "المدونة", path: "/dashboard/blog", icon: Newspaper },
    ],
  },
  {
    label: "التشغيل",
    items: [
      { label: "المحفظة", path: "/dashboard/wallet", icon: Wallet },
      { label: "الدروبشيبينغ", path: "/dashboard/dropshipping", icon: Boxes },
      { label: "الإعدادات", path: "/dashboard/settings", icon: Settings },
      { label: "الدليل السريع", path: "/dashboard/learn", icon: GraduationCap },
    ],
  },
];

// Flattened for counting, mobile navigation and page titles. Every entry is a
// real route; branding is intentionally not one of them (set once at onboarding).
const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));

const BOTTOM_NAV = [
  { label: "الرئيسية", path: "/dashboard", icon: LayoutDashboard },
  { label: "الطلبات", path: "/dashboard/orders", icon: ShoppingCart },
  { label: "المنتجات", path: "/dashboard/products", icon: Package },
];

/**
 * Navigation permission rule. The API remains the enforcement point; this only
 * keeps links the current principal cannot use out of the sidebar.
 */
function navPermission(path: string): StorePermission {
  if (path === "/dashboard/settings") return "settings.write";
  if (path === "/dashboard/wallet") return "billing.manage";
  return "store.read";
}

const TEAM_ROLE_LABELS: Record<string, string> = {
  admin: "مدير عام",
  manager: "مدير",
  staff: "موظف",
  viewer: "مشاهدة فقط",
};

const PUBLISH_STATUS_LABELS: Record<string, string> = {
  draft: "غير منشور",
  ready: "جاهز للمراجعة",
  published: "منشور",
  suspended: "نشر موقوف",
};


function matches(path: string, itemPath: string) {
  if (itemPath === "/dashboard") return path === "/dashboard";
  return path === itemPath || path.startsWith(`${itemPath}/`);
}

function pageTitle(path: string) {
  const item = [...NAV_ITEMS].reverse().find((entry) => matches(path, entry.path));
  if (path.startsWith("/dashboard/orders/")) return "تفاصيل الطلب";
  return item?.label ?? "لوحة التحكم";
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { session, loading, logout, refresh, teamMember, can } = useSession();
  const { theme } = useTheme();
  const path = usePath();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const revalidated = useRef(false);
  const lastApprovalNotificationId = useRef("");

  const store = session?.store;
  const subdomain = store?.subdomain ?? "";
  const section = pageTitle(path);
  const accountRole = teamMember ? TEAM_ROLE_LABELS[teamMember.role] ?? "فريق" : "تاجر";
  const accountName =
    teamMember?.name ||
    [session?.merchant?.first_name, session?.merchant?.last_name].filter(Boolean).join(" ") ||
    session?.merchant?.email ||
    "";
  const accountEmail = teamMember?.email || session?.merchant?.email || "";
  const storefrontUrl = publicStorefrontUrl(store) || "/";
  const storefrontLabel = publicStorefrontLabel(store) || storefrontUrl;
  const publishing = session?.publishing ?? null;
  const publishStatus: string = publishing?.publish_status ?? store?.publishStatus ?? "draft";
  const publishReason: string = publishing?.publish_reason || store?.publishReason || "";
  const publishLabel = PUBLISH_STATUS_LABELS[publishStatus] ?? publishStatus;
  const canManagePublishing = can("settings.write");
  const subscriptionExpired = Boolean(store?.subscriptionPaidUntil && new Date(store.subscriptionPaidUntil).getTime() <= Date.now());

  // The session snapshot lives in memory and survives client-side navigation,
  // so a store renamed elsewhere (publishing during onboarding) would keep every
  // console request pointed at the old subdomain. Re-read it once per mount.
  useEffect(() => {
    if (loading || !store || revalidated.current) return;
    revalidated.current = true;
    void refresh();
  }, [loading, store, refresh]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate(`/auth/login?next=${encodeURIComponent(path)}`, { replace: true });
      return;
    }
    // The console only opens after the store is designed and published. Draft
    // merchants belong in onboarding, so the "complete setup" prompt can never
    // appear and there is no way to skip the remaining steps. Team members join
    // an existing store, so they must never be sent through merchant onboarding.
    if (!session.store) {
      navigate("/onboarding", { replace: true });
      return;
    }
    if (!teamMember && !session.store.onboardingCompleted) {
      navigate("/onboarding", { replace: true });
    }
  }, [loading, session, teamMember, path]);

  const loadNotifications = async () => {
    if (!subdomain) return;
    try {
      const result = await api.dashboard.notifications(subdomain);
      setNotifications(result.notifications);
      setUnread(result.unread);
      // A new approval notification means the store status may have changed
      // (rejected, approved, or suspended). Pull a fresh session so the header
      // banner reflects it without requiring a page reload.
      const latestApproval = result.notifications.find((item: any) => item.type === "approval");
      if (latestApproval && latestApproval.id !== lastApprovalNotificationId.current) {
        lastApprovalNotificationId.current = latestApproval.id;
        void refresh();
      }
    } catch {
      // A failed notification poll must not interrupt the page the merchant is
      // working on; the bell simply stays at its last known state.
    }
  };

  useEffect(() => {
    if (!subdomain) return;
    void loadNotifications();
    // Admin reviews happen outside this tab, so do not wait a full minute for
    // the bell to catch up. Poll less aggressively in the background and check
    // immediately whenever the merchant returns to the dashboard.
    const timer = window.setInterval(() => void loadNotifications(), 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [subdomain]);

  // A pending store may be approved from another browser by the platform
  // administrator. Refresh the session while locked so the dashboard opens
  // automatically without requiring a logout/login cycle.
  useEffect(() => {
    if (loading || !store || store.status === "active") return;
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [loading, store?.id, store?.status, refresh]);

  // Integration badges must reflect the running server, not a static guess.
  // The assistant page already asks this endpoint; the sidebar reuses the same
  // answer for the "setup required" badge.
  const assistantStatus = useAsync(
    async () => (subdomain ? api.assistant.get(subdomain) : null),
    [subdomain]
  );
  const assistantConfigured = assistantStatus.data?.configured === true;
  // Until the answer is known, keep the badge hidden instead of briefly
  // claiming setup is required on an already-configured instance.
  const assistantKnown = assistantStatus.data !== null;

  useEffect(() => {
    setDrawerOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, [path]);

  const markAllRead = async () => {
    try {
      await api.dashboard.readNotifications(subdomain);
      setNotifications((current) => current.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const nav = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 pb-5">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => isFeatureVisible(item.path) && can(navPermission(item.path))
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="pt-3">
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">{group.label}</div>
            {items.map((item) => {
              const active = matches(path, item.path);
              const Icon = item.icon;
              const feature = resolveFeature(item.path, { assistantConfigured });
              const showBadge =
                Boolean(feature?.badge) && (item.path !== "/dashboard/assistant" || assistantKnown);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-brand px-2.5 py-2 text-xs font-semibold transition",
                    active
                      ? "bg-brand-soft text-brand ring-1 ring-inset ring-brand-line"
                      : "text-ink-soft hover:bg-surface hover:text-ink"
                  )}
                >
                  <span className={cn("rounded-brand-sm p-1.5", active ? "bg-brand-soft text-brand" : "text-subtle group-hover:text-ink-soft")}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                  <span className="ms-auto flex shrink-0 items-center gap-1">
                    {showBadge ? (
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[8px] font-semibold",
                          feature?.state === "needs_setup"
                            ? "border-warning-line bg-warning-soft text-warning"
                            : "border-line bg-surface text-subtle"
                        )}
                      >
                        {feature?.badge}
                      </span>
                    ) : null}
                    {active ? <span className="h-1.5 w-1.5 rounded-full bg-brand" /> : null}
                  </span>
                </Link>
              );
            })}
          </div>
        );
      })}
      <div className="mt-4 rounded-brand border border-line bg-surface p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-soft"><BookOpen className="h-3 w-3 text-brand" /> تحتاج مساعدة؟</div>
        <Link href="/dashboard/learn" className="mt-1.5 block text-[11px] leading-5 text-subtle hover:text-ink">
          أدلة قصيرة لإعداد المتجر والطلبات والشحن في الدليل السريع.
        </Link>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner label="جارٍ تحميل لوحة التحكم…" />
      </div>
    );
  }

  if (!session?.store) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner label="جارٍ تجهيز متجرك…" />
      </div>
    );
  }

  // Never paint the console (not even for one frame) before onboarding is done;
  // the redirect effect above sends the merchant back to finish setup.
  if (!store.onboardingCompleted && !teamMember) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner label="جارٍ تحويلك لإكمال تهيئة المتجر…" />
      </div>
    );
  }

  if (subscriptionExpired && path !== "/dashboard/wallet") {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-canvas p-6 font-arabic text-ink">
        <div className="w-full max-w-lg rounded-brand-lg border border-warning-line bg-card p-7 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft text-warning"><Clock className="h-7 w-7" /></div>
          <h1 className="mt-4 font-heading text-2xl font-bold">انتهى اشتراك المتجر</h1>
          <p className="mt-2 text-sm leading-7 text-subtle">تم قفل لوحة التحكم لانتهاء مدة الاشتراك. أرسل بيانات الدفع من صفحة الاشتراك، وبعد اعتماد الأدمن ستعود كل وظائف المتجر للعمل.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => navigate("/dashboard/wallet")} className="rounded-brand bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:bg-brand-hover">تجديد الاشتراك</button>
            <button type="button" onClick={handleLogout} className="rounded-brand border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface">تسجيل الخروج</button>
          </div>
        </div>
      </div>
    );
  }
  const storeInitial = (store.storeName ?? "س").trim().charAt(0);

  return (
    <DashboardContext.Provider value={{ store, subdomain, section, storefrontUrl, storefrontLabel }}>
      <div dir="rtl" data-theme={theme} className="min-h-screen bg-canvas font-arabic text-ink">
        {/* Desktop right sidebar (RTL start edge). */}
        <aside className="fixed inset-y-0 start-0 z-40 hidden w-[272px] border-e border-line bg-card lg:flex lg:flex-col">
          <div className="flex h-[72px] items-center justify-between border-b border-line px-4">
            <Link href="/dashboard" aria-label="سند"><BrandLogo size="sm" showTagline={false} /></Link>
            <Badge tone={teamMember ? "border-line bg-surface text-ink-soft" : "border-brand-line bg-brand-soft text-brand"}>
              {accountRole}
            </Badge>
          </div>

          <div className="border-b border-line p-3">
            <Link href={storefrontUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2.5 rounded-brand border border-line bg-surface p-2.5 transition hover:border-brand-line">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-brand-sm bg-brand text-sm font-bold text-on-brand">
                {store.logoUrl ? <img src={mediaUrl(store.logoUrl)} alt="" className="h-full w-full object-cover" /> : storeInitial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-ink">{store.storeName}</div>
                <div className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-subtle" dir="ltr">
                  {storefrontLabel}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-subtle group-hover:text-brand" />
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Badge tone="bg-surface text-ink-soft border-line">{publishLabel}</Badge>
              {teamMember ? <Badge tone="bg-info-soft text-info border-info-line">عضو فريق</Badge> : <Badge tone="bg-brand-soft text-brand border-brand-line">مالك المتجر</Badge>}
            </div>
          </div>

          <div className="min-h-0 flex-1">{nav}</div>

          <div className="border-t border-line p-3">
            <div className="flex items-center gap-2 rounded-brand px-2 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-ink-soft">
                {(accountName || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-ink">
                  {accountName || accountEmail}
                </div>
                <div className="truncate text-[10px] text-subtle">{accountEmail}</div>
              </div>
              <button onClick={handleLogout} className="rounded-brand-sm p-1.5 text-subtle hover:bg-surface hover:text-danger" title="تسجيل الخروج">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute inset-y-0 start-0 flex w-[286px] flex-col border-e border-line bg-card">
              <div className="flex h-[72px] items-center justify-between border-b border-line px-4">
                <BrandLogo size="sm" showTagline={false} />
                <button onClick={() => setDrawerOpen(false)} className="rounded-brand-sm p-2 text-subtle hover:bg-surface hover:text-ink" aria-label="إغلاق القائمة">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="border-b border-line p-3">
                <div className="text-xs font-bold text-ink">{store.storeName}</div>
                <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{storefrontLabel}</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge tone="bg-surface text-ink-soft border-line">{publishLabel}</Badge>
                  {teamMember ? <Badge tone="bg-info-soft text-info border-info-line">{accountRole}</Badge> : null}
                </div>
              </div>
              <div className="min-h-0 flex-1">{nav}</div>
            </aside>
          </div>
        ) : null}

        <div className="lg:ps-[272px]">
          <header className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur-xl">
            <div className="flex h-[72px] items-center gap-2 px-4 sm:px-6">
              <button onClick={() => setDrawerOpen(true)} className="rounded-brand-sm p-2 text-subtle hover:bg-surface hover:text-ink lg:hidden" aria-label="فتح القائمة">
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] text-subtle">
                  <span>لوحة التحكم</span>
                  <span>/</span>
                  <span className="text-ink-soft">{section}</span>
                </div>
                <h1 className="truncate font-heading text-base font-bold text-ink sm:text-lg">{section}</h1>
              </div>

              <Link
                href={storefrontUrl}
                target="_blank" rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-brand border border-line bg-card px-3 py-2 text-[11px] font-semibold text-ink-soft transition hover:border-brand-line hover:text-brand sm:flex"
              >
                <Store className="h-3.5 w-3.5 text-brand" />
                عرض المتجر
              </Link>

              <ThemeToggle compact />

              <div className="relative">
                <button
                  onClick={() => {
                    if (!notificationsOpen) void loadNotifications();
                    setNotificationsOpen((v) => !v);
                    setProfileOpen(false);
                  }}
                  className="relative rounded-brand border border-line bg-card p-2 text-subtle transition hover:bg-surface hover:text-ink"
                  aria-label="الإشعارات"
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 ? <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-on-brand">{unread > 9 ? "9+" : unread}</span> : null}
                </button>
                {notificationsOpen ? (
                  <div className="surface-popover absolute end-0 top-full z-40 mt-2 w-[min(92vw,22rem)] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-ink"><BellRing className="h-3.5 w-3.5 text-brand" /> الإشعارات</div>
                      {unread > 0 ? <button onClick={markAllRead} className="text-[10px] font-semibold text-brand hover:text-brand-hover">تعليم الكل كمقروء</button> : null}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length ? notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={async () => {
                            if (!n.read) {
                              await api.dashboard.readNotifications(subdomain, n.id).catch(() => null);
                              setNotifications((current) => current.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                              setUnread((v) => Math.max(0, v - 1));
                            }
                            setNotificationsOpen(false);
                            if (n.link) navigate(n.link);
                          }}
                          className={cn("block w-full border-b border-line/70 px-3.5 py-3 text-start transition hover:bg-surface", !n.read && "bg-brand-soft/50")}
                        >
                          <div className="flex items-start gap-2">
                            <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-line" : "bg-brand")} />
                            <div className="min-w-0">
                              <div className="truncate text-[11px] font-semibold text-ink">{n.title}</div>
                              {n.body ? <div className="mt-0.5 line-clamp-2 text-[10px] leading-5 text-subtle">{n.body}</div> : null}
                              <div className="mt-1 text-[9px] text-subtle">{timeAgo(n.createdAt)}</div>
                            </div>
                          </div>
                        </button>
                      )) : (
                        <div className="px-4 py-10 text-center text-[11px] text-subtle">لا توجد إشعارات بعد. ستظهر هنا عند وصول طلب أو تقييم جديد.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setProfileOpen((v) => !v); setNotificationsOpen(false); }}
                  className="flex items-center gap-1.5 rounded-brand border border-line bg-card p-1.5 ps-2 text-ink-soft transition hover:bg-surface"
                  aria-label={`حساب ${accountRole}`}
                >
                  <span className="hidden max-w-28 truncate text-[11px] font-semibold sm:inline">{accountEmail}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-subtle" />
                </button>
                {profileOpen ? (
                  <div className="surface-popover absolute end-0 top-full z-40 mt-2 w-56 p-1.5">
                    <div className="border-b border-line px-3 py-2.5">
                      <div className="truncate text-[11px] font-bold text-ink">{accountName || accountEmail}</div>
                      <div className="mt-0.5 truncate text-[10px] text-subtle">{accountEmail} · {accountRole}</div>
                    </div>
                    {can("settings.write") ? (
                      <Link href="/dashboard/settings" className="mt-1 flex items-center gap-2 rounded-brand-sm px-3 py-2 text-[11px] text-ink-soft hover:bg-surface hover:text-ink"><Settings className="h-3.5 w-3.5" /> إعدادات المتجر</Link>
                    ) : null}
                    <Link href="/dashboard/learn" className="flex items-center gap-2 rounded-brand-sm px-3 py-2 text-[11px] text-ink-soft hover:bg-surface hover:text-ink"><GraduationCap className="h-3.5 w-3.5" /> الدليل السريع</Link>
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-brand-sm px-3 py-2 text-[11px] text-danger hover:bg-danger-soft"><LogOut className="h-3.5 w-3.5" /> تسجيل الخروج</button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
            <StoreApprovalGate status={store.status} reason={store.statusReason} />
            {store.status === "active" && publishStatus !== "published" ? (
              <div className="mb-4">
                <Alert
                  tone={publishStatus === "suspended" ? "error" : "warning"}
                  title={publishStatus === "suspended" ? "نشر المتجر موقوف" : "متجرك معتمد لكنه غير منشور"}
                >
                  <div className="space-y-1.5">
                    <p>
                      {publishStatus === "suspended"
                        ? "أوقف فريق سند نشر الواجهة، ولا تظهر منتجاتك للعملاء حالياً."
                        : "واجهة المتجر لا تظهر للعملاء حتى تنشرها. المنتجات والطلبات تبقى محفوظة."}
                    </p>
                    {publishReason ? <p className="text-[11px] font-semibold">السبب: {publishReason}</p> : null}
                    {canManagePublishing ? (
                      <Link href="/dashboard/settings" className="inline-flex font-bold underline underline-offset-2">
                        فتح إعدادات النشر
                      </Link>
                    ) : (
                      <p className="text-[11px]">دورك الحالي لا يسمح بتغيير النشر. اطلب من مالك المتجر أو مدير إعادة النشر.</p>
                    )}
                  </div>
                </Alert>
              </div>
            ) : null}
            {teamMember?.status === "invited" ? (
              <div className="mb-4">
                <Alert tone="info" title="دعوة فريق غير مكتملة">
                  أكمل تفعيل الدعوة من رابط البريد لتثبيت الوصول. حتى ذلك الحين تُطبق صلاحيات دورك الحالي.
                </Alert>
              </div>
            ) : null}
            {store.status === "active" ? children : null}
          </main>

          {/* Mobile bottom navigation */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
            <div className="grid grid-cols-4">
              {BOTTOM_NAV.filter((item) => can(navPermission(item.path))).map((item) => {
                const active = matches(path, item.path);
                const Icon = item.icon;
                return (
                  <Link key={item.path} href={item.path} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 py-2.5 text-xs font-semibold", active ? "text-brand" : "text-subtle")}>
                    <Icon className="h-4.5 w-4.5" />
                    {item.label}
                  </Link>
                );
              })}
              <button type="button" aria-label="فتح المزيد من أقسام لوحة التحكم" onClick={() => setDrawerOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-1 py-2.5 text-xs font-semibold text-subtle">
                <Menu className="h-4.5 w-4.5" />
                المزيد
              </button>
            </div>
          </nav>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}

export { NAV_ITEMS };
