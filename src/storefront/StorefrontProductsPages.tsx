import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Minus,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import { api, mediaUrl } from "../lib/api";
import { money } from "../lib/format";
import { Link, navigate, useQuery } from "../lib/router";
import { useAsync } from "../lib/useAsync";
import { cn, useToast } from "../components/ui";
import { useStorefront } from "./StorefrontContext";
import {
  ContinueShoppingLink,
  DiscountBadge,
  ErrorBlock,
  LoadingBlock,
  Price,
  ProductCard,
  ProductGridSkeleton,
  ProductImage,
  QuantityStepper,
  SearchBar,
  SectionHeading,
  Stars,
  StorefrontEmpty,
  useJsonLd,
  useStorefrontSeo,
} from "./StorefrontUI";

const SORTS = [
  { value: "newest", label: "الأحدث" },
  { value: "oldest", label: "الأقدم" },
  { value: "price_asc", label: "السعر: الأقل أولاً" },
  { value: "price_desc", label: "السعر: الأعلى أولاً" },
  { value: "name", label: "الاسم أبجدياً" },
];

function useCatalogUrl() {
  const { base } = useStorefront();
  return (path: string, params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "" && value !== null && !(key === "page" && Number(value) === 1) && !(key === "sort" && value === "newest")) {
        query.set(key, String(value));
      }
    }
    const suffix = query.toString();
    return `${base}${path}${suffix ? `?${suffix}` : ""}`;
  };
}

