import React, { useState } from 'react';
import { Language } from '../data/translations';
import { RefreshCw, Sliders, DollarSign, Globe, CheckCircle2 } from 'lucide-react';
import { SUPPORTED_MERCHANT_CURRENCIES, PLATFORM_BASE_BILLING_CURRENCY } from '../data/currencies';

interface ExchangeRateSimulatorProps {
  currentLang: Language;
}

export const ExchangeRateSimulator: React.FC<ExchangeRateSimulatorProps> = ({ currentLang }) => {
  const [mode, setMode] = useState<'automatic' | 'manual'>('automatic');
  const [markupPercent, setMarkupPercent] = useState<number>(2); // 2% FX risk buffer
  const [basePriceEGP, setBasePriceEGP] = useState<number>(750); // e.g. Egyptian cotton shirt / jacket

  // Egp per USD = ~49.5
  // Conversion: item in EGP -> in USD -> in SAR / AED / KWD
  const egpPerUsd = 49.5;
  const priceInUsd = basePriceEGP / egpPerUsd;

  const calculateTargetPrice = (currencyCode: string, rateVsUsd: number) => {
    let finalAmount = 0;
    if (currencyCode === 'EGP') {
      return basePriceEGP;
    }
    const rawTarget = priceInUsd * rateVsUsd;
    const withMarkup = mode === 'manual' ? rawTarget * (1 + markupPercent / 100) : rawTarget;

    if (currencyCode === 'KWD' || currencyCode === 'BHD' || currencyCode === 'OMR') {
      return Number(withMarkup.toFixed(2));
    }
    return Math.round(withMarkup);
  };

  return (
    <div className="bg-card rounded-brand-lg border border-line shadow-sm p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand mb-1">
            <Globe className="w-4 h-4" />
            <span>{currentLang === 'ar' ? 'معمارية العملات وأسعار الصرف' : 'Currency & Exchange Rate Architecture'}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold font-heading text-ink">
            {currentLang === 'ar' ? 'نظام الصرف المزدوج: آلي ويدوي للتجارة الإقليمية' : 'Dual Exchange Rate System: Automatic & Manual Modes'}
          </h3>
          <p className="text-xs text-subtle mt-1">
            {currentLang === 'ar'
              ? 'تحديد أسعار منتجاتك في مصر، وعرضها تلقائياً للمتسوق السعودي والإماراتي والكويتي بعملته المحلية.'
              : 'Price items in EGP, and render them in SAR, AED, and KWD with complete FX control.'}
          </p>
          <p className="text-[11px] text-subtle mt-1">
            {currentLang === 'ar'
              ? 'أسعار مرجعية توضيحية للتجربة، وليست أسعار صرف حية.'
              : 'Illustrative reference rates for experimentation, not live FX feeds.'}
          </p>
        </div>

        {/* Mode Toggle Button */}
        <div className="inline-flex p-1 bg-surface rounded-brand-sm self-start sm:self-auto">
          <button
            onClick={() => setMode('automatic')}
            className={`px-3 py-1.5 text-xs font-medium rounded-brand-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
              mode === 'automatic'
                ? 'bg-card text-ink shadow-xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand" />
            <span>{currentLang === 'ar' ? 'وضع آلي (محدّث لحظياً)' : 'Automatic (Live API)'}</span>
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 text-xs font-medium rounded-brand-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
              mode === 'manual'
                ? 'bg-card text-ink shadow-xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-brand" />
            <span>{currentLang === 'ar' ? 'وضع يدوي (مخصص مع هامش)' : 'Manual (With Buffer)'}</span>
          </button>
        </div>
      </div>

      {/* Simulator Interface */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-6">
        {/* Left Inputs */}
        <div className="md:col-span-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-soft mb-1.5">
              {currentLang === 'ar' ? 'سعر المنتج الأصلي بعملة متجرك (مثال: الجنيه المصري):' : 'Product Base Price in Merchant Currency (EGP):'}
            </label>
            <div className="relative">
              <input
                type="number"
                value={basePriceEGP}
                onChange={(e) => setBasePriceEGP(Math.max(1, Number(e.target.value)))}
                className="input-control"
              />
              <span className={`absolute top-2.5 text-xs font-semibold text-subtle ${currentLang === 'ar' ? 'left-3' : 'right-3'}`}>
                {currentLang === 'ar' ? 'ج.م' : 'EGP'}
              </span>
            </div>
          </div>

          {/* If manual mode, show buffer markup */}
          {mode === 'manual' ? (
            <div className="p-3 bg-warning-soft rounded-brand border border-warning-line space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-warning">
                  {currentLang === 'ar' ? 'هامش أمان تقلبات الصرف والتحويل (FX Buffer):' : 'FX Volatility Safety Buffer:'}
                </span>
                <span className="font-bold text-warning">+{markupPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="0.5"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(Number(e.target.value))}
                className="w-full h-1.5 bg-warning-soft rounded-brand-sm appearance-none cursor-pointer accent-warning"
              />
              <div className="text-[11px] text-warning leading-tight">
                {currentLang === 'ar'
                  ? 'يضمن لك عدم تأثر أرباحك الصافية بأي رسوم تحويل بطاقات ائتمانية أجنبية.'
                  : 'Protects your net profit against foreign card conversion surcharges.'}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-surface rounded-brand border border-line text-xs text-ink-soft space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                <span>{currentLang === 'ar' ? 'مصدر السعر: أسعار الصرف الرسمية المعتمدة' : 'Source: Official Live FX Feed'}</span>
              </div>
              <p className="text-[11px] text-subtle">
                {currentLang === 'ar'
                  ? 'يتم تحديث أسعار الصرف دورياً مع الحفاظ على استقرار التسعير للمشتري أثناء جلسة الشراء.'
                  : 'Exchange rates refresh deterministically while locking shopper session price.'}
              </p>
            </div>
          )}

          {/* Architecture principle note */}
          <div className="text-[11px] text-subtle bg-surface p-3 rounded-brand-sm border border-line">
            <span className="font-bold text-ink-soft block mb-0.5">
              {currentLang === 'ar' ? 'فصل عملة المنصة عن عملة المتجر:' : 'Platform vs Merchant Decoupling:'}
            </span>
            {currentLang === 'ar'
              ? 'فوترة المنصة الداخلية الأساسية تتم بـ USD كمعيار محاسبي سحابي، بينما أنت تبيع بعملتك المفضلة 100% دون أي قيود.'
              : 'Internal platform billing base is USD; merchant store currency is 100% merchant-defined.'}
          </div>
        </div>

        {/* Right Output: Real-time Multi-market Storefront Prices */}
        <div className="md:col-span-7 bg-surface rounded-brand p-4 border border-line space-y-3">
          <div className="text-xs font-semibold text-ink-soft flex items-center justify-between pb-2 border-b border-line">
            <span>{currentLang === 'ar' ? 'معاينة سعر المنتج فورياً في متاجر العملاء:' : 'Live Shopper Storefront Price by Market:'}</span>
            <span className="text-[10px] text-subtle">
              {mode === 'automatic' ? (currentLang === 'ar' ? 'تحديث آلي' : 'Auto Sync') : `يدوي (+${markupPercent}%)`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5">
            {SUPPORTED_MERCHANT_CURRENCIES.filter((c) => c.code !== 'USD').map((c) => {
              const displayPrice = calculateTargetPrice(c.code, c.exchangeRateVsUsd);
              const isBase = c.code === 'EGP';

              return (
                <div
                  key={c.code}
                  className={`p-3 rounded-brand-sm border transition-all ${
                    isBase
                      ? 'bg-brand-soft/70 border-brand-line'
                      : 'bg-card border-line'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-subtle mb-1">
                    <span className="flex items-center gap-1 font-medium text-ink-soft">
                      <span>{c.flag}</span>
                      <span>{c.code}</span>
                    </span>
                    {isBase && (
                      <span className="text-[9px] bg-brand text-white px-1 rounded font-bold">
                        {currentLang === 'ar' ? 'الأساس' : 'Base'}
                      </span>
                    )}
                  </div>
                  <div className="text-base sm:text-lg font-bold font-heading text-ink">
                    {displayPrice.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-subtle">
                      {currentLang === 'ar' ? c.symbol_ar : c.symbol_en}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
