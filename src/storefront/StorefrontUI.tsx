import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgePercent,
  Check,
  ImageOff,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Tag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { mediaUrl } from "../lib/api";
import { money } from "../lib/format";
import { Link } from "../lib/router";
import { cn } from "../components/ui";
import { useStorefront } from "./StorefrontContext";

/* ---------------------------------- SEO ---------------------------------- */

/**
 * Keeps the document title, description and social tags in sync with the
 * active storefront screen. Values are restored when leaving the screen so a
 * merchant's marketing site never inherits a product's metadata.
 */
export function useStorefrontSeo(input: {
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
  noindex?: boolean;
}) {
  const { title, description, image, canonical, noindex } = input;
  useEffect(() => {
    if (!title && !description) return;
    const previousTitle = document.title;
    const tags: Array<{ tag: HTMLMetaElement; content: string | null }> = [];
    const apply = (attribute: "name" | "property", key: string, content?: string) => {
      if (!content) return;
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      const existed = Boolean(tag);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attribute, key);
        document.head.appendChild(tag);
      }
      tags.push({ tag, content: existed ? tag.getAttribute("content") : null });
      tag.setAttribute("content", content);
    };

    if (title) document.title = title;
    apply("name", "description", description);
    apply("property", "og:title", title);
    apply("property", "og:description", description);
    apply("property", "og:image", image ? mediaUrl(image) : undefined);
    apply("name", "twitter:title", title);
    apply("name", "twitter:description", description);
    if (noindex) apply("name", "robots", "noindex, nofollow");

    let previousCanonical: string | null = null;
    let canonicalTag: HTMLLinkElement | null = null;
    if (canonical) {
      canonicalTag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      previousCanonical = canonicalTag?.getAttribute("href") ?? null;
      if (!canonicalTag) {
        canonicalTag = document.createElement("link");
        canonicalTag.rel = "canonical";
        document.head.appendChild(canonicalTag);
      }
      canonicalTag.href = canonical;
    }

    return () => {
      document.title = previousTitle;
      for (const entry of tags) {
        if (entry.content === null) entry.tag.remove();
        else entry.tag.setAttribute("content", entry.content);
      }
      if (canonicalTag) {
        if (previousCanonical === null) canonicalTag.remove();
        else canonicalTag.href = previousCanonical;
      }
    };
  }, [title, description, image, canonical, noindex]);
}

export function useJsonLd(id: string, data: unknown) {
  const serialized = useMemo(() => JSON.stringify(data), [data]);
  useEffect(() => {
    let script = document.getElementById(id) as HTMLScriptElement | null;
    const created = !script;
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = serialized;
    return () => {
      if (created) script?.remove();
    };
  }, [id, serialized]);
}

/* -------------------------------- primitives ------------------------------ */

export function Stars({ rating, className }: { rating: number; className?: string }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          className={cn(
            "h-3.5 w-3.5",
            index <= Math.round(value) ? "fill-warning text-warning" : "text-line"
          )}
        />
      ))}
    </span>
  );
}

export function Price({
  value,
  compareAt,
  currency,
  size = "md",
}: {
  value: number;
  compareAt?: number | null;
  currency: string;
  size?: "sm" | "md" | "lg";
}) {
  const compare = Number(compareAt ?? 0);
  const hasDiscount = compare > value && value > 0;
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-2xl" };
  return (
    <span className="flex flex-wrap items-baseline gap-2">
      <span className={cn("font-bold tabular-nums", sizes[size])}>{money(value, currency)}</span>
      {hasDiscount ? (
        <span className={cn("text-subtle line-through", size === "lg" ? "text-sm" : "text-[11px]")}>
          {money(compare, currency)}
        </span>
      ) : null}
    </span>
  );
}

