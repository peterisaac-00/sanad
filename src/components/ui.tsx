import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Info, Loader2, Search, X } from "lucide-react";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "border-brand bg-brand text-on-brand shadow-brand-card hover:bg-brand-hover active:bg-brand-active",
  secondary: "border-secondary bg-secondary text-on-secondary hover:brightness-110",
  ghost: "border-transparent text-subtle hover:bg-surface hover:text-ink",
  danger: "border-danger bg-danger text-on-danger hover:brightness-95",
  outline: "border-line bg-card text-ink hover:border-subtle/50 hover:bg-surface",
  success: "border-success bg-success text-on-success hover:brightness-95",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-brand-sm px-3 text-xs",
  md: "h-10 gap-2 rounded-brand px-4 text-sm",
  lg: "h-12 gap-2 rounded-brand px-6 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("surface-card", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</div> : null}
        <h1 className="font-heading text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
          {label}
          {required ? <span className="text-danger">*</span> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="block text-[11px] text-danger">{error}</span> : hint ? <span className="block text-[11px] text-subtle">{hint}</span> : null}
    </label>
  );
}

const controlClass = "input-control h-10 py-0";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn(controlClass, className)} {...rest} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref
) {
  return <textarea ref={ref} className={cn(controlClass, "h-auto min-h-24 resize-y py-2.5 leading-6", className)} {...rest} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref
) {
  return (
    <select ref={ref} className={cn(controlClass, className)} {...rest}>
      {children}
    </select>
  );
});

export function SearchInput({
  value,
  onChange,
  placeholder = "بحث…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(controlClass, "ps-9")}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "border-line bg-surface text-ink-soft",
  dot,
  className,
}: {
  children: React.ReactNode;
  tone?: string;
  dot?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone, className)}>
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dot)} /> : null}
      {children}
    </span>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-info-line bg-info-soft text-info",
    success: "border-success-line bg-success-soft text-success",
    warning: "border-warning-line bg-warning-soft text-warning",
    error: "border-danger-line bg-danger-soft text-danger",
  };
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;
  return (
    <div className={cn("flex gap-3 rounded-brand border p-3.5 text-xs leading-6", tones[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title ? <div className="font-bold">{title}</div> : null}
        <div className="text-current/90">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-subtle">
      <Loader2 className="h-5 w-5 animate-spin text-brand" />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-brand bg-surface", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-brand border border-line bg-surface text-brand">
        {icon ?? <Info className="h-5 w-5" />}
      </div>
      <div>
        <div className="font-semibold text-ink">{title}</div>
        {description ? <div className="mx-auto mt-1 max-w-md text-xs leading-6 text-subtle">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    ) ?? []).filter((element) => element.getAttribute("aria-hidden") !== "true");
    window.requestAnimationFrame(() => (focusable()[0] ?? dialogRef.current)?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-3 backdrop-blur-sm sm:p-6" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("surface-popover my-4 w-full overflow-hidden", sizes[size])}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="font-heading text-lg font-bold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-subtle">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-brand-sm p-1.5 text-subtle transition hover:bg-surface hover:text-ink"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تأكيد الحذف",
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-brand border border-danger-line bg-danger-soft p-3 text-xs leading-6 text-danger">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        لا يمكن التراجع عن هذا الإجراء. تأكد من أنك تريد المتابعة.
      </div>
    </Modal>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "brand" | "success" | "info" | "warning" | "danger";
}) {
  const accents = {
    brand: "border-brand-line bg-brand-soft text-brand",
    success: "border-success-line bg-success-soft text-success",
    info: "border-info-line bg-info-soft text-info",
    warning: "border-warning-line bg-warning-soft text-warning",
    danger: "border-danger-line bg-danger-soft text-danger",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium text-subtle">{label}</div>
          <div className="mt-2 font-heading text-2xl font-bold text-ink">{value}</div>
          {hint ? <div className="mt-1 text-[11px] text-subtle">{hint}</div> : null}
        </div>
        {icon ? <div className={cn("rounded-brand border p-2", accents[accent])}>{icon}</div> : null}
      </div>
    </Card>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-3 rounded-brand border border-line bg-surface p-3", disabled && "cursor-not-allowed opacity-60")}>
      <span>
        <span className="block text-xs font-semibold text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-[11px] leading-5 text-subtle">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-5 w-9 rounded-full bg-line transition peer-checked:bg-brand" />
        <span className="absolute start-0.5 h-4 w-4 rounded-full bg-card shadow transition peer-checked:start-[18px]" />
      </span>
    </label>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return total !== undefined ? <div className="px-1 py-3 text-[11px] text-subtle">إجمالي {total}</div> : null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-xs text-subtle">
      <div>صفحة {page} من {totalPages}{total !== undefined ? ` · ${total} سجل` : ""}</div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>السابق</Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>التالي</Button>
      </div>
    </div>
  );
}

export function CopyButton({ value, label = "نسخ" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("انسخ الرابط:", value);
        }
      }}
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "تم النسخ" : label}
    </Button>
  );
}

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}
interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++toastId;
    setItems((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ push, success: (m) => push(m, "success"), error: (m) => push(m, "error") }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-20 start-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2 sm:bottom-6">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-brand border px-4 py-3 text-xs leading-5 shadow-brand-popover",
              item.tone === "success" && "border-success-line bg-success-soft text-success",
              item.tone === "error" && "border-danger-line bg-danger-soft text-danger",
              item.tone === "info" && "border-line bg-card text-ink"
            )}
          >
            {item.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : item.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{item.message}</span>
            <button onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))} aria-label="إغلاق">
              <X className="h-3.5 w-3.5 opacity-60" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
