import React, { useState } from 'react';
import { Language } from '../data/translations';
import { PLATFORM_CORE_SYSTEMS, FeatureSystem } from '../data/features';
import {
  Store,
  Package,
  ShoppingBag,
  Truck,
  CreditCard,
  MessageCircle,
  Share2,
  Search,
  TrendingUp,
  RefreshCw,
  Banknote,
  CheckCircle2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface FeaturesViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
  onOpenDemoModal: () => void;
}

const iconMap: Record<string, any> = {
  Store,
  Package,
  ShoppingBag,
  Truck,
  CreditCard,
  MessageCircle,
  Share2,
  Search,
  TrendingUp,
  RefreshCw,
  Banknote
};

export const FeaturesView: React.FC<FeaturesViewProps> = ({
  currentLang,
  onOpenStoreModal,
  onOpenDemoModal
}) => {
  const [selectedSystemId, setSelectedSystemId] = useState<string>('cod-lifecycle');

  const selectedSystem =
    PLATFORM_CORE_SYSTEMS.find((s) => s.id === selectedSystemId) || PLATFORM_CORE_SYSTEMS[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand-soft px-3 py-1 rounded-brand-sm border border-brand-line">
          {currentLang === 'ar' ? 'البنية التحتية والأنظمة' : 'Platform Systems & Architecture'}
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading text-ink tracking-tight">
          {currentLang === 'ar'
            ? 'أنظمة متكاملة لتشغيل تجارتك من الألف إلى الياء'
            : 'Comprehensive Systems to Power Your Commerce End-to-End'}
        </h1>
        <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
          {currentLang === 'ar'
            ? 'سند ليست مجرد منشئ واجهات متاجر؛ إنها منصة تشغيل تجارية تعالج أعقد تحديات التاجر في العالم العربي: من ضبط دورة الكاش والـ COD، وحتى التصدير الرقمي والتكامل الإعلاني.'
            : 'Sanad is not merely a storefront builder; it is a commerce operating system solving Arab merchants’ real challenges: COD cashflows, regional shipping, and ad tracking.'}
        </p>
      </div>

      {/* Systems Selector Tabs */}
      <div className="flex flex-wrap gap-2 justify-center pb-2">
        {PLATFORM_CORE_SYSTEMS.map((system) => {
          const Icon = iconMap[system.iconName] || Store;
          const isSelected = system.id === selectedSystemId;
          return (
            <button
              key={system.id}
              onClick={() => setSelectedSystemId(system.id)}
              className={`px-3.5 py-2 rounded-brand text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'bg-secondary text-white shadow-xs'
                  : 'bg-card border border-line text-ink-soft hover:border-line hover:bg-surface'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-brand-on-dark' : 'text-subtle'}`} />
              <span>{currentLang === 'ar' ? system.title_ar : system.title_en}</span>
            </button>
          );
        })}
      </div>

      {/* Selected System Deep Dive Display */}
      <div className="bg-card rounded-brand-lg border border-line shadow-sm p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand bg-brand-soft/70 px-2.5 py-1 rounded">
                {currentLang === 'ar' ? 'نظام تشغيلي متكامل' : 'Core Operating System'}
              </span>
              {selectedSystem.badge_ar && (
                <span className="text-xs font-bold text-ink-soft bg-surface px-2 py-0.5 rounded">
                  {currentLang === 'ar' ? selectedSystem.badge_ar : selectedSystem.badge_en}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-ink">
              {currentLang === 'ar' ? selectedSystem.title_ar : selectedSystem.title_en}
            </h2>

            <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
              {currentLang === 'ar'
                ? selectedSystem.short_description_ar
                : selectedSystem.short_description_en}
            </p>

            {/* Checklist of architectural points */}
            <div className="space-y-3 pt-2 border-t border-line">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                {currentLang === 'ar' ? 'القدرات والآليات المطبقة في النظام:' : 'System Capabilities & Implementation:'}
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm text-ink-soft">
                {(currentLang === 'ar'
                  ? selectedSystem.detailed_points_ar
                  : selectedSystem.detailed_points_en
                ).map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 flex flex-wrap gap-3">
              <button
                onClick={onOpenStoreModal}
                className="px-6 py-3 bg-brand hover:bg-brand-hover text-white rounded-brand text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{currentLang === 'ar' ? 'ابدأ متجرك بهذا النظام' : 'Start With This System'}</span>
                {currentLang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={onOpenDemoModal}
                className="px-5 py-3 border border-line hover:border-subtle/40 text-ink rounded-brand text-xs font-semibold transition-colors cursor-pointer"
              >
                {currentLang === 'ar' ? 'معاينة في لوحة التحكم' : 'Preview In Dashboard'}
              </button>
            </div>
          </div>

          {/* Right Visual Graphic / Architecture Card */}
          <div className="lg:col-span-5 bg-secondary text-white p-6 sm:p-8 rounded-brand-lg border border-white/10 space-y-4">
            <div className="text-xs font-mono text-brand-on-dark">
              // ARCHITECTURE : {selectedSystem.id.toUpperCase()}
            </div>
            <div className="text-sm font-semibold text-white/70">
              {currentLang === 'ar' ? 'معايير التنفيذ والجاهزية:' : 'Execution & Readiness Standard:'}
            </div>

            <div className="space-y-3 text-xs text-white/70">
              <div className="space-y-1 rounded-brand-sm border border-white/10 bg-white/5 p-3">
                <span className="block font-mono text-[11px] text-brand-on-dark/70">01. ARABIC_FIRST</span>
                <span>مهيأ هندسياً لاتجاه اليمين إلى اليسار ولغة عربية سليمة وواجهات ملائمة للمتسوقين العرب.</span>
              </div>
              <div className="space-y-1 rounded-brand-sm border border-white/10 bg-white/5 p-3">
                <span className="block font-mono text-[11px] text-brand-on-dark/70">02. ZERO_COMMISSION</span>
                <span>لا يفرض أي تكاليف أو عمولات إضافية على كل حركة بيع أو معاملة.</span>
              </div>
              <div className="space-y-1 rounded-brand-sm border border-white/10 bg-white/5 p-3">
                <span className="block font-mono text-[11px] text-brand-on-dark/70">03. SCALABILITY</span>
                <span>معمارية تسمح بالانتقال من مبيعات المحافظات إلى التصدير للخليج بدون إعادة بناء.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of All Systems for Fast Reference */}
      <div className="space-y-6 pt-6">
        <h3 className="text-xl font-bold font-heading text-ink text-center">
          {currentLang === 'ar' ? 'نظرة عامة على كافة أنظمة منصة سند' : 'Overview of All Sanad Operating Systems'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PLATFORM_CORE_SYSTEMS.map((system) => {
            const Icon = iconMap[system.iconName] || Store;
            return (
              <div
                key={system.id}
                onClick={() => {
                  setSelectedSystemId(system.id);
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                className="p-5 rounded-brand-lg border border-line bg-card hover:border-brand hover:shadow-xs transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-brand-sm bg-surface flex items-center justify-center text-ink">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-brand font-bold bg-brand-soft px-2 py-0.5 rounded">
                    0% عمولة
                  </span>
                </div>

                <h4 className="font-heading font-bold text-sm text-ink">
                  {currentLang === 'ar' ? system.title_ar : system.title_en}
                </h4>

                <p className="text-xs text-subtle line-clamp-2">
                  {currentLang === 'ar' ? system.short_description_ar : system.short_description_en}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