export function ProductImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-surface text-subtle", className)}>
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }
  return (
    <img
      src={mediaUrl(src)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

export function QuantityStepper({
  qty,
  max,
  onChange,
  compact,
}: {
  qty: number;
  max: number;
  onChange: (next: number) => void;
  compact?: boolean;
}) {
  const { theme } = useStorefront();
  const limit = Math.max(1, max || 1);
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-brand border p-1", theme.border, theme.soft)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, qty - 1))}
        disabled={qty <= 1}
        className="rounded-brand-sm p-1.5 transition hover:bg-line/60 disabled:opacity-40"
        aria-label="تقليل الكمية"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className={cn("min-w-7 text-center text-xs font-bold tabular-nums", compact && "min-w-6")}>{qty}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(limit, qty + 1))}
        disabled={qty >= limit}
        className="rounded-brand-sm p-1.5 transition hover:bg-line/60 disabled:opacity-40"
        aria-label="زيادة الكمية"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function DiscountBadge({ price, compareAt }: { price: number; compareAt?: number | null }) {
  const compare = Number(compareAt ?? 0);
  if (!(compare > price && price > 0)) return null;
  const percent = Math.round((1 - price / compare) * 100);
  if (percent <= 0) return null;
  return (
    <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-on-danger">وفّر {percent}%</span>
  );
}

/* ------------------------------- product card ----------------------------- */

export function ProductCard({ product }: { product: any }) {
  const { base, currency, theme, addToCart } = useStorefront();
  const name = product.nameAr || product.nameEn || product.sku;
  const price = Number(product.displayPrice ?? product.basePrice ?? 0);
  const compare = Number(product.compareAtPrice ?? 0) || null;
  const image = product.images?.[0]?.url || product.imageUrl || "";
  const stock = Number(product.totalStock ?? product.stock ?? 0);
  const inStock = product.inStock !== false && stock > 0;
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const href = `${base}/products/${encodeURIComponent(product.slug || product.id)}`;

  return (
    <article className={cn("group overflow-hidden rounded-brand border transition", theme.panel, theme.panelHover)}>
      <Link href={href} className="relative block aspect-square overflow-hidden">
        <ProductImage
          src={image}
          alt={name}
          className="transition duration-300 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <DiscountBadge price={price} compareAt={compare} />
            {product.isFeatured ? (
              <span className="rounded-full bg-overlay px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                مميز
              </span>
            ) : null}
          </div>
          {!inStock ? (
            <span className="rounded-full bg-overlay px-2 py-0.5 text-[10px] font-semibold text-white">نفدت الكمية</span>
          ) : null}
        </div>
      </Link>
      <div className="space-y-2.5 p-3.5">
        <div className="min-h-10">
          {product.category?.nameAr || product.category?.name ? (
            <span className={cn("text-[10px] font-medium", theme.muted)}>
              {product.category.nameAr || product.category.name}
            </span>
          ) : null}
          <Link href={href} className={cn("line-clamp-2 block text-sm font-semibold leading-6", theme.heading)}>
            {name}
          </Link>
        </div>
        <div className="flex items-end justify-between gap-2">
          <Price value={price} compareAt={compare} currency={currency} size="sm" />
          {!hasVariants ? (
            <button
              type="button"
              disabled={!inStock}
              onClick={() =>
                addToCart(
                  {
                    productId: product.id,
                    slug: product.slug,
                    name,
                    sku: product.sku,
                    price,
                    image,
                    maxStock: stock,
                  },
                  1
                )
              }
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-brand text-on-brand shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: theme.primary }}
              aria-label={`أضف ${name} إلى السلة`}
            >
              <ShoppingBag className="h-4 w-4" />
            </button>
          ) : (
            <Link
              href={href}
              className="rounded-brand border px-2.5 py-2 text-[10px] font-bold transition hover:opacity-80"
              style={{ borderColor: theme.primary, color: theme.primary }}
            >
              الخيارات
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  const { theme } = useStorefront();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={cn("overflow-hidden rounded-brand border", theme.panel)}>
          <div className={cn("aspect-square animate-pulse", theme.soft)} />
          <div className="space-y-2 p-3">
            <div className={cn("h-3 w-4/5 animate-pulse rounded-brand-sm", theme.soft)} />
            <div className={cn("h-3 w-1/2 animate-pulse rounded-brand-sm", theme.soft)} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- layout -------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { theme } = useStorefront();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.primary }}>
            {eyebrow}
          </div>
        ) : null}
        <h2 className={cn("font-heading text-xl font-bold sm:text-2xl", theme.heading)}>{title}</h2>
        {description ? <p className={cn("mt-1 max-w-2xl text-xs leading-6", theme.muted)}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StorefrontEmpty({
  icon = <ShoppingBag className="h-6 w-6" />,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { theme } = useStorefront();
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-brand border px-6 py-16 text-center", theme.panel)}>
      <div className={cn("flex h-14 w-14 items-center justify-center rounded-brand", theme.soft)} style={{ color: theme.primary }}>
        {icon}
      </div>
      <div>
        <div className={cn("font-heading text-lg font-bold", theme.heading)}>{title}</div>
        {description ? <p className={cn("mx-auto mt-1 max-w-md text-xs leading-6", theme.muted)}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingBlock({ label = "جارٍ التحميل…" }: { label?: string }) {
  const { theme } = useStorefront();
  return (
    <div className={cn("flex items-center justify-center gap-2 py-16 text-sm", theme.muted)}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { theme } = useStorefront();
  return (
    <div className={cn("mx-auto max-w-lg rounded-brand border p-6 text-center", theme.panel)}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-brand bg-danger-soft text-danger">
        <X className="h-5 w-5" />
      </div>
      <div className={cn("font-semibold", theme.heading)}>تعذر إكمال الطلب</div>
      <p className={cn("mt-1 text-xs leading-6", theme.muted)}>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-brand px-4 py-2 text-xs font-bold text-on-brand"
          style={{ background: theme.primary }}
        >
          إعادة المحاولة
        </button>
      ) : null}
    </div>
  );
}

/* --------------------------------- coupon -------------------------------- */

export function CouponBox({ compact = false }: { compact?: boolean }) {
  const { theme, coupon, couponLoading, applyCoupon, clearCoupon, currency } = useStorefront();
  const [code, setCode] = useState(coupon?.code ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCode(coupon?.code ?? "");
  }, [coupon?.code]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await applyCoupon(code);
    } catch (err: any) {
      setError(err?.message || "تعذر تطبيق كود الخصم.");
    } finally {
      setBusy(false);
    }
  };

  if (coupon) {
    return (
      <div className="rounded-brand border border-success-line bg-success-soft p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-success">
            <BadgePercent className="h-4 w-4" />
            <span>{coupon.code}</span>
            <Check className="h-3.5 w-3.5" />
          </div>
          <button
            type="button"
            onClick={clearCoupon}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-danger hover:opacity-75"
          >
            <X className="h-3 w-3" /> إزالة
          </button>
        </div>
        <div className="mt-1 text-[11px] text-success">
          {coupon.freeShipping ? "شحن مجاني على هذا الطلب." : `خصم ${money(coupon.discount, currency)}.`}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className={cn("pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2", theme.muted)} />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="كود الخصم"
            className={cn(theme.input, "ps-9", compact && "py-2 text-xs")}
            maxLength={80}
          />
        </div>
        <button
          type="submit"
          disabled={busy || couponLoading || !code.trim()}
          className="shrink-0 rounded-brand border px-3 text-xs font-bold transition hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: theme.primary, color: theme.primary }}
        >
          {busy || couponLoading ? "…" : "تطبيق"}
        </button>
      </div>
      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </form>
  );
}

/* ---------------------------------- misc --------------------------------- */

export function TrustStrip() {
  const { theme, zones, payments, store } = useStorefront();
  const freeThreshold = zones
    .map((zone: any) => Number(zone.free_shipping_threshold))
    .filter((value: number) => Number.isFinite(value) && value > 0)
    .sort((a: number, b: number) => a - b)[0];
  const governorates = new Set<string>();
  for (const zone of zones) {
    for (const item of Array.isArray(zone.governorates) ? zone.governorates : []) governorates.add(String(item));
  }

  const items = [
    payments.cod_enabled
      ? { icon: <PackageCheck className="h-4 w-4" />, title: "الدفع عند الاستلام", text: "استلم طلبك وادفع عند وصوله." }
      : null,
    zones.length
      ? {
          icon: <Truck className="h-4 w-4" />,
          title: "شحن منظم",
          text: freeThreshold
            ? `شحن مجاني للطلبات فوق ${money(freeThreshold, store.currency)}.`
            : governorates.size
              ? `توصيل إلى ${governorates.size} محافظة.`
              : "اختر محافظتك لحساب الشحن.",
        }
      : null,
    store.return_policy
      ? { icon: <Check className="h-4 w-4" />, title: "سياسة استرجاع واضحة", text: String(store.return_policy).slice(0, 90) }
      : null,
  ].filter(Boolean) as Array<{ icon: React.ReactNode; title: string; text: string }>;

  if (!items.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className={cn("flex items-start gap-3 rounded-brand border p-3.5", theme.panel)}>
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-brand bg-brand-soft text-brand"
          >
            {item.icon}
          </span>
          <span>
            <span className={cn("block text-xs font-bold", theme.heading)}>{item.title}</span>
            <span className={cn("mt-0.5 block text-[11px] leading-5", theme.muted)}>{item.text}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function SearchBar({
  initial,
  onSubmit,
  placeholder = "ابحث عن منتج…",
  compact = false,
}: {
  initial?: string;
  onSubmit: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const { theme } = useStorefront();
  const [value, setValue] = useState(initial ?? "");
  useEffect(() => setValue(initial ?? ""), [initial]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value.trim());
      }}
      className="relative w-full"
    >
      <Search className={cn("pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2", theme.muted)} />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className={cn(theme.input, compact ? "h-10 py-0 pe-16 ps-9 text-xs" : "ps-9 pe-20")}
        maxLength={100}
      />
      <button
        type="submit"
        className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-brand-sm px-3 py-1.5 text-[11px] font-bold text-on-brand"
        style={{ background: theme.primary }}
      >
        بحث
      </button>
    </form>
  );
}

export function ContinueShoppingLink({ children = "متابعة التسوق" }: { children?: React.ReactNode }) {
  const { base, theme } = useStorefront();
  return (
    <Link
      href={`${base}/products`}
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", theme.muted)}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

export function RemoveLineButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger transition hover:opacity-75"
    >
      <Trash2 className="h-3.5 w-3.5" /> إزالة
    </button>
  );
}
