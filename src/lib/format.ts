export const CURRENCIES: Record<string, { label: string; symbol: string }> = {
  EGP: { label: "جنيه مصري", symbol: "ج.م" },
};

export function money(value: number | null | undefined, currency = "EGP"): string {
  const n = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("ar-EG-u-nu-latn", {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
  return `${formatted} ${CURRENCIES[currency]?.symbol ?? currency}`;
}

export function number(value: number | null | undefined): string {
  return new Intl.NumberFormat("ar-EG-u-nu-latn").format(Number(value ?? 0));
}

export function percent(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat("ar-EG-u-nu-latn", { maximumFractionDigits: 1 }).format(n)}%`;
}

export function date(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function dayMonth(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { month: "short", day: "numeric" }).format(d);
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return "";
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.round(hours / 24);
  if (days < 30) return `قبل ${days} يوم`;
  return date(value);
}

export const ORDER_STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  pending: { label: "قيد الانتظار", tone: "bg-warning-soft text-warning border-warning-line", dot: "bg-warning" },
  needs_confirmation: { label: "بانتظار التأكيد", tone: "bg-warning-soft text-warning border-warning-line", dot: "bg-warning" },
  confirmed: { label: "مؤكد", tone: "bg-info-soft text-info border-info-line", dot: "bg-info" },
  preparing: { label: "قيد التجهيز", tone: "bg-info-soft text-info border-info-line", dot: "bg-info" },
  ready_to_ship: { label: "جاهز للشحن", tone: "bg-info-soft text-info border-info-line", dot: "bg-info" },
  shipped: { label: "تم الشحن", tone: "bg-brand-soft text-brand border-brand-line", dot: "bg-brand" },
  out_for_delivery: { label: "خرج للتوصيل", tone: "bg-brand-soft text-brand border-brand-line", dot: "bg-brand" },
  delivered: { label: "تم التوصيل", tone: "bg-success-soft text-success border-success-line", dot: "bg-success" },
  cancelled: { label: "ملغي", tone: "bg-danger-soft text-danger border-danger-line", dot: "bg-danger" },
  returned: { label: "مرتجع", tone: "border-line bg-surface text-subtle", dot: "bg-subtle" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "غير مدفوع", tone: "bg-warning-soft text-warning border-warning-line" },
  paid: { label: "مدفوع", tone: "bg-success-soft text-success border-success-line" },
  partially_refunded: { label: "مسترد جزئياً", tone: "bg-info-soft text-info border-info-line" },
  refunded: { label: "مسترد", tone: "border-line bg-surface text-subtle" },
  failed: { label: "فشل الدفع", tone: "bg-danger-soft text-danger border-danger-line" },
};

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["needs_confirmation", "confirmed", "cancelled"],
  needs_confirmation: ["pending", "confirmed", "cancelled"],
  confirmed: ["preparing", "ready_to_ship", "shipped", "cancelled"],
  preparing: ["ready_to_ship", "shipped", "cancelled"],
  ready_to_ship: ["shipped", "out_for_delivery", "cancelled"],
  shipped: ["out_for_delivery", "delivered", "cancelled", "returned"],
  out_for_delivery: ["delivered", "cancelled", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

/**
 * Mirrors server/validate.ts. A paid order cannot silently become unpaid;
 * refund states change only through the refund workflow.
 */
export const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  unpaid: ["paid", "failed"],
  failed: ["unpaid", "paid"],
  paid: ["refunded"],
  partially_refunded: ["refunded"],
  refunded: [],
};

export const BUSINESS_TYPES: Record<string, string> = {
  fashion: "أزياء وملابس",
  electronics: "إلكترونيات",
  restaurant: "مطاعم وأغذية",
  beauty: "تجميل وعناية",
  furniture: "أثاث ومفروشات",
  digital: "منتجات رقمية",
  services: "خدمات",
  other: "أخرى",
};

export const TEMPLATES: Record<string, { label: string; description: string; accent: string; emoji: string }> = {
  general: { label: "متجر عام", description: "مرن لكل المنتجات والقطاعات", accent: "#047857", emoji: "🛍️" },
  fashion: { label: "أزياء", description: "صور كبيرة وتجربة بصرية أنيقة", accent: "#DB2777", emoji: "👗" },
  electronics: { label: "إلكترونيات", description: "مواصفات تقنية ومقارنة سريعة", accent: "#0891B2", emoji: "💻" },
  restaurant: { label: "مطاعم", description: "قوائم طعام وطلبات سريعة", accent: "#EA580C", emoji: "🍽️" },
  beauty: { label: "تجميل", description: "هوية ناعمة وتركيز على العناية", accent: "#9333EA", emoji: "💄" },
  services: { label: "خدمات", description: "احترافية لحجز الخدمات وعرضها", accent: "#059669", emoji: "🧰" },
};

export const EGYPT_GOVERNORATES = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "القليوبية",
  "الشرقية",
  "الدقهلية",
  "المنوفية",
  "الغربية",
  "البحيرة",
  "دمياط",
  "بورسعيد",
  "الإسماعيلية",
  "السويس",
  "كفر الشيخ",
  "الفيوم",
  "بني سويف",
  "المنيا",
  "أسيوط",
  "سوهاج",
  "قنا",
  "الأقصر",
  "أسوان",
  "البحر الأحمر",
  "الوادي الجديد",
  "مطروح",
  "شمال سيناء",
  "جنوب سيناء",
];

export function statusLabel(status: string): string {
  return ORDER_STATUS[status]?.label ?? status;
}

export function paymentLabel(status: string): string {
  return PAYMENT_STATUS[status]?.label ?? status;
}

export interface PresentedError {
  title: string;
  message: string;
  action: "login" | "retry" | "back" | "contact" | "check";
  retryable: boolean;
}

export function presentApiError(err: any): PresentedError {
  const status = Number(err?.status || 0);
  if (status === 401) return { title: "انتهت الجلسة", message: "سجّل الدخول مرة أخرى للمتابعة.", action: "login", retryable: false };
  if (status === 403) return { title: "لا تملك الصلاحية", message: "اطلب من مالك المتجر منحك الصلاحية المطلوبة.", action: "back", retryable: false };
  if (status === 404) return { title: "العنصر غير موجود", message: "ربما تم حذفه أو لم يعد متاحاً. ارجع للقائمة وحاول من جديد.", action: "back", retryable: false };
  if (status === 409) return { title: "تعارض في البيانات", message: "تغيّرت البيانات منذ فتح الصفحة. حدّث الصفحة وراجع التغييرات.", action: "check", retryable: true };
  if (status === 429 || err?.code === "RATE_LIMITED") return { title: "محاولات كثيرة", message: "انتظر قليلاً ثم حاول مجدداً.", action: "retry", retryable: true };
  if (status >= 500 || !status) return { title: "الخدمة غير متاحة", message: "تعذر الاتصال بالخادم. تحقّق من الاتصال ثم أعد المحاولة.", action: "retry", retryable: true };
  return { title: "تعذر تنفيذ الطلب", message: safeErrorLegacy(err), action: "check", retryable: false };
}

function safeErrorLegacy(err: any): string {
  const message = typeof err?.message === "string" ? err.message : "";
  if (err?.code === "INVALID_CREDENTIALS") return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (err?.code === "VALIDATION_ERROR") return "تحقق من البيانات المدخلة ثم حاول مجدداً.";
  return message || "تحقق من البيانات ثم حاول مجدداً.";
}

export function safeError(err: any): string {
  const message = typeof err?.message === "string" ? err.message : "";
  if ([401, 403, 404, 409, 429].includes(Number(err?.status)) || Number(err?.status) >= 500 || !Number(err?.status) && err?.code === "NETWORK_ERROR") {
    return presentApiError(err).message;
  }
  if (err?.code === "INVALID_CREDENTIALS") return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (err?.code === "EMAIL_TAKEN") return "هذا البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول.";
  if (err?.code === "SUBDOMAIN_TAKEN") return "رابط المتجر محجوز. اختر رابطاً آخر.";
  if (err?.code === "VALIDATION_ERROR") return "تحقق من البيانات المدخلة ثم حاول مجدداً.";
  if (err?.code === "AI_NOT_CONFIGURED") return "المساعد الذكي غير متصل بعد. أضف بيانات مزود الذكاء الاصطناعي في بيئة الخادم.";
  if (err?.code === "PAYMENT_PROVIDER_NOT_CONFIGURED") return "بوابة الدفع الإلكتروني غير مهيأة بعد.";
  if (err?.code === "INVITE_NOT_FOUND") return "رابط الدعوة غير صالح أو تم استخدامه بالفعل. اطلب دعوة جديدة من مالك المتجر.";
  if (err?.code === "INVITE_ALREADY_ACCEPTED") return "تم قبول هذه الدعوة بالفعل. سجّل الدخول بحساب الفريق.";
  if (err?.code === "INVITE_EXPIRED") return "انتهت صلاحية الدعوة. اطلب من مالك المتجر إرسال دعوة جديدة.";
  if (err?.code === "TEAM_INVITE_PENDING") return "لم تُقبل دعوتك بعد. افتح رابط الدعوة وأكمل إنشاء كلمة المرور أولاً.";
  if (err?.code === "TEAM_MEMBER_SUSPENDED") return "حسابك في فريق المتجر موقوف. تواصل مع مالك المتجر.";
  if (err?.code === "TEAM_MEMBER_EXISTS") return "هذا البريد عضو في الفريق بالفعل.";
  return message || "حدث خطأ غير متوقع. حاول مرة أخرى.";
}
