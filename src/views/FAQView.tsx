import React, { useState } from 'react';
import { Language } from '../data/translations';
import { FAQS_DATA, FAQItem } from '../data/faq';
import { HelpCircle, ChevronDown, ChevronUp, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';

interface FAQViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

export const FAQView: React.FC<FAQViewProps> = ({ currentLang, onOpenStoreModal }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({ c1: true, o1: true });

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const categories = [
    { id: 'all', name_ar: 'كافة الأسئلة', name_en: 'All Questions' },
    { id: 'commercial', name_ar: 'الأسعار والعمولة (0%)', name_en: 'Pricing & Commission' },
    { id: 'cod', name_ar: 'الدفع عند الاستلام والشحن', name_en: 'COD & Logistics' },
    { id: 'gulf', name_ar: 'التوسع والخليج وتعدد العملات', name_en: 'Gulf & Multi-Currency' },
    { id: 'marketing', name_ar: 'التسويق وميتا وجوجل', name_en: 'Meta & Google Marketing' },
    { id: 'tech', name_ar: 'التقنية والترحيل', name_en: 'Tech & Migration' }
  ];

  const filteredFaqs =
    selectedCategory === 'all'
      ? FAQS_DATA
      : FAQS_DATA.filter((f) => f.category === selectedCategory);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
          {currentLang === 'ar' ? 'الأسئلة الشائعة والأجوبة الشفافة' : 'Frequently Asked Questions'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-slate-900 tracking-tight">
          {currentLang === 'ar'
            ? 'إجابات واضحة ومباشرة لكل سؤال يدور في ذهنك'
            : 'Direct, Transparent Answers to Every Question'}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {currentLang === 'ar'
            ? 'كل ما تحتاج معرفته عن الأسعار الثابتة، انعدام العمولة، دورة الـ COD، الشحن في المحافظات، والبيع لعملاء الخليج.'
            : 'Everything you need to know regarding fixed SaaS pricing, 0% commission, COD operations, and cross-border selling.'}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {currentLang === 'ar' ? cat.name_ar : cat.name_en}
          </button>
        ))}
      </div>

      {/* Accordion FAQ List */}
      <div className="space-y-3">
        {filteredFaqs.map((faq) => {
          const isOpen = !!openItems[faq.id];
          return (
            <div
              key={faq.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all shadow-2xs"
            >
              <button
                onClick={() => toggleItem(faq.id)}
                className="w-full text-start p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                    {currentLang === 'ar' ? faq.category_name_ar : faq.category_name_en}
                  </span>
                  <h3 className="font-heading font-bold text-sm sm:text-base text-slate-900">
                    {currentLang === 'ar' ? faq.question_ar : faq.question_en}
                  </h3>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 bg-slate-50/40">
                  {currentLang === 'ar' ? faq.answer_ar : faq.answer_en}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="text-center pt-6 space-y-4">
        <h4 className="font-heading font-bold text-lg text-slate-900">
          {currentLang === 'ar' ? 'هل لديك سؤال لم تجد إجابته هنا؟' : 'Have a question not addressed here?'}
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {currentLang === 'ar'
            ? 'فريق الدعم الفني التجاري جاهز للرد على استفسارك مباشرة عبر واتساب.'
            : 'Our merchant operations desk is available on WhatsApp.'}
        </p>
        <button
          onClick={onOpenStoreModal}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
        >
          <span>{currentLang === 'ar' ? 'ابدأ متجرك الآن' : 'Start Your Store Now'}</span>
          {currentLang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
