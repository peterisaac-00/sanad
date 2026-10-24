import React from "react";
import { Construction, Compass, Lock } from "lucide-react";
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
