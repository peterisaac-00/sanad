export interface IndustryVertical {
  id: string;
  name_ar: string;
  name_en: string;
  tagline_ar: string;
  tagline_en: string;
  icon: string;
  challenges_ar: string[];
  challenges_en: string[];
  solutions_ar: string[];
  solutions_en: string[];
  best_practices_ar: string[];
  best_practices_en: string[];
}

export const INDUSTRIES_DATA: IndustryVertical[] = [
  {
    id: 'fashion',
    name_ar: 'الأزياء والملابس والأحذية',
    name_en: 'Fashion, Apparel & Footwear',
    tagline_ar: 'إدارة مقاسات وألوان دقيقة، وخفض معدلات استبدال المقاس مع دعم المعاينة والشحن السريع.',
    tagline_en: 'Granular size/color variant matrix, size guides, and streamlined exchanges for fashion brands.',
    icon: 'Shirt',
    challenges_ar: [
      'ارتفاع طلبات استبدال المقاسات',
      'تعدد المقاسات والألوان لكل قطعة',
      'الحاجة لصور وتفاصيل خامات عالية الجودة'
    ],
    challenges_en: [
      'High rate of size exchange requests',
      'Complex multi-variant inventory across sizes and colors',
      'Need for rich visual fabric galleries'
    ],
    solutions_ar: [
      'إدارة متقدمة لمتغيرات المقاس واللون مع جداول قياسات مدمجة',
      'سياسة استبدال مرنة وبوالص شحن مخصصة لشركات الشحن',
      'قوالب عرض منتجات تركز على الصور الكبيرة والأزياء'
    ],
    solutions_en: [
      'Advanced variant matrix with embedded measurement charts',
      'Structured exchange and partial return workflows',
      'Fashion-optimized visual catalog layouts'
    ],
    best_practices_ar: [
      'تأكيد مقاس العميل عبر واتساب قبل الشحن لتقليل نسبة المرتجع بنسبة 30%',
      'توفير صور توضيحية واقعية مع إيضاح طول العارض والوزن التقريبي'
    ],
    best_practices_en: [
      'Verify buyer sizes via WhatsApp prior to dispatch to slash returns by 30%',
      'Include real-life model sizing and exact centimeter dimensions'
    ]
  },
  {
    id: 'beauty',
    name_ar: 'مستحضرات التجميل والعناية',
    name_en: 'Beauty & Skincare',
    tagline_ar: 'زيادة متوسط قيمة الطلب عبر العروض المجمعة (Bundles) وتكرار الشراء المنتظم.',
    tagline_en: 'Maximize AOV with product bundles, routine kits, and predictable replenishment cycles.',
    icon: 'Sparkles',
    challenges_ar: [
      'انخفاض سعر المنتج المفرد وزيادة تكلفة الشحن نسبياً',
      'الحاجة لثقة عالية بالمكونات وأصالة المنتج',
      'تكرار الشراء المستمر'
    ],
    challenges_en: [
      'Low single-unit price vs relatively fixed shipping fees',
      'High consumer sensitivity to ingredient authenticity',
      'Need for systematic repeat purchase incentives'
    ],
    solutions_ar: [
      'ميزة الباقات والعروض الترويجية المجمعة لرفع قيمة السلة AOV',
      'أقسام مخصصة لشهادات الجودة وتفاصيل الاستخدام والمكونات',
      'تذكير يدوي عبر واتساب بإعادة طلب روتين العناية برسالة جاهزة'
    ],
    solutions_en: [
      'Custom bundle builder to push order totals above free shipping thresholds',
      'Dedicated ingredient disclosure and authentic usage guidelines',
      'Manual WhatsApp re-order reminder with a prepared message'
    ],
    best_practices_ar: [
      'تحديد حد أدنى للشحن المجاني (مثلاً 500 ج.م في مصر) لتشجيع شراء مجموعات كاملة',
      'توضيح تواريخ الصلاحية وشروط التخزين لتعزيز ثقة المشتري'
    ],
    best_practices_en: [
      'Set strategic free-shipping thresholds to incentivize full routine orders',
      'Disclose batch safety and storage guidelines to build absolute credibility'
    ]
  },
  {
    id: 'electronics',
    name_ar: 'الإلكترونيات والإكسسوارات',
    name_en: 'Electronics & Accessories',
    tagline_ar: 'إدارة الأرقام التسلسلية، شروط الضمان، ومواصفات المنتجات التقنية بدقة واحترافية.',
    tagline_en: 'Serial number tracking, clear warranty disclaimers, and technical specification tables.',
    icon: 'Cpu',
    challenges_ar: [
      'ارتفاع قيمة المنتجات وحساسية الشحن',
      'ضرورة إيضاح مواصفات التوافق مع الأجهزة المختلفة',
      'شروط الضمان وتجربة المنتج'
    ],
    challenges_en: [
      'High value products requiring secure insured delivery',
      'Need for precise technical compatibility specifications',
      'Strict warranty compliance and testing workflows'
    ],
    solutions_ar: [
      'جداول مواصفات تقنية قياسية مهيأة لمحركات البحث',
      'إدارة أرقام تتبع القطع وحالات الضمان بالفاتورة',
      'الدفع عند الاستلام وتسجيل بيانات الشحن يدوياً دون وعود بتتبع آلي'
    ],
    solutions_en: [
      'Standardized technical spec sheets optimized for search discovery',
      'Invoice-embedded warranty certificates and serial reference codes',
      'Cash on delivery with manual courier entry and no automated tracking promises'
    ],
    best_practices_ar: [
      'توضيح توافق الملحق (مثل التوافق مع هواتف معينة أو منافذ شحن) بخط عريض',
      'فرض تأكيد هاتفي أو دفعة مقدمة على الطلبات مرتفعة القيمة'
    ],
    best_practices_en: [
      'Highlight compatibility warnings prominently to avoid wrong purchases',
      'Enforce phone confirmation or partial deposits on high-ticket electronics'
    ]
  },
  {
    id: 'home-living',
    name_ar: 'المنزل والديكور والأثاث',
    name_en: 'Home, Decor & Furniture',
    tagline_ar: 'حساب دقيق لوزن وأبعاد الشحنات، وتسعير الشحن الثقيل حسب المحافظة مع تجربة تصفح بصرية.',
    tagline_en: 'Volumetric shipping tariff engine for bulky goods with rich lifestyle imagery.',
    icon: 'Home',
    challenges_ar: [
      'أحجام وأوزان كبيرة تؤثر على تكاليف النقل',
      'صعوبة الشحن للمحافظات البعيدة للقطع الكبيرة',
      'أهمية المعاينة الواقعية للأبعاد والألوان'
    ],
    challenges_en: [
      'Bulky dimensions and volumetric carrier weight surcharges',
      'Logistical complexities for remote governorates',
      'High shopper need to assess actual room dimensions'
    ],
    solutions_ar: [
      'قواعد شحن مخصصة للقطع الثقيلة حسب المحافظة أو المنطقة',
      'إمكانية حصر الشحن لبعض المنتجات في مناطق جغرافية محددة',
      'معرض صور ومقاطع فيديو توضيحية لتفاصيل الخامات والأبعاد'
    ],
    solutions_en: [
      'Custom governorate weight-tier shipping rate calculation',
      'Geographic restriction controls for extra-fragile or oversized items',
      'High-res dimension diagrams and lifestyle video integration'
    ],
    best_practices_ar: [
      'كتابة الأبعاد بالسنتيمتر بدقة (الطول × العرض × الارتفاع) في أول سطرين من الوصف',
      'شرح طريقة التغليف المقاوم للصدمات لتقليل مخاوف الكسر أثناء الشحن'
    ],
    best_practices_en: [
      'State exact dimensions (L × W × H) in centimeters on the first lines',
      'Describe shockproof packaging clearly to eliminate shipping breakage anxiety'
    ]
  },
  {
    id: 'social-sellers',
    name_ar: 'تجار السوشيال ميديا والتجارة المباشرة D2C',
    name_en: 'Social Commerce & D2C Brands',
    tagline_ar: 'نقل البيع العشوائي في رسائل إنستغرام وتيك توك إلى نظام إلكتروني منظم يوفر ساعات من العمل اليومي.',
    tagline_en: 'Transform chaotic DM selling into a streamlined operating hub that recovers hours every day.',
    icon: 'Instagram',
    challenges_ar: [
      'إهدار ساعات طويلة في الرد على استفسارات الأسعار والمقاسات في الـ DMs',
      'ضياع الطلبات بين الرسائل وتكرار أخطاء تسجيل العناوين',
      'صعوبة تتبع مبالغ الدفع عند الاستلام المعلقة لدى مناديب الشحن'
    ],
    challenges_en: [
      'Wasting endless hours answering repetitive pricing & size questions in DMs',
      'Lost orders in message queues and frequent address entry typos',
      'Inability to track pending courier COD cash remittances accurately'
    ],
    solutions_ar: [
      'رابط متجر واحد يوضع في البايو Bio يختصر رحلة العميل ويوضح المنتجات والمخزون الحي',
      'تأكيد الطلب وفتح واتساب برسالة/فاتورة جاهزة يرسلها فريقك يدوياً',
      'لوحة متابعة مركزية توضح لك بالضبط كم طرداً تم تسليمه وكم أموالاً بانتظار التحصيل'
    ],
    solutions_en: [
      'A single link in bio with real-time inventory and instant frictionless checkout',
      'Order confirmation with a prepared WhatsApp invoice message sent manually by your team',
      'Clean dashboard showing delivered packages and pending cash remittances'
    ],
    best_practices_ar: [
      'توجيه المتابعين دائماً للشراء من رابط المتجر بدلاً من الـ DMs لتوفير وقتك',
      'الاستفادة من 0% عمولة لتسعير منتجاتك بحرية وتقديم عروض منافسة'
    ],
    best_practices_en: [
      'Consistently direct social followers to store link rather than chaotic DMs',
      'Leverage our 0% commission to protect your margins and offer better value'
    ]
  }
];
