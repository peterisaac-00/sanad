export interface CurrencyDefinition {
  code: string;
  name_ar: string;
  name_en: string;
  symbol_ar: string;
  symbol_en: string;
  decimals: number;
  exchangeRateVsUsd: number; // 1 USD = X Currency
  flag: string;
}

export const PLATFORM_BASE_BILLING_CURRENCY = {
  code: 'USD',
  name_ar: 'الدولار الأمريكي (عملة الفوترة الأساسية للمنصة)',
  name_en: 'US Dollar (Platform Base Billing Currency)',
  symbol: '$',
  description_ar: 'العملة المحاسبية الداخلية لإدارة اقتصاديات المنصة السحابية والتراخيص، وتنفصل تماماً عن عملات متاجر التجار.',
  description_en: 'Internal cloud platform accounting currency, completely decoupled from merchant store currencies.'
};

export const SUPPORTED_MERCHANT_CURRENCIES: CurrencyDefinition[] = [
  { code: 'EGP', name_ar: 'الجنيه المصري', name_en: 'Egyptian Pound', symbol_ar: 'ج.م', symbol_en: 'EGP', decimals: 2, exchangeRateVsUsd: 49.50, flag: '🇪🇬' },
  { code: 'SAR', name_ar: 'الريال السعودي', name_en: 'Saudi Riyal', symbol_ar: 'ر.س', symbol_en: 'SAR', decimals: 2, exchangeRateVsUsd: 3.75, flag: '🇸🇦' },
  { code: 'AED', name_ar: 'الدرهم الإماراتي', name_en: 'UAE Dirham', symbol_ar: 'د.إ', symbol_en: 'AED', decimals: 2, exchangeRateVsUsd: 3.67, flag: '🇦🇪' },
  { code: 'KWD', name_ar: 'الدينار الكويتي', name_en: 'Kuwaiti Dinar', symbol_ar: 'د.ك', symbol_en: 'KWD', decimals: 3, exchangeRateVsUsd: 0.308, flag: '🇰🇼' },
  { code: 'QAR', name_ar: 'الريال القطري', name_en: 'Qatari Riyal', symbol_ar: 'ر.ق', symbol_en: 'QAR', decimals: 2, exchangeRateVsUsd: 3.64, flag: '🇶🇦' },
  { code: 'BHD', name_ar: 'الدينار البحريني', name_en: 'Bahraini Dinar', symbol_ar: 'د.ب', symbol_en: 'BHD', decimals: 3, exchangeRateVsUsd: 0.376, flag: '🇧🇭' },
  { code: 'OMR', name_ar: 'الريال العُماني', name_en: 'Omani Rial', symbol_ar: 'ر.ع', symbol_en: 'OMR', decimals: 3, exchangeRateVsUsd: 0.385, flag: '🇴🇲' },
  { code: 'USD', name_ar: 'الدولار الأمريكي', name_en: 'US Dollar', symbol_ar: '$', symbol_en: '$', decimals: 2, exchangeRateVsUsd: 1.00, flag: '🌐' }
];

export interface MerchantCurrencyConfig {
  primaryCurrency: string;
  displayCurrencies: string[];
  exchangeRateMode: 'automatic' | 'manual';
  manualRates: Record<string, number>;
  automaticSource: string;
  markupPercentage: number; // e.g. 2% cushion for fx volatility
  lastUpdated: string;
}

export const DEFAULT_MERCHANT_CURRENCY_CONFIG: MerchantCurrencyConfig = {
  // Multi-currency and automatic FX are not implemented. A store uses one base
  // currency until that feature ships; this default reflects the runtime truth.
  primaryCurrency: 'EGP',
  displayCurrencies: ['EGP'],
  exchangeRateMode: 'manual',
  manualRates: {
    EGP: 49.50,
  },
  automaticSource: 'غير متاح — لا يوجد مزود أسعار صرف',
  markupPercentage: 0,
  lastUpdated: '2026-10-08T08:00:00Z'
};
