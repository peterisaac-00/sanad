import React, { useState } from 'react';
import { Language } from '../data/translations';
import { INDUSTRIES_DATA, IndustryVertical } from '../data/industries';
import {
  Shirt,
  Sparkles,
  Cpu,
  Home,
  Instagram,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface IndustriesViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

const iconMap: Record<string, any> = {
  Shirt,
  Sparkles,
  Cpu,
  Home,
  Instagram
};

export const IndustriesView: React.FC<IndustriesViewProps> = ({ currentLang, onOpenStoreModal }) => {
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>('fashion');

  const activeIndustry =
    INDUSTRIES_DATA.find((i) => i.id === selectedIndustryId) || INDUSTRIES_DATA[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand-soft px-3 py-1 rounded-brand-sm border border-brand-line">
          {currentLang === 'ar' ? 'حلول القطاعات المتخصصة' : 'Industry Vertical Solutions'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-ink tracking-tight">
          {currentLang === 'ar'
            ? 'أدوات تجارة مهيأة خصيصاً لطبيعة منتجاتك'
            : 'Commerce Features Tailored to Your Specific Category'}
        </h1>
        <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
          {currentLang === 'ar'
            ? 'متطلبات تاجر الملابس تختلف كلياً عن متطلبات تاجر الإلكترونيات أو مستحضرات التجميل. صممنا حلولاً لمعالجة تحديات كل قطاع عملياً.'
            : 'Fashion demands variant matrices and size exchanges; electronics demands serial warranties. We engineer solutions addressing each sector.'}
        </p>
      </div>

      {/* Industry Tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        {INDUSTRIES_DATA.map((ind) => {
          const Icon = iconMap[ind.icon] || Shirt;
          const isSelected = ind.id === selectedIndustryId;
          return (
            <button
              key={ind.id}
              onClick={() => setSelectedIndustryId(ind.id)}
              className={`px-4 py-2.5 rounded-brand text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'bg-secondary text-white shadow-xs'
                  : 'bg-card border border-line text-ink-soft hover:border-line hover:bg-surface'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-brand-on-dark' : 'text-subtle'}`} />
              <span>{currentLang === 'ar' ? ind.name_ar : ind.name_en}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Industry Card */}
      <div className="bg-card rounded-brand-lg border border-line shadow-sm p-6 sm:p-10 space-y-8">
        <div>
          <span className="text-xs font-bold text-brand bg-brand-soft px-2.5 py-1 rounded border border-brand-line">
            {currentLang === 'ar' ? activeIndustry.name_ar : activeIndustry.name_en}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-ink mt-2">
            {currentLang === 'ar' ? activeIndustry.tagline_ar : activeIndustry.tagline_en}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Challenges */}
          <div className="p-5 rounded-brand-lg bg-warning-soft/60 border border-warning-line/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-warning">
              <AlertCircle className="w-4 h-4 text-warning" />
              <span>{currentLang === 'ar' ? 'التحديات الشائعة في القطاع:' : 'Common Industry Pain Points:'}</span>
            </div>
            <ul className="space-y-2 text-xs text-warning">
              {(currentLang === 'ar' ? activeIndustry.challenges_ar : activeIndustry.challenges_en).map((ch, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="font-bold">•</span>
                  <span>{ch}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sanad Solutions */}
          <div className="p-5 rounded-brand-lg bg-brand-soft/60 border border-brand-line/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-active">
              <CheckCircle2 className="w-4 h-4 text-brand" />
              <span>{currentLang === 'ar' ? 'حلول منصة سند المطبقة:' : 'Implemented Sanad Solutions:'}</span>
            </div>
            <ul className="space-y-2 text-xs text-brand-active">
              {(currentLang === 'ar' ? activeIndustry.solutions_ar : activeIndustry.solutions_en).map((sol, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="font-bold">✓</span>
                  <span>{sol}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Best Practices */}
          <div className="p-5 rounded-brand-lg bg-surface border border-line space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <Lightbulb className="w-4 h-4 text-brand" />
              <span>{currentLang === 'ar' ? 'نصائح لرفع الربحية والتحويل:' : 'Profitability Best Practices:'}</span>
            </div>
            <ul className="space-y-2 text-xs text-ink-soft">
              {(currentLang === 'ar' ? activeIndustry.best_practices_ar : activeIndustry.best_practices_en).map((bp, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-brand font-bold">✦</span>
                  <span>{bp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-line">
          <div className="text-xs text-ink-soft">
            {currentLang === 'ar'
              ? 'هل تبدأ في هذا المجال؟ نوفر لك الدعم والتهيئة الشاملة بدون أي عمولة على الطلبات.'
              : 'Launching in this niche? Enjoy full operational support with 0% platform commission.'}
          </div>
          <button
            onClick={onOpenStoreModal}
            className="px-6 py-3 bg-brand hover:bg-brand-hover text-white rounded-brand text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 self-stretch sm:self-auto justify-center"
          >
            <span>{currentLang === 'ar' ? 'ابدأ متجرك في هذا القطاع' : 'Launch In This Category'}</span>
            {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
