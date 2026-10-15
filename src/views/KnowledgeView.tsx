import React, { useState } from 'react';
import { Language } from '../data/translations';
import { KNOWLEDGE_ARTICLES, KnowledgeArticle } from '../data/knowledge';
import { BookOpen, Clock, Calendar, ArrowLeft, ArrowRight, Share2, CheckCircle2 } from 'lucide-react';

interface KnowledgeViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({ currentLang, onOpenStoreModal }) => {
  const [selectedSlug, setSelectedSlug] = useState<string>(KNOWLEDGE_ARTICLES[0].slug);

  const activeArticle =
    KNOWLEDGE_ARTICLES.find((a) => a.slug === selectedSlug) || KNOWLEDGE_ARTICLES[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
          {currentLang === 'ar' ? 'مركز المعرفة وأدلة التجارة' : 'Merchant Knowledge Hub'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-slate-900 tracking-tight">
          {currentLang === 'ar'
            ? 'أدلة عملية وموثوقة لنمو تجارتك الإلكترونية'
            : 'Battle-Tested Playbooks for Arab Commerce Growth'}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {currentLang === 'ar'
            ? 'مقالات متعمقة تعالج مشاكل حقيقية يواجهها التجار في مصر والعالم العربي: من خفض مرتجعات الـ COD، إلى إدارة إعلانات Meta و Google، والتصدير إلى الخليج.'
            : 'In-depth, pragmatic guides addressing merchant realities: slashing COD returns, conquering Meta CAPI attribution, and exporting to the GCC.'}
        </p>
      </div>

      {/* Main Grid: Articles List Sidebar + Active Article Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Article Selector Column */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            {currentLang === 'ar' ? 'الأدلة المتاحة للقراءة:' : 'Available Playbooks:'}
          </h3>

          <div className="space-y-2">
            {KNOWLEDGE_ARTICLES.map((art) => {
              const isSelected = art.slug === selectedSlug;
              return (
                <button
                  key={art.slug}
                  onClick={() => {
                    setSelectedSlug(art.slug);
                    window.scrollTo({ top: 350, behavior: 'smooth' });
                  }}
                  className={`w-full text-start p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-emerald-800">
                      {currentLang === 'ar' ? art.category_ar : art.category_en}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{art.reading_time_min} {currentLang === 'ar' ? 'دقائق' : 'min'}</span>
                    </span>
                  </div>

                  <h4 className="font-heading font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                    {currentLang === 'ar' ? art.title_ar : art.title_en}
                  </h4>

                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {currentLang === 'ar' ? art.summary_ar : art.summary_en}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Article Full Reader */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
          {/* Article Header Metadata */}
          <div className="space-y-4 pb-6 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                {currentLang === 'ar' ? activeArticle.category_ar : activeArticle.category_en}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{activeArticle.published_date}</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{activeArticle.reading_time_min} {currentLang === 'ar' ? 'دقائق قراءة متعمقة' : 'min read'}</span>
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 leading-snug">
              {currentLang === 'ar' ? activeArticle.title_ar : activeArticle.title_en}
            </h2>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {currentLang === 'ar' ? activeArticle.summary_ar : activeArticle.summary_en}
            </p>
          </div>

          {/* Article Content Sections */}
          <div className="space-y-8 text-slate-800 text-sm sm:text-base leading-relaxed">
            {(currentLang === 'ar' ? activeArticle.sections_ar : activeArticle.sections_en).map((section, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="font-heading font-bold text-lg sm:text-xl text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span>{section.heading}</span>
                </h3>
                <p className="text-slate-600 leading-relaxed ps-8">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Article Footer & Practical CTA */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-6 rounded-2xl">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-900">
                {currentLang === 'ar' ? 'طبّق هذه الاستراتيجية في متجرك الآن' : 'Implement This Strategy Today'}
              </h4>
              <p className="text-xs text-slate-500">
                {currentLang === 'ar' ? 'سند توفر كافة الأدوات المشروحة في هذا الدليل بـ 100 ج.م شهرياً وبدون عمولة.' : 'Sanad equips you with all tools in this guide for 100 EGP/mo.'}
              </p>
            </div>

            <button
              onClick={onOpenStoreModal}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 self-stretch sm:self-auto justify-center flex-shrink-0"
            >
              <span>{currentLang === 'ar' ? 'ابدأ متجرك' : 'Start Your Store'}</span>
              {currentLang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
