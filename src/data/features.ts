export interface FeatureSystem {
  id: string;
  iconName: string;
  title_ar: string;
  title_en: string;
  short_description_ar: string;
  short_description_en: string;
  detailed_points_ar: string[];
  detailed_points_en: string[];
  status: 'active' | 'limited' | 'designed_for_expansion';
  badge_ar?: string;
  badge_en?: string;
}

export const PLATFORM_CORE_SYSTEMS: FeatureSystem[] = [
  {
    id: 'store-engine',
    iconName: 'Store',
    title_ar: 'محرك المتجر والواجهة العربية',
    title_en: 'Store Engine & Arabic Storefront',
    short_description_ar: 'واجهات تسوق عربية سريعة ومصممة هندسياً لهواتف المتسوقين العرب ومعدلات تحويل مرتفعة.',
    short_description_en: 'Lightning-fast Arabic shopping interfaces engineered for mobile shoppers with high conversion rates.',
    detailed_points_ar: [
      'تصميم RTL حقيقي من الأساس وليس مجرد قالب معرّب شكلياً',
      'سرعة فائقة في التصفح وسلة الشراء تعمل بسلاسة على شبكات 4G',
      'نطاق فرعي مجاني (yourstore.sanad.app) مع HTTPS؛ ربط النطاق المستقل قيد التطوير',
      'تخصيص الهوية البصرية، الشعار، الألوان، وأقسام الصفحة الرئيسية بدون كتابة أكواد',
      'صفحة إتمام طلب فائقة البساطة مخصصة لتقليل التخلي عن السلة'
    ],
    detailed_points_en: [
      'Native RTL typography and flow, not a superficial translation',
      'Fast loading speed optimized for 4G mobile networks across the Arab world',
      'Free Sanad subdomain (yourstore.sanad.app) with HTTPS; custom domains are planned',
      'Brand customization: logos, palettes, banner sections without touching code',
      'Streamlined checkout flow engineered to minimize cart abandonment'
    ],
    status: 'active'
  },
  {
    id: 'products-inventory',
    iconName: 'Package',
    title_ar: 'المنتجات وإدارة المخزون والتتبع',
    title_en: 'Products, Variants & Inventory',
    short_description_ar: 'تنظيم عميق للمنتجات، التصنيفات المتعددة، المتغيرات (المقاسات والألوان)، وسجل حركات المخزون.',
    short_description_en: 'Comprehensive product catalogs, nested categories, multi-variants, and inventory history audit.',
    detailed_points_ar: [
      'دعم غير محدود للمنتجات، الصور عالية الدقة، والوصف الغني لمحركات البحث',
      'إدارة متغيرات المقاس واللون مع تخصيص سعر ومخزون لكل متغير SKU',
      'تتبع حركات وتاريخ المخزون مع تنبيهات عند اقتراب نفاد الكمية',
      'تحسين سيو تلقائي للمنتجات (Product Schema + Meta Tags + Clean URLs)',
      'تحديد أوزان المنتجات وأبعادها لحساب تكاليف الشحن تلقائياً'
    ],
    detailed_points_en: [
      'Unlimited products, high-res galleries, and rich SEO-ready descriptions',
      'Multi-dimensional variants (size, color, material) with distinct SKU inventory',
      'Stock history audit trail with rule-based low-stock notifications',
      'Automatic Product Schema.org structured data, meta tags, and clean URLs',
      'Product weight and dimensions configuration for accurate carrier tariffs'
    ],
    status: 'active'
  },
  {
    id: 'cod-lifecycle',
    iconName: 'Banknote',
    title_ar: 'نظام الدفع عند الاستلام الاستراتيجي (COD)',
    title_en: 'Strategic Cash on Delivery (COD) Operating System',
    short_description_ar: 'إدارة دورة حياة الدفع عند الاستلام بالكامل لتقليل نسبة المرتجعات وتحصيل أموالك بسرعة.',
    short_description_en: 'End-to-end COD operations pipeline designed to slash cancellations and safeguard cashflow.',
    detailed_points_ar: [
      'تتبع دورة حياة الطلب: وارد ← مؤكد هاتفياً / عبر واتساب ← قيد التجهيز ← مشحون ← جاري التوصيل ← تم التسليم والتحصيل ← مرتجع',
      'حساب مؤشرات COD الحيوية: معدل نجاح التسليم ونسبة الإلغاء، مع تسجيل التحصيل يدوياً لكل طلب',
      'إمكانية فرض رسم رمزي على خيار الدفع عند الاستلام لتغطية تكلفة التحصيل',
      'حظر العملاء غير الجادين وأصحاب المرتجعات المتكررة لحماية رأس مالك',
      'رسالة واتساب جاهزة يرسلها التاجر يدوياً عند خروج الشحنة؛ لا إشعارات تلقائية'
    ],
    detailed_points_en: [
      '8-stage pipeline: Placed → Confirmed → Picked → Shipped → Out for Delivery → Delivered & Collected → Remitted/Returned',
      'Actionable COD KPIs: delivery success rate, cancellation rate, and manual collection recording per order',
      'Configurable COD fee surcharge to cover the cost of collection',
      'Fraud prevention and repeat-return customer flags to protect merchant margins',
      'Prepared WhatsApp message the merchant sends manually when the parcel is dispatched; no automatic alerts'
    ],
    status: 'active',
    badge_ar: 'محور التجارة في مصر والمنطقة',
    badge_en: 'Core Arab Commerce Lifeline'
  },
  {
    id: 'orders-operations',
    iconName: 'ShoppingBag',
    title_ar: 'إدارة الطلبات والعمليات',
    title_en: 'Orders & Fulfillment Operations',
    short_description_ar: 'لوحة قيادة مركزية لمتابعة كافة الطلبات، طباعة البوالص، وتحديث الحالات فورياً.',
    short_description_en: 'Unified operations command center to process orders, print packing slips, and update statuses.',
    detailed_points_ar: [
      'فلترة متقدمة للطلبات حسب الحالة، طريقة الدفع، المحافظة، وقيمة الطلب',
      'طباعة فواتير مبيعات احترافية وبوالص شحن مجهزة لتسليمها لشركة الشحن',
      'سجل زمني مفصل لكل عملية تعديل أو اتصال تم على الطلب لمنع تضارب فريق العمل',
      'معمارية معتمدة لإدارة المرتجعات والاستبدال الجزئي أو الكلي'
    ],
    detailed_points_en: [
      'Smart order filtering by fulfillment status, payment method, city, and order total',
      '1-click printable Arabic invoices, packing slips, and courier manifest sheets',
      'Detailed audit log for every status change and customer interaction',
      'Structured returns, exchanges, and partial refund handling framework'
    ],
    status: 'active'
  },
  {
    id: 'shipping-logistics',
    iconName: 'Truck',
    title_ar: 'الشحن والمناطق الجغرافية (يدوي)',
    title_en: 'Shipping Zones (Manual)',
    short_description_ar: 'تخصيص أسعار الشحن بحسب المحافظات المصرية ودول الخليج مع خيارات الشحن المجاني. الربط مع شركات الشحن والتتبع غير متاحين.',
    short_description_en: 'Manual shipping rates by Egyptian governorate and Gulf destination with free-delivery thresholds. Carrier integration and tracking are not available.',
    detailed_points_ar: [
      'تقسيم المحافظات (القاهرة والجيزة، الإسكندرية، محافظات الدلتا، الصعيد، القناة، المحافظات الحدودية)',
      'تسعير خاص للشحن الدولي عابر الحدود إلى السعودية، الإمارات، والكويت',
      'تحديد حد أدنى للطلب لتفعيل الشحن المجاني (أداة مؤكدة لرفع متوسط قيمة السلة AOV)',
      'إدارة يدوية لشركات الشحن: تُسجَّل بيانات الناقل في الطلب دون ربط آلي أو تتبع شحنات',
    ],
    detailed_points_en: [
      'Egyptian governorate clusters (Greater Cairo, Alexandria, Delta, Upper Egypt, Red Sea & Frontier)',
      'Dedicated cross-border shipping tariffs for Saudi Arabia, UAE, and GCC',
      'Dynamic free shipping thresholds to systematically lift Average Order Value (AOV)',
      'Manual courier records on each order; no carrier API integration or shipment tracking',
    ],
    status: 'limited',
    badge_ar: 'مناطق وأسعار فقط — بدون تتبع',
    badge_en: 'Zones & rates only — no tracking'
  },
  {
    id: 'payments-engine',
    iconName: 'CreditCard',
    title_ar: 'المدفوعات والدفع عند الاستلام',
    title_en: 'Payments & Cash on Delivery',
    short_description_ar: 'الدفع عند الاستلام هو الخيار الفعلي. الدفع الإلكتروني غير متاح حتى يكتمل محوّل الدفع والاختبارات الأمنية.',
    short_description_en: 'Cash on delivery is live. Online card and wallet payments stay disabled until a complete payment adapter and security tests ship.',
    detailed_points_ar: [
      'الدفع عند الاستلام (COD) مدمج وجاهز للعمل من اللحظة الأولى',
      'لا يوجد محوّل دفع إلكتروني مثبت؛ خيار الدفع الإلكتروني معطّل في المتجر ولوحة التحكم',
      'البنية المعمارية تسمح بإضافة مزود لاحقاً، لكنها ليست تكاملاً جاهزاً ولا تعني أن الدفع الإلكتروني يعمل',
      'المنصة لا تحتفظ بأموال المبيعات؛ الدفع عند الاستلام يُحصَّل خارج سند'
    ],
    detailed_points_en: [
      'Cash on delivery is active from day one',
      'No online payment adapter is installed; digital payment stays disabled in the storefront and dashboard',
      'The codebase can host a provider later, but that is not a working integration and does not mean online payments work',
      'Sanad never holds sale proceeds; cash on delivery is collected outside the platform'
    ],
    status: 'limited',
    badge_ar: 'الدفع عند الاستلام فقط',
    badge_en: 'COD only'
  },
  {
    id: 'whatsapp-commerce',
    iconName: 'MessageCircle',
    title_ar: 'التواصل عبر واتساب (يدوي)',
    title_en: 'WhatsApp Outreach (Manual)',
    short_description_ar: 'روابط wa.me يدوية وتذكير السلات المتروكة برسائل جاهزة. الإرسال التلقائي يحتاج مزوداً وقالباً معتمداً.',
    short_description_en: 'Manual wa.me links and prepared abandoned-cart reminders. Automated sending requires a configured provider and an approved template.',
    detailed_points_ar: [
      'زر شراء واستفسار سريع عبر واتساب مدمج في صفحة كل منتج',
      'رسالة جاهزة لتأكيد بيانات العنوان تُفتح في واتساب ويرسلها التاجر يدوياً',
      'لا يوجد إرسال تلقائي أو إشعار بوليصة؛ يمكن نسخ رابط تتبع الطلب وإرساله يدوياً',
      'تذكير السلات المتروكة يفتح واتساب برسالة جاهزة ولا يُعلّم السلة كمذكّرة تلقائياً'
    ],
    detailed_points_en: [
      'A WhatsApp inquiry/purchase button embedded on each product page',
      'A prepared address-confirmation message opens in WhatsApp and the merchant sends it manually',
      'No automated sending or shipment notification; copy the order tracking link and send it manually',
      'Abandoned-cart reminders open WhatsApp with a prepared message and never mark the cart as auto-reminded'
    ],
    status: 'limited',
    badge_ar: 'روابط يدوية — بدون إرسال تلقائي',
    badge_en: 'Manual links — no auto-send'
  },
  {
    id: 'meta-commerce',
    iconName: 'Share2',
    title_ar: 'منظومة ميتا التجارية (Meta Commerce)',
    title_en: 'Meta Commerce Architecture',
    short_description_ar: 'قيد التطوير: ربط فيسبوك وإنستغرام لتتبع الحملات وكتالوج المنتجات وقياس عائد الإعلانات. غير متاح للاستخدام الآن.',
    short_description_en: 'Planned: Facebook and Instagram sync for campaign tracking, product catalog, and ROAS. Not available for use yet.',
    detailed_points_ar: [
      'تجهيز خلاصة المنتجات الحية (XML Product Feed) للربط مع Meta Commerce Manager',
      'تكامل مع Meta Pixel و Conversions API (CAPI) لتجاوز قيود متصفحات iOS وتتبع دقيق للمبيعات',
      'تتبع مسار التجارة الكامل: الإعلان ← المتجر ← إضافة للسلة ← الطلب ← الإيراد الفعلي',
      'تحديد المنتجات الأكثر مبيعاً لتوجيه ميزانيات الحملات الإعلانية بدقة'
    ],
    detailed_points_en: [
      'Real-time XML product feed for automated Meta Commerce Manager catalog sync',
      'Meta Pixel + Conversions API (CAPI) framework to bypass iOS privacy drops and ensure attribution',
      'Closed-loop commerce attribution: Ad → Storefront → AddToCart → Purchase → Real Revenue',
      'Product performance insights to allocate advertising spend effectively'
    ],
    status: 'designed_for_expansion',
    badge_ar: 'قيد التطوير — ليست ميزة متاحة',
    badge_en: 'Planned — not available'
  },
  {
    id: 'google-ecosystem',
    iconName: 'Search',
    title_ar: 'منظومة جوجل التجارية (Google Commerce)',
    title_en: 'Google Commerce Ecosystem',
    short_description_ar: 'قيد التطوير: تجهيز متجرك لنتائج Google Shopping وتحليلات GA4 وتتبع حملات Google Ads. غير متاح للاستخدام الآن.',
    short_description_en: 'Planned: prepare your store for Google Shopping, GA4 ecommerce tracking, and Google Ads conversions. Not available for use yet.',
    detailed_points_ar: [
      'توليد خلاصة Google Merchant Center المتوافقة مع معايير محرك البحث',
      'ربط Google Analytics 4 (GA4) مع تتبع كامل لأحداث الشراء (Purchase, BeginCheckout)',
      'دعم Google Tag Manager (GTM) لإدارة وسوم التتبع بحرية تامة',
      'بناء روابط التتبع الذكية UTM لمراقبة مصدر كل طلب ومبيعة'
    ],
    detailed_points_en: [
      'Standardized Google Merchant Center product feed generator for Shopping ads',
      'Google Analytics 4 (GA4) ecommerce event measurement (view_item, purchase, etc.)',
      'Google Tag Manager (GTM) container container architecture for flexible script management',
      'Automated UTM campaign parameter capture for clear source-of-sale attribution'
    ],
    status: 'designed_for_expansion',
    badge_ar: 'قيد التطوير — ليست ميزة متاحة',
    badge_en: 'Planned — not available'
  },
  {
    id: 'growth-center',
    iconName: 'TrendingUp',
    title_ar: 'مركز نمو التاجر والتحليلات التحليلية',
    title_en: 'Merchant Growth Center & Analytics',
    short_description_ar: 'لوحة مؤشرات واضحة تركز على الربحية الحقيقية، معدلات استكمال الطلبات، وتكرار الشراء.',
    short_description_en: 'Pragmatic KPI cockpit focusing on genuine net margins, order fulfillment rates, and customer retention.',
    detailed_points_ar: [
      'متابعة صافي المبيعات، عدد الطلبات، ومتوسط قيمة السلة (AOV)',
      'تحليل جودة الطلبات: نسبة الإلغاء، نسبة المرتجع، ونسبة الطلبات المسلمة فعلياً',
      'تحديد أفضل المنتجات مبيعاً وأكثرها ربحية دون الاعتماد على ادعاءات ذكاء اصطناعي وهمية',
      'مراقبة أداء قسائم التخفيضات ومردود حملات التسويق'
    ],
    detailed_points_en: [
      'Net revenue, order counts, and Average Order Value (AOV) real-time counters',
      'Fulfillment health metrics: cancellation rate, return rate, collected cash ratio',
      'Top-performing products and repeat customer frequency calculated deterministically',
      'Coupon code efficacy and marketing channel contribution metrics'
    ],
    status: 'active'
  },
  {
    id: 'migration-center',
    iconName: 'RefreshCw',
    title_ar: 'مركز الترحيل (قيد التطوير)',
    title_en: 'Migration Center (Planned)',
    short_description_ar: 'الترحيل التلقائي غير متاح الآن. عند إطلاقه سيتيح استيراد الكتالوج من ملفات CSV و Excel؛ حالياً تُضاف المنتجات يدوياً.',
    short_description_en: 'Automatic migration is not available today. When shipped it will support catalogue import from CSV and Excel; products are currently added manually.',
    detailed_points_ar: [
      'استيراد ملفات المنتجات والمخزون سيتاح عند إطلاق الميزة؛ غير متاح الآن',
      'قوالب Excel و CSV للتحميل والتعبئة قيد التطوير',
      'تصدير الطلبات والعملاء بصيغة CSV متاح الآن؛ تصدير كامل البيانات ليس متاحاً بعد',
      'مطابقة الحقول التلقائية قيد التطوير وليست متاحة للاستخدام'
    ],
    detailed_points_en: [
      'Product and inventory file import will be available when the feature ships; it is not available now',
      'Downloadable CSV/Excel templates are planned',
      'Orders and customers can be exported as CSV today; a complete data export is not available yet',
      'Automatic column mapping is planned and is not available for use'
    ],
    status: 'designed_for_expansion',
    badge_ar: 'قيد التطوير — ليست ميزة متاحة',
    badge_en: 'Planned — not available'
  }
];
