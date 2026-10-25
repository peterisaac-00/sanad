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
  code: 'EGP',
  name_ar: 'الجنيه المصري (عملة الفوترة الأساسية للمنصة)',
  name_en: 'Egyptian Pound (Platform Base Billing Currency)',
  symbol: 'ج.م',
  description_ar: 'العملة المحاسبية الأساسية للمنصة ومتاجر التجار داخل مصر.',
  description_en: 'The accounting currency for the platform and merchant stores in Egypt.'
};

export const SUPPORTED_MERCHANT_CURRENCIES: CurrencyDefinition[] = [
  { code: 'EGP', name_ar: 'الجنيه المصري', name_en: 'Egyptian Pound', symbol_ar: 'ج.م', symbol_en: 'EGP', decimals: 2, exchangeRateVsUsd: 49.50, flag: '🇪🇬' }
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
