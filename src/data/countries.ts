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
  }
];
