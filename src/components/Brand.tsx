import React from "react";
import { cn } from "./ui";

export function BrandLogo({
  size = "md",
  dark = true,
  showTagline = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  dark?: boolean;
  showTagline?: boolean;
  className?: string;
}) {
  const box = size === "sm" ? "h-8 w-8 text-sm" : size === "lg" ? "h-12 w-12 text-xl" : "h-10 w-10 text-lg";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("flex items-center justify-center rounded-xl border border-blue-400/30 bg-blue-600 font-heading font-bold text-white shadow-lg shadow-blue-950/30", box)}>
        سـ
      </div>
      <div className="flex flex-col">
        <span className={cn("font-heading font-bold leading-none tracking-tight", dark ? "text-white" : "text-slate-900", size === "lg" ? "text-xl" : "text-lg")}>
          سند للتجارة
        </span>
        {showTagline ? (
          <span className={cn("mt-1 text-[10px] leading-tight", dark ? "text-slate-400" : "text-slate-500")}>
            منصة تشغيل التجارة الإلكترونية العربية
          </span>
        ) : null}
      </div>
    </div>
  );
}
