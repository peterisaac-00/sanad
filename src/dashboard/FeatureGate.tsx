import React from "react";
import { CheckCircle2, Clock3, Construction, Compass, Lock } from "lucide-react";
import { Card, EmptyState } from "../components/ui";
import { Link } from "../lib/router";
import type { FeatureDefinition } from "./features";

export function FeatureGate({ feature }: { feature: FeatureDefinition }) {
  const isPlanned = feature.state === "coming_soon";
  return (
    <Card>
      <EmptyState
        title={isPlanned ? `${feature.label} قيد التطوير` : `${feature.label} غير متاح`}
        description={
          feature.reason ||
          (isPlanned
            ? "هذه الميزة ليست مكتملة بعد، ولا نعرضها كأنها تعمل."
            : "هذه الميزة غير متاحة في الخطة الحالية.")
        }
        icon={isPlanned ? <Construction className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        action={
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-brand border border-line px-4 py-2 text-xs font-semibold text-ink transition hover:border-brand-line"
          >
            <Compass className="h-3.5 w-3.5" /> العودة إلى لوحة التحكم
          </Link>
        }
      />
    </Card>
  );
}

const STORE_STATUS_COPY: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
  pending: {
    title: "متجرك قيد مراجعة الإدارة",
    description: "أكملنا استلام بيانات متجرك. ستتمكن من استخدام لوحة التحكم وإضافة المنتجات فور موافقة مدير المنصة.",
    icon: <Clock3 className="h-6 w-6" />,
  },
  rejected: {
    title: "يحتاج متجرك إلى تعديل",
    description: "راجعت الإدارة طلب فتح المتجر وتحتاج إلى إجراء تعديلات قبل تفعيل لوحة التحكم.",
    icon: <Lock className="h-6 w-6" />,
  },
  suspended: {
    title: "تم إيقاف المتجر مؤقتًا",
    description: "لا يمكن استخدام لوحة التحكم حاليًا. تواصل مع إدارة سند لمعرفة سبب الإيقاف والخطوة التالية.",
    icon: <Lock className="h-6 w-6" />,
  },
};

export function StoreApprovalGate({ status, reason }: { status?: string | null; reason?: string | null }) {
  if (!status || status === "active") return null;
  const copy = STORE_STATUS_COPY[status] ?? STORE_STATUS_COPY.pending;
  const description = reason && status !== "pending" ? `${copy.description}\n\nملاحظة الإدارة: ${reason}` : copy.description;
  return (
    <Card className="mx-auto max-w-2xl border-brand-line bg-card">
      <EmptyState
        title={copy.title}
        description={description}
        icon={copy.icon}
        action={
          <div className="flex items-center gap-2 rounded-brand border border-brand-line bg-brand-soft px-4 py-2.5 text-xs font-semibold text-brand">
            <CheckCircle2 className="h-4 w-4" /> سيتم فتح لوحة التحكم تلقائيًا بعد الاعتماد
          </div>
        }
      />
    </Card>
  );
}
