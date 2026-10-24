import React, { useState } from 'react';
import { Language } from '../data/translations';
import { PRICING_MODEL, COMMON_FEATURES_LIST_AR, COMMON_FEATURES_LIST_EN } from '../data/pricing';
import { ROICalculator } from '../components/ROICalculator';
import {
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  Store,
  DollarSign,
  TrendingDown
} from 'lucide-react';

interface PricingViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

export const PricingView: React.FC<PricingViewProps> = ({ currentLang, onOpenStoreModal }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const features = currentLang === 'ar' ? COMMON_FEATURES_LIST_AR : COMMON_FEATURES_LIST_EN;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand-soft px-3 py-1 rounded-brand-sm border border-brand-line">
          {currentLang === 'ar' ? 'النموذج التجاري النهائي' : 'Fixed SaaS Commercial Model'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-ink tracking-tight">
          {currentLang === 'ar'
            ? 'تسعير ثابت ومباشر · 0% عمولة على المبيعات'
            : 'Predictable Flat Pricing · 0% Commission on Orders'}
        </h1>
        <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
          {currentLang === 'ar'
            ? 'نحن نؤمن بأن مبيعاتك وجهدك يجب أن تعود لك بالكامل. لا رسوم خفية، لا نسبة مئوية مقتطعة من أرباحك، وتسعير واضح يلائم كل تاجر مصري وعربي.'
            : 'We believe your revenue belongs entirely to you. No hidden percentage commissions, no transaction fees taken by the platform.'}
        </p>

        {/* Billing cycle switcher tabs */}
        <div className="inline-flex p-1 bg-surface rounded-brand border border-line mt-4">
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-5 py-2.5 rounded-brand-sm text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              billingCycle === 'annual'
                ? 'bg-brand text-on-brand shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <span>{currentLang === 'ar' ? 'الاشتراك السنوي' : 'Annual Billing'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${billingCycle === 'annual' ? 'bg-brand text-on-brand' : 'bg-brand-soft text-brand'}`}>
              {PRICING_MODEL.annual.savings_badge_ar}
            </span>
          </button>

          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2.5 rounded-brand-sm text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-secondary text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <span>{currentLang === 'ar' ? 'الاشتراك الشهري' : 'Monthly Billing'}</span>
          </button>
        </div>
      </div>

      {/* Main Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Monthly Plan Card */}
        <div className={`bg-card rounded-brand-lg border p-8 space-y-6 flex flex-col justify-between transition-all ${
          billingCycle === 'monthly'
            ? 'border-white/10 shadow-md ring-1 ring-secondary'
            : 'border-line opacity-90'
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-subtle uppercase tracking-wider">
                {currentLang === 'ar' ? 'الخطة الشهرية المرنة' : 'Flexible Monthly Plan'}
              </span>
              <span className="text-xs font-bold text-brand bg-brand-soft px-2.5 py-0.5 rounded border border-brand-line">
                0% عمولة
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-extrabold font-heading text-ink">
                100
              </span>
              <span className="text-sm font-semibold text-subtle">
                {currentLang === 'ar' ? 'جنيه مصري / شهرياً' : 'EGP / month'}
              </span>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              {currentLang === 'ar'
                ? PRICING_MODEL.monthly.note_ar
                : PRICING_MODEL.monthly.note_en}
            </p>

            <div className="pt-4 border-t border-line space-y-2.5 text-xs text-ink-soft">
              <div className="font-semibold text-ink">
                {currentLang === 'ar' ? 'المزايا المشمولة:' : 'Included Features:'}
              </div>
              {features.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onOpenStoreModal}
            className="w-full py-3.5 bg-secondary text-on-secondary hover:brightness-110 rounded-brand text-xs font-bold transition-colors cursor-pointer"
          >
            {currentLang === 'ar' ? 'اختر الخطة الشهرية (100 ج.م/شهر)' : 'Select Monthly Plan'}
          </button>
        </div>

        {/* Annual Plan Card */}
        <div className={`bg-card rounded-brand-lg border p-8 space-y-6 flex flex-col justify-between transition-all relative ${
          billingCycle === 'annual'
            ? 'border-brand shadow-xl ring-2 ring-brand/30 bg-brand-soft/10'
            : 'border-line'
        }`}>
          {/* Savings Badge */}
          <div className="absolute -top-3.5 end-6 bg-brand text-on-brand text-xs font-extrabold px-3 py-1 rounded-full shadow-xs">
            {PRICING_MODEL.annual.savings_badge_ar}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand uppercase tracking-wider">
                {currentLang === 'ar' ? 'الخطة السنوية الأكثر توفيراً' : 'Best Value Annual Plan'}
              </span>
              <span className="text-xs font-bold text-brand bg-brand-soft px-2.5 py-0.5 rounded border border-brand-line">
                0% عمولة
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-extrabold font-heading text-ink">
                1,000
              </span>
              <span className="text-sm font-semibold text-subtle">
                {currentLang === 'ar' ? 'جنيه مصري / سنوياً' : 'EGP / year'}
              </span>
            </div>

            <div className="p-3 bg-brand-soft rounded-brand border border-brand-line text-xs text-brand-active font-medium">
              {currentLang === 'ar'
                ? PRICING_MODEL.annual.calculation_explanation_ar
                : PRICING_MODEL.annual.calculation_explanation_en}
            </div>

            <div className="pt-2 border-t border-line space-y-2.5 text-xs text-ink-soft">
              <div className="font-semibold text-ink">
                {currentLang === 'ar' ? 'كافة مزايا المنصة مشمولة بدون حدود:' : 'All Platform Capabilities Unlocked:'}
              </div>
              {features.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onOpenStoreModal}
            className="w-full py-3.5 bg-brand hover:bg-brand-hover text-on-brand rounded-brand text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
          >
            <span>{currentLang === 'ar' ? 'اختر الخطة السنوية ووفر 200 ج.م' : 'Select Annual Plan (Save 200 EGP)'}</span>
            {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Interactive Savings Calculator */}
      <ROICalculator currentLang={currentLang} onOpenStoreModal={onOpenStoreModal} />

      {/* THIRD-PARTY TRANSPARENCY TABLE */}
      <div className="bg-card rounded-brand-lg border border-line p-6 sm:p-10 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand">
            <ShieldCheck className="w-4 h-4" />
            <span>{currentLang === 'ar' ? 'الشفافية الكاملة وتفصيل التكاليف' : 'Complete Fee Disclosures'}</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-heading text-ink">
            {currentLang === 'ar'
              ? 'ما الذي يشمله اشتراك سند؟ وما الذي يتقاضاه المزودون الخارجيون؟'
              : 'What is Included in Sanad vs External Third-Party Providers?'}
          </h3>
          <p className="text-xs sm:text-sm text-ink-soft">
            {currentLang === 'ar'
              ? 'نحن لا نخفي أي شيء. لتكون على بصيرة كاملة باقتصاديات متجرك، هذه مقارنة واضحة بين اشتراك منصة سند والخدمات الخارجية مثل البنوك والشحن.'
              : 'We hide nothing. Here is a clear breakdown distinguishing platform fees from external courier and banking fees.'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface text-ink-soft">
                <th className="py-3 px-4 font-bold text-start">{currentLang === 'ar' ? 'البند / الخدمة' : 'Service Item'}</th>
                <th className="py-3 px-4 font-bold text-start">{currentLang === 'ar' ? 'التكلفة المقدرة' : 'Estimated Cost'}</th>
                <th className="py-3 px-4 font-bold text-start">{currentLang === 'ar' ? 'عمولة منصة سند' : 'Sanad Cut'}</th>
                <th className="py-3 px-4 font-bold text-start">{currentLang === 'ar' ? 'ملاحظات وتوضيحات' : 'Operational Notes'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PRICING_MODEL.third_party_transparency.map((row, idx) => (
                <tr key={idx} className={idx === 0 ? 'bg-brand-soft/40 font-medium' : ''}>
                  <td className="py-3.5 px-4 font-bold text-ink">
                    {currentLang === 'ar' ? row.category_ar : row.category_en}
                  </td>
                  <td className="py-3.5 px-4 text-ink-soft">
                    {currentLang === 'ar' ? row.cost_ar : row.cost_en}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-brand bg-brand-soft/70 px-2 py-0.5 rounded">
                      {currentLang === 'ar' ? row.commission_ar : row.commission_en}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-subtle max-w-xs">
                    {currentLang === 'ar' ? row.notes_ar : row.notes_en}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancellation and Trust Guarantee */}
      <div className="bg-surface rounded-brand-lg border border-line p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-ink">
            {currentLang === 'ar' ? 'سياسة الإلغاء وحرية التاجر' : 'Cancellation & Merchant Independence'}
          </h4>
          <p className="text-xs text-ink-soft max-w-xl">
            {currentLang === 'ar'
              ? 'يمكنك إلغاء تجديد اشتراكك الشهري بالتواصل مع الدعم قبل موعد التجديد. بيانات منتجاتك وقوائم عملائك ملكك دائماً، ويمكنك تصدير الطلبات والعملاء بملفات CSV بدون عوائق.'
              : 'You can cancel renewal by contacting support before the renewal date. Your product data, catalogs, and customer lists belong to you, and orders and customers can be exported as CSV.'}
          </p>
        </div>

        <button
          onClick={onOpenStoreModal}
          className="px-5 py-2.5 bg-secondary text-on-secondary hover:brightness-110 rounded-brand-sm text-xs font-bold transition-colors cursor-pointer flex-shrink-0"
        >
          {currentLang === 'ar' ? 'ابدأ الآن بـ 100 ج.م' : 'Start for 100 EGP'}
        </button>
      </div>
    </div>
  );
};
