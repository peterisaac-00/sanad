import React from "react";
import { ArrowLeft, Layers, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import { api, mediaUrl } from "../lib/api";
import { TEMPLATES } from "../lib/format";
import { Link } from "../lib/router";
import { useAsync } from "../lib/useAsync";
import { cn } from "../components/ui";
import { useStorefront } from "./StorefrontContext";
import {
  ProductCard,
  ProductGridSkeleton,
  ProductImage,
  SectionHeading,
  StorefrontEmpty,
  TrustStrip,
  useJsonLd,
  useStorefrontSeo,
} from "./StorefrontUI";

function whatsappUrl(url: string, message: string) {
  if (!url) return "";
  return `${url}${url.includes("?") ? "&" : "?"}text=${encodeURIComponent(message)}`;
}

export function StorefrontHomePage() {
  const { subdomain, base, store, categories, featured, theme } = useStorefront();
  const newest = useAsync(
    () => api.storefront.products(subdomain, { pageSize: 8, sort: "newest" }),
    [subdomain]
  );
  const name = store.store_name || "المتجر";
  const template = TEMPLATES[store.template] ?? TEMPLATES.general;
  const cover = store.cover_url || "";
  const logo = store.logo_url || "";
  const whatsapp = whatsappUrl(store.whatsapp_url, `مرحباً ${name}، أرغب في الاستفسار عن منتجاتكم.`);
  const newestProducts = (newest.data?.products ?? []).filter(
    (product: any) => !featured.some((item: any) => item.id === product.id)
  );

  useStorefrontSeo({
    title: store.seo?.title || name,
    description: store.seo?.description || store.description || undefined,
    image: cover || undefined,
    canonical: `${window.location.origin}${base}`,
  });
  useJsonLd("sanad-store-structured-data", {
    "@context": "https://schema.org",
    "@type": "Store",
    name,
    description: store.description || undefined,
    image: cover ? mediaUrl(cover) : undefined,
    url: `${window.location.origin}${base}`,
    currenciesAccepted: store.currency || "EGP",
    ...(store.cod_enabled ? { paymentAccepted: "الدفع عند الاستلام" } : {}),
    ...(store.support_email ? { email: store.support_email } : {}),
  });

  return (
    <div className="space-y-10 pb-14">
      <section className="relative overflow-hidden rounded-b-[2rem] border-b border-white/10">
        <div className="absolute inset-0">
          {cover ? (
            <img src={mediaUrl(cover)} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `radial-gradient(circle at 18% 18%, color-mix(in srgb, ${theme.primary} 33%, transparent), transparent 50%), radial-gradient(circle at 85% 80%, color-mix(in srgb, ${theme.primary} 15%, transparent), transparent 42%), linear-gradient(135deg, var(--color-secondary), var(--color-canvas))`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-secondary via-secondary/75 to-secondary/35" />
        </div>

        <div className="relative mx-auto flex min-h-[420px] max-w-6xl flex-col justify-center gap-5 px-4 py-14 sm:px-6 lg:min-h-[500px] lg:py-20">
          <div className="flex flex-wrap items-center gap-2">
            {logo ? (
              <img
                src={mediaUrl(logo)}
                alt={name}
                className="h-12 w-12 rounded-brand border border-white/20 bg-white/10 object-cover"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-brand text-lg font-bold text-on-brand shadow-lg"
                style={{ background: theme.primary }}
              >
                {name.trim().charAt(0) || "س"}
              </div>
            )}
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
              {template.emoji} {template.label}
            </span>
          </div>

          <div className="max-w-2xl">
            <h1 className="font-heading text-3xl font-extrabold leading-tight text-white sm:text-5xl">{name}</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/80 sm:text-base">
              {store.description || "تسوّق منتجات مختارة بعناية، مع توصيل منظم ودفع آمن عند الاستلام."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`${base}/products`}
              className="inline-flex items-center gap-2 rounded-brand px-5 py-3 text-sm font-bold text-on-brand shadow-lg transition hover:opacity-90"
              style={{ background: theme.primary }}
            >
              <ShoppingBag className="h-4 w-4" />
              تسوّق الآن
            </Link>
            <Link
              href={`${base}/categories`}
              className="inline-flex items-center gap-2 rounded-brand border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Layers className="h-4 w-4" />
              تصفح الأقسام
            </Link>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-brand border border-brand-on-dark/40 bg-brand-on-dark/15 px-5 py-3 text-sm font-bold text-brand-on-dark transition hover:bg-brand-on-dark/25"
              >
                <MessageCircle className="h-4 w-4" />
                تواصل واتساب
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-white/70">
            {store.cod_enabled ? <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> الدفع عند الاستلام متاح</span> : null}
            {store.support_email ? <span>الدعم: {store.support_email}</span> : null}
            {store.return_policy ? <span>سياسة استرجاع واضحة</span> : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 sm:px-6">
        <TrustStrip />

        {categories.length ? (
          <section className="space-y-4">
            <SectionHeading
              eyebrow="تسوّق حسب القسم"
              title="الأقسام"
              action={
                <Link href={`${base}/categories`} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: theme.primary }}>
                  عرض الكل <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.slice(0, 8).map((category: any) => {
                const count = category._count?.products ?? 0;
                return (
                  <Link
                    key={category.id}
                    href={`${base}/categories/${encodeURIComponent(category.slug)}`}
                    className={cn("group overflow-hidden rounded-brand border transition", theme.panel, theme.panelHover)}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {category.imageUrl ? (
                        <ProductImage src={category.imageUrl} alt={category.nameAr || category.name} className="transition duration-300 group-hover:scale-105" />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${theme.primary} 13%, transparent), transparent)` }}
                        >
                          <Layers className="h-7 w-7" style={{ color: theme.primary }} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-secondary/75 to-transparent" />
                      <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
                        <span className="text-sm font-bold text-white">{category.nameAr || category.name}</span>
                        <span className="rounded-full bg-overlay px-2 py-0.5 text-[10px] font-semibold text-white">
                          {count} منتج
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {featured.length ? (
          <section className="space-y-4">
            <SectionHeading
              eyebrow="اختيارات المتجر"
              title="منتجات مميزة"
              description="منتجات اختارها فريق المتجر لعرضها في الواجهة."
              action={
                <Link href={`${base}/products`} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: theme.primary }}>
                  كل المنتجات <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {featured.slice(0, 8).map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : null}

        {newest.loading ? (
          <section className="space-y-4">
            <SectionHeading eyebrow="وصل حديثاً" title={featured.length ? "أحدث المنتجات" : "منتجات المتجر"} />
            <ProductGridSkeleton />
          </section>
        ) : newestProducts.length ? (
          <section className="space-y-4">
            <SectionHeading
              eyebrow="وصل حديثاً"
              title={featured.length ? "أحدث المنتجات" : "منتجات المتجر"}
              action={
                <Link href={`${base}/products?sort=newest`} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: theme.primary }}>
                  عرض الكل <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {newestProducts.slice(0, 8).map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : !featured.length && !newest.loading ? (
          <StorefrontEmpty
            title="المتجر يجهّز منتجاته الأولى"
            description="لم تُضف منتجات منشورة بعد. تواصل مع المتجر للاستفسار عن المنتجات المتاحة."
            action={
              whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-brand px-4 py-2.5 text-xs font-bold text-on-brand"
                  style={{ background: theme.primary }}
                >
                  <MessageCircle className="h-4 w-4" /> تواصل مع المتجر
                </a>
              ) : undefined
            }
          />
        ) : null}

        {whatsapp ? (
          <section
            className="overflow-hidden rounded-brand-lg border p-6 sm:p-8"
            style={{
              borderColor: `color-mix(in srgb, ${theme.primary} 20%, transparent)`,
              background: `linear-gradient(120deg, color-mix(in srgb, ${theme.primary} 9%, transparent), transparent 55%)`,
            }}
          >
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className={cn("font-heading text-xl font-bold", theme.heading)}>لديك سؤال قبل الطلب؟</h2>
                <p className={cn("mt-1 max-w-xl text-xs leading-6", theme.muted)}>
                  فريق {name} متاح على واتساب لمساعدتك في اختيار المنتج المناسب ومعرفة مواعيد التوصيل.
                </p>
              </div>
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-2 rounded-brand px-5 py-3 text-sm font-bold text-on-brand"
                style={{ background: theme.primary }}
              >
                <MessageCircle className="h-4 w-4" /> راسلنا على واتساب
              </a>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
