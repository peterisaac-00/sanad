import React from "react";
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Settings2,
  Store as StoreIcon,
  XCircle,
} from "lucide-react";
import { api, mediaUrl } from "../lib/api";
import { date, dateTime, money, number } from "../lib/format";
import { Badge, Button, EmptyState, cn } from "../components/ui";
import { TableShell, Td, Th } from "../dashboard/common";

export type AdminPermission =
  | "overview.read"
  | "stores.read"
  | "stores.write"
  | "merchants.read"
  | "subscriptions.read"
  | "subscriptions.write"
  | "wallet.read"
  | "wallet.write"
  | "support.read"
  | "support.write"
  | "reports.read"
  | "domains.read"
  | "domains.write"
  | "audit.read"
  | "flags.read"
  | "flags.write"
  | "admins.manage";

export interface AdminPanelProps {
  can: (permission: AdminPermission) => boolean;
}

/** Panels that render or mutate the signed-in admin identity also need it. */
export interface AdminIdentityPanelProps extends AdminPanelProps {
  /** The signed-in PlatformAdmin from /api/admin/auth/me. */
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
    two_factor_enabled?: boolean;
    last_login_at?: string | null;
  };
}

export const ADMIN_ROLE_LABELS: Record<string, string> = {
  super_admin: "مدير أعلى",
  operations: "تشغيل",
  finance: "مالية",
  support: "دعم",
  readonly: "قراءة فقط",
};

export const STORE_STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  active: { label: "نشط", tone: "bg-success-soft text-success border-success-line", dot: "bg-success" },
  pending: { label: "بانتظار الموافقة", tone: "bg-warning-soft text-warning border-warning-line", dot: "bg-warning" },
  rejected: { label: "مرفوض", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
  suspended: { label: "موقوف", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
};

export const PUBLISH_STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  draft: { label: "غير منشور", tone: "bg-surface text-ink-soft border-line", dot: "bg-subtle" },
  ready: { label: "جاهز للمراجعة", tone: "bg-info-soft text-info border-info-line", dot: "bg-info" },
  published: { label: "منشور", tone: "bg-success-soft text-success border-success-line", dot: "bg-success" },
  suspended: { label: "نشر موقوف", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  pending: { label: "قيد المراجعة", tone: "bg-warning-soft text-warning border-warning-line", dot: "bg-warning" },
  approved: { label: "معتمدة", tone: "bg-success-soft text-success border-success-line", dot: "bg-success" },
  rejected: { label: "مرفوضة", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
};

export const WALLET_STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  pending: { label: "قيد المراجعة", tone: "bg-warning-soft text-warning border-warning-line", dot: "bg-warning" },
  completed: { label: "معتمد", tone: "bg-success-soft text-success border-success-line", dot: "bg-success" },
  rejected: { label: "مرفوض", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
  failed: { label: "فاشل", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
  cancelled: { label: "ملغى", tone: "bg-surface text-ink-soft border-line", dot: "bg-subtle" },
};

export const TICKET_STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: "مفتوحة", tone: "bg-warning-soft text-warning border-warning-line" },
  in_progress: { label: "قيد المعالجة", tone: "bg-info-soft text-info border-info-line" },
  resolved: { label: "تم الحل", tone: "bg-success-soft text-success border-success-line" },
  closed: { label: "مغلقة", tone: "bg-surface text-ink-soft border-line" },
};

export const PRIORITY: Record<string, { label: string; tone: string }> = {
  low: { label: "منخفضة", tone: "bg-surface text-ink-soft border-line" },
  normal: { label: "عادية", tone: "bg-info-soft text-info border-info-line" },
  high: { label: "عالية", tone: "bg-warning-soft text-warning border-warning-line" },
  urgent: { label: "عاجلة", tone: "bg-danger-soft text-danger border-danger-line" },
};

export const DOMAIN_STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  pending: { label: "بانتظار التحقق", tone: "bg-warning-soft text-warning border-warning-line", dot: "bg-warning" },
  verified: { label: "موثّق", tone: "bg-success-soft text-success border-success-line", dot: "bg-success" },
};

