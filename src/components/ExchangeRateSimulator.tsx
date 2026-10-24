import React from 'react';
import { Language } from '../data/translations';
import { AlertCircle, CheckCircle2, Clock, Globe } from 'lucide-react';

interface ExchangeRateSimulatorProps {
  currentLang: Language;
}

/**
 * The old version simulated automatic FX and multi-currency checkout, neither
 * of which exists. Keep the section honest: explain what works today and what
 * is still planned.
 */
export const ExchangeRateSimulator: React.FC<ExchangeRateSimulatorProps> = ({ currentLang }) => {
  const available = [
    currentLang === 'ar'
      ? 'اختيار عملة أساسية واحدة للمتجر من إعدادات المتجر.'
      : 'Choose one base currency for the store from settings.',
    currentLang === 'ar'
      ? 'تُعرض أسعار المنتجات والطلبات بعملة المتجر المختارة.'
      : 'Product and order prices are displayed in the selected store currency.',
    currentLang === 'ar'
      ? 'تسجيل الطلبات الإقليمية يدوياً بعملة المتجر.'
      : 'Regional orders can be recorded manually in the store currency.',
  ];

  const planned = [
    currentLang === 'ar'
      ? 'عرض أسعار تلقائية بعملات متعددة للعميل الواحد.'
      : 'Automatic multi-currency price display per shopper.',
    currentLang === 'ar'
      ? 'تحديث أسعار الصرف من مصدر حي أو يدوي مع هامش تحوط.'
      : 'Live or manual FX updates with a hedging buffer.',
    currentLang === 'ar'
      ? 'تحويل تلقائي بين عملات المتجر وعملة العميل.'
      : 'Automatic conversion between store and shopper currencies.',
  ];

  return (
    <div className="bg-card rounded-brand-lg border border-line shadow-sm p-6 sm:p-8">
      <div className="flex flex-col gap-3 pb-5 border-b border-line sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-brand">
            <Globe className="h-4 w-4" />
            <span>{currentLang === 'ar' ? 'العملات وأسعار الصرف' : 'Currencies & FX'}</span>
          </div>
          <h3 className="text-lg font-bold font-heading text-ink sm:text-xl">
            {currentLang === 'ar' ? 'تعدد العملات وأسعار الصرف قيد التطوير' : 'Multi-Currency & FX Are Planned'}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-6 text-subtle">
            {currentLang === 'ar'
              ? 'لا نعرض محاكياً لأسعار صرف حية لأنها غير موجودة. حالياً يعمل المتجر بعملة أساسية واحدة، ولا يوجد تحويل تلقائي أو تحديث لأسعار الصرف.'
              : 'We do not show a live FX simulator because no live feed exists. Today a store runs on one base currency, with no automatic conversion or FX updates.'}
          </p>
        </div>
        <span className="self-start rounded-full border border-warning-line bg-warning-soft px-3 py-1 text-[10px] font-bold text-warning">
          {currentLang === 'ar' ? 'قيد التطوير — ليست ميزة متاحة' : 'Planned — not available'}
        </span>
      </div>

      <div className="grid gap-3 pt-5 md:grid-cols-3">
        <div className="rounded-brand border border-success-line bg-success-soft/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-success">
            <CheckCircle2 className="h-4 w-4" />
            <span>{currentLang === 'ar' ? 'متاح الآن' : 'Available now'}</span>
          </div>
          <ul className="space-y-1.5 text-[11px] leading-5 text-ink-soft">
            {available.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-brand border border-warning-line bg-warning-soft/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-warning">
            <AlertCircle className="h-4 w-4" />
            <span>{currentLang === 'ar' ? 'غير متاح الآن' : 'Not available yet'}</span>
          </div>
          <ul className="space-y-1.5 text-[11px] leading-5 text-ink-soft">
            {planned.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-brand border border-line bg-surface p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink">
            <Clock className="h-4 w-4" />
            <span>{currentLang === 'ar' ? 'ماذا يعني ذلك للتاجر؟' : 'What this means for merchants'}</span>
          </div>
          <p className="text-[11px] leading-6 text-subtle">
            {currentLang === 'ar'
              ? 'حدّد عملة متجرك الأساسية عند الإعداد، وسجّل الطلبات الإقليمية يدوياً حتى يكتمل نظام تعدد العملات. لن نعرض أسعاراً محوّلة أو أسعار صرف غير حقيقية.'
              : 'Set your store base currency during setup and record regional orders manually until multi-currency ships. We will not show converted prices or fake FX rates.'}
          </p>
        </div>
      </div>
    </div>
  );
};
