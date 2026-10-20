import React from "react";
import { ArrowLeft, Layers } from "lucide-react";
import { Link } from "../lib/router";
import { cn } from "../components/ui";
import { useStorefront } from "./StorefrontContext";
import { ProductImage, SectionHeading, StorefrontEmpty, useStorefrontSeo } from "./StorefrontUI";

export function StorefrontCategoriesPage() {
  const { base, store, categories, theme } = useStorefront();
  useStorefrontSeo({
    title: `الأقسام — ${store.store_name}`,
    description: store.seo?.description || store.description || `تصفح أقسام متجر ${store.store_name}.`,
    canonical: `${window.location.origin}${base}/categories`,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <SectionHeading
        eyebrow="دليل التسوق"
        title="أقسام المتجر"
        description="اختر القسم الذي يناسبك للوصول سريعاً إلى المنتجات المنشورة."
        action={
          <Link href={`${base}/products`} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: theme.primary }}>
            كل المنتجات <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {categories.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category: any) => {
            const count = category._count?.products ?? 0;
            return (
              <Link
                key={category.id}
                href={`${base}/categories/${encodeURIComponent(category.slug)}`}
                className={cn("group overflow-hidden rounded-2xl border transition", theme.panel, theme.panelHover)}
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  {category.imageUrl ? (
                    <ProductImage
                      src={category.imageUrl}
                      alt={category.nameAr || category.name}
                      className="transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${theme.primary}22, transparent)` }}
                    >
                      <Layers className="h-9 w-9" style={{ color: theme.primary }} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
                  <span className="absolute end-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                    {count} منتج
                  </span>
                </div>
                <div className="space-y-1.5 p-4">
                  <h2 className={cn("font-heading text-base font-bold", theme.heading)}>{category.nameAr || category.name}</h2>
                  {category.description ? (
                    <p className={cn("line-clamp-2 text-xs leading-6", theme.muted)}>{category.description}</p>
                  ) : (
                    <p className={cn("text-xs", theme.muted)}>استعرض منتجات هذا القسم.</p>
                  )}
                  <span className="inline-flex items-center gap-1 pt-1 text-[11px] font-bold" style={{ color: theme.primary }}>
                    تسوّق القسم <ArrowLeft className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <StorefrontEmpty
          icon={<Layers className="h-6 w-6" />}
          title="لا توجد أقسام بعد"
          description="يمكنك تصفح جميع منتجات المتجر المنشورة مباشرة."
          action={
            <Link
              href={`${base}/products`}
              className="rounded-xl px-4 py-2.5 text-xs font-bold text-white"
              style={{ background: theme.primary }}
            >
              تصفح المنتجات
            </Link>
          }
        />
      )}
    </div>
  );
}