export function StorefrontProductsPage({ categorySlug }: { categorySlug?: string }) {
  const { subdomain, base, store, categories, theme } = useStorefront();
  const query = useQuery();
  const toast = useToast();
  const buildUrl = useCatalogUrl();
  const search = query.get("search") || "";
  const sort = SORTS.some((item) => item.value === query.get("sort")) ? (query.get("sort") as string) : "newest";
  const page = Math.max(1, Number(query.get("page") || 1) || 1);
  const category = categorySlug || query.get("category") || "";
  const categoryInfo = categories.find((item: any) => item.slug === category);
  const routePath = categorySlug ? `/categories/${encodeURIComponent(categorySlug)}` : "/products";
  const result = useAsync(
    () => api.storefront.products(subdomain, { page, pageSize: 12, search, category, sort }),
    [subdomain, page, search, category, sort]
  );
  const products = result.data?.products ?? [];
  const pagination = result.data?.pagination;

  useStorefrontSeo({
    title: categoryInfo
      ? `${categoryInfo.nameAr || categoryInfo.name} — ${store.store_name}`
      : `كل المنتجات — ${store.store_name}`,
    description:
      categoryInfo?.description ||
      store.seo?.description ||
      `تسوّق منتجات ${store.store_name} المنشورة مع خيارات الدفع عند الاستلام.`,
    canonical: `${window.location.origin}${base}${routePath}${search ? `?search=${encodeURIComponent(search)}` : ""}`,
  });

  const go = (patch: Record<string, string | number | undefined>) => {
    navigate(
      buildUrl(routePath, {
        search,
        sort,
        page: 1,
        ...(categorySlug ? {} : { category }),
        ...patch,
      })
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <nav className={cn("flex flex-wrap items-center gap-1.5 text-[11px]", theme.muted)}>
        <Link href={base} className="hover:opacity-80">الرئيسية</Link>
        <ChevronLeft className="h-3 w-3" />
        {categoryInfo ? (
          <>
            <Link href={`${base}/categories`} className="hover:opacity-80">الأقسام</Link>
            <ChevronLeft className="h-3 w-3" />
            <span className={theme.heading}>{categoryInfo.nameAr || categoryInfo.name}</span>
          </>
        ) : (
          <span className={theme.heading}>كل المنتجات</span>
        )}
      </nav>

      <SectionHeading
        eyebrow={categoryInfo ? "قسم" : "كتالوج المتجر"}
        title={categoryInfo ? categoryInfo.nameAr || categoryInfo.name : "كل المنتجات"}
        description={categoryInfo?.description || "ابحث وصفّي المنتجات المنشورة في المتجر."}
        action={
          <Link href={`${base}/cart`} className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.primary }}>
            <ShoppingBag className="h-3.5 w-3.5" /> السلة
          </Link>
        }
      />

      <div className={cn("flex flex-col gap-3 rounded-brand border p-3 sm:flex-row sm:items-center", theme.panel)}>
        <div className="flex-1">
          <SearchBar
            initial={search}
            onSubmit={(value) => go({ search: value || undefined })}
            placeholder={categoryInfo ? `ابحث داخل ${categoryInfo.nameAr || categoryInfo.name}…` : "ابحث بالاسم أو SKU…"}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("whitespace-nowrap text-[11px]", theme.muted)}>ترتيب:</span>
          <select
            value={sort}
            onChange={(event) => go({ sort: event.target.value })}
            className={cn(theme.input, "h-10 py-0 text-xs")}
          >
            {SORTS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={buildUrl("/products", { sort })}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
            !category ? "text-on-brand" : theme.muted
          )}
          style={!category ? { background: theme.primary, borderColor: theme.primary } : { borderColor: "var(--color-border)" }}
        >
          الكل
        </Link>
        {categories.map((item: any) => {
          const active = item.slug === category;
          return (
            <Link
              key={item.id}
              href={buildUrl(`/categories/${encodeURIComponent(item.slug)}`, { sort })}
              className={cn("rounded-full border px-3 py-1.5 text-[11px] font-semibold transition", active ? "text-on-brand" : theme.muted)}
              style={active ? { background: theme.primary, borderColor: theme.primary } : { borderColor: "var(--color-border)" }}
            >
              {item.nameAr || item.name}
            </Link>
          );
        })}
      </div>

      {search ? (
        <div className={cn("flex flex-wrap items-center gap-2 text-xs", theme.muted)}>
          نتائج البحث عن <strong className={theme.heading}>«{search}»</strong>
          <Link href={buildUrl(routePath, { category: categorySlug ? undefined : category, sort })} className="text-danger hover:underline">
            مسح البحث
          </Link>
        </div>
      ) : null}

      {result.loading ? (
        <ProductGridSkeleton count={8} />
      ) : result.error ? (
        <ErrorBlock
          message="تعذر تحميل المنتجات. تحقق من اتصالك أو حاول لاحقاً."
          onRetry={result.reload}
        />
      ) : products.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {pagination && pagination.totalPages > 1 ? (
            <div className={cn("flex items-center justify-between gap-3 rounded-brand border px-4 py-3 text-xs", theme.panel, theme.muted)}>
              <span>
                صفحة {pagination.page} من {pagination.totalPages} · {pagination.total} منتج
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => go({ page: page - 1 })}
                  className={cn("inline-flex items-center gap-1 rounded-brand-sm border px-3 py-1.5 font-semibold disabled:opacity-40", theme.border)}
                >
                  <ChevronRight className="h-3.5 w-3.5" /> السابق
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => go({ page: page + 1 })}
                  className={cn("inline-flex items-center gap-1 rounded-brand-sm border px-3 py-1.5 font-semibold disabled:opacity-40", theme.border)}
                >
                  التالي <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : pagination ? (
            <div className={cn("text-[11px]", theme.muted)}>{pagination.total} منتج</div>
          ) : null}
        </>
      ) : (
        <StorefrontEmpty
          icon={<Search className="h-6 w-6" />}
          title="لا توجد منتجات مطابقة"
          description={
            search || category
              ? "جرّب تعديل البحث أو اختيار قسم آخر."
              : "لم تُنشر منتجات في المتجر بعد. عد قريباً أو تواصل مع المتجر."
          }
          action={
            <Link
              href={buildUrl("/products", { sort: "newest" })}
              className="rounded-brand px-4 py-2.5 text-xs font-bold text-on-brand"
              style={{ background: theme.primary }}
            >
              عرض كل المنتجات
            </Link>
          }
        />
      )}
    </div>
  );
}

/* -------------------------------- product --------------------------------- */

function optionDefinitions(product: any) {
  const variants: any[] = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return [];
  const keys = new Set<string>();
  for (const variant of variants) {
    for (const key of Object.keys(variant.optionValues ?? {})) {
      if (key) keys.add(key);
    }
  }
  const options: any[] = Array.isArray(product.options) ? product.options : [];
  const byKey = new Map<string, any>();
  for (const option of options) {
    if (option.name) byKey.set(option.name, option);
    if (option.nameAr) byKey.set(option.nameAr, option);
  }
  return [...keys].map((key) => {
    const option = byKey.get(key);
    const declared = (option?.values ?? []).map((value: any) => ({
      value: value.value,
      label: value.valueAr || value.value,
    }));
    const variantValues = new Set<string>();
    for (const variant of variants) {
      const value = variant.optionValues?.[key];
      if (value) variantValues.add(String(value));
    }
    const values = [...declared];
    for (const value of variantValues) {
      if (!values.some((entry) => entry.value === value)) values.push({ value, label: value });
    }
    return {
      key,
      label: option?.nameAr || option?.name || key,
      values,
    };
  });
}

