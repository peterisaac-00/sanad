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
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentLang,
  onNavigate,
  onOpenStoreModal
}) => {
  const t = UI_TRANSLATIONS[currentLang];

  return (
    <div className="space-y-20 pb-20 overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative pt-12 sm:pt-20 pb-16 bg-gradient-to-b from-card via-surface/50 to-card">
        {/* Subtle geometric grid background pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)",
            backgroundSize: "4rem 4rem",
            maskImage:
              "radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)",
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Top credibility badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-soft text-brand border border-brand-line text-xs font-semibold rounded-brand-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                <span>{t.badge_zero_commission}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface text-ink border border-line text-xs font-semibold rounded-brand-sm">
                <span>{t.badge_fixed_pricing}</span>
                <span className="text-brand font-bold">({t.save_annual_badge})</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary text-white/70 text-xs font-medium rounded-brand-sm">
                <span>{t.badge_egypt_launch}</span>
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-extrabold text-ink tracking-tight leading-[1.18]">
              {t.hero_headline}
            </h1>

            {/* Subheadline & Promise */}
            <p className="text-base sm:text-xl text-ink-soft font-normal leading-relaxed max-w-3xl mx-auto">
              {t.hero_subheadline}
            </p>

            {/* Core Promise Banner */}
            <div className="inline-block bg-surface/90 border border-line px-4 py-2 rounded-brand text-xs sm:text-sm font-semibold text-ink">
              <span className="text-brand">✦</span> {t.brand_promise}
            </div>

            {/* Hero CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={onOpenStoreModal}
                className="w-full sm:w-auto px-7 py-3.5 bg-brand hover:bg-brand-hover active:bg-brand-active text-on-brand font-bold text-sm rounded-brand shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>{t.cta_start_store}</span>
                {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Trust bullet row */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-subtle">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-brand" />
                <span>{currentLang === 'ar' ? 'بدون بطاقة ائتمانية للبدء' : 'No credit card needed to test'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-brand" />
                <span>{currentLang === 'ar' ? '0% عمولة على المبيعات دائماً' : 'Always 0% order commission'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-brand" />
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
          <div className="bg-card p-6 sm:p-7 rounded-brand-lg border border-line shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-brand bg-brand-soft/70 text-brand flex items-center justify-center font-bold text-lg">
              0%
            </div>
            <h3 className="text-lg font-bold font-heading text-ink">
              {currentLang === 'ar' ? 'بيع بدون أي عمولة للمنصة' : '0% Platform Commission'}
            </h3>
            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              {currentLang === 'ar'
                ? 'لا نقتطع نسبة مئوية من طلباتك ولا نأخذ حصة من نجاحك. مبيعاتك بالكامل تعود لحسابك البنكي، والاشتراك ثابت وشفاف: 100 ج.م شهرياً أو 1,000 ج.م سنوياً.'
                : 'We never take a cut of your order revenue. 100% of your sales margins stay with you. Transparent flat SaaS fee: 100 EGP/mo or 1,000 EGP/yr.'}
            </p>
          </div>

          {/* Pillar 2: COD Operating System */}
          <div className="bg-card p-6 sm:p-7 rounded-brand-lg border border-line shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-brand bg-secondary text-brand-on-dark flex items-center justify-center font-bold">
              <Banknote className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-heading text-ink">
              {currentLang === 'ar' ? 'دورة حياة الـ COD المتكاملة' : 'Full COD Operating Lifecycle'}
            </h3>
            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              {currentLang === 'ar'
                ? 'الدفع عند الاستلام ليس مجرد خيار فرعي؛ بل هو عصب التجارة في مصر. نوفر دورة حالات واضحة، وتسجيلاً يدوياً للتحصيل، ورسائل واتساب جاهزة للتأكيد بدلاً من ادعاء أتمتة غير موجودة.'
                : 'COD is not an afterthought; it is the lifeblood of Egyptian commerce. We provide a clear status flow, manual collection recording, and prepared WhatsApp messages instead of pretending automation exists.'}
            </p>
          </div>

          {/* Pillar 3: Egypt to Gulf Infrastructure */}
          <div className="bg-card p-6 sm:p-7 rounded-brand-lg border border-line shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-brand bg-brand-soft/70 text-brand flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-heading text-ink">
              {currentLang === 'ar' ? 'انطلاقة مصر · جاهزية الخليج' : 'Egypt Launch · Gulf Ready'}
            </h3>
            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              {currentLang === 'ar'
                ? 'عملة أساسية واحدة للمتجر، وتسجيل يدوي للطلبات الإقليمية، وشحن عابر للحدود يتم التنسيق بشأنه مع شركة شحن خارج سند. تعدد العملات وأسعار الصرف الآلية قيد التطوير.'
                : 'One base store currency, manual regional order recording, and cross-border shipping coordinated with a courier outside Sanad. Multi-currency and automatic FX are planned.'}
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
          <span className="text-xs font-bold uppercase tracking-wider text-brand">
            {currentLang === 'ar' ? 'منظومة التشغيل الموحدة' : 'Unified Operating System'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-ink">
            {currentLang === 'ar' ? 'كل ما يحتاجه التاجر العربي لإدارة وتنمية تجارته' : 'Everything Arab Merchants Need to Operate & Grow'}
          </h2>
          <p className="text-xs sm:text-sm text-subtle">
            {currentLang === 'ar'
              ? 'متجر + منتجات + طلبات + شحن + مدفوعات + تسويق + نمو، من مكان واحد بدون تشتت.'
              : 'Store + Products + Orders + Shipping + Payments + Marketing + Growth from one command center.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLATFORM_CORE_SYSTEMS.slice(0, 6).map((system) => (
            <div
              key={system.id}
              className="bg-card rounded-brand-lg border border-line p-6 shadow-2xs hover:shadow-xs transition-shadow space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${system.status === 'active' ? 'text-subtle' : 'text-warning'}`}>
                    {system.status === 'active'
                      ? (currentLang === 'ar' ? 'نظام مفعل ومباشر' : 'Live Operating System')
                      : system.status === 'limited'
                        ? (currentLang === 'ar' ? 'متاح جزئياً' : 'Partially available')
                        : (currentLang === 'ar' ? 'قيد التطوير' : 'Planned')}
                  </span>
                  {system.badge_ar && (
                    <span className="text-[10px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded border border-brand-line">
                      {currentLang === 'ar' ? system.badge_ar : system.badge_en}
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-bold font-heading text-ink">
                  {currentLang === 'ar' ? system.title_ar : system.title_en}
                </h3>

                <p className="text-xs text-ink-soft leading-relaxed">
                  {currentLang === 'ar' ? system.short_description_ar : system.short_description_en}
                </p>

                <ul className="space-y-1.5 pt-2 border-t border-line text-xs text-ink-soft">
                  {(currentLang === 'ar' ? system.detailed_points_ar : system.detailed_points_en).slice(0, 3).map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-brand font-bold">✓</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => onNavigate('features')}
                className="text-xs font-semibold text-brand hover:text-brand-hover pt-2 flex items-center gap-1 cursor-pointer self-start"
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
            className="px-6 py-3 border border-line hover:border-subtle/40 text-ink text-xs font-bold rounded-brand transition-colors cursor-pointer"
          >
            {currentLang === 'ar' ? 'استكشف كافة الأنظمة والمزايا الـ 11' : 'Explore All 11 Core Systems'}
          </button>
        </div>
      </section>

      {/* 6. CURRENCY & FX STATUS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ExchangeRateSimulator currentLang={currentLang} />
      </section>

      {/* 7. TARGET MARKETS & REGIONAL EXPANSION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand">
            {currentLang === 'ar' ? 'الانتشار الجغرافي' : 'Geographic Reach'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-ink">
            {currentLang === 'ar' ? 'بُنيت للتاجر العربي، ولم تُترجم له فحسب' : 'Built for Arab Merchants, Not Merely Translated'}
          </h2>
          <p className="text-xs sm:text-sm text-subtle">
            {currentLang === 'ar'
              ? 'انطلاقة قوية في مصر، وتجهيز معمارية التوسع للسعودية والإمارات والكويت وقطر والبحرين وسلطنة عُمان.'
              : 'Launched strongly in Egypt, with complete architectural readiness for Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, and Oman.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COUNTRIES_DATA.map((c) => (
            <div
              key={c.code}
              className={`p-5 rounded-brand-lg border transition-all ${
                c.status === 'launch'
                  ? 'border-brand bg-brand-soft/40 shadow-xs ring-1 ring-brand/30'
                  : 'border-line bg-card hover:border-brand/40'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">{c.flag}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  c.status === 'launch' ? 'bg-brand text-on-brand' : 'bg-surface text-ink-soft'
                }`}>
                  {c.status === 'launch'
                    ? (currentLang === 'ar' ? 'سوق الإطلاق 🇪🇬' : 'Launch Market')
                    : (currentLang === 'ar' ? 'جاهز للتوسع' : 'Expansion Ready')}
                </span>
              </div>

              <h3 className="font-heading font-bold text-base text-ink">
                {currentLang === 'ar' ? c.name_ar : c.name_en}
              </h3>

              <div className="text-xs text-ink-soft mt-1 font-medium">
                {currentLang === 'ar' ? `العملة: ${c.currency_code} (${c.currency_symbol_ar})` : `Currency: ${c.currency_code}`}
              </div>

              <p className="text-[11px] text-subtle mt-2 line-clamp-2">
                {currentLang === 'ar' ? c.description_ar : c.description_en}
              </p>

              <button
                onClick={() => onNavigate('countries')}
                className="mt-3 text-[11px] font-semibold text-brand hover:underline cursor-pointer flex items-center gap-1"
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
        <div className="bg-secondary text-white rounded-brand-lg p-8 sm:p-12 relative overflow-hidden">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-1.5 rounded-brand-sm border border-brand-on-dark/30 bg-brand-on-dark/10 px-3 py-1 text-xs font-semibold text-brand-on-dark">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>0% عمولة على الطلبات · بدون أي رسوم خفية</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold font-heading text-white">
              {currentLang === 'ar' ? 'تسعير ثابت، واضح، وعادل لكل تاجر' : 'Fixed, Clear, and Honest SaaS Pricing'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-white/10 p-5 rounded-brand-lg border border-white/10 space-y-2">
                <div className="text-xs font-bold text-white/70">
                  {currentLang === 'ar' ? 'الاشتراك الشهري' : 'Monthly Subscription'}
                </div>
                <div className="text-3xl font-extrabold font-heading text-white">
                  100 <span className="text-sm font-normal text-white/70">{currentLang === 'ar' ? 'جنيه مصري / شهر' : 'EGP / month'}</span>
                </div>
                <div className="text-xs text-white/70">
                  {currentLang === 'ar' ? 'مرونة كاملة، تجديد شهري بدون التزام طويل الأجل.' : 'Flexible monthly billing; contact support to cancel renewal.'}
                </div>
              </div>

              <div className="bg-white/10 p-5 rounded-brand-lg border border-brand/60 relative space-y-2">
                <span className="absolute top-3 end-3 rounded bg-brand-on-dark px-2 py-0.5 text-[10px] font-extrabold text-secondary">
                  {PRICING_MODEL.annual.savings_badge_ar}
                </span>
                <div className="text-xs font-bold text-brand-on-dark">
                  {currentLang === 'ar' ? 'الاشتراك السنوي' : 'Annual Subscription'}
                </div>
                <div className="text-3xl font-extrabold font-heading text-white">
                  1,000 <span className="text-sm font-normal text-white/70">{currentLang === 'ar' ? 'جنيه مصري / سنة' : 'EGP / year'}</span>
                </div>
                <div className="text-xs text-brand-on-dark">
                  {currentLang === 'ar' ? '12 شهراً = 1,000 ج.م بدلاً من 1,200 ج.م (وفر 200 جنيه سنويًا).' : '12 months = 1,000 EGP instead of 1,200 EGP (Save 200 EGP).'}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={onOpenStoreModal}
                className="px-6 py-3.5 bg-brand hover:bg-brand-hover text-on-brand font-bold text-xs rounded-brand transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{t.cta_start_store}</span>
                {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                onClick={() => onNavigate('pricing')}
                className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-brand transition-colors cursor-pointer"
              >
                {currentLang === 'ar' ? 'عرض جدول الشفافية والمقارنة' : 'View Full Fee Transparency Table'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FINAL HIGH-CONVERSION CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h2 className="text-2xl sm:text-4xl font-extrabold font-heading text-ink">
          {currentLang === 'ar' ? 'جاهز لإطلاق متجرك بدون عمولة على مبيعاتك؟' : 'Ready to Launch Your Store with 0% Commission?'}
        </h2>
        <p className="text-xs sm:text-base text-ink-soft max-w-xl mx-auto">
          {currentLang === 'ar'
            ? 'انضم إلى التجار في مصر والوطن العربي الذين يديرون طلباتهم، شحنهم، ومدفوعاتهم باحترافية كاملة.'
            : 'Join merchants across Egypt and the Arab world managing their orders, shipping, and payments with total independence.'}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onOpenStoreModal}
            className="w-full sm:w-auto px-8 py-3.5 bg-brand hover:bg-brand-hover text-on-brand font-bold text-sm rounded-brand shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Store className="w-4 h-4" />
            <span>{t.cta_start_store}</span>
            {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </section>
    </div>
  );
};
