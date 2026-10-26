import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { money, ORDER_STATUS, PAYMENT_STATUS, statusLabel, paymentLabel } from "../lib/format";
import { Badge, cn } from "../components/ui";

/** Order status pill. Uses the shared status map so every screen agrees. */
export function StatusBadge({ status }: { status: string }) {
  const meta = ORDER_STATUS[status];
  return (
    <Badge tone={meta?.tone} dot={meta?.dot}>
      {statusLabel(status)}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  const meta = PAYMENT_STATUS[status];
  return <Badge tone={meta?.tone ?? "bg-surface text-ink-soft border-line"}>{paymentLabel(status)}</Badge>;
}

export function Money({ value, currency }: { value: number | null | undefined; currency: string }) {
  return <span className="font-semibold text-ink">{money(value, currency)}</span>;
}

export function Th({ children, className, dir }: { children?: React.ReactNode; className?: string; dir?: "ltr" | "rtl" }) {
  return (
    <th dir={dir} className={cn("whitespace-nowrap px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-subtle", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, dir }: { children?: React.ReactNode; className?: string; dir?: "ltr" | "rtl" }) {
  return <td dir={dir} className={cn("break-words px-4 py-3 align-middle text-ink-soft [overflow-wrap:anywhere]", className)}>{children}</td>;
}

export function ActivePill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> مفعّل</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-subtle"><XCircle className="h-3.5 w-3.5" /> متوقف</span>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} من 5`} dir="ltr">
      {[1, 2, 3, 4, 5].map((value) => (
        <span key={value} className={value <= rating ? "text-warning" : "text-ink-soft"}>★</span>
      ))}
    </span>
  );
}

/** Convert an <input type="date"> value to an ISO datetime (local midnight / end of day). */
export function dateInputToIso(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function isoToDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function TableShell({ children, minWidth = 640 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
