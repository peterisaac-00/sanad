export interface PricingPlan {
  id: 'monthly' | 'annual';
  name_ar: string;
  name_en: string;
  price_egp: number;
  billing_cycle_ar: string;
  billing_cycle_en: string;
  equivalent_monthly_egp?: number;
  savings_text_ar?: string;
  savings_text_en?: string;
  highlight: boolean;
  commission: string;
  commission_subtext_ar: string;
  commission_subtext_en: string;
  features_ar: string[];
  features_en: string[];
}

export const PRICING_MODEL = {
  monthly: {
    price_egp: 100,
    period_ar: 'شهرياً',
    period_en: 'per month',
    note_ar: 'مرونة كاملة، تجديد شهري بدون التزام طويل الأجل',
    note_en: 'Total flexibility, renews monthly with no long-term lock-in'
  },
  annual: {
    price_egp: 1000,
    period_ar: 'سنوياً',
    period_en: 'per year',
    yearly_savings_egp: 200,
    calculation_explanation_ar: '12 شهراً بنظام الدفع الشهري = 1,200 ج.م | الاشتراك السنوي = 1,000 ج.م | وفر 200 جنيه سنويًا',
    calculation_explanation_en: '12 months on monthly plan = 1,200 EGP | Annual plan = 1,000 EGP | Save 200 EGP per year',
    savings_badge_ar: 'وفر 200 جنيه سنويًا',
    savings_badge_en: 'Save 200 EGP / year',
    highlight: true
  },
  zero_commission_promise: {
    headline_ar: '0% عمولة على مبيعات متجرك - أرباحك بالكامل لك',
    headline_en: '0% Platform Commission on Orders - Keep 100% of Your Margins',
    subtext_ar: 'لا نقتطع أي نسبة مئوية أو رسم ثابت على أي طلب ناجح. سواء حققت مبيعات بـ 10,000 ج.م أو 500,000 ج.م، رسوم منصتنا ثابتة ولا تزيد مع نموك.',
    subtext_en: 'We take zero percentage or flat platform fee on any successful order. Whether you make 10,000 EGP or 500,000 EGP in sales, platform fees remain strictly fixed.'
  },
  third_party_transparency: [
    {
      category_ar: 'رسوم المنصة (سند للتجارة)',
      category_en: 'Platform Fees (Sanad Commerce)',
      cost_ar: '100 ج.م شهرياً أو 1,000 ج.م سنوياً فقط',
      cost_en: '100 EGP/mo or 1,000 EGP/yr only',
      commission_ar: '0% عمولة نهائياً',
      commission_en: 'Strictly 0% Commission',
      notes_ar: 'تشمل استضافة المتجر، البنية التحتية، إدارة الطلبات، لوحة التحكم، ومناطق الشحن اليدوية. لا تشمل الدفع الإلكتروني أو ربط شركات الشحن.',
      notes_en: 'Includes store hosting, infrastructure, orders management, the admin portal, and manual shipping zones. Online payments and carrier integrations are not included.'
    },
    {
      category_ar: 'بوابات الدفع الإلكتروني (Paymob / Fawry / Kashier / Mada)',
      category_en: 'Payment Gateways (Paymob / Fawry / Mada / KNET)',
      cost_ar: 'غير متاحة في النسخة الحالية — لا توجد رسوم',
      cost_en: 'Not available in the current release — no fees',
      commission_ar: 'لا تنطبق — لا يوجد محوّل دفع مثبت',
      commission_en: 'Not applicable — no payment adapter installed',
      notes_ar: 'الدفع عند الاستلام هو الخيار الفعلي. لن يظهر خيار الدفع الإلكتروني في المتجر قبل تثبيت بوابة دفع كاملة مع Webhooks واختبارات إعادة المحاولة.',
      notes_en: 'Cash on delivery is the actual option today. Online payment stays hidden until a complete gateway adapter with webhooks and retry handling ships.'
    },
    {
      category_ar: 'شركات الشحن والطرود (Bosta / Aramex / SMSA)',
      category_en: 'Courier & Shipping Providers (Bosta / Aramex / SMSA)',
      cost_ar: 'تتفق عليها مع شركة الشحن خارج سند',
      cost_en: 'Agreed directly with the courier outside Sanad',
      commission_ar: 'تسددها لشركة الشحن مباشرة أو يحاسبك المندوب عليها',
      commission_en: 'Paid directly to the courier or collected by the courier agent',
      notes_ar: 'الشحن يدوي: لا يوجد ربط آلي أو تتبع شحنات داخل سند. أدخل اسم الشركة وتفاصيل الشحن في الطلب يدوياً.',
      notes_en: 'Shipping is manual: Sanad has no courier integration or shipment tracking. Record the courier and shipping details on the order manually.'
    },
    {
      category_ar: 'النطاق الفرعي المجاني (yourstore.sanad.app)',
      category_en: 'Free Sanad Subdomain (yourstore.sanad.app)',
      cost_ar: 'مشمول في الاشتراك',
      cost_en: 'Included in the subscription',
      commission_ar: '0 ج.م — بدون رسوم إضافية',
      commission_en: '0 EGP — no extra fees',
      notes_ar: 'يأتي متجرك بنطاق فرعي مجاني. يمكنك ربط نطاقك المستقل (.com / .eg / .sa) من إعدادات المتجر بعد توثيق ملكيته بسجل DNS؛ تظل تكلفة تسجيل النطاق لدى مزوّدك، وتُفعّل شهادة HTTPS بعد تهيئة الوكيل الخارجي.',
      notes_en: 'Your store gets a free Sanad subdomain. You can connect a custom .com/.eg/.sa domain from store settings after DNS ownership verification; domain registration remains billed by your registrar, and HTTPS activates after external-proxy provisioning.'
    }
  ]
};

