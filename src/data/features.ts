export interface FeatureSystem {
  id: string;
  iconName: string;
  title_ar: string;
  title_en: string;
  short_description_ar: string;
  short_description_en: string;
  detailed_points_ar: string[];
  detailed_points_en: string[];
  status: 'active' | 'designed_for_expansion';
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
      'إمكانية ربط نطاقك المخصص (.com / .eg / .sa) مجاناً مع شهادة SSL سحابية',
      'تخصيص الهوية البصرية، الشعار، الألوان، وأقسام الصفحة الرئيسية بدون كتابة أكواد',
      'صفحة إتمام طلب فائقة البساطة مخصصة لتقليل التخلي عن السلة'
    ],
    detailed_points_en: [
      'Native RTL typography and flow, not a superficial translation',
      'Fast loading speed optimized for 4G mobile networks across the Arab world',
      'Free custom domain connection (.com / .eg / .sa) with automatic Cloud SSL',
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
      'حساب مؤشرات COD الحيوية: معدل نجاح التسليم، نسبة الإلغاء، ومطابقة التحصيلات النقدية مع شركة الشحن',
      'إمكانية فرض رسم رمزي على خيار الدفع عند الاستلام لتشجيع الدفع الإلكتروني',
      'حظر العملاء غير الجادين وأصحاب المرتجعات المتكررة لحماية رأس مالك',
      'إشعار المشتري تلقائياً برسالة تذكير عند خروج الشحنة مع المندوب'
    ],
    detailed_points_en: [
      '8-stage pipeline: Placed → Confirmed → Picked → Shipped → Out for Delivery → Delivered & Collected → Remitted/Returned',
      'Actionable COD KPIs: Delivery success rate, cancellation rate, courier cash reconciliation',
      'Configurable COD fee surcharge to incentivize pre-paid digital transactions',
      'Fraud prevention and repeat-return customer flags to protect merchant margins',
      'Automatic delivery day SMS/WhatsApp alerts when courier is dispatched'
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
    title_ar: 'الشحن والمناطق الجغرافية',
    title_en: 'Shipping Zones & Logistics Architecture',
    short_description_ar: 'تخصيص أسعار الشحن بحسب المحافظات المصرية ودول الخليج مع خيارات الشحن المجاني.',
    short_description_en: 'Granular shipping rules by Egyptian governorates and Gulf countries with free delivery thresholds.',
    detailed_points_ar: [
      'تقسيم المحافظات (القاهرة والجيزة، الإسكندرية، محافظات الدلتا، الصعيد، القناة، المحافظات الحدودية)',
      'تسعير خاص للشحن الدولي عابر الحدود إلى السعودية، الإمارات، والكويت',
      'تحديد حد أدنى للطلب لتفعيل الشحن المجاني (أداة مؤكدة لرفع متوسط قيمة السلة AOV)',
      'خيارات الربط مع شركات الشحن الرائدة (بوسطة، أرامكس، سمسا، وغيرها) عبر واجهات مرنة'
    ],
    detailed_points_en: [
      'Egyptian governorate clusters (Greater Cairo, Alexandria, Delta, Upper Egypt, Red Sea & Frontier)',
      'Dedicated cross-border shipping tariffs for Saudi Arabia, UAE, and GCC',
      'Dynamic free shipping thresholds to systematically lift Average Order Value (AOV)',
      'Flexible architectural integration hooks for leading couriers (Bosta, Aramex, SMSA)'
    ],
    status: 'active'
  },
  {
    id: 'payments-engine',
    iconName: 'CreditCard',
    title_ar: 'منظومة المدفوعات المحلية والإقليمية',
    title_en: 'Local & Regional Payments Engine',
    short_description_ar: 'دعم الدفع عند الاستلام مع بنية تحتية لربط بوابات الدفع الإلكتروني المعتمدة في كل دولة.',
    short_description_en: 'Native COD plus open integration architecture for accredited digital payment gateways.',
    detailed_points_ar: [
      'الدفع عند الاستلام (COD) مدمج وجاهز للعمل من اللحظة الأولى',
      'معمارية جاهزة لربط بوابات الدفع المصرية (Paymob, Fawry, Kashier, InstaPay, Vodafone Cash)',
      'معمارية جاهزة لمدفوعات الخليج (مدى Mada, Apple Pay, KNET, تمارا, تابي)',
      'استقبال أموالك مباشرة على حسابك البنكي دون وساطة مالية من المنصة'
    ],
    detailed_points_en: [
      'Cash on Delivery active out-of-the-box with customized instructions',
      'Architectural support for Egyptian payment processors (Paymob, Fawry, InstaPay, Wallets)',
      'GCC payment ecosystem readiness (Mada, Apple Pay, KNET, Tamara, Tabby)',
      'Direct merchant settlement: funds flow directly from gateway to merchant bank accounts'
    ],
    status: 'active'
  },
  {
    id: 'whatsapp-commerce',
    iconName: 'MessageCircle',
    title_ar: 'مركز واتساب التجاري (WhatsApp Commerce)',
    title_en: 'WhatsApp Commerce Center',
    short_description_ar: 'تحويل محادثات واتساب إلى محرك مبيعات حقيقي، تأكيد الطلبات، واسترجاع السلات المتروكة.',
    short_description_en: 'Turn WhatsApp conversations into a reliable revenue engine, order confirmations, and retention.',
    detailed_points_ar: [
      'زر شراء واستفسار سريع عبر واتساب مدمج في صفحة كل منتج',
      'قوالب رسائل فورية لتأكيد بيانات العنوان قبل شحن طرد الدفع عند الاستلام',
      'إشعار العميل برقم بوليصة الشحن ورابط التتبع بنقرة واحدة عبر واتساب',
      'استرجاع السلات المتروكة وتذكير العملاء بالمنتجات التي أبدوا اهتماماً بها'
    ],
    detailed_points_en: [
      '1-click "Inquire or Buy on WhatsApp" button embedded directly on product pages',
      'Standardized address and order confirmation message templates prior to COD dispatch',
      'Send tracking numbers and live order progress directly to customer WhatsApp chats',
      'Abandoned cart recovery follow-up templates designed for Arab shoppers'
    ],
    status: 'active',
    badge_ar: 'الأعلى تحويلاً في العالم العربي',
    badge_en: 'Highest Converting Arab Channel'
  },
  {
    id: 'meta-commerce',
    iconName: 'Share2',
    title_ar: 'منظومة ميتا التجارية (Meta Commerce)',
    title_en: 'Meta Commerce Architecture',
    short_description_ar: 'ربط احترافي مع فيسبوك وإنستغرام لتتبع الحملات، كتالوج المنتجات، وقياس عائد الإعلانات (ROAS).',
    short_description_en: 'Direct sync with Facebook & Instagram: Pixel, Conversions API (CAPI), and live Product Feeds.',
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
    status: 'active'
  },
  {
    id: 'google-ecosystem',
    iconName: 'Search',
    title_ar: 'منظومة جوجل التجارية (Google Commerce)',
    title_en: 'Google Commerce Ecosystem',
    short_description_ar: 'تجهيز متجرك للظهور في نتائج Google Shopping وتحليلات GA4 المتقدمة وتتبع حملات Google Ads.',
    short_description_en: 'Prepare your store for Google Shopping, GA4 ecommerce tracking, and Google Ads conversions.',
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
    status: 'active'
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
    title_ar: 'مركز الترحيل السريع للبيانات',
    title_en: 'Migration Center (Import / Export)',
    short_description_ar: 'انقل منتجاتك، عملاءك، ومخزونك من أي منصة سابقة بملفات Excel و CSV بدون فقدان بياناتك.',
    short_description_en: 'Seamlessly migrate products, customers, and inventory from previous platforms via CSV & Excel.',
    detailed_points_ar: [
      'استيراد مرن لملفات المنتجات والصور والمخزون بضغطة زر واحدة',
      'قوالب Excel و CSV جاهزة للتحميل والتعبئة المباشرة',
      'إمكانية تصدير كافة بيانات متجرك في أي وقت بصيغ مفتوحة (أنت تملك بياناتك بالكامل)',
      'دعم مطابقة الحقول التلقائي لتسهيل الانتقال من المنصات الشائعة'
    ],
    detailed_points_en: [
      'Bulk product and inventory import from standardized spreadsheets in seconds',
      'Ready-to-use CSV/Excel sample templates with validation guidelines',
      'Unrestricted data export anytime: complete ownership of your merchant records',
      'Smart column mapper designed for effortless transition from legacy systems'
    ],
    status: 'active'
  }
];
