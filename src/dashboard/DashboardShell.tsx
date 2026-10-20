import React, { createContext, useContext, useEffect, useState } from "react";
import {
  BadgePercent,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Boxes,
  ChevronDown,
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
  Palette,
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
import { api, mediaUrl } from "../lib/api";
import { safeError, timeAgo } from "../lib/format";
import { Link, navigate, usePath } from "../lib/router";
import { useSession } from "../lib/session";
import { useTheme, ThemeToggle } from "../lib/theme";
import { BrandLogo } from "../components/Brand";
import { Badge, Spinner, cn, useToast } from "../components/ui";

export interface DashboardContextValue {
  store: any;
  subdomain: string;
  section: string;
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
    label: "المحتوى والتصميم",
    items: [
      { label: "التصميم", path: "/dashboard/design", icon: Palette },
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
      { label: "مركز التعلم", path: "/dashboard/learn", icon: GraduationCap },
    ],
  },
];

// Flattened for counting, mobile navigation and page titles. The product
// requirement is 22 destinations; every one of them is a real route.
const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));

const BOTTOM_NAV = [
  { label: "الرئيسية", path: "/dashboard", icon: LayoutDashboard },
  { label: "الطلبات", path: "/dashboard/orders", icon: ShoppingCart },
  { label: "المنتجات", path: "/dashboard/products", icon: Package },
  { label: "التقارير", path: "/dashboard/reports", icon: BarChart3 },
];

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
  const { session, loading, logout } = useSession();
  const { theme } = useTheme();
  const path = usePath();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  const store = session?.store;
  const subdomain = store?.subdomain ?? "";
  const section = pageTitle(path);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate(`/auth/login?next=${encodeURIComponent(path)}`, { replace: true });
      return;
    }
    if (!session.store) navigate("/onboarding", { replace: true });
    else if (!session.store.onboardingCompleted && path === "/dashboard") {
      // Dashboard remains usable while the store is a draft; the banner below
      // explains why the public link is not live yet. No forced redirect loop.
    }
  }, [loading, session, path]);

  const loadNotifications = async () => {
    if (!subdomain) return;
    try {
      const result = await api.dashboard.notifications(subdomain);
      setNotifications(result.notifications);
      setUnread(result.unread);
    } catch {
      // A failed notification poll must not interrupt the page the merchant is
      // working on; the bell simply stays at its last known state.
    }
  };

  useEffect(() => {
    if (!subdomain) return;
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 60_000);
    return () => window.clearInterval(timer);
  }, [subdomain]);

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
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="pt-3">
          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">{group.label}</div>
          {group.items.map((item) => {
            const active = matches(path, item.path);
            const Icon = item.icon;
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
                {active ? <span className="ms-auto h-1.5 w-1.5 rounded-full bg-brand" /> : null}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-4 rounded-brand border border-line bg-surface p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-soft"><BookOpen className="h-3 w-3 text-brand" /> تحتاج مساعدة؟</div>
        <Link href="/dashboard/learn" className="mt-1.5 block text-[11px] leading-5 text-subtle hover:text-ink">
          أدلة إعداد المتجر والطلبات والشحن داخل مركز التعلم.
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

  const storeInitial = (store.storeName ?? "س").trim().charAt(0);

  return (
    <DashboardContext.Provider value={{ store, subdomain, section }}>
      <div dir="rtl" data-theme={theme} className="min-h-screen bg-canvas font-arabic text-ink">
        {/* Desktop right sidebar (RTL start edge). */}
        <aside className="fixed inset-y-0 start-0 z-40 hidden w-[272px] border-e border-line bg-card lg:flex lg:flex-col">
          <div className="flex h-[72px] items-center justify-between border-b border-line px-4">
            <Link href="/dashboard" aria-label="سند"><BrandLogo size="sm" showTagline={false} /></Link>
            <Badge tone="border-brand-line bg-brand-soft text-brand">تاجر</Badge>
          </div>

          <div className="border-b border-line p-3">
            <Link href={`/store/${subdomain}`} target="_blank" className="group flex items-center gap-2.5 rounded-brand border border-line bg-surface p-2.5 transition hover:border-brand-line">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-brand-sm bg-brand text-sm font-bold text-on-brand">
                {store.logoUrl ? <img src={mediaUrl(store.logoUrl)} alt="" className="h-full w-full object-cover" /> : storeInitial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-ink">{store.storeName}</div>
                <div className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-subtle" dir="ltr">
                  /store/{subdomain}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-subtle group-hover:text-brand" />
            </Link>
            {!store.onboardingCompleted ? (
              <Link href="/onboarding" className="mt-2 flex items-center justify-between rounded-brand-sm border border-warning-line bg-warning-soft px-2.5 py-1.5 text-[10px] font-semibold text-warning">
                <span>المتجر مسودة — أكمل التهيئة</span>
                <span>←</span>
              </Link>
            ) : null}
          </div>

          <div className="min-h-0 flex-1">{nav}</div>

          <div className="border-t border-line p-3">
            <div className="flex items-center gap-2 rounded-brand px-2 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-ink-soft">
                {(session.merchant?.first_name || session.merchant?.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-ink">
                  {[session.merchant?.first_name, session.merchant?.last_name].filter(Boolean).join(" ") || session.merchant?.email}
                </div>
                <div className="truncate text-[10px] text-subtle">{session.merchant?.email}</div>
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
                <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">/store/{subdomain}</div>
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
                href={`/store/${subdomain}`}
                target="_blank"
                className="hidden items-center gap-1.5 rounded-brand border border-line bg-card px-3 py-2 text-[11px] font-semibold text-ink-soft transition hover:border-brand-line hover:text-brand sm:flex"
              >
                <Store className="h-3.5 w-3.5 text-brand" />
                عرض المتجر
              </Link>

              <ThemeToggle compact />

              <div className="relative">
                <button
                  onClick={() => { setNotificationsOpen((v) => !v); setProfileOpen(false); }}
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
                  aria-label="حساب التاجر"
                >
                  <span className="hidden max-w-28 truncate text-[11px] font-semibold sm:inline">{session.merchant?.email}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-subtle" />
                </button>
                {profileOpen ? (
                  <div className="surface-popover absolute end-0 top-full z-40 mt-2 w-56 p-1.5">
                    <div className="border-b border-line px-3 py-2.5">
                      <div className="truncate text-[11px] font-bold text-ink">{session.merchant?.email}</div>
                      <div className="mt-0.5 text-[10px] text-subtle">{store.storeName}</div>
                    </div>
                    <Link href="/dashboard/settings" className="mt-1 flex items-center gap-2 rounded-brand-sm px-3 py-2 text-[11px] text-ink-soft hover:bg-surface hover:text-ink"><Settings className="h-3.5 w-3.5" /> إعدادات المتجر</Link>
                    <Link href="/dashboard/learn" className="flex items-center gap-2 rounded-brand-sm px-3 py-2 text-[11px] text-ink-soft hover:bg-surface hover:text-ink"><GraduationCap className="h-3.5 w-3.5" /> مركز التعلم</Link>
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-brand-sm px-3 py-2 text-[11px] text-danger hover:bg-danger-soft"><LogOut className="h-3.5 w-3.5" /> تسجيل الخروج</button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {!store.onboardingCompleted ? (
            <div className="border-b border-warning-line bg-warning-soft px-4 py-2.5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-warning">متجرك لم يُنشر بعد. العملاء لن يروه في نتائج البحث حتى تنشر صفحة البيع.</span>
                <Link href="/onboarding" className="font-bold text-warning underline-offset-4 hover:underline">أكمل التهيئة والنشر ←</Link>
              </div>
            </div>
          ) : null}

          <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 lg:pb-10">{children}</main>

          {/* Mobile bottom navigation */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
            <div className="grid grid-cols-5">
              {BOTTOM_NAV.map((item) => {
                const active = matches(path, item.path);
                const Icon = item.icon;
                return (
                  <Link key={item.path} href={item.path} className={cn("flex flex-col items-center gap-1 py-2.5 text-[9px] font-semibold", active ? "text-brand" : "text-subtle")}>
                    <Icon className="h-4.5 w-4.5" />
                    {item.label}
                  </Link>
                );
              })}
              <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[9px] font-semibold text-subtle">
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
