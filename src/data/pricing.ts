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
      notes_ar: 'تشمل استضافة المتجر، البنية التحتية، إدارة الطلبات، لوحة التحكم، ونظام الشحن والمدفوعات.',
      notes_en: 'Includes store hosting, infrastructure, orders management, admin portal, shipping & payment engine.'
    },
    {
      category_ar: 'بوابات الدفع الإلكتروني (Paymob / Fawry / Kashier / Mada)',
      category_en: 'Payment Gateways (Paymob / Fawry / Mada / KNET)',
      cost_ar: 'تحددها البوابة المتعاقد معها (عادة 2.5% - 2.75% + رسوم بنكية ثابتة)',
      cost_en: 'Set directly by the gateway (typically 2.5% - 2.75% + fixed bank fee)',
      commission_ar: 'رسوم معالجة بنكية تذهب لمزود الدفع مباشرة',
      commission_en: 'Direct bank processing fee to the gateway provider',
      notes_ar: 'أموالك تُحوّل من بوابة الدفع إلى حسابك البنكي مباشرة دون مرورها بحساب المنصة.',
      notes_en: 'Your payout settles directly from the gateway to your bank account with zero platform intermediary.'
    },
    {
      category_ar: 'شركات الشحن والطرود (Bosta / Aramex / SMSA)',
      category_en: 'Courier & Shipping Providers (Bosta / Aramex / SMSA)',
      cost_ar: 'حسب بوليصة الشحن ووزن الطرد والمحافظة أو الوجهة الخليجية',
      cost_en: 'Per shipment airway bill, weight, and delivery governorate / Gulf destination',
      commission_ar: 'تسددها لشركة الشحن مباشرة أو يحاسبك المندوب عليها',
      commission_en: 'Paid directly to courier or settled via COD cash remittances',
      notes_ar: 'يمكنك ربط حسابك الخاص لدى أي شركة شحن أو استخدام بوالص الشحن المباشرة.',
      notes_en: 'Connect your own negotiated courier account with complete operational autonomy.'
    },
    {
      category_ar: 'النطاق الخاص (Custom Domain - .com / .eg / .sa)',
      category_en: 'Custom Domain (.com / .eg / .sa)',
      cost_ar: 'سعر النطاق السنوي لدى مسجل النطاقات (مثل Namecheap أو GoDaddy)',
      cost_en: 'Annual domain registration fee paid to domain registrar',
      commission_ar: '0 ج.م للمنصة لربط النطاق مجاناً مع شهادة SSL مجانية مدى الحياة',
      commission_en: '0 EGP platform connection fee + Free automated SSL certificate',
      notes_ar: 'نوفر لك نطاقاً فرعياً مجانياً (yourstore.sanad.app) أو يمكنك ربط نطاقك المستقل بكل سهولة.',
      notes_en: 'Free subdomain (yourstore.sanad.app) included, or connect your existing domain seamlessly.'
    }
  ]
};

export const COMMON_FEATURES_LIST_AR = [
  'متجر إلكتروني متكامل سريع ومتوافق بنسبة 100% مع الهواتف المحمولة',
  '0% عمولة على المبيعات والطلبات بدون أي سقف للأرباح',
  'إدارة غير محدودة للمنتجات، التصنيفات، المتغيرات (المقاسات والألوان)',
  'دورة حياة متكاملة للدفع عند الاستلام (COD) من التأكيد إلى التحصيل',
  'إدارة الطلبات والحالات، سجل العملاء، وتقارير المبيعات الحية',
  'دعم تعدد العملات (الجنيه المصري، الريال السعودي، الدرهم، الدينار الكويتي...) وتحديثات الصرف',
  'إعداد مناطق الشحن وأسعار التوصيل بالمحافظات وقواعد الشحن المجاني',
  'مركز WhatsApp التجاري لإرسال إشعارات الطلبات وتأكيد الشحن الفوري',
  'تجهيز وتصدير كتالوج المنتجات إلى Meta Commerce و Google Merchant Center',
  'أدوات التسويق: قسائم الخصم، العروض المجمعة، وتتبع الحملات الإعلانية',
  'مركز الترحيل السريع: استيراد المنتجات والعملاء بملفات Excel / CSV',
  'شهادة أمان SSL سحابية مجانية ودعم فني متخصص عبر القنوات المباشرة'
];

export const COMMON_FEATURES_LIST_EN = [
  'High-speed responsive Arabic-first storefront with mobile checkout',
  '0% platform commission on orders with unlimited sales volume',
  'Unlimited products, hierarchical categories, and multi-variant SKUs',
  'Full-cycle Cash on Delivery (COD) tracking from order to cash remittance',
  'Real-time order statuses, customer purchase history, and actionable reports',
  'Multi-currency commerce engine (EGP, SAR, AED, KWD, QAR, BHD, OMR, USD)',
  'Custom shipping zones, governorate courier tariffs, and free shipping tiers',
  'WhatsApp Commerce hub for quick confirmations and cart recovery',
  'Product catalog feed generator for Meta Commerce & Google Shopping',
  'Marketing tools: flexible coupon codes, order bundles, and UTM tracking',
  'Migration Center: 1-click CSV / Excel product and customer import',
  'Automated free Cloud SSL certificate and dedicated merchant support'
];
