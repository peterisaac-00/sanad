import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  Compass,
  Home,
  LayoutGrid,
  Menu,
  MessageCircle,
  Search,
  ShoppingBag,
  Store,
  Truck,
  X,
} from "lucide-react";
import { api, mediaUrl } from "../lib/api";
import { money } from "../lib/format";
import { Link, navigate, usePath } from "../lib/router";
import { useAsync } from "../lib/useAsync";
import { cn } from "../components/ui";
import { StorefrontProvider, useStorefront } from "./StorefrontContext";
import { StorefrontHomePage } from "./StorefrontHomePage";
import { StorefrontCategoriesPage } from "./StorefrontCategoriesPage";
import { StorefrontProductPage, StorefrontProductsPage } from "./StorefrontProductsPages";
import { StorefrontCartPage, StorefrontCheckoutPage, StorefrontOrderPage, StorefrontTrackPage } from "./StorefrontCheckoutPages";
import { StorefrontBlogPage, StorefrontBlogPostPage, StorefrontNotFoundPage, StorefrontPageView } from "./StorefrontContentPages";
import { SearchBar } from "./StorefrontUI";

/* ---------------------------------- shell --------------------------------- */

function StoreLogo({ size = "md", onDark = false }: { size?: "sm" | "md" | "lg"; onDark?: boolean }) {
  const { store, theme } = useStorefront();
  const name = store.store_name || "المتجر";
  const logo = store.logo_url || "";
  const sizes = { sm: "h-8 w-8 rounded-lg text-xs", md: "h-10 w-10 rounded-xl text-sm", lg: "h-16 w-16 rounded-2xl text-xl" };
  return (
    <span className="flex items-center gap-2.5">
      {logo ? (
        <img src={mediaUrl(logo)} alt={name} className={cn("shrink-0 object-cover", sizes[size])} />
      ) : (
        <span
          className={cn("flex shrink-0 items-center justify-center font-bold text-white shadow-sm", sizes[size])}
          style={{ background: theme.primary }}
        >
          {name.trim().charAt(0) || "س"}
        </span>
      )}
      <span className="min-w-0">
        <span className={cn("block truncate font-heading font-extrabold leading-tight", onDark ? "text-white" : theme.heading, size === "lg" ? "text-xl" : "text-sm sm:text-base")}>
          {name}
        </span>
        {size !== "sm" ? (
          <span className={cn("block truncate text-[10px]", onDark ? "text-white/70" : theme.muted)}>متجر إلكتروني</span>
        ) : null}
      </span>
    </span>
  );
}

function headerNotice() {
  const { zones, payments, currency, store } = useStorefront();
  const threshold = zones
    .map((zone: any) => Number(zone.free_shipping_threshold))
    .filter((value: number) => Number.isFinite(value) && value > 0)
    .sort((a: number, b: number) => a - b)[0];
  if (threshold) return `شحن مجاني للطلبات فوق ${money(threshold, currency)}`;
  if (payments.cod_enabled) return `الدفع عند الاستلام متاح · توصيل منظم إلى بابك`;
  if (store.support_email) return `للتواصل والاستفسار: ${store.support_email}`;
  return "مرحباً بك في متجرنا";
}

