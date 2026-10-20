import React from "react";
import { cn } from "./ui";

/**
 * The single Sanad brand mark used by marketing, auth, onboarding, dashboard
 * and merchant-facing platform chrome. `dark` means "placed on a dark surface".
 */
export function BrandLogo({
  size = "md",
  dark = false,
  showTagline = true,
  title = "سند للتجارة",
  tagline = "منصة تشغيل التجارة الإلكترونية العربية",
  className,
}: {
  size?: "sm" | "md" | "lg";
  dark?: boolean;
  showTagline?: boolean;
  title?: string;
  tagline?: string;
  className?: string;
}) {
  const box = size === "sm" ? "h-8 w-8 text-sm rounded-brand-sm" : size === "lg" ? "h-12 w-12 text-xl rounded-brand" : "h-10 w-10 text-lg rounded-brand";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("flex shrink-0 items-center justify-center bg-secondary font-heading font-bold text-brand shadow-brand-card", box)}>
        سـ
      </div>
      <div className="flex flex-col">
        <span
          className={cn(
            "font-heading font-bold leading-none tracking-tight",
            dark ? "text-white" : "text-ink",
            size === "lg" ? "text-xl" : "text-lg"
          )}
        >
          {title}
        </span>
        {showTagline ? (
          <span className={cn("mt-1 text-[10px] leading-tight", dark ? "text-white/60" : "text-subtle")}>
            {tagline}
          </span>
        ) : null}
      </div>
    </div>
  );
}
