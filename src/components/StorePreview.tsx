import React from "react";
import { Menu, Search, ShoppingBag, Star } from "lucide-react";
import { mediaUrl } from "../lib/api";
import { TEMPLATES } from "../lib/format";
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
  const primary = branding?.primaryColor || "#2563EB";
  const themeMode = branding?.themeMode || "dark";
  const dark = themeMode !== "light";
  const font = branding?.arabicFont || "Cairo";
  const template = TEMPLATES[store?.templateKey || branding?.templateKey || "general"] ?? TEMPLATES.general;
  const name = store?.storeName || "اسم متجرك";
  const description = store?.description || "اكتب وصفاً قصيراً لمتجرك ليظهر هنا للعملاء.";
  const logo = store?.logoUrl || "";
  const cover = store?.coverUrl || "";
  const mobile = device === "mobile";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-2xl",
        mobile ? "mx-auto w-[330px] rounded-[2rem] border-4" : "w-full",
        dark ? "border-slate-700 bg-[#080d16]" : "border-slate-200 bg-white",
        className
      )}
      style={{ fontFamily: `'${font}', system-ui, sans-serif` }}
      dir="rtl"
    >
      <div className={cn("flex items-center justify-between px-4 py-3", dark ? "border-b border-white/5" : "border-b border-slate-100")}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg text-xs font-bold text-white" style={{ background: primary }}>
            {logo ? <img src={mediaUrl(logo)} alt="" className="h-full w-full object-cover" /> : name.trim().charAt(0) || "س"}
          </div>
          <span className={cn("text-xs font-bold", dark ? "text-white" : "text-slate-900")}>{name}</span>
        </div>
        <div className="flex items-center gap-2">
          {!mobile ? (
            <div className={cn("hidden items-center gap-3 text-[9px] sm:flex", dark ? "text-slate-400" : "text-slate-500")}>
              <span>الرئيسية</span>
              <span>المنتجات</span>
              <span>تواصل</span>
            </div>
          ) : null}
          <Search className={cn("h-3.5 w-3.5", dark ? "text-slate-400" : "text-slate-500")} />
          <div className="relative">
            <ShoppingBag className={cn("h-3.5 w-3.5", dark ? "text-slate-300" : "text-slate-600")} />
            <span className="absolute -end-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[7px] font-bold text-white">0</span>
          </div>
          {mobile ? <Menu className={cn("h-3.5 w-3.5", dark ? "text-slate-300" : "text-slate-600")} /> : null}
        </div>
      </div>

      <div className="relative">
        <div
          className={cn("relative overflow-hidden", mobile ? "h-40" : "h-56")}
          style={{
            background: cover
              ? undefined
              : `radial-gradient(circle at 20% 20%, ${primary}35, transparent 48%), linear-gradient(135deg, ${primary}22, ${dark ? "#0b1220" : "#f1f5f9"})`,
          }}
        >
          {cover ? <img src={mediaUrl(cover)} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
          <div className={cn("absolute inset-0", dark ? "bg-slate-950/55" : "bg-white/50")} />
          <div className={cn("relative flex h-full flex-col justify-center gap-2 px-5", mobile ? "max-w-full" : "max-w-[60%]")}>
            <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold text-white" style={{ background: primary }}>
              {template.emoji} {template.label}
            </span>
            <h3 className={cn("font-bold leading-tight", dark ? "text-white" : "text-slate-900", mobile ? "text-lg" : "text-2xl")}>{name}</h3>
            <p className={cn("line-clamp-2 text-[9px] leading-4", dark ? "text-slate-300" : "text-slate-600")}>{description}</p>
            <button className="w-fit rounded-lg px-3 py-1.5 text-[9px] font-bold text-white" style={{ background: primary }}>
              تسوّق الآن
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className={cn("text-[10px] font-bold", dark ? "text-white" : "text-slate-900")}>تسوّق حسب القسم</span>
          <span className="text-[8px]" style={{ color: primary }}>عرض الكل</span>
        </div>
        <div className="flex gap-2 overflow-hidden">
          {["الأكثر مبيعاً", "وصل حديثاً", "عروض"].map((label) => (
            <span key={label} className={cn("rounded-full px-2.5 py-1 text-[8px] font-semibold", dark ? "bg-white/5 text-slate-300" : "bg-slate-100 text-slate-600")}>
              {label}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className={cn("text-[10px] font-bold", dark ? "text-white" : "text-slate-900")}>منتجات مميزة</span>
          <span className="text-[8px] text-slate-500">ستظهر منتجاتك هنا بعد الإضافة</span>
        </div>
        <div className={cn("mt-2 grid gap-2", mobile ? "grid-cols-2" : "grid-cols-4")}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={cn("overflow-hidden rounded-xl border", dark ? "border-white/5 bg-white/[0.03]" : "border-slate-100 bg-slate-50")}>
              <div className={cn("flex items-center justify-center", mobile ? "h-16" : "h-20", dark ? "bg-slate-800/60" : "bg-slate-200/70")}>
                <ShoppingBag className={cn("h-4 w-4", dark ? "text-slate-600" : "text-slate-400")} />
              </div>
              <div className="space-y-1.5 p-2">
                <div className={cn("h-1.5 w-3/4 rounded", dark ? "bg-slate-700" : "bg-slate-300")} />
                <div className="flex items-center justify-between">
                  <div className={cn("h-1.5 w-1/3 rounded", dark ? "bg-slate-800" : "bg-slate-200")} />
                  <div className="flex items-center gap-0.5">
                    <Star className="h-2 w-2 fill-amber-400 text-amber-400" />
                    <span className="text-[7px] text-slate-500">5</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={cn("flex items-center justify-between px-4 py-3 text-[8px]", dark ? "border-t border-white/5 text-slate-500" : "border-t border-slate-100 text-slate-500")}>
        <span>© {new Date().getFullYear()} {name}</span>
        <span>مدعوم بواسطة سند</span>
      </div>
    </div>
  );
}
