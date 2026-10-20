import React from "react";
import { Menu, Search, ShoppingBag, Star } from "lucide-react";
import { mediaUrl } from "../lib/api";
import { TEMPLATES } from "../lib/format";
import { readableOnPrimary } from "../lib/color";
import { cn } from "../components/ui";

export function StorePreview({
  store,
  branding,
  device = "desktop",
  className,
}: {
  store: any;
  branding?: any;
  device?: "desktop" | "mobile";
  className?: string;
}) {
  const primary = branding?.primaryColor || "#047857";
  const onPrimary = readableOnPrimary(primary);
  const themeMode = branding?.themeMode || "light";
  const dark = themeMode !== "light";
  const font = branding?.arabicFont || "IBM Plex Sans Arabic";
  const template = TEMPLATES[store?.templateKey || branding?.templateKey || "general"] ?? TEMPLATES.general;
  const name = store?.storeName || "اسم متجرك";
  const description = store?.description || "اكتب وصفاً قصيراً لمتجرك ليظهر هنا للعملاء.";
  const logo = store?.logoUrl || "";
  const cover = store?.coverUrl || "";
  const mobile = device === "mobile";

  return (
    <div
      data-theme={dark ? "dark" : "light"}
      className={cn(
        "overflow-hidden rounded-brand border border-line bg-canvas text-ink shadow-brand-popover",
        mobile ? "mx-auto w-[330px] rounded-[2rem] border-4" : "w-full",
        className
      )}
      style={{ fontFamily: `'${font}', var(--font-arabic)`, ...({ "--color-primary": primary, "--color-on-primary": onPrimary } as React.CSSProperties) }}
      dir="rtl"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-brand-sm text-xs font-bold text-on-brand" style={{ background: primary }}>
            {logo ? <img src={mediaUrl(logo)} alt="" className="h-full w-full object-cover" /> : name.trim().charAt(0) || "س"}
          </div>
          <span className="text-xs font-bold text-ink">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          {!mobile ? (
            <div className="hidden items-center gap-3 text-[9px] text-subtle sm:flex">
              <span>الرئيسية</span>
              <span>المنتجات</span>
              <span>تواصل</span>
            </div>
          ) : null}
          <Search className="h-3.5 w-3.5 text-subtle" />
          <div className="relative">
            <ShoppingBag className="h-3.5 w-3.5 text-ink-soft" />
            <span className="absolute -end-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-danger text-[7px] font-bold text-on-danger">0</span>
          </div>
          {mobile ? <Menu className="h-3.5 w-3.5 text-ink-soft" /> : null}
        </div>
      </div>

      <div className="relative">
        <div
          className={cn("relative overflow-hidden", mobile ? "h-40" : "h-56")}
          style={{
            background: cover
              ? undefined
              : `radial-gradient(circle at 20% 20%, ${primary}35, transparent 48%), linear-gradient(135deg, ${primary}22, var(--color-surface))`,
          }}
        >
          {cover ? <img src={mediaUrl(cover)} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-canvas/40" />
          <div className={cn("relative flex h-full flex-col justify-center gap-2 px-5", mobile ? "max-w-full" : "max-w-[60%]")}>
            <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold text-on-brand" style={{ background: primary }}>
              {template.emoji} {template.label}
            </span>
            <h3 className={cn("font-heading font-bold leading-tight text-ink", mobile ? "text-lg" : "text-2xl")}>{name}</h3>
            <p className="line-clamp-2 text-[9px] leading-4 text-ink-soft">{description}</p>
            <button className="w-fit rounded-brand-sm px-3 py-1.5 text-[9px] font-bold text-on-brand" style={{ background: primary }}>
              تسوّق الآن
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold text-ink">تسوّق حسب القسم</span>
          <span className="text-[8px]" style={{ color: primary }}>عرض الكل</span>
        </div>
        <div className="flex gap-2 overflow-hidden">
          {["الأكثر مبيعاً", "وصل حديثاً", "عروض"].map((label) => (
            <span key={label} className="rounded-full bg-surface px-2.5 py-1 text-[8px] font-semibold text-ink-soft">
              {label}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] font-bold text-ink">منتجات مميزة</span>
          <span className="text-[8px] text-subtle">ستظهر منتجاتك هنا بعد الإضافة</span>
        </div>
        <div className={cn("mt-2 grid gap-2", mobile ? "grid-cols-2" : "grid-cols-4")}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="overflow-hidden rounded-brand border border-line bg-card">
              <div className={cn("flex items-center justify-center bg-surface", mobile ? "h-16" : "h-20")}>
                <ShoppingBag className="h-4 w-4 text-subtle" />
              </div>
              <div className="space-y-1.5 p-2">
                <div className="h-1.5 w-3/4 rounded-full bg-line" />
                <div className="flex items-center justify-between">
                  <div className="h-1.5 w-1/3 rounded-full bg-surface" />
                  <div className="flex items-center gap-0.5">
                    <Star className="h-2 w-2 fill-warning text-warning" />
                    <span className="text-[7px] text-subtle">5</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[8px] text-subtle">
        <span>© {new Date().getFullYear()} {name}</span>
        <span>مدعوم بواسطة سند</span>
      </div>
    </div>
  );
}
