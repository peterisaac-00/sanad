import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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
import { BrandLogo } from "../components/Brand";
import { Badge, Button, Spinner, cn, useToast } from "../components/ui";

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
          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{group.label}</div>
          {group.items.map((item) => {
            const active = matches(path, item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition",
                  active
                    ? "bg-blue-500/12 text-blue-100 ring-1 ring-inset ring-blue-500/25"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                )}
              >
                <span className={cn("rounded-lg p-1.5", active ? "bg-blue-500/15 text-blue-300" : "text-slate-500 group-hover:text-slate-300")}>
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
                {active ? <span className="ms-auto h-1.5 w-1.5 rounded-full bg-blue-400" /> : null}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><BookOpen className="h-3 w-3 text-blue-400" /> تحتاج مساعدة؟</div>
        <Link href="/dashboard/learn" className="mt-1.5 block text-[11px] leading-5 text-slate-500 hover:text-slate-300">
          أدلة إعداد المتجر والطلبات والشحن داخل مركز التعلم.
        </Link>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060a13]">
        <Spinner label="جارٍ تحميل لوحة التحكم…" />
      </div>
    );
  }

  if (!session?.store) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060a13]">
        <Spinner label="جارٍ تجهيز متجرك…" />
      </div>
    );
  }

  const storeInitial = (store.storeName ?? "س").trim().charAt(0);

  return (
    <DashboardContext.Provider value={{ store, subdomain, section }}>
      <div dir="rtl" className="min-h-screen bg-[#060a13] font-arabic text-slate-100">
        <div className="pointer-events-none fixed inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)", backgroundSize: "64px 64px" }} />

        {/* Desktop right sidebar (RTL start edge). */}
        <aside className="fixed inset-y-0 start-0 z-40 hidden w-[268px] border-e border-white/[0.06] bg-[#080d17]/95 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex h-[68px] items-center justify-between border-b border-white/[0.06] px-4">
            <Link href="/dashboard" aria-label="سند"><BrandLogo size="sm" /></Link>
            <Badge tone="border-blue-500/25 bg-blue-500/10 text-blue-200">تاجر</Badge>
          </div>

          <div className="border-b border-white/[0.06] p-3">
            <Link href={`/store/${subdomain}`} target="_blank" className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 transition hover:border-blue-500/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-600 text-sm font-bold text-white">
                {store.logoUrl ? <img src={mediaUrl(store.logoUrl)} alt="" className="h-full w-full object-cover" /> : storeInitial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-white">{store.storeName}</div>
                <div className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-slate-500" dir="ltr">
                  /store/{subdomain}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-slate-600 group-hover:text-blue-400" />
            </Link>
            {!store.onboardingCompleted ? (
              <Link href="/onboarding" className="mt-2 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-2.5 py-1.5 text-[10px] font-semibold text-amber-200">
                <span>المتجر مسودة — أكمل التهيئة</span>
                <span>←</span>
              </Link>
            ) : null}
          </div>

          <div className="min-h-0 flex-1">{nav}</div>

          <div className="border-t border-white/[0.06] p-3">
            <div className="flex items-center gap-2 rounded-xl px-2 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300">
                {(session.merchant?.first_name || session.merchant?.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-slate-200">
                  {[session.merchant?.first_name, session.merchant?.last_name].filter(Boolean).join(" ") || session.merchant?.email}
                </div>
                <div className="truncate text-[10px] text-slate-600">{session.merchant?.email}</div>
              </div>
              <button onClick={handleLogout} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-300" title="تسجيل الخروج">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute inset-y-0 start-0 flex w-[286px] flex-col border-e border-white/10 bg-[#080d17]">
              <div className="flex h-[68px] items-center justify-between border-b border-white/10 px-4">
                <BrandLogo size="sm" />
                <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800" aria-label="إغلاق القائمة">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="border-b border-white/10 p-3">
                <div className="text-xs font-bold text-white">{store.storeName}</div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-500" dir="ltr">/store/{subdomain}</div>
              </div>
              <div className="min-h-0 flex-1">{nav}</div>
            </aside>
          </div>
        ) : null}

        <div className="lg:ps-[268px]">
          <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#060a13]/85 backdrop-blur-xl">
            <div className="flex h-[68px] items-center gap-2 px-4 sm:px-6">
              <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden" aria-label="فتح القائمة">
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <span>لوحة التحكم</span>
                  <span>/</span>
                  <span className="text-slate-400">{section}</span>
                </div>
                <h1 className="truncate font-heading text-base font-bold text-white sm:text-lg">{section}</h1>
              </div>

              <Link
                href={`/store/${subdomain}`}
                target="_blank"
                className="hidden items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-blue-500/40 hover:text-white sm:flex"
              >
                <Store className="h-3.5 w-3.5 text-blue-400" />
                عرض المتجر
              </Link>

              <div className="relative">
                <button
                  onClick={() => { setNotificationsOpen((v) => !v); setProfileOpen(false); }}
                  className="relative rounded-lg border border-slate-800 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  aria-label="الإشعارات"
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 ? <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span> : null}
                </button>
                {notificationsOpen ? (
                  <div className="absolute end-0 top-full z-40 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white"><BellRing className="h-3.5 w-3.5 text-blue-400" /> الإشعارات</div>
                      {unread > 0 ? <button onClick={markAllRead} className="text-[10px] font-semibold text-blue-400 hover:text-blue-300">تعليم الكل كمقروء</button> : null}
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
                          className={cn("block w-full border-b border-slate-800/60 px-3.5 py-3 text-start transition hover:bg-slate-800/50", !n.read && "bg-blue-500/[0.04]")}
                        >
                          <div className="flex items-start gap-2">
                            <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-slate-700" : "bg-blue-400")} />
                            <div className="min-w-0">
                              <div className="truncate text-[11px] font-semibold text-slate-200">{n.title}</div>
                              {n.body ? <div className="mt-0.5 line-clamp-2 text-[10px] leading-5 text-slate-500">{n.body}</div> : null}
                              <div className="mt-1 text-[9px] text-slate-600">{timeAgo(n.createdAt)}</div>
                            </div>
                          </div>
                        </button>
                      )) : (
                        <div className="px-4 py-10 text-center text-[11px] text-slate-500">لا توجد إشعارات بعد. ستظهر هنا عند وصول طلب أو تقييم جديد.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setProfileOpen((v) => !v); setNotificationsOpen(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 p-1.5 ps-2 text-slate-300 transition hover:bg-slate-800"
                  aria-label="حساب التاجر"
                >
                  <span className="hidden max-w-28 truncate text-[11px] font-semibold sm:inline">{session.merchant?.email}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                </button>
                {profileOpen ? (
                  <div className="absolute end-0 top-full z-40 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
                    <div className="border-b border-slate-800 px-3 py-2.5">
                      <div className="truncate text-[11px] font-bold text-white">{session.merchant?.email}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{store.storeName}</div>
                    </div>
                    <Link href="/dashboard/settings" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-800"><Settings className="h-3.5 w-3.5" /> إعدادات المتجر</Link>
                    <Link href="/dashboard/learn" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-800"><GraduationCap className="h-3.5 w-3.5" /> مركز التعلم</Link>
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-rose-300 hover:bg-rose-500/10"><LogOut className="h-3.5 w-3.5" /> تسجيل الخروج</button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {!store.onboardingCompleted ? (
            <div className="border-b border-amber-500/15 bg-amber-500/[0.05] px-4 py-2.5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-amber-100">متجرك لم يُنشر بعد. العملاء لن يروه في نتائج البحث حتى تنشر صفحة البيع.</span>
                <Link href="/onboarding" className="font-bold text-amber-300 hover:text-amber-200">أكمل التهيئة والنشر ←</Link>
              </div>
            </div>
          ) : null}

          <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 lg:pb-10">{children}</main>

          {/* Mobile bottom navigation */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#080d17]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
            <div className="grid grid-cols-5">
              {BOTTOM_NAV.map((item) => {
                const active = matches(path, item.path);
                const Icon = item.icon;
                return (
                  <Link key={item.path} href={item.path} className={cn("flex flex-col items-center gap-1 py-2.5 text-[9px] font-semibold", active ? "text-blue-400" : "text-slate-500")}>
                    <Icon className="h-4.5 w-4.5" />
                    {item.label}
                  </Link>
                );
              })}
              <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[9px] font-semibold text-slate-500">
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
