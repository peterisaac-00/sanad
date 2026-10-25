import { ApiError } from "../errors.js";

/**
 * One publishing vocabulary for registration, onboarding, admin approval,
 * suspension, storefront and dashboard.
 *
 * Store.status remains the platform approval lifecycle
 * (pending -> active / rejected / suspended).
 * Store.publishStatus is the storefront lifecycle
 * (draft -> ready -> published -> suspended).
 *
 * A storefront is publicly visible only when status=active AND
 * publishStatus=published. A suspended/rejected store always wins, so a stale
 * publish flag can never keep a blocked store online.
 */
export type PublishStatus = "draft" | "ready" | "published" | "suspended";

export const PUBLISH_REASONS = {
  draft: "لم يكتمل إعداد المتجر بعد.",
  ready: "المتجر جاهز وينتظر موافقة إدارة المنصة.",
  rejected: "تم رفض طلب فتح المتجر. راجع ملاحظات الإدارة.",
  suspended: "تم تعليق المتجر مؤقتًا. تواصل مع الدعم.",
  unpublished: "المتجر غير منشور حاليًا.",
  active: "",
} as const;

export interface PublishState {
  status: string;
  publishStatus: string;
  publishReason: string;
  statusReason: string;
  onboardingCompleted: boolean;
  publishedAt: Date | null;
}

export function isPublished(store: PublishState): boolean {
  return store.status === "active" && store.publishStatus === "published";
}

/** Why a store cannot be published right now, or null when it can. */
export function publishBlockReason(store: PublishState): string | null {
  if (store.status === "suspended") return PUBLISH_REASONS.suspended;
  if (store.status === "rejected") return PUBLISH_REASONS.rejected;
  if (store.status !== "active") return PUBLISH_REASONS.ready;
  if (!store.onboardingCompleted) return PUBLISH_REASONS.draft;
  return null;
}

export function assertCanPublish(store: PublishState): void {
  const reason = publishBlockReason(store);
  if (reason) {
    throw new ApiError(409, "STORE_NOT_PUBLISHABLE", reason);
  }
}

/**
 * After onboarding completes:
 * - an approved store publishes immediately;
 * - a pending store becomes ready and waits for approval.
 */
export function publishStateAfterOnboarding(store: PublishState, now = new Date()) {
  if (store.status === "active") {
    return {
      publishStatus: "published" as PublishStatus,
      publishReason: PUBLISH_REASONS.active,
      publishedAt: store.publishedAt ?? now,
    };
  }
  return {
    publishStatus: "ready" as PublishStatus,
    publishReason:
      store.status === "suspended"
        ? PUBLISH_REASONS.suspended
        : store.status === "rejected"
          ? PUBLISH_REASONS.rejected
          : PUBLISH_REASONS.ready,
    publishedAt: null,
  };
}

/** After an admin approves/reinstates a store. */
export function publishStateAfterApproval(store: PublishState, now = new Date()) {
  if (store.onboardingCompleted) {
    return {
      publishStatus: "published" as PublishStatus,
      publishReason: PUBLISH_REASONS.active,
      publishedAt: store.publishedAt ?? now,
    };
  }
  return {
    publishStatus: "draft" as PublishStatus,
    publishReason: PUBLISH_REASONS.draft,
    publishedAt: null,
  };
}

export function publishingSnapshot(store: PublishState) {
  const visible = isPublished(store);
  return {
    status: store.status,
    publish_status: store.publishStatus,
    publish_reason: visible ? "" : store.publishReason || publishBlockReason(store) || PUBLISH_REASONS.unpublished,
    status_reason: store.statusReason,
    published: visible,
    public_visible: visible,
    published_at: store.publishedAt,
    can_publish: publishBlockReason(store) === null && store.publishStatus !== "published",
  };
}
