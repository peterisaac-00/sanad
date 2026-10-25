/**
 * Single source of truth for which console features are exposed.
 *
 * Every feature has exactly one state:
 * - available: the core workflow works end to end.
 * - needs_setup: the page works but depends on server/integration setup.
 * - coming_soon: the workflow is incomplete; the page is hidden and gated.
 * - not_in_plan: deliberately not offered in this product phase.
 *
 * The sidebar only renders available/needs_setup entries, and the router gates
 * coming_soon/not_in_plan routes even when someone opens the URL directly.
 */
export type FeatureState = "available" | "needs_setup" | "coming_soon" | "not_in_plan";

export interface FeatureDefinition {
  label: string;
  state: FeatureState;
  reason?: string;
  /** Short, truthful qualifier shown next to the nav label. */
  badge?: string;
}

/** Live integration state used to refine the static registry at runtime. */
export interface FeatureRuntime {
  /** True when the server has a usable AI provider for the assistant. */
  assistantConfigured?: boolean;
}

export const FEATURE_REGISTRY: Record<string, FeatureDefinition> = {
  "/dashboard": { label: "لوحة التحكم", state: "available" },
  "/dashboard/orders": { label: "الطلبات", state: "available" },
  "/dashboard/reports": { label: "التقارير", state: "available" },
  "/dashboard/products": { label: "المنتجات", state: "available" },
  "/dashboard/categories": { label: "الفئات", state: "available" },
  "/dashboard/customers": { label: "العملاء", state: "available" },
  "/dashboard/shipping": {
    label: "مناطق الشحن",
    state: "available",
    badge: "يدوي",
    reason: "أسعار المناطق وأسماء شركات الشحن تُدار يدوياً؛ لا يوجد ربط آلي بشركات الشحن أو تتبع مباشر.",
  },
  "/dashboard/reviews": { label: "التقييمات", state: "available" },
  "/dashboard/abandoned-carts": {
    label: "السلات المتروكة",
    state: "available",
    badge: "مراسلة يدوية",
    reason: "التذكير يفتح محادثة واتساب برسالة جاهزة. الإرسال التلقائي غير متاح حتى تُعتمد قوالب واتساب.",
  },
  "/dashboard/upsells": {
    label: "العروض الإضافية",
    state: "coming_soon",
    reason: "يمكن حفظ قواعد العرض، لكن المتجر لا يعرضها بعد. لذلك الصفحة غير متاحة حتى يكتمل عرضها للعملاء.",
  },
  "/dashboard/related-products": { label: "المنتجات المرتبطة", state: "available" },
  "/dashboard/coupons": { label: "الكوبونات", state: "available" },
  "/dashboard/affiliates": {
    label: "التسويق بالعمولة",
    state: "available",
    badge: "تصفية يدوية",
    reason: "تُسجَّل العمولات وتُصفّى يدوياً بعد توصيل الطلب. لا يوجد صرف آلي أو رصيد قابل للسحب.",
  },
  "/dashboard/loyalty": {
    label: "برنامج الولاء",
    state: "coming_soon",
    reason: "كسب النقاط وتعديلها يعمل، لكن استبدالها عند الشراء لم يُبنَ بعد. الصفحة غير متاحة حتى يكتمل الاستبدال.",
  },
  "/dashboard/assistant": {
    label: "مساعد التسويق",
    state: "needs_setup",
    badge: "يتطلب إعداد",
    reason: "يعمل فقط عند إعداد مزود ذكاء اصطناعي على الخادم. بدون ذلك لن يولّد أي محتوى.",
  },
  "/dashboard/pages": { label: "الصفحات", state: "available" },
  "/dashboard/blog": { label: "المدونة", state: "available" },
  "/dashboard/wallet": {
    label: "المحفظة",
    state: "available",
    badge: "بموافقة الإدارة",
    reason: "طلبات الإيداع تُسجَّل كطلبات معلّقة ولا تُضاف إلى الرصيد إلا بعد اعتماد إدارة المنصة.",
  },
  "/dashboard/dropshipping": {
    label: "الدروبشيبينغ",
    state: "coming_soon",
    reason: "لا يوجد ربط بموردين أو توريد آلي. إدارة أسماء الموردين فقط لا تكفي لعرض الميزة كعملية مكتملة.",
  },
  "/dashboard/settings": { label: "الإعدادات", state: "available" },
  "/dashboard/learn": { label: "الدليل السريع", state: "available" },
};

export function featureForPath(path: string): FeatureDefinition | undefined {
  return FEATURE_REGISTRY[path];
}

/**
 * Applies live integration state to a registry entry.
 *
 * The static registry cannot know whether an AI provider was configured in the
 * server environment, so the assistant would otherwise keep showing "setup
 * required" even while its page correctly reports a working connection.
 */
export function resolveFeature(
  path: string,
  runtime: FeatureRuntime = {}
): FeatureDefinition | undefined {
  const feature = FEATURE_REGISTRY[path];
  if (!feature) return undefined;
  if (path === "/dashboard/assistant" && runtime.assistantConfigured === true) {
    return { ...feature, state: "available", badge: undefined, reason: undefined };
  }
  return feature;
}

export function isFeatureVisible(path: string): boolean {
  const feature = FEATURE_REGISTRY[path];
  return Boolean(feature && feature.state !== "coming_soon" && feature.state !== "not_in_plan");
}

export function isFeatureGated(path: string): boolean {
  const feature = FEATURE_REGISTRY[path];
  return Boolean(feature && (feature.state === "coming_soon" || feature.state === "not_in_plan"));
}
