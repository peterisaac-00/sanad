/**
 * Static quick-guide content. Kept separate from the React page so route links
 * can be regression-tested against the features that actually exist.
 */
export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  href?: string;
}

export const LEARN_CHECKLIST: { title: string; items: ChecklistItem[] }[] = [
  {
    title: "جهّز متجرك للبيع",
    items: [
      { id: "product", label: "أضف أول منتج مع صورة وسعر", hint: "المنتجات ← منتج جديد", href: "/dashboard/products" },
      { id: "categories", label: "أنشئ فئات لتنظيم الكتالوج", hint: "منتجات بفئات واضحة تُشترى أكثر", href: "/dashboard/categories" },
      { id: "shipping", label: "أضف منطقة شحن بأسعار التحصيل", hint: "بدون منطقة شحن لن يُحسب الشحن في الطلبات", href: "/dashboard/shipping" },
      { id: "whatsapp", label: "أضف رقم واتساب للدعم", hint: "يظهر في متجرك وصفحة نجاح الطلب", href: "/dashboard/settings" },
    ],
  },
  {
    title: "ابدأ استقبال أول طلب",
    items: [
      { id: "share", label: "شارك رابط متجرك أو استخدم كود الإحالة", hint: "انسخ الرابط من بطاقة المتجر في الشريط الجانبي" },
      { id: "confirm", label: "أكد الطلبات الجديدة خلال 30 دقيقة", hint: "الطلبات ← تغيير الحالة إلى «مؤكد»", href: "/dashboard/orders" },
      { id: "track", label: "تابع حالة الطلب حتى التوصيل", hint: "قيد التجهيز ← جاهز للشحن ← خرج للتوصيل ← تم التوصيل" },
      { id: "manual", label: "سجّل الطلبات الخارجية يدوياً", hint: "طلبات واردة من واتساب/سوق خارجي ← تسجيل طلب يدوي خارجي", href: "/dashboard/orders" },
    ],
  },
  {
    title: "انمُ بعد أول طلب",
    items: [
      { id: "coupon", label: "أنشئ كوبون ترحيبي للعملاء الجدد", hint: "مثال: WELCOME10", href: "/dashboard/coupons" },
      { id: "abandoned", label: "تابع السلات المتروكة عبر واتساب", hint: "تذكير يدوي برسالة جاهزة", href: "/dashboard/abandoned-carts" },
      { id: "reviews", label: "راجع التقييمات ووافق على الجيد منها", hint: "التقييمات المنشورة تبني الثقة", href: "/dashboard/reviews" },
      { id: "reports", label: "راقب أفضل المنتجات أسبوعياً", hint: "التقارير ← أفضل المنتجات", href: "/dashboard/reports" },
    ],
  },
];

export type GuideIcon = "play" | "book" | "growth" | "catalog";

export interface LearnGuide {
  title: string;
  description: string;
  minutes: number;
  href: string;
  icon: GuideIcon;
  tone: string;
}

export const LEARN_GUIDES: LearnGuide[] = [
  { title: "دليل البداية السريعة", description: "من أول منتج حتى أول طلب مؤكد، خطوة بخطوة.", minutes: 5, href: "/dashboard/products", icon: "play", tone: "from-brand/20" },
  { title: "إدارة الطلبات والشحن", description: "حالات الطلب، التحصيل، الشحن اليدوي ومناطق الشحن.", minutes: 7, href: "/dashboard/orders", icon: "book", tone: "from-info/20" },
  { title: "التسويق والنمو", description: "الكوبونات، السلات المتروكة، والعمولات مع تصفية يدوية.", minutes: 8, href: "/dashboard/coupons", icon: "growth", tone: "from-success/20" },
  { title: "المنتجات والكتالوج", description: "أفضل ممارسات الصور والأوصاف والأسعار والمتغيرات.", minutes: 6, href: "/dashboard/products", icon: "catalog", tone: "from-warning/20" },
];

export const LEARN_GUIDE_LINKS = LEARN_GUIDES.map((guide) => guide.href);

export const LEARN_ROUTE_PATHS = Array.from(
  new Set([
    ...LEARN_CHECKLIST.flatMap((group) => group.items.map((item) => item.href).filter((href): href is string => Boolean(href))),
    ...LEARN_GUIDE_LINKS,
  ])
);