function StorefrontHeader() {
  const { base, store, theme, cartCount, published } = useStorefront();
  const path = usePath();
  const [menuOpen, setMenuOpen] = useState(false);
  const rest = path === base ? "/" : path.startsWith(`${base}/`) ? path.slice(base.length) : "/";
  const whatsapp = store.whatsapp_url || "";
  const nav = [
    { href: base, label: "الرئيسية", icon: Home, active: rest === "/" },
    { href: `${base}/products`, label: "المنتجات", icon: ShoppingBag, active: rest === "/products" || rest.startsWith("/products/") },
    { href: `${base}/categories`, label: "الأقسام", icon: LayoutGrid, active: rest === "/categories" || rest.startsWith("/categories/") },
    { href: `${base}/blog`, label: "المدونة", icon: Compass, active: rest === "/blog" || rest.startsWith("/blog/") },
  ];

  useEffect(() => setMenuOpen(false), [path]);

  return (
    <header className="sticky top-0 z-40">
      {published ? (
        <div className="text-white" style={{ background: theme.primary }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-[10px] font-semibold sm:px-6">
            <span className="flex items-center gap-1.5"><Truck className="h-3 w-3" /> {headerNotice()}</span>
            <div className="flex items-center gap-3">
              <Link href={`${base}/track`} className="hidden hover:opacity-80 sm:inline">تتبع طلبك</Link>
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:opacity-80">
                  <MessageCircle className="h-3 w-3" /> واتساب
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={cn("border-b backdrop-blur-md", theme.dark ? "border-white/10 bg-[#070b13]/90" : "border-slate-200 bg-white/90")}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href={base} aria-label={store.store_name} className="min-w-0 shrink-0">
            <StoreLogo />
          </Link>

          {published ? (
            <nav className={cn("ms-4 hidden items-center gap-5 text-xs font-semibold lg:flex", theme.navLink)}>
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("relative py-2 transition", item.active && "font-bold")}
                  style={item.active ? { color: theme.primary } : undefined}
                >
                  {item.label}
                  {item.active ? <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-0.5 w-5 rounded-full" style={{ background: theme.primary }} /> : null}
                </Link>
              ))}
            </nav>
          ) : (
            <span className={cn("ms-3 rounded-full border px-2.5 py-1 text-[10px] font-bold", theme.border, theme.muted)}>
              قيد التجهيز
            </span>
          )}

          <div className="ms-auto flex items-center gap-2">
            {published ? (
              <div className="hidden w-56 xl:block">
                <SearchBar compact onSubmit={(value) => navigate(`${base}/products${value ? `?search=${encodeURIComponent(value)}` : ""}`)} />
              </div>
            ) : null}
            {published ? (
              <Link
                href={`${base}/cart`}
                className={cn("relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition", theme.border, theme.navLink)}
                aria-label="سلة التسوق"
              >
                <ShoppingBag className="h-4 w-4" />
                {cartCount > 0 ? (
                  <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: theme.primary }}>
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl border transition lg:hidden", theme.border, theme.navLink)}
              aria-label="القائمة"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className={cn("border-t px-4 py-3 lg:hidden", theme.border)}>
            {published ? (
              <>
                <div className="mb-3">
                  <SearchBar compact onSubmit={(value) => navigate(`${base}/products${value ? `?search=${encodeURIComponent(value)}` : ""}`)} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {nav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold", theme.soft, item.active ? theme.heading : theme.muted)}
                      >
                        <Icon className="h-4 w-4" /> {item.label}
                      </Link>
                    );
                  })}
                  <Link href={`${base}/cart`} className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold", theme.soft, theme.heading)}>
                    <ShoppingBag className="h-4 w-4" /> السلة {cartCount ? `(${cartCount})` : ""}
                  </Link>
                  <Link href={`${base}/track`} className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold", theme.soft, theme.muted)}>
                    <Search className="h-4 w-4" /> تتبع الطلب
                  </Link>
                </div>
                {store.whatsapp_url ? (
                  <a
                    href={store.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-bold text-emerald-500"
                  >
                    <MessageCircle className="h-4 w-4" /> تواصل على واتساب
                  </a>
                ) : null}
              </>
            ) : (
              <div className={cn("text-[11px] leading-6", theme.muted)}>
                هذا المتجر قيد التجهيز ولم يُنشر بعد. تابعنا قريباً.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function StorefrontFooter() {
  const { base, store, pages, theme, payments } = useStorefront();
  const year = new Date().getFullYear();
  const whatsapp = store.whatsapp_url || "";
  return (
    <footer className={cn("mt-10 border-t", theme.border, theme.dark ? "bg-[#050810]" : "bg-white")}>
      <div className="mx-auto grid max-w-6xl gap-7 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <StoreLogo />
          <p className={cn("max-w-sm text-[11px] leading-6", theme.muted)}>
            {store.description || `تسوّق منتجات ${store.store_name} مع خيارات توصيل واضحة ودفع عند الاستلام.`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {payments.cod_enabled ? (
              <span className={cn("rounded-full border px-2 py-1 text-[9px] font-semibold", theme.border, theme.muted)}>دفع عند الاستلام</span>
            ) : null}
            {payments.online_enabled ? (
              <span className={cn("rounded-full border px-2 py-1 text-[9px] font-semibold", theme.border, theme.muted)}>دفع إلكتروني</span>
            ) : null}
            {store.currency ? (
              <span className={cn("rounded-full border px-2 py-1 text-[9px] font-semibold", theme.border, theme.muted)}>{store.currency}</span>
            ) : null}
          </div>
        </div>

        <div>
          <div className={cn("mb-3 text-xs font-bold", theme.heading)}>التسوق</div>
          <ul className={cn("space-y-2 text-[11px]", theme.muted)}>
            <li><Link href={`${base}/products`} className="hover:opacity-80">كل المنتجات</Link></li>
            <li><Link href={`${base}/categories`} className="hover:opacity-80">الأقسام</Link></li>
            <li><Link href={`${base}/cart`} className="hover:opacity-80">سلة التسوق</Link></li>
            <li><Link href={`${base}/track`} className="hover:opacity-80">تتبع الطلب</Link></li>
            <li><Link href={`${base}/blog`} className="hover:opacity-80">المدونة</Link></li>
          </ul>
        </div>

        <div>
          <div className={cn("mb-3 text-xs font-bold", theme.heading)}>معلومات المتجر</div>
          <ul className={cn("space-y-2 text-[11px]", theme.muted)}>
            {pages.slice(0, 6).map((page: any) => (
              <li key={page.id}>
                <Link href={`${base}/pages/${encodeURIComponent(page.slug)}`} className="hover:opacity-80">{page.title}</Link>
              </li>
            ))}
            {!pages.length ? <li>لا توجد صفحات منشورة بعد.</li> : null}
          </ul>
        </div>

        <div>
          <div className={cn("mb-3 text-xs font-bold", theme.heading)}>تواصل معنا</div>
          <ul className={cn("space-y-2 text-[11px]", theme.muted)}>
            {whatsapp ? (
              <li>
                <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-emerald-500 hover:opacity-80">
                  <MessageCircle className="h-3.5 w-3.5" /> واتساب المتجر
                </a>
              </li>
            ) : null}
            {store.support_email ? (
              <li>
                <a href={`mailto:${store.support_email}`} className="hover:opacity-80" dir="ltr">{store.support_email}</a>
              </li>
            ) : null}
            {store.return_policy ? <li className="leading-5">الاسترجاع: {store.return_policy}</li> : null}
            {!whatsapp && !store.support_email ? <li>قنوات التواصل ستظهر هنا عند إضافتها.</li> : null}
          </ul>
        </div>
      </div>

      <div className={cn("border-t", theme.border)}>
        <div className={cn("mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[10px] sm:px-6", theme.muted)}>
          <span>© {year} {store.store_name}. جميع الحقوق محفوظة.</span>
          <Link href="/" className="inline-flex items-center gap-1 hover:opacity-80">
            مدعوم بواسطة سند للتجارة <ChevronLeft className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </footer>
  );
}

function FloatingWhatsApp() {
  const { store } = useStorefront();
  if (!store.whatsapp_url) return null;
  return (
    <a
      href={store.whatsapp_url}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 start-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl transition hover:bg-emerald-600"
      aria-label="تواصل عبر واتساب"
    >
      <MessageCircle className="h-5 w-5" />
    </a>
  );
}

function ComingSoon() {
  const { store, theme, base } = useStorefront();
  const cover = store.cover_url || "";
  const whatsapp = store.whatsapp_url || "";
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <div className={cn("overflow-hidden rounded-3xl border", theme.panel)}>
        <div className="relative min-h-56 overflow-hidden">
          {cover ? (
            <img src={mediaUrl(cover)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 20% 20%, ${theme.primary}66, transparent 55%), #0b1220` }}
            />
          )}
          <div className="absolute inset-0 bg-slate-950/65" />
          <div className="relative flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
            <StoreLogo size="lg" onDark />
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">
              المتجر قيد التجهيز
            </span>
            <h1 className="font-heading text-2xl font-extrabold text-white sm:text-3xl">{store.store_name}</h1>
          </div>
        </div>
        <div className="space-y-4 p-6 text-center sm:p-8">
          <p className={cn("mx-auto max-w-lg text-sm leading-7", theme.muted)}>
            {store.description || "يعمل المتجر على تجهيز منتجاته وصفحاته. سيظهر للعملاء بمجرد نشر التاجر للمتجر من لوحة التحكم."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white"
                style={{ background: theme.primary }}
              >
                <MessageCircle className="h-4 w-4" /> تواصل مع المتجر
              </a>
            ) : null}
            <Link href="/" className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold", theme.border)}>
              <Store className="h-4 w-4" /> العودة إلى سند
            </Link>
            <Link href="/dashboard" className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold", theme.border)}>
              <ArrowLeft className="h-4 w-4" /> إدارة المتجر
            </Link>
          </div>
          <p className={cn("text-[10px]", theme.muted)}>
            رابط المتجر: <span dir="ltr" className="font-mono">{base}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function StorefrontRoutes() {
  const path = usePath();
  const { base, published } = useStorefront();
  const rest = path === base ? "/" : path.startsWith(`${base}/`) ? path.slice(base.length) : "/";

  if (!published) return <ComingSoon />;

  if (rest === "/") return <StorefrontHomePage />;
  if (rest === "/products") return <StorefrontProductsPage />;
  if (rest.startsWith("/products/")) {
    return <StorefrontProductPage slug={decodeURIComponent(rest.slice("/products/".length))} />;
  }
  if (rest === "/categories") return <StorefrontCategoriesPage />;
  if (rest.startsWith("/categories/")) {
    return <StorefrontProductsPage categorySlug={decodeURIComponent(rest.slice("/categories/".length))} />;
  }
  if (rest === "/cart") return <StorefrontCartPage />;
  if (rest === "/checkout") return <StorefrontCheckoutPage />;
  if (rest === "/track") return <StorefrontTrackPage />;
  if (rest.startsWith("/order/")) {
    const orderNumber = rest.slice("/order/".length);
    if (/^\d+$/.test(orderNumber)) return <StorefrontOrderPage orderNumber={orderNumber} />;
    return <StorefrontNotFoundPage />;
  }
  if (rest === "/blog") return <StorefrontBlogPage />;
  if (rest.startsWith("/blog/")) return <StorefrontBlogPostPage slug={decodeURIComponent(rest.slice("/blog/".length))} />;
  if (rest.startsWith("/pages/")) return <StorefrontPageView slug={decodeURIComponent(rest.slice("/pages/".length))} />;
  return <StorefrontNotFoundPage />;
}

function StorefrontShell() {
  return (
    <>
      <StorefrontHeader />
      <main className="min-h-[55vh]">
        <StorefrontRoutes />
      </main>
      <StorefrontFooter />
      <FloatingWhatsApp />
    </>
  );
}

/* --------------------------------- loading -------------------------------- */

function StorefrontLoading() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#070b13] px-4 py-16 text-slate-300">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-white/5" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

function StorefrontUnavailable({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#070b13] p-5 text-slate-200">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
          <Store className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-xl font-bold text-white">المتجر غير متاح</h1>
        <p className="mt-2 text-xs leading-6 text-slate-400">{message}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <button type="button" onClick={onRetry} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white">
              إعادة المحاولة
            </button>
          ) : null}
          <Link href="/" className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-slate-200">
            العودة إلى سند
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- root ---------------------------------- */

export function StorefrontApp({ subdomain }: { subdomain: string }) {
  const result = useAsync(() => api.storefront.get(subdomain), [subdomain]);

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);

  const errorMessage = useMemo(() => {
    const err = result.error as any;
    if (!err) return "";
    if (err.status === 404 || err.code === "STORE_NOT_FOUND") {
      return "هذا المتجر غير موجود أو تم إيقافه. تحقق من الرابط أو تواصل مع صاحب المتجر.";
    }
    return "تعذر تحميل المتجر حالياً. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.";
  }, [result.error]);

  if (result.loading && !result.data) return <StorefrontLoading />;
  if (result.error || !result.data) {
    return <StorefrontUnavailable message={errorMessage} onRetry={result.error ? result.reload : undefined} />;
  }

  return (
    <StorefrontProvider subdomain={subdomain} data={result.data} reload={result.reload}>
      <StorefrontShell />
    </StorefrontProvider>
  );
}
