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
        <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand-soft px-3 py-1 rounded-brand-sm border border-brand-line">
          {currentLang === 'ar' ? 'الأسئلة الشائعة والأجوبة الشفافة' : 'Frequently Asked Questions'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-ink tracking-tight">
          {currentLang === 'ar'
            ? 'إجابات واضحة ومباشرة لكل سؤال يدور في ذهنك'
            : 'Direct, Transparent Answers to Every Question'}
        </h1>
        <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
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
            className={`px-3.5 py-2 rounded-brand text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-secondary text-white shadow-xs'
                : 'bg-card border border-line text-ink-soft hover:bg-surface'
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
              className="bg-card rounded-brand-lg border border-line overflow-hidden transition-all shadow-2xs"
            >
              <button
                onClick={() => toggleItem(faq.id)}
                className="w-full text-start p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface/60 transition-colors"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded border border-brand-line inline-block">
                    {currentLang === 'ar' ? faq.category_name_ar : faq.category_name_en}
                  </span>
                  <h3 className="font-heading font-bold text-sm sm:text-base text-ink">
                    {currentLang === 'ar' ? faq.question_ar : faq.question_en}
                  </h3>
                </div>

                <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center flex-shrink-0 text-subtle">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-ink-soft leading-relaxed border-t border-line pt-4 bg-surface/40">
                  {currentLang === 'ar' ? faq.answer_ar : faq.answer_en}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="text-center pt-6 space-y-4">
        <h4 className="font-heading font-bold text-lg text-ink">
          {currentLang === 'ar' ? 'هل لديك سؤال لم تجد إجابته هنا؟' : 'Have a question not addressed here?'}
        </h4>
        <p className="text-xs text-subtle max-w-md mx-auto">
          {currentLang === 'ar'
            ? 'فريق الدعم الفني التجاري جاهز للرد على استفسارك مباشرة عبر واتساب.'
            : 'Our merchant operations desk is available on WhatsApp.'}
        </p>
        <button
          onClick={onOpenStoreModal}
          className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-brand shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
        >
          <span>{currentLang === 'ar' ? 'ابدأ متجرك الآن' : 'Start Your Store Now'}</span>
          {currentLang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
