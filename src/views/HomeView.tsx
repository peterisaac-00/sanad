import React from 'react';
import { Language, UI_TRANSLATIONS } from '../data/translations';
import { PLATFORM_CORE_SYSTEMS } from '../data/features';
import { COUNTRIES_DATA } from '../data/countries';
import { PRICING_MODEL } from '../data/pricing';
import { ROICalculator } from '../components/ROICalculator';
import { ExchangeRateSimulator } from '../components/ExchangeRateSimulator';
import { CODProcessVisualizer } from '../components/CODProcessVisualizer';
import {
  Store,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Truck,
  ShieldCheck,
  Globe,
  MessageCircle,
  Share2,
  Search,
  Banknote,
  Sparkles,
  Layers,
  ChevronRight,
  Zap,
  Check
} from 'lucide-react';

interface HomeViewProps {
  currentLang: Language;
  onNavigate: (viewId: string) => void;
  onOpenStoreModal: () => void;
  onOpenDemoModal: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentLang,
  onNavigate,
  onOpenStoreModal,
  onOpenDemoModal
}) => {
  const t = UI_TRANSLATIONS[currentLang];

  return (
    <div className="space-y-20 pb-20 overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative pt-12 sm:pt-20 pb-16 bg-gradient-to-b from-white via-slate-50/50 to-white">
        {/* Subtle geometric grid background pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Top credibility badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.badge_zero_commission}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold rounded-lg">
                <span>{t.badge_fixed_pricing}</span>
                <span className="text-emerald-700 font-bold">({t.save_annual_badge})</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-slate-100 text-xs font-medium rounded-lg">
                <span>{t.badge_egypt_launch}</span>
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.18]">
              {t.hero_headline}
            </h1>

            {/* Subheadline & Promise */}
            <p className="text-base sm:text-xl text-slate-600 font-normal leading-relaxed max-w-3xl mx-auto">
              {t.hero_subheadline}
            </p>

            {/* Core Promise Banner */}
            <div className="inline-block bg-slate-100/90 border border-slate-200 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-800">
              <span className="text-emerald-600">✦</span> {t.brand_promise}
            </div>

            {/* Hero CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={onOpenStoreModal}
                className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>{t.cta_start_store}</span>
                {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                onClick={onOpenDemoModal}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>{t.cta_interactive_demo}</span>
              </button>
            </div>

            {/* Trust bullet row */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currentLang === 'ar' ? 'بدون بطاقة ائتمانية للبدء' : 'No credit card needed to test'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currentLang === 'ar' ? '0% عمولة على المبيعات دائماً' : 'Always 0% order commission'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currentLang === 'ar' ? 'تصدير بياناتك متاح 100%' : '100% merchant data export'}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE THREE COMMERCIAL PILLARS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1: 0% Commission */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center font-bold text-lg">
              0%
            </div>
            <h3 className="text-lg font-bold font-heading text-slate-900">
              {currentLang === 'ar' ? 'بيع بدون أي عمولة للمنصة' : '0% Platform Commission'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {currentLang === 'ar'
                ? 'لا نقتطع نسبة مئوية من طلباتك ولا نأخذ حصة من نجاحك. مبيعاتك بالكامل تعود لحسابك البنكي، والاشتراك ثابت وشفاف: 100 ج.م شهرياً أو 1,000 ج.م سنوياً.'
                : 'We never take a cut of your order revenue. 100% of your sales margins stay with you. Transparent flat SaaS fee: 100 EGP/mo or 1,000 EGP/yr.'}
            </p>
          </div>

          {/* Pillar 2: COD Operating System */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold">
              <Banknote className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-heading text-slate-900">
              {currentLang === 'ar' ? 'دورة حياة الـ COD المتكاملة' : 'Full COD Operating Lifecycle'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {currentLang === 'ar'
                ? 'الدفع عند الاستلام ليس مجرد خيار فرعي؛ بل هو عصب التجارة في مصر. نوفر نظاماً متكاملاً من التأكيد بالواتساب وحتى مطابقة تحصيلات مناديب الشحن لخفض المرتجعات.'
                : 'COD is not an afterthought; it is the lifeblood of Egyptian commerce. We engineer the complete cycle from WhatsApp verification to courier cash settlement.'}
            </p>
          </div>

          {/* Pillar 3: Egypt to Gulf Infrastructure */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-heading text-slate-900">
              {currentLang === 'ar' ? 'انطلاقة مصر · جاهزية الخليج' : 'Egypt Launch · Gulf Ready'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {currentLang === 'ar'
                ? 'بنية تحتية لتعدد العملات (EGP, SAR, AED, KWD)، تسعير آلي ويدوي لأسعار الصرف، ودعم الشحن عابر الحدود لتبيع لعملاء السعودية والإمارات مباشرة.'
                : 'Multi-currency engine (EGP, SAR, AED, KWD), dual FX system, and cross-border shipping tools to scale your sales to Gulf consumers.'}
            </p>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE ROI CALCULATOR */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ROICalculator currentLang={currentLang} onOpenStoreModal={onOpenStoreModal} />
      </section>

      {/* 4. THE 8 STRATEGIC COD PIPELINE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <CODProcessVisualizer currentLang={currentLang} />
      </section>

      {/* 5. CORE PLATFORM CAPABILITIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            {currentLang === 'ar' ? 'منظومة التشغيل الموحدة' : 'Unified Operating System'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">
            {currentLang === 'ar' ? 'كل ما يحتاجه التاجر العربي لإدارة وتنمية تجارته' : 'Everything Arab Merchants Need to Operate & Grow'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {currentLang === 'ar'
              ? 'متجر + منتجات + طلبات + شحن + مدفوعات + تسويق + نمو، من مكان واحد بدون تشتت.'
              : 'Store + Products + Orders + Shipping + Payments + Marketing + Growth from one command center.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLATFORM_CORE_SYSTEMS.slice(0, 6).map((system) => (
            <div
              key={system.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs hover:shadow-xs transition-shadow space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {system.status === 'active' ? (currentLang === 'ar' ? 'نظام مفعل ومباشر' : 'Live Operating System') : ''}
                  </span>
                  {system.badge_ar && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {currentLang === 'ar' ? system.badge_ar : system.badge_en}
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-bold font-heading text-slate-900">
                  {currentLang === 'ar' ? system.title_ar : system.title_en}
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {currentLang === 'ar' ? system.short_description_ar : system.short_description_en}
                </p>

                <ul className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  {(currentLang === 'ar' ? system.detailed_points_ar : system.detailed_points_en).slice(0, 3).map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => onNavigate('features')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 pt-2 flex items-center gap-1 cursor-pointer self-start"
              >
                <span>{currentLang === 'ar' ? 'تفاصيل النظام' : 'Inspect system'}</span>
                {currentLang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center pt-2">
          <button
            onClick={() => onNavigate('features')}
            className="px-6 py-3 border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {currentLang === 'ar' ? 'استكشف كافة الأنظمة والمزايا الـ 11' : 'Explore All 11 Core Systems'}
          </button>
        </div>
      </section>

      {/* 6. DUAL EXCHANGE RATE SIMULATOR */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ExchangeRateSimulator currentLang={currentLang} />
      </section>

      {/* 7. TARGET MARKETS & REGIONAL EXPANSION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            {currentLang === 'ar' ? 'الانتشار الجغرافي' : 'Geographic Reach'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">
            {currentLang === 'ar' ? 'بُنيت للتاجر العربي، ولم تُترجم له فحسب' : 'Built for Arab Merchants, Not Merely Translated'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {currentLang === 'ar'
              ? 'انطلاقة قوية في مصر، وتجهيز معمارية التوسع للسعودية والإمارات والكويت وقطر والبحرين وسلطنة عُمان.'
              : 'Launched strongly in Egypt, with complete architectural readiness for Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, and Oman.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COUNTRIES_DATA.map((c) => (
            <div
              key={c.code}
              className={`p-5 rounded-2xl border transition-all ${
                c.status === 'launch'
                  ? 'border-emerald-500 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">{c.flag}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  c.status === 'launch' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {c.status === 'launch'
                    ? (currentLang === 'ar' ? 'سوق الإطلاق 🇪🇬' : 'Launch Market')
                    : (currentLang === 'ar' ? 'جاهز للتوسع' : 'Expansion Ready')}
                </span>
              </div>

              <h3 className="font-heading font-bold text-base text-slate-900">
                {currentLang === 'ar' ? c.name_ar : c.name_en}
              </h3>

              <div className="text-xs text-slate-600 mt-1 font-medium">
                {currentLang === 'ar' ? `العملة: ${c.currency_code} (${c.currency_symbol_ar})` : `Currency: ${c.currency_code}`}
              </div>

              <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">
                {currentLang === 'ar' ? c.description_ar : c.description_en}
              </p>

              <button
                onClick={() => onNavigate('countries')}
                className="mt-3 text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>{currentLang === 'ar' ? 'تفاصيل السوق والمدفوعات' : 'Market specs'}</span>
                {currentLang === 'ar' ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 8. PRICING SNAPSHOT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-semibold rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>0% عمولة على الطلبات · بدون أي رسوم خفية</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold font-heading text-white">
              {currentLang === 'ar' ? 'تسعير ثابت، واضح، وعادل لكل تاجر' : 'Fixed, Clear, and Honest SaaS Pricing'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 space-y-2">
                <div className="text-xs font-bold text-slate-300">
                  {currentLang === 'ar' ? 'الاشتراك الشهري' : 'Monthly Subscription'}
                </div>
                <div className="text-3xl font-extrabold font-heading text-white">
                  100 <span className="text-sm font-normal text-slate-400">{currentLang === 'ar' ? 'جنيه مصري / شهر' : 'EGP / month'}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {currentLang === 'ar' ? 'مرونة كاملة، تجديد شهري بدون التزام.' : 'Flexible monthly billing, cancel anytime.'}
                </div>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-emerald-500/60 relative space-y-2">
                <span className="absolute top-3 end-3 bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded">
                  {PRICING_MODEL.annual.savings_badge_ar}
                </span>
                <div className="text-xs font-bold text-emerald-400">
                  {currentLang === 'ar' ? 'الاشتراك السنوي' : 'Annual Subscription'}
                </div>
                <div className="text-3xl font-extrabold font-heading text-white">
                  1,000 <span className="text-sm font-normal text-slate-400">{currentLang === 'ar' ? 'جنيه مصري / سنة' : 'EGP / year'}</span>
                </div>
                <div className="text-xs text-emerald-300">
                  {currentLang === 'ar' ? '12 شهراً = 1,000 ج.م بدلاً من 1,200 ج.م (وفر 200 جنيه سنويًا).' : '12 months = 1,000 EGP instead of 1,200 EGP (Save 200 EGP).'}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={onOpenStoreModal}
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{t.cta_start_store}</span>
                {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                onClick={() => onNavigate('pricing')}
                className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {currentLang === 'ar' ? 'عرض جدول الشفافية والمقارنة' : 'View Full Fee Transparency Table'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FINAL HIGH-CONVERSION CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h2 className="text-2xl sm:text-4xl font-extrabold font-heading text-slate-900">
          {currentLang === 'ar' ? 'جاهز لإطلاق متجرك بدون عمولة على مبيعاتك؟' : 'Ready to Launch Your Store with 0% Commission?'}
        </h2>
        <p className="text-xs sm:text-base text-slate-600 max-w-xl mx-auto">
          {currentLang === 'ar'
            ? 'انضم إلى التجار في مصر والوطن العربي الذين يديرون طلباتهم، شحنهم، ومدفوعاتهم باحترافية كاملة.'
            : 'Join merchants across Egypt and the Arab world managing their orders, shipping, and payments with total independence.'}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onOpenStoreModal}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Store className="w-4 h-4" />
            <span>{t.cta_start_store}</span>
            {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenDemoModal}
            className="w-full sm:w-auto px-6 py-3.5 border border-slate-300 hover:border-slate-400 text-slate-800 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
          >
            {t.cta_interactive_demo}
          </button>
        </div>
      </section>
    </div>
  );
};
