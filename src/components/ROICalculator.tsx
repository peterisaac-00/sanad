import React, { useState } from 'react';
import { Language } from '../data/translations';
import { Calculator, ArrowLeft, ArrowRight, ShieldCheck, Check } from 'lucide-react';

interface ROICalculatorProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

export const ROICalculator: React.FC<ROICalculatorProps> = ({ currentLang, onOpenStoreModal }) => {
  const [monthlySalesEGP, setMonthlySalesEGP] = useState<number>(60000);
  const [competitorCommissionRate, setCompetitorCommissionRate] = useState<number>(2.5);

  // Platform fixed subscription
  const sanadMonthlyFee = 100;
  const sanadCommissionFee = 0; // 0%
  const sanadTotalMonthly = sanadMonthlyFee + sanadCommissionFee;

  // Typical competitor: Base subscription (e.g. 500 EGP) + Commission rate (e.g. 2.5%)
  const competitorBaseMonthly = 350;
  const competitorCommissionFee = (monthlySalesEGP * competitorCommissionRate) / 100;
  const competitorTotalMonthly = competitorBaseMonthly + competitorCommissionFee;

  const monthlySavings = Math.max(0, competitorTotalMonthly - sanadTotalMonthly);
  const annualSavings = monthlySavings * 12;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 mb-1">
            <Calculator className="w-4 h-4" />
            <span>{currentLang === 'ar' ? 'حاسبة أرباح التاجر الحقيقية' : 'Merchant Net Margin Calculator'}</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            {currentLang === 'ar' ? 'كم توفر شهرياً وسنوياً مع عمولة 0%؟' : 'How Much Do You Save with 0% Commission?'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {currentLang === 'ar'
              ? 'قارن بين اشتراك سند الثابت (100 ج.م شهرياً مع 0% عمولة) والمنصات التي تقتطع نسبة من كل طلب تبيعه.'
              : 'Compare Sanad flat pricing (100 EGP/mo with 0% cut) vs platforms skimming percentages off your sales.'}
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 font-semibold self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>0% عمولة المنصة موثقة تعاقدياً</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
        {/* Sliders and Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Monthly Sales Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-700">
                {currentLang === 'ar' ? 'حجم مبيعات متجرك الشهرية المتوقعة:' : 'Expected Monthly Store Sales:'}
              </label>
              <span className="text-base font-bold font-heading text-slate-900 bg-slate-100 px-3 py-1 rounded-md">
                {monthlySalesEGP.toLocaleString()} {currentLang === 'ar' ? 'ج.م' : 'EGP'}
              </span>
            </div>
            <input
              type="range"
              min="10000"
              max="300000"
              step="5000"
              value={monthlySalesEGP}
              onChange={(e) => setMonthlySalesEGP(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>10,000 {currentLang === 'ar' ? 'ج.م' : 'EGP'}</span>
              <span>100,000 {currentLang === 'ar' ? 'ج.م' : 'EGP'}</span>
              <span>300,000+ {currentLang === 'ar' ? 'ج.م' : 'EGP'}</span>
            </div>
          </div>

          {/* Competitor Commission Rate */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-700">
                {currentLang === 'ar' ? 'نسبة عمولة المنصات الأخرى المعتادة على المبيعات:' : 'Competitor Percentage Commission:'}
              </label>
              <span className="text-sm font-bold text-slate-700">
                {competitorCommissionRate}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[2.0, 2.5, 3.5].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setCompetitorCommissionRate(rate)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                    competitorCommissionRate === rate
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  {rate}% {currentLang === 'ar' ? 'عمولة' : 'cut'}
                </button>
              ))}
            </div>
          </div>

          {/* Side by side breakdown comparison */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500">
                {currentLang === 'ar' ? 'المنصات بنظام العمولة' : 'Commission-Based Platforms'}
              </div>
              <div className="text-lg font-bold text-slate-800">
                {Math.round(competitorTotalMonthly).toLocaleString()} {currentLang === 'ar' ? 'ج.م/شهر' : 'EGP/mo'}
              </div>
              <div className="text-[11px] text-slate-500">
                {currentLang === 'ar'
                  ? `(عمولة مبيعات: ${Math.round(competitorCommissionFee).toLocaleString()} ج.م + اشتراك)`
                  : `(Commission: ${Math.round(competitorCommissionFee).toLocaleString()} + sub)`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1">
              <div className="text-[11px] font-semibold text-emerald-700 flex items-center justify-between">
                <span>{currentLang === 'ar' ? 'منصة سند للتجارة' : 'Sanad Commerce'}</span>
                <span className="bg-emerald-600 text-white text-[9px] px-1 py-0.2 rounded font-bold">0% عمولة</span>
              </div>
              <div className="text-lg font-bold text-emerald-900">
                100 {currentLang === 'ar' ? 'ج.م/شهر' : 'EGP/mo'}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium">
                {currentLang === 'ar' ? '0 ج.م عمولة مبيعات، مهما نمت أرباحك' : '0 EGP commission, no matter your growth'}
              </div>
            </div>
          </div>
        </div>

        {/* Savings Result Card */}
        <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="text-xs uppercase font-bold tracking-wider text-emerald-400">
              {currentLang === 'ar' ? 'وفر أرباحك في جيبك' : 'Your Net Savings'}
            </div>

            <div>
              <div className="text-xs text-slate-400">
                {currentLang === 'ar' ? 'التوفير الشهري المباشر:' : 'Direct Monthly Savings:'}
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-heading text-white">
                {Math.round(monthlySavings).toLocaleString()} <span className="text-sm font-normal text-emerald-400">{currentLang === 'ar' ? 'جنيه مصري / شهر' : 'EGP / month'}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                {currentLang === 'ar' ? 'إجمالي ما توفره لعملك سنوياً:' : 'Total Annual Savings for Your Business:'}
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold font-heading text-emerald-400">
                {Math.round(annualSavings).toLocaleString()} <span className="text-sm font-normal text-slate-300">{currentLang === 'ar' ? 'ج.م / سنة' : 'EGP / year'}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {currentLang === 'ar'
                  ? 'مبلغ كافٍ لتمويل حملات إعلانية إضافية أو تطوير منتجاتك بدلاً من دفعه كعمولات للمنصة!'
                  : 'Enough capital to fund ads or expand stock instead of paying software commissions!'}
              </div>
            </div>
          </div>

          <button
            onClick={onOpenStoreModal}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <span>{currentLang === 'ar' ? 'ابدأ متجرك بـ 100 ج.م شهرياً فقط' : 'Start Your Store for 100 EGP/mo'}</span>
            {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
