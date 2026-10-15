import React, { useState } from 'react';
import { Language } from '../data/translations';
import {
  HelpCircle,
  Search,
  BookOpen,
  MessageCircle,
  Mail,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  FileText
} from 'lucide-react';

interface HelpCenterViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

export const HelpCenterView: React.FC<HelpCenterViewProps> = ({ currentLang, onOpenStoreModal }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('getting-started');

  const topics = [
    {
      id: 'getting-started',
      title_ar: 'الخطوات الأولى وإعداد المتجر',
      title_en: 'Getting Started & Store Setup',
      articles: [
        { title_ar: 'كيف تضيف أول منتج وصوره ومتغيرات المقاس واللون؟', title_en: 'How to add your first product with sizes and colors?' },
        { title_ar: 'ربط النطاق الخاص (.com / .eg / .sa) بخطوات سهلة', title_en: 'Connecting your custom domain with free SSL' },
        { title_ar: 'تخصيص الشعار وألوان المتجر وصور البانر الترويجية', title_en: 'Customizing brand logo, colors and home banners' }
      ]
    },
    {
      id: 'shipping-cod',
      title_ar: 'إعدادات الشحن والدفع عند الاستلام',
      title_en: 'Shipping Setup & COD Workflows',
      articles: [
        { title_ar: 'كيف تحدد أسعار شحن مختلفة لكل محافظة في مصر؟', title_en: 'How to set custom courier tariffs per governorate' },
        { title_ar: 'تفعيل قاعدة الشحن المجاني فوق مبلغ محدد (مثال: 600 ج.م)', title_en: 'Enabling free shipping threshold over target cart total' },
        { title_ar: 'خطوات تأكيد الطلبات عبر واتساب لتقليل المرتجعات', title_en: 'WhatsApp verification workflows to cut cancellations' }
      ]
    },
    {
      id: 'payments',
      title_ar: 'بوابات الدفع الإلكتروني والتحويل',
      title_en: 'Digital Payment Gateways',
      articles: [
        { title_ar: 'ربط بوابات الدفع المصرية (Paymob / Fawry / InstaPay)', title_en: 'Connecting Egyptian payment providers' },
        { title_ar: 'تفعيل بطاقات مدى و Apple Pay لعملاء السعودية والخليج', title_en: 'Enabling Mada & Apple Pay for Gulf shoppers' },
        { title_ar: 'كيف تُحوّل أموال مبيعاتك مباشرة إلى حسابك البنكي؟', title_en: 'Direct bank payout flow and zero platform holding' }
      ]
    },
    {
      id: 'marketing-meta',
      title_ar: 'التسويق ومنصات Meta و Google',
      title_en: 'Marketing & Meta / Google Feeds',
      articles: [
        { title_ar: 'كيف تنسخ رابط كتالوج المنتجات إلى Meta Commerce Manager؟', title_en: 'Syncing live product XML feed to Meta Commerce Manager' },
        { title_ar: 'ربط كود التتبع Google Analytics 4 و Google Tag Manager', title_en: 'Setting up GA4 ecommerce events and GTM container' },
        { title_ar: 'إنشاء قسائم تخفيض بنسبة مئوية أو بمبلغ ثابت', title_en: 'Creating percentage or fixed amount promo codes' }
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
          {currentLang === 'ar' ? 'مركز المساعدة والتوثيق' : 'Help Center & Documentation'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-slate-900 tracking-tight">
          {currentLang === 'ar'
            ? 'كيف يمكننا مساعدتك في إدارة متجرك؟'
            : 'How Can We Assist Your Merchant Operations?'}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {currentLang === 'ar'
            ? 'شروحات واضحة وتوثيق خطوة بخطوة لكافة وظائف المنصة؛ من إضافة أول منتج وحتى مطابقة تحصيلات الشحن.'
            : 'Step-by-step documentation for every platform operation, from adding products to courier cash reconciliation.'}
        </p>

        {/* Search Bar */}
        <div className="relative max-w-xl mx-auto pt-2">
          <input
            type="text"
            placeholder={currentLang === 'ar' ? 'ابحث في الشروحات: مثلاً "شحن المحافظات" أو "بوابة الدفع"...' : 'Search guides: e.g. "shipping zones" or "custom domain"...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3.5 px-4 pe-12 bg-white border border-slate-300 rounded-2xl text-xs sm:text-sm text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <Search className={`w-5 h-5 text-slate-400 absolute top-6 ${currentLang === 'ar' ? 'left-4' : 'right-4'}`} />
        </div>
      </div>

      {/* Support Direct Channels Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-emerald-950">
              {currentLang === 'ar' ? 'دعم مباشر عبر واتساب' : 'Direct WhatsApp Support'}
            </h3>
            <p className="text-xs text-emerald-800">
              {currentLang === 'ar' ? 'تواصل مع فريق الدعم الفني مباشرة لأي استفسار تشغيلي.' : 'Chat directly with our operational support team.'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-slate-900">
              {currentLang === 'ar' ? 'التوثيق المكتوب والبريد' : 'Merchant Documentation'}
            </h3>
            <p className="text-xs text-slate-600">
              {currentLang === 'ar' ? 'أدلة إرشادية وتحديثات دورية على مدار الساعة.' : 'Complete technical guides available 24/7.'}
            </p>
          </div>
        </div>
      </div>

      {/* Documentation Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {topics
          .map((top) => {
            const q = searchQuery.trim().toLowerCase();
            const articles = q
              ? top.articles.filter(
                  (a) =>
                    a.title_ar.includes(searchQuery.trim()) ||
                    a.title_en.toLowerCase().includes(q) ||
                    top.title_ar.includes(searchQuery.trim()) ||
                    top.title_en.toLowerCase().includes(q)
                )
              : top.articles;
            return { ...top, articles };
          })
          .filter((top) => top.articles.length > 0)
          .map((top) => (
          <div key={top.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 text-sm font-bold font-heading text-slate-900 border-b border-slate-100 pb-3">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>{currentLang === 'ar' ? top.title_ar : top.title_en}</span>
            </div>

            <div className="space-y-2.5">
              {top.articles.map((art, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer flex items-center justify-between text-xs text-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium">{currentLang === 'ar' ? art.title_ar : art.title_en}</span>
                  </div>
                  {currentLang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5 text-slate-400" /> : <ArrowRight className="w-3.5 h-3.5 text-slate-400" />}
                </div>
              ))}
            </div>
          </div>
          ))}
        {searchQuery.trim() &&
          topics.every((top) => {
            const q = searchQuery.trim().toLowerCase();
            return !top.articles.some(
              (a) =>
                a.title_ar.includes(searchQuery.trim()) ||
                a.title_en.toLowerCase().includes(q)
            );
          }) && (
            <div className="md:col-span-2 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 p-6">
              {currentLang === 'ar' ? 'لا توجد نتائج مطابقة لبحثك.' : 'No guides match your search.'}
            </div>
          )}
      </div>
    </div>
  );
};