export const COMMON_FEATURES_LIST_AR = [
  'متجر إلكتروني متكامل سريع ومتوافق بنسبة 100% مع الهواتف المحمولة',
  '0% عمولة على المبيعات والطلبات بدون أي سقف للأرباح',
  'إدارة غير محدودة للمنتجات، التصنيفات، المتغيرات (المقاسات والألوان)',
  'دورة حياة متكاملة للدفع عند الاستلام (COD) من التأكيد إلى التحصيل',
  'إدارة الطلبات والحالات، سجل العملاء، وتقارير المبيعات الحية',
  'اختيار عملة المتجر الأساسية (الجنيه المصري، الريال السعودي، الدرهم، الدينار الكويتي...)',
  'إعداد مناطق الشحن وأسعار التوصيل بالمحافظات وقواعد الشحن المجاني',
  'روابط واتساب يدوية للتواصل مع العملاء وتذكير السلات المتروكة برسائل جاهزة (بدون إرسال تلقائي)',
  'تصدير الطلبات والعملاء بملفات CSV لاستخدامها في أدواتك الخارجية',
  'أدوات التسويق المتاحة: قسائم الخصم وتقارير أداء المنتجات والطلبات',
  'سجل نشاط للمتجر لمراجعة التغييرات الحساسة',
  'شهادة أمان SSL سحابية مجانية ودعم فني متخصص عبر القنوات المباشرة'
];

export const COMMON_FEATURES_LIST_EN = [
  'High-speed responsive Arabic-first storefront with mobile checkout',
  '0% platform commission on orders with unlimited sales volume',
  'Unlimited products, hierarchical categories, and multi-variant SKUs',
  'Full-cycle Cash on Delivery (COD) status flow from order to cash remittance',
  'Real-time order statuses, customer purchase history, and actionable reports',
  'Choose one base store currency (EGP, SAR, AED, KWD, QAR, BHD, OMR, USD)',
  'Custom shipping zones, governorate courier tariffs, and free shipping tiers',
  'Manual WhatsApp links for customer outreach and abandoned-cart reminders with prepared messages (no automated sending)',
  'Export orders and customers as CSV for your external tools',
  'Available marketing tools: discount coupons and product/order performance reports',
  'Store activity log for reviewing sensitive changes',
  'Automated free Cloud SSL certificate and dedicated merchant support'
];
