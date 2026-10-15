export interface CountryInfo {
  code: string;
  name_ar: string;
  name_en: string;
  flag: string;
  status: 'launch' | 'expansion';
  currency_code: string;
  currency_symbol_ar: string;
  currency_symbol_en: string;
  exchange_rate_vs_usd: number;
  vat_rate: string;
  cod_prevalence: string;
  description_ar: string;
  description_en: string;
  popular_payment_methods: string[];
  local_couriers: string[];
  cross_border_focus: string;
  key_cities: string[];
}

export const COUNTRIES_DATA: CountryInfo[] = [
  {
    code: 'EG',
    name_ar: 'جمهورية مصر العربية',
    name_en: 'Egypt',
    flag: '🇪🇬',
    status: 'launch',
    currency_code: 'EGP',
    currency_symbol_ar: 'ج.م',
    currency_symbol_en: 'EGP',
    exchange_rate_vs_usd: 49.5,
    vat_rate: '14%',
    cod_prevalence: 'مرتفعة جداً (تتجاوز 65% من معاملات التجارة الإلكترونية)',
    description_ar: 'سوق الإطلاق الرئيسي؛ أكبر كتلة استهلاكية عربية مع نمو متسارع في التجارة عبر منصات التواصل والتجارة المباشرة D2C.',
    description_en: 'Primary launch market; largest Arab consumer base with rapid growth in social and direct-to-consumer commerce.',
    popular_payment_methods: ['الدفع عند الاستلام (COD)', 'فودافون كاش والمحافظ الإلكترونية', 'إنستاباي InstaPay', 'فوري Fawry', 'البطاقات البنكية (Meeza / Visa / Mastercard)', 'خدمات الشراء الآن والدفع لاحقاً (ValU / Sympl)'],
    local_couriers: ['بوسطة Bosta', 'أرامكس Aramex', 'البريد المصري Egypt Post', 'شاحن Shahan', 'مندوبين التوصيل الداخليين'],
    cross_border_focus: 'تصدير المنتجات المصنعة محلياً والملابس والأغذية إلى أسواق الخليج العربي.',
    key_cities: ['القاهرة الكبرى', 'الإسكندرية', 'الجيزة', 'المنصورة', 'طنطا', 'أسيوط', 'بورسعيد']
  },
  {
    code: 'SA',
    name_ar: 'المملكة العربية السعودية',
    name_en: 'Saudi Arabia',
    flag: '🇸🇦',
    status: 'expansion',
    currency_code: 'SAR',
    currency_symbol_ar: 'ر.س',
    currency_symbol_en: 'SAR',
    exchange_rate_vs_usd: 3.75,
    vat_rate: '15% (وفق لوائح ZATCA)',
    cod_prevalence: 'متوسطة إلى منخفضة (تفوق كبير للدفع الإلكتروني مع بقاء COD في بعض المناطق)',
    description_ar: 'سوق التوسع الأول؛ أعلى متوسط قيمة طلب (AOV) وبنية تحتية رقمية فائقة التطور ومدفوعات فورية.',
    description_en: 'Prime expansion market; highest average order value (AOV) and advanced digital payments infrastructure.',
    popular_payment_methods: ['مدى mada', 'Apple Pay', 'تمارا Tamara', 'تابي Tabby', 'Stc pay', 'الدفع عند الاستلام COD'],
    local_couriers: ['سمسا SMSA', 'أرامكس Aramex', 'سبل SPL (البريد السعودي)', 'جي آند تي J&T Express', 'جاهز / ناقل'],
    cross_border_focus: 'استقبال الشحنات المباشرة من مصر واستيراد السلع النوعية، وتصدير العلامات السعودية إقليمياً.',
    key_cities: ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'القصيم']
  },
  {
    code: 'AE',
    name_ar: 'الإمارات العربية المتحدة',
    name_en: 'United Arab Emirates',
    flag: '🇦🇪',
    status: 'expansion',
    currency_code: 'AED',
    currency_symbol_ar: 'د.إ',
    currency_symbol_en: 'AED',
    exchange_rate_vs_usd: 3.67,
    vat_rate: '5%',
    cod_prevalence: 'منخفضة (اعتماد شبه كامل على البطاقات الرقمية والمحافظ الذكية)',
    description_ar: 'مركز لوجستي وتجاري إقليمي رائد، قوة شرائية مرتفعة وسرعة توصيل قياسية مع خيارات دفع رقمية متعددة.',
    description_en: 'Leading regional logistics and commercial hub, high purchasing power and record delivery speeds.',
    popular_payment_methods: ['Apple Pay', 'البطاقات الائتمانية العالمية', 'تابي Tabby', 'تمارا Tamara', 'Google Pay', 'الدفع عند الاستلام'],
    local_couriers: ['أرامكس Aramex', 'دي إتش إل DHL', 'فتشر Fetchr', 'بريد الإمارات Emirates Post'],
    cross_border_focus: 'تجارة عابرة للحدود عالية القيمة والربط بين مستودعات دبي والأسواق المحيطة.',
    key_cities: ['دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'رأس الخيمة']
  },
  {
    code: 'KW',
    name_ar: 'دولة الكويت',
    name_en: 'Kuwait',
    flag: '🇰🇼',
    status: 'expansion',
    currency_code: 'KWD',
    currency_symbol_ar: 'د.ك',
    currency_symbol_en: 'KWD',
    exchange_rate_vs_usd: 0.31,
    vat_rate: '0% (حتى الآن)',
    cod_prevalence: 'متوازنة مع تفضيل واسع لشبكة KNET المحلية',
    description_ar: 'سوق ذو قدرة إنفاق فردية عالية جداً ونشاط تجاري كثيف لقطاعات العطور، الأزياء، والمطابخ السحابية.',
    description_en: 'High per-capita spending market with vibrant activity in luxury fashion, perfumes, and direct retail.',
    popular_payment_methods: ['كي نت KNET', 'Apple Pay', 'البطاقات الائتمانية', 'الدفع عند الاستلام'],
    local_couriers: ['بوستاشي Posta Plus', 'أرامكس Aramex', 'دي إتش إل DHL', 'شركات التوصيل المحلية'],
    cross_border_focus: 'سوق رئيسي لاستقبال الطلبات الفاخرة والعطور والأزياء من مصر ومصممي المنطقة.',
    key_cities: ['مدينة الكويت', 'حولي', 'السالمية', 'الفروانية', 'الأحمدي']
  },
  {
    code: 'QA',
    name_ar: 'دولة قطر',
    name_en: 'Qatar',
    flag: '🇶🇦',
    status: 'expansion',
    currency_code: 'QAR',
    currency_symbol_ar: 'ر.ق',
    currency_symbol_en: 'QAR',
    exchange_rate_vs_usd: 3.64,
    vat_rate: '0%',
    cod_prevalence: 'منخفضة مع انتشار البطاقات والمحافظ الرقمية الوطنية',
    description_ar: 'بنية تحتية مصرفية حديثة، مستهلكون يبحثون عن الجودة وخدمات التوصيل السريع للمنتجات الفاخرة.',
    description_en: 'Modern banking infrastructure with consumers demanding high quality and fast fulfillment.',
    popular_payment_methods: ['QPay بوابة قطر للدفع', 'Apple Pay', 'البطاقات الائتمانية', 'الدفع عند الاستلام'],
    local_couriers: ['كيو بوست Q-Post', 'أرامكس Aramex', 'دي إتش إل DHL'],
    cross_border_focus: 'استيراد السلع المتخصصة ومنتجات الهدايا والأزياء المتميزة.',
    key_cities: ['الدوحة', 'الريان', 'الوكرة', 'الخور']
  },
  {
    code: 'BH',
    name_ar: 'مملكة البحرين',
    name_en: 'Bahrain',
    flag: '🇧🇭',
    status: 'expansion',
    currency_code: 'BHD',
    currency_symbol_ar: 'د.ب',
    currency_symbol_en: 'BHD',
    exchange_rate_vs_usd: 0.38,
    vat_rate: '10%',
    cod_prevalence: 'منخفضة جداً بفضل منظومة بنفت بي BenefitPay الثورية',
    description_ar: 'بيئة رقمية ناضجة حيث تحظى المحافظ والمدفوعات اللاتلامسية بثقة شبه كاملة من كافة فئات المجتمع.',
    description_en: 'Mature digital environment where contactless and BenefitPay payments enjoy near universal trust.',
    popular_payment_methods: ['بنفت بي BenefitPay', 'Apple Pay', 'البطاقات الائتمانية', 'الدفع عند الاستلام'],
    local_couriers: ['بريد البحرين Bahrain Post', 'أرامكس Aramex', 'الناقلون المحليون'],
    cross_border_focus: 'تجارة تفاعلية وثيقة مع المنطقة الشرقية في السعودية ومصر.',
    key_cities: ['المنامة', 'المحرق', 'الرفاع', 'مدينة عيسى']
  },
  {
    code: 'OM',
    name_ar: 'سلطنة عُمان',
    name_en: 'Oman',
    flag: '🇴🇲',
    status: 'expansion',
    currency_code: 'OMR',
    currency_symbol_ar: 'ر.ع',
    currency_symbol_en: 'OMR',
    exchange_rate_vs_usd: 0.385,
    vat_rate: '5%',
    cod_prevalence: 'متوسطة إلى مرتفعة مع نمو ملحوظ في الدفع عبر شبكة عُمان نت ومحفظة ثواني',
    description_ar: 'سوق صاعد ذو اتساع جغرافي مميز، يتطلب مرونة في تسعير الشحن للمحافظات ودعماً قوياً للدفع عند الاستلام.',
    description_en: 'Emerging market with unique geography, requiring flexible regional shipping and strong COD flows.',
    popular_payment_methods: ['عُمان نت OmanNet', 'محفظة ثواني Thawani', 'البطاقات البنكية', 'الدفع عند الاستلام COD'],
    local_couriers: ['بريد عُمان Asyad Express', 'أرامكس Aramex', 'خطوط النقل الإقليمية'],
    cross_border_focus: 'ربط تجاري متنامي مع أسواق الخليج ومصر لمنتجات الحرف والصناعات الغذائية.',
    key_cities: ['مسقط', 'صلالة', 'صحار', 'نزوى', 'صور']
  }
];