export const TLS_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "بانتظار التهيئة", tone: "bg-warning-soft text-warning border-warning-line" },
  active: { label: "نشط", tone: "bg-success-soft text-success border-success-line" },
  failed: { label: "فشل", tone: "bg-danger-soft text-danger border-danger-line" },
};

export const PLAN_LABEL: Record<string, string> = { monthly: "شهري", annual: "سنوي" };
export const PLAN_PERIOD: Record<string, string> = { monthly: "شهر", annual: "سنة" };
export const PAYMENT_METHOD: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  instapay: "إنستاباي",
  vodafone_cash: "فودافون كاش",
  wallet: "محفظة إلكترونية",
  other: "طريقة أخرى",
};

export function storeMeta(status: string) {
  return STORE_STATUS[status] ?? { label: status, tone: "bg-surface text-ink-soft border-line", dot: "bg-subtle" };
}

export function publishMeta(status: string) {
  return PUBLISH_STATUS[status] ?? { label: status, tone: "bg-surface text-ink-soft border-line", dot: "bg-subtle" };
}

export function ownerName(owner: any): string {
  if (!owner) return "—";
  return (
    owner.name ||
    [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
    owner.email ||
    "—"
  );
}

export function monthLabel(value: string): string {
  const [year, month] = String(value).split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { month: "short", year: "2-digit" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

export function storeUrl(store: any): string {
  return store?.customDomain ? `https://${store.customDomain}` : `/store/${store?.subdomain ?? ""}`;
}

export function VisitsChart({ rows }: { rows: Array<{ month: string; visits: number }> }) {
  const max = Math.max(...rows.map((row) => row.visits), 1);
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-3" dir="ltr">
      {rows.map((row) => {
        const height = row.visits === 0 ? 3 : Math.max(8, (row.visits / max) * 100);
        return (
          <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="text-[10px] font-semibold text-ink-soft">{number(row.visits)}</div>
            <div className="flex h-32 w-full items-end overflow-hidden rounded-brand-sm bg-surface">
              <div
                className="w-full rounded-brand-sm bg-gradient-to-t from-brand to-brand/55 transition-[height] duration-500"
                style={{ height: `${height}%` }}
              />
            </div>
            <div className="truncate text-[10px] text-subtle" dir="rtl">{monthLabel(row.month)}</div>
          </div>
        );
      })}
    </div>
  );
}

export type StoreReviewAction = "approve" | "reject" | "suspend";

export function StoreTable({
  stores,
  emptyTitle = "لا توجد متاجر",
  emptyDescription = "ستظهر المتاجر هنا بعد تسجيل أول تاجر.",
  onIdentity,
  onAction,
  onPublish,
}: {
  stores: any[];
  emptyTitle?: string;
  emptyDescription?: string;
  onIdentity?: (store: any) => void;
  onAction?: (store: any, action: StoreReviewAction) => void;
  onPublish?: (store: any, action: "publish" | "unpublish") => void;
}) {
  if (stores.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={<StoreIcon className="h-5 w-5" />} />;
  }
  return (
    <TableShell minWidth={1240}>
      <thead>
        <tr className="border-b border-line bg-surface/60">
          <Th>المتجر</Th>
          <Th>المالك</Th>
          <Th>الاعتماد</Th>
          <Th>النشر</Th>
          <Th>الاشتراك</Th>
          <Th>الفريق والنطاقات</Th>
          <Th>الإجراءات</Th>
        </tr>
      </thead>
      <tbody>
        {stores.map((store) => {
          const meta = storeMeta(store.status);
          const publishing = publishMeta(store.publishStatus);
          const publicUrl = storeUrl(store);
          return (
            <tr key={store.id} className="border-b border-line align-top transition hover:bg-surface/50">
              <Td>
                <div className="flex items-center gap-2.5">
                  {store.logoUrl ? (
                    <img src={mediaUrl(store.logoUrl)} alt="" className="h-9 w-9 rounded-brand-sm border border-line object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-brand-sm bg-brand-soft text-sm font-bold text-brand">
                      {String(store.storeName ?? "س").trim().charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="max-w-[190px] truncate text-xs font-bold text-ink">{store.storeName}</div>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-subtle hover:text-brand"
                      dir="ltr"
                    >
                      {store.customDomain || `/store/${store.subdomain}`} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <div className="mt-0.5 text-[10px] text-subtle">أُنشئ {date(store.createdAt)}</div>
                  </div>
                </div>
              </Td>
              <Td>
                <div className="text-[11px] font-semibold text-ink">{ownerName(store.owner)}</div>
                <div className="mt-0.5 max-w-[180px] truncate font-mono text-[10px] text-subtle" dir="ltr">{store.owner?.email ?? "—"}</div>
              </Td>
              <Td>
                <Badge tone={meta.tone} dot={meta.dot}>{meta.label}</Badge>
                <div className="mt-1 text-[10px] text-subtle">
                  {store.activatedAt ? `فُعّل ${date(store.activatedAt)}` : "لم يُفعّل بعد"}
                </div>
                <div className="mt-0.5 text-[10px] text-subtle">
                  {store.onboardingCompleted ? "أكمل التهيئة" : "لم يكمل التهيئة"}
                </div>
              </Td>
              <Td>
                <Badge tone={publishing.tone} dot={publishing.dot}>{publishing.label}</Badge>
                <div className="mt-1 max-w-[210px] text-[10px] leading-4 text-subtle">
                  {store.publishStatus === "published"
                    ? store.publishedAt
                      ? `منشور ${dateTime(store.publishedAt)}`
                      : "ظاهر للعملاء"
                    : store.publishReason || store.publishing?.publish_reason || "غير ظاهر للعملاء"}
                </div>
                {onPublish && store.status === "active" && store.onboardingCompleted ? (
                  <button
                    type="button"
                    onClick={() => onPublish(store, store.publishStatus === "published" ? "unpublish" : "publish")}
                    className="mt-1 text-[10px] font-semibold text-brand underline underline-offset-2"
                  >
                    {store.publishStatus === "published" ? "إيقاف النشر" : "نشر المتجر"}
                  </button>
                ) : null}
              </Td>
              <Td>
                <div className="text-[11px] font-semibold text-ink">{PLAN_LABEL[store.plan] ?? store.plan ?? "—"}</div>
                <div className="mt-0.5 text-[10px] text-subtle">
                  {store.subscriptionPaidUntil ? `مدفوع حتى ${date(store.subscriptionPaidUntil)}` : "لا يوجد تجديد معتمد"}
                </div>
                <div className="mt-0.5 text-[10px] text-subtle">{number(store.visitsThisMonth ?? 0)} زيارة هذا الشهر</div>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Badge tone="bg-surface text-ink-soft border-line">{number(store.teamCount ?? 0)} أعضاء</Badge>
                  <Badge tone="bg-surface text-ink-soft border-line">{number(store.domainCount ?? 0)} نطاق</Badge>
                  {Number(store.openTickets ?? 0) > 0 ? (
                    <Badge tone="bg-warning-soft text-warning border-warning-line">{number(store.openTickets)} تذكرة</Badge>
                  ) : null}
                </div>
              </Td>
              <Td>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {onAction ? (
                    <>
                      {store.status !== "active" ? (
                        <Button size="sm" variant="success" onClick={() => onAction(store, "approve")}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> تفعيل
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => onAction(store, "suspend")} title="إيقاف المتجر">
                          <Ban className="h-3.5 w-3.5" /> إيقاف
                        </Button>
                      )}
                      {store.status === "pending" ? (
                        <Button size="sm" variant="ghost" onClick={() => onAction(store, "reject")} title="رفض الطلب">
                          <XCircle className="h-3.5 w-3.5" /> رفض
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  {onIdentity ? (
                    <Button size="sm" variant="outline" onClick={() => onIdentity(store)}>
                      <Settings2 className="h-3.5 w-3.5" /> الهوية
                    </Button>
                  ) : null}
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}

export function PermissionNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-brand border border-line bg-surface px-3 py-2 text-[11px] leading-5 text-subtle">
      {children}
    </div>
  );
}

export function AdminTableEmpty({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
  return <EmptyState title={title} description={description} icon={icon} />;
}

export { api, cn, money };