export function StorefrontProductPage({ slug }: { slug: string }) {
  const { subdomain, base, store, theme, currency, addToCart } = useStorefront();
  const toast = useToast();
  const result = useAsync(() => api.storefront.product(subdomain, slug), [subdomain, slug]);
  const product = result.data?.product;
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [image, setImage] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const definitions = useMemo(() => optionDefinitions(product), [product]);
  const variants: any[] = useMemo(() => (Array.isArray(product?.variants) ? product.variants : []), [product]);

  useEffect(() => {
    if (!product) return;
    const gallery = Array.isArray(product.images) ? product.images : [];
    setImage(gallery[0]?.url || "");
    const preferred = variants.find((variant) => Number(variant.stock) > 0) ?? variants[0];
    if (preferred) {
      const next: Record<string, string> = {};
      for (const definition of optionDefinitions(product)) {
        next[definition.key] = preferred.optionValues?.[definition.key] ?? "";
      }
      setSelection(next);
      setQty(1);
    } else {
      setSelection({});
      setQty(1);
    }
    setReviewNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;
    return (
      variants.find((variant) =>
        definitions.every((definition) => (variant.optionValues?.[definition.key] ?? "") === (selection[definition.key] ?? ""))
      ) ?? null
    );
  }, [variants, definitions, selection]);

  useEffect(() => {
    if (selectedVariant?.imageUrl) setImage(selectedVariant.imageUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant?.id]);

  const name = product ? product.nameAr || product.nameEn || product.sku : "";
  const basePrice = Number(product?.displayPrice ?? product?.basePrice ?? 0);
  const price = selectedVariant && Number(selectedVariant.price) > 0 ? Number(selectedVariant.price) : basePrice;
  const compareAt =
    selectedVariant?.compareAtPrice != null
      ? Number(selectedVariant.compareAtPrice)
      : product?.compareAtPrice != null
        ? Number(product.compareAtPrice)
        : null;
  const stock = selectedVariant ? Number(selectedVariant.stock) : Number(product?.totalStock ?? product?.stock ?? 0);
  const hasVariants = variants.length > 0;
  const inStock = hasVariants ? Boolean(selectedVariant) && stock > 0 : stock > 0;
  const gallery: any[] = Array.isArray(product?.images) ? product.images : [];
  const description = product?.descriptionAr || product?.descriptionEn || product?.shortDescriptionAr || "";
  const shortDescription = product?.shortDescriptionAr || product?.shortDescriptionEn || "";
  const category = product?.category;
  const reviews: any[] = Array.isArray(product?.reviews) ? product.reviews : [];
  const summary = product?.review_summary ?? { average: 0, count: 0 };
  const related: any[] = Array.isArray(product?.related_products) ? product.related_products : [];
  const whatsapp = store.whatsapp_url
    ? `${store.whatsapp_url}${store.whatsapp_url.includes("?") ? "&" : "?"}text=${encodeURIComponent(
        `مرحباً، أرغب في الاستفسار عن ${name}${selectedVariant ? ` (${Object.values(selection).join(" / ")})` : ""}.`
      )}`
    : "";

  useStorefrontSeo({
    title: product ? product.seoTitle || `${name} — ${store.store_name}` : `المنتج — ${store.store_name}`,
    description:
      product?.seoDescription ||
      shortDescription ||
      (description ? String(description).slice(0, 160) : undefined) ||
      store.seo?.description,
    image: gallery[0]?.url,
    canonical: `${window.location.origin}${base}/products/${encodeURIComponent(slug)}`,
  });
  useJsonLd(
    "sanad-product-structured-data",
    product
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          sku: product.sku,
          description: shortDescription || String(description).slice(0, 500) || undefined,
          image: gallery.map((item) => mediaUrl(item.url)).filter(Boolean),
          category: category ? category.nameAr || category.name : undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: currency,
            price,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `${window.location.origin}${base}/products/${encodeURIComponent(slug)}`,
          },
          ...(summary.count > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: summary.average,
                  reviewCount: summary.count,
                },
              }
            : {}),
        }
      : {}
  );

  const choose = (key: string, value: string) => {
    setSelection((current) => ({ ...current, [key]: value }));
    setQty(1);
  };

  const add = (thenCheckout = false) => {
    if (!product) return;
    if (hasVariants && !selectedVariant) {
      toast.error("اختر خيارات المنتج أولاً.");
      return;
    }
    if (!inStock) {
      toast.error("هذا المنتج غير متوفر حالياً.");
      return;
    }
    const label = Object.entries(selection)
      .map(([key, value]) => {
        const definition = definitions.find((item: any) => item.key === key);
        const found = definition?.values.find((item: any) => item.value === value);
        return found?.label || value;
      })
      .filter(Boolean)
      .join(" / ");
    const added = addToCart(
      {
        productId: product.id,
        slug: product.slug,
        name,
        sku: selectedVariant?.sku || product.sku,
        variantId: selectedVariant?.id,
        variantLabel: label || undefined,
        price,
        image: selectedVariant?.imageUrl || gallery[0]?.url || "",
        maxStock: stock,
      },
      qty
    );
    if (added && thenCheckout) navigate(`${base}/checkout`);
  };

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!product) return;
    if (!reviewName.trim() || !reviewContent.trim()) {
      toast.error("أدخل اسمك ونص التقييم.");
      return;
    }
    setReviewBusy(true);
    setReviewNote("");
    try {
      const response = await api.storefront.submitReview(subdomain, {
        productId: product.id,
        customerName: reviewName.trim(),
        rating: reviewRating,
        content: reviewContent.trim(),
      });
      setReviewNote(response?.note || "تم استلام تقييمك وسيظهر بعد مراجعة المتجر.");
      setReviewContent("");
    } catch (err: any) {
      toast.error(err?.message || "تعذر إرسال التقييم.");
    } finally {
      setReviewBusy(false);
    }
  };

  if (result.loading) return <div className="mx-auto max-w-6xl px-4 py-10"><LoadingBlock /></div>;
  if (result.error || !product) {
    const notFound = (result.error as any)?.code === "PRODUCT_NOT_FOUND" || (result.error as any)?.status === 404;
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <ErrorBlock
          message={notFound ? "هذا المنتج غير موجود أو لم يعد منشوراً في المتجر." : "تعذر تحميل المنتج. حاول مرة أخرى."}
          onRetry={notFound ? undefined : result.reload}
        />
        <div className="mt-4 text-center"><ContinueShoppingLink>تصفح المنتجات</ContinueShoppingLink></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <nav className={cn("flex flex-wrap items-center gap-1.5 text-[11px]", theme.muted)}>
        <Link href={base} className="hover:opacity-80">الرئيسية</Link>
        <ChevronLeft className="h-3 w-3" />
        <Link href={`${base}/products`} className="hover:opacity-80">المنتجات</Link>
        {category ? (
          <>
            <ChevronLeft className="h-3 w-3" />
            <Link href={`${base}/categories/${encodeURIComponent(category.slug)}`} className="hover:opacity-80">
              {category.nameAr || category.name}
            </Link>
          </>
        ) : null}
        <ChevronLeft className="h-3 w-3" />
        <span className={cn("line-clamp-1", theme.heading)}>{name}</span>
      </nav>

      <div className="grid gap-7 lg:grid-cols-2">
        <div className="space-y-3">
          <div className={cn("relative aspect-square overflow-hidden rounded-brand-lg border", theme.panel)}>
            <ProductImage src={image} alt={name} />
            <div className="absolute start-3 top-3 flex flex-col gap-1.5">
              <DiscountBadge price={price} compareAt={compareAt} />
            </div>
          </div>
          {gallery.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((item, index) => (
                <button
                  key={item.id || index}
                  type="button"
                  onClick={() => setImage(item.url)}
                  className={cn(
                    "h-16 w-16 shrink-0 overflow-hidden rounded-brand border-2 transition",
                    image === item.url ? "opacity-100" : "opacity-70 hover:opacity-100"
                  )}
                  style={{ borderColor: image === item.url ? theme.primary : "transparent" }}
                  aria-label={`صورة ${index + 1}`}
                >
                  <ProductImage src={item.url} alt={item.alt || name} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            {category ? (
              <Link
                href={`${base}/categories/${encodeURIComponent(category.slug)}`}
                className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold"
                style={{ background: `color-mix(in srgb, ${theme.primary} 9%, transparent)`, color: theme.primary }}
              >
                {category.nameAr || category.name}
              </Link>
            ) : null}
            <h1 className={cn("font-heading text-2xl font-extrabold leading-tight sm:text-3xl", theme.heading)}>{name}</h1>
            {summary.count > 0 ? (
              <div className="flex items-center gap-2">
                <Stars rating={summary.average} />
                <span className={cn("text-[11px]", theme.muted)}>
                  {summary.average} · {summary.count} تقييم
                </span>
              </div>
            ) : (
              <span className={cn("text-[11px]", theme.muted)}>كن أول من يقيّم هذا المنتج</span>
            )}
            {shortDescription ? <p className={cn("text-sm leading-7", theme.muted)}>{shortDescription}</p> : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Price value={price} compareAt={compareAt} currency={currency} size="lg" />
            {inStock ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[10px] font-bold text-success">
                <Check className="h-3 w-3" /> متوفر
              </span>
            ) : (
              <span className="rounded-full bg-danger-soft px-2.5 py-1 text-[10px] font-bold text-danger">نفدت الكمية</span>
            )}
          </div>

          {definitions.length ? (
            <div className="space-y-3">
              {definitions.map((definition: any) => (
                <div key={definition.key} className="space-y-1.5">
                  <div className={cn("text-xs font-bold", theme.heading)}>{definition.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {definition.values.map((value: any) => {
                      const active = selection[definition.key] === value.value;
                      return (
                        <button
                          key={value.value}
                          type="button"
                          onClick={() => choose(definition.key, value.value)}
                          className={cn(
                            "rounded-brand border px-3 py-2 text-xs font-semibold transition",
                            active ? "text-white" : theme.muted
                          )}
                          style={
                            active
                              ? { background: theme.primary, borderColor: theme.primary }
                              : { borderColor: "var(--color-border)" }
                          }
                        >
                          {value.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!selectedVariant ? (
                <p className="text-[11px] font-semibold text-danger">هذه التركيبة غير متاحة. اختر قيمة أخرى.</p>
              ) : null}
            </div>
          ) : null}

          {inStock && stock <= 5 ? (
            <p className="text-[11px] font-semibold text-warning">باقي {stock} قطع فقط في المخزون.</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <QuantityStepper qty={qty} max={Math.max(1, stock)} onChange={setQty} />
            <button
              type="button"
              onClick={() => add(false)}
              disabled={!inStock}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-brand px-5 text-sm font-bold text-on-brand shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              style={{ background: theme.primary }}
            >
              <ShoppingBag className="h-4 w-4" /> أضف إلى السلة
            </button>
            <button
              type="button"
              onClick={() => add(true)}
              disabled={!inStock}
              className={cn("inline-flex h-12 items-center justify-center rounded-brand border px-4 text-sm font-bold transition hover:opacity-80 disabled:opacity-40", theme.border)}
            >
              اطلب الآن
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-[11px]">
            {store.cod_enabled ? (
              <span className={cn("inline-flex items-center gap-1.5 rounded-brand-sm border px-2.5 py-1.5", theme.border, theme.muted)}>
                <PackageCheck className="h-3.5 w-3.5" /> الدفع عند الاستلام
              </span>
            ) : null}
            <span className={cn("inline-flex items-center gap-1.5 rounded-brand-sm border px-2.5 py-1.5", theme.border, theme.muted)}>
              <Truck className="h-3.5 w-3.5" /> شحن يُحسب حسب المحافظة
            </span>
            <span className={cn("inline-flex items-center gap-1.5 rounded-brand-sm border px-2.5 py-1.5", theme.border, theme.muted)}>
              <ShieldCheck className="h-3.5 w-3.5" /> أسعار ومخزون محدّثان
            </span>
          </div>

          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-success hover:opacity-80"
            >
              <MessageCircle className="h-4 w-4" /> استفسر عن المنتج على واتساب
            </a>
          ) : null}
          <div className={cn("text-[11px]", theme.muted)}>
            SKU: <span dir="ltr" className="font-mono">{product.sku}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className={cn("rounded-brand border p-5", theme.panel)}>
          <h2 className={cn("mb-3 font-heading text-lg font-bold", theme.heading)}>تفاصيل المنتج</h2>
          {description ? (
            <div className={cn("whitespace-pre-line text-sm leading-8", theme.muted)}>{description}</div>
          ) : (
            <p className={cn("text-xs", theme.muted)}>لم يضف المتجر وصفاً تفصيلياً لهذا المنتج بعد.</p>
          )}
        </section>
        <aside className={cn("space-y-3 rounded-brand border p-5 text-xs", theme.panel, theme.muted)}>
          <div className="flex items-center justify-between gap-2">
            <span>الدفع عند الاستلام</span>
            <span className={theme.heading}>{store.cod_enabled ? "متاح" : "غير متاح"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>سياسة الاسترجاع</span>
            <span className={cn("max-w-[60%] text-end", theme.heading)}>{store.return_policy || "تواصل مع المتجر"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>الدعم</span>
            <span className={theme.heading}>{store.support_email || "واتساب المتجر"}</span>
          </div>
        </aside>
      </div>

      <section className="space-y-5" id="reviews">
        <SectionHeading
          eyebrow="آراء العملاء"
          title="التقييمات"
          description={summary.count ? `${summary.count} تقييم منشور بمتوسط ${summary.average} من 5.` : "شارك تجربتك مع المنتج بعد الشراء."}
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {reviews.length ? (
              reviews.map((review) => (
                <article key={review.id} className={cn("rounded-brand border p-4", theme.panel)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-on-brand" style={{ background: theme.primary }}>
                        {String(review.customerName || "ع").trim().charAt(0)}
                      </span>
                      <span className={cn("text-xs font-bold", theme.heading)}>{review.customerName}</span>
                    </div>
                    <Stars rating={review.rating} />
                  </div>
                  <p className={cn("mt-2 whitespace-pre-line text-xs leading-6", theme.muted)}>{review.content}</p>
                  {review.merchantReply ? (
                    <div className={cn("mt-3 rounded-brand p-3 text-[11px] leading-6", theme.soft)}>
                      <span className={cn("font-bold", theme.heading)}>رد المتجر: </span>
                      {review.merchantReply}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <div className={cn("rounded-brand border p-6 text-center text-xs", theme.panel, theme.muted)}>
                لا توجد تقييمات منشورة بعد. تقييمات العملاء تظهر بعد مراجعة المتجر.
              </div>
            )}
          </div>

          <form onSubmit={submitReview} className={cn("h-fit space-y-3 rounded-brand border p-4", theme.panel)}>
            <div className={cn("text-sm font-bold", theme.heading)}>أضف تقييمك</div>
            {reviewNote ? (
              <div className="rounded-brand border border-success-line bg-success-soft p-2.5 text-[11px] leading-5 text-success">
                {reviewNote}
              </div>
            ) : null}
            <div>
              <div className={cn("mb-1.5 text-[11px] font-semibold", theme.muted)}>تقييمك</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" onClick={() => setReviewRating(value)} aria-label={`${value} نجوم`}>
                    <Star className={cn("h-5 w-5", value <= reviewRating ? "fill-warning text-warning" : "text-line")} />
                  </button>
                ))}
              </div>
            </div>
            <input
              value={reviewName}
              onChange={(event) => setReviewName(event.target.value)}
              placeholder="اسمك"
              className={theme.input}
              maxLength={120}
              required
            />
            <textarea
              value={reviewContent}
              onChange={(event) => setReviewContent(event.target.value)}
              placeholder="اكتب تجربتك مع المنتج…"
              className={cn(theme.input, "min-h-24 resize-y leading-6")}
              maxLength={3000}
              required
            />
            <button
              type="submit"
              disabled={reviewBusy}
              className="w-full rounded-brand px-4 py-2.5 text-xs font-bold text-on-brand disabled:opacity-50"
              style={{ background: theme.primary }}
            >
              {reviewBusy ? "جارٍ الإرسال…" : "إرسال التقييم"}
            </button>
            <p className={cn("text-[10px] leading-5", theme.muted)}>
              يُحفظ التقييم كمراجعة بانتظار موافقة المتجر، وقد لا يظهر فوراً.
            </p>
          </form>
        </div>
      </section>

      {related.length ? (
        <section className="space-y-4">
          <SectionHeading eyebrow="قد يعجبك أيضاً" title="منتجات مشابهة" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {related.slice(0, 4).map((item: any) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex justify-center">
        <ContinueShoppingLink>العودة إلى كل المنتجات</ContinueShoppingLink>
      </div>
    </div>
  );
}
