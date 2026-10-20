export const CURRENCIES: Record<string, { label: string; symbol: string }> = {
  EGP: { label: "جنيه مصري", symbol: "ج.م" },
  SAR: { label: "ريال سعودي", symbol: "ر.س" },
  AED: { label: "درهم إماراتي", symbol: "د.إ" },
  KWD: { label: "دينار كويتي", symbol: "د.ك" },
  QAR: { label: "ريال قطري", symbol: "ر.ق" },
  USD: { label: "دولار أمريكي", symbol: "$" },
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
  pending: { label: "قيد الانتظار", tone: "bg-amber-500/10 text-amber-300 border-amber-500/25", dot: "bg-amber-400" },
  needs_confirmation: { label: "بانتظار التأكيد", tone: "bg-orange-500/10 text-orange-300 border-orange-500/25", dot: "bg-orange-400" },
  confirmed: { label: "مؤكد", tone: "bg-sky-500/10 text-sky-300 border-sky-500/25", dot: "bg-sky-400" },
  preparing: { label: "قيد التجهيز", tone: "bg-indigo-500/10 text-indigo-300 border-indigo-500/25", dot: "bg-indigo-400" },
  ready_to_ship: { label: "جاهز للشحن", tone: "bg-violet-500/10 text-violet-300 border-violet-500/25", dot: "bg-violet-400" },
  shipped: { label: "تم الشحن", tone: "bg-blue-500/10 text-blue-300 border-blue-500/25", dot: "bg-blue-400" },
  out_for_delivery: { label: "خرج للتوصيل", tone: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25", dot: "bg-cyan-400" },
  delivered: { label: "تم التوصيل", tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", dot: "bg-emerald-400" },
  cancelled: { label: "ملغي", tone: "bg-rose-500/10 text-rose-300 border-rose-500/25", dot: "bg-rose-400" },
  returned: { label: "مرتجع", tone: "bg-slate-500/10 text-slate-300 border-slate-500/25", dot: "bg-slate-400" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "غير مدفوع", tone: "bg-amber-500/10 text-amber-300 border-amber-500/25" },
  paid: { label: "مدفوع", tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" },
  partially_refunded: { label: "مسترد جزئياً", tone: "bg-violet-500/10 text-violet-300 border-violet-500/25" },
  refunded: { label: "مسترد", tone: "bg-slate-500/10 text-slate-300 border-slate-500/25" },
  failed: { label: "فشل الدفع", tone: "bg-rose-500/10 text-rose-300 border-rose-500/25" },
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
  general: { label: "متجر عام", description: "مرن لكل المنتجات والقطاعات", accent: "#2563EB", emoji: "🛍️" },
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

export function safeError(err: any): string {
  const message = typeof err?.message === "string" ? err.message : "";
  if (err?.status === 429 || err?.code === "RATE_LIMITED") return "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.";
  if (err?.code === "INVALID_CREDENTIALS") return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (err?.code === "EMAIL_TAKEN") return "هذا البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول.";
  if (err?.code === "SUBDOMAIN_TAKEN") return "رابط المتجر محجوز. اختر رابطاً آخر.";
  if (err?.code === "VALIDATION_ERROR") return "تحقق من البيانات المدخلة ثم حاول مجدداً.";
  if (err?.code === "AI_NOT_CONFIGURED") return "المساعد الذكي غير متصل بعد. أضف بيانات مزود الذكاء الاصطناعي في بيئة الخادم.";
  if (err?.code === "PAYMENT_PROVIDER_NOT_CONFIGURED") return "بوابة الدفع الإلكتروني غير مهيأة بعد.";
  return message || "حدث خطأ غير متوقع. حاول مرة أخرى.";
}
