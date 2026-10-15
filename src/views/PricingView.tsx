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
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
          {currentLang === 'ar' ? 'النموذج التجاري النهائي' : 'Fixed SaaS Commercial Model'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-slate-900 tracking-tight">
          {currentLang === 'ar'
            ? 'تسعير ثابت ومباشر · 0% عمولة على المبيعات'
            : 'Predictable Flat Pricing · 0% Commission on Orders'}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {currentLang === 'ar'
            ? 'نحن نؤمن بأن مبيعاتك وجهدك يجب أن تعود لك بالكامل. لا رسوم خفية، لا نسبة مئوية مقتطعة من أرباحك، وتسعير واضح يلائم كل تاجر مصري وعربي.'
            : 'We believe your revenue belongs entirely to you. No hidden percentage commissions, no transaction fees taken by the platform.'}
        </p>

        {/* Billing cycle switcher tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 mt-4">
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              billingCycle === 'annual'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{currentLang === 'ar' ? 'الاشتراك السنوي' : 'Annual Billing'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${billingCycle === 'annual' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {PRICING_MODEL.annual.savings_badge_ar}
            </span>
          </button>

          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{currentLang === 'ar' ? 'الاشتراك الشهري' : 'Monthly Billing'}</span>
          </button>
        </div>
      </div>

      {/* Main Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Monthly Plan Card */}
        <div className={`bg-white rounded-3xl border p-8 space-y-6 flex flex-col justify-between transition-all ${
          billingCycle === 'monthly'
            ? 'border-slate-900 shadow-md ring-1 ring-slate-900'
            : 'border-slate-200 opacity-90'
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {currentLang === 'ar' ? 'الخطة الشهرية المرنة' : 'Flexible Monthly Plan'}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                0% عمولة
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-extrabold font-heading text-slate-900">
                100
              </span>
              <span className="text-sm font-semibold text-slate-500">
                {currentLang === 'ar' ? 'جنيه مصري / شهرياً' : 'EGP / month'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {currentLang === 'ar'
                ? PRICING_MODEL.monthly.note_ar
                : PRICING_MODEL.monthly.note_en}
            </p>

            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">
                {currentLang === 'ar' ? 'المزايا المشمولة:' : 'Included Features:'}
              </div>
              {features.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onOpenStoreModal}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {currentLang === 'ar' ? 'اختر الخطة الشهرية (100 ج.م/شهر)' : 'Select Monthly Plan'}
          </button>
        </div>

        {/* Annual Plan Card */}
        <div className={`bg-white rounded-3xl border p-8 space-y-6 flex flex-col justify-between transition-all relative ${
          billingCycle === 'annual'
            ? 'border-emerald-500 shadow-xl ring-2 ring-emerald-500 bg-emerald-50/10'
            : 'border-slate-200'
        }`}>
          {/* Savings Badge */}
          <div className="absolute -top-3.5 end-6 bg-emerald-600 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-xs">
            {PRICING_MODEL.annual.savings_badge_ar}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                {currentLang === 'ar' ? 'الخطة السنوية الأكثر توفيراً' : 'Best Value Annual Plan'}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                0% عمولة
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-extrabold font-heading text-slate-900">
                1,000
              </span>
              <span className="text-sm font-semibold text-slate-500">
                {currentLang === 'ar' ? 'جنيه مصري / سنوياً' : 'EGP / year'}
              </span>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 font-medium">
              {currentLang === 'ar'
                ? PRICING_MODEL.annual.calculation_explanation_ar
                : PRICING_MODEL.annual.calculation_explanation_en}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">
                {currentLang === 'ar' ? 'كافة مزايا المنصة مشمولة بدون حدود:' : 'All Platform Capabilities Unlocked:'}
              </div>
              {features.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onOpenStoreModal}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
          >
            <span>{currentLang === 'ar' ? 'اختر الخطة السنوية ووفر 200 ج.م' : 'Select Annual Plan (Save 200 EGP)'}</span>
            {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Interactive Savings Calculator */}
      <ROICalculator currentLang={currentLang} onOpenStoreModal={onOpenStoreModal} />

      {/* THIRD-PARTY TRANSPARENCY TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
            <span>{currentLang === 'ar' ? 'الشفافية الكاملة وتفصيل التكاليف' : 'Complete Fee Disclosures'}</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            {currentLang === 'ar'
              ? 'ما الذي يشمله اشتراك سند؟ وما الذي يتقاضاه المزودون الخارجيون؟'
              : 'What is Included in Sanad vs External Third-Party Providers?'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            {currentLang === 'ar'
              ? 'نحن لا نخفي أي شيء. لتكون على بصيرة كاملة باقتصاديات متجرك، هذه مقارنة واضحة بين اشتراك منصة سند والخدمات الخارجية مثل البنوك والشحن.'
              : 'We hide nothing. Here is a clear breakdown distinguishing platform fees from external courier and banking fees.'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <th className="py-3 px-4 font-bold text-start">{currentLang === 'ar' ? 'البند / الخدمة' : 'Service Item'}</th>
                <th className="py-3 px-4 font-bold text-start">{currentLang === 'ar' ? 'التكلفة المقدرة' : 'Estimated Cost'}</th>
                <th className="py-3 px-4 font-bold text-start">{currentLang === 'ar' ? 'عمولة منصة سند' : 'Sanad Cut'}</th>
                <th className="py-3 px-4 font-bold text-start">{currentLang === 'ar' ? 'ملاحظات وتوضيحات' : 'Operational Notes'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PRICING_MODEL.third_party_transparency.map((row, idx) => (
                <tr key={idx} className={idx === 0 ? 'bg-emerald-50/40 font-medium' : ''}>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {currentLang === 'ar' ? row.category_ar : row.category_en}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    {currentLang === 'ar' ? row.cost_ar : row.cost_en}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                      {currentLang === 'ar' ? row.commission_ar : row.commission_en}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 max-w-xs">
                    {currentLang === 'ar' ? row.notes_ar : row.notes_en}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancellation and Trust Guarantee */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-900">
            {currentLang === 'ar' ? 'سياسة الإلغاء وحرية التاجر' : 'Cancellation & Merchant Independence'}
          </h4>
          <p className="text-xs text-slate-600 max-w-xl">
            {currentLang === 'ar'
              ? 'يمكنك إلغاء اشتراكك الشهري في أي وقت بنقرة زر واحدة من لوحة التحكم. بيانات منتجاتك وقوائم عملائك ملكك دائماً ويمكنك تصديرها بملفات Excel / CSV بدون أي عوائق.'
              : 'You can cancel your monthly plan anytime with one click. Your product data, catalogs, and customer lists belong exclusively to you.'}
          </p>
        </div>

        <button
          onClick={onOpenStoreModal}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex-shrink-0"
        >
          {currentLang === 'ar' ? 'ابدأ الآن بـ 100 ج.م' : 'Start for 100 EGP'}
        </button>
      </div>
    </div>
  );
};
