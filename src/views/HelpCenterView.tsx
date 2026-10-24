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
        { title_ar: 'استخدام نطاقك الفرعي المجاني', title_en: 'Using your free Sanad subdomain' },
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
        { title_ar: 'إرسال رسالة تأكيد واتساب جاهزة يدوياً لتقليل المرتجعات', title_en: 'Sending a prepared WhatsApp confirmation manually to cut cancellations' }
      ]
    },
    {
      id: 'payments',
      title_ar: 'الدفع عند الاستلام والمدفوعات اليدوية',
      title_en: 'Cash on Delivery & Manual Payments',
      articles: [
        { title_ar: 'كيف تغيّر حالة الدفع أو تسجل دفعة يدوية؟', title_en: 'How to record a manual payment or change payment status' },
        { title_ar: 'لماذا خيار الدفع الإلكتروني معطّل حالياً؟', title_en: 'Why online payment is currently disabled' },
        { title_ar: 'كيف تطبع فاتورة وتنسق الشحن مع الناقل خارج سند؟', title_en: 'Printing an invoice and coordinating shipping outside Sanad' }
      ]
    },
    {
      id: 'marketing-meta',
      title_ar: 'التسويق وتصدير البيانات',
      title_en: 'Marketing & Data Export',
      articles: [
        { title_ar: 'كيف تصدّر الطلبات والعملاء بملف CSV؟', title_en: 'Exporting orders and customers to CSV' },
        { title_ar: 'إنشاء قسائم تخفيض بنسبة مئوية أو بمبلغ ثابت', title_en: 'Creating percentage or fixed-amount promo codes' },
        { title_ar: 'ما التكاملات التسويقية المتاحة الآن وما المخطط لها؟', title_en: 'Which marketing integrations exist today vs. planned' }
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand-soft px-3 py-1 rounded-brand-sm border border-brand-line">
          {currentLang === 'ar' ? 'مركز المساعدة' : 'Help Center'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-ink tracking-tight">
          {currentLang === 'ar'
            ? 'كيف يمكننا مساعدتك في إدارة متجرك؟'
            : 'How Can We Assist Your Merchant Operations?'}
        </h1>
        <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
          {currentLang === 'ar'
            ? 'إرشادات مختصرة لبعض العمليات الشائعة. الدليل التفاعلي الكامل موجود داخل لوحة التحكم.'
            : 'Short guidance for common operations. The interactive guide lives inside the dashboard.'}
        </p>

        {/* Search Bar */}
        <div className="relative max-w-xl mx-auto pt-2">
          <input
            type="text"
            placeholder={currentLang === 'ar' ? 'ابحث في الإرشادات: مثلاً "شحن المحافظات" أو "الدفع عند الاستلام"...' : 'Search guidance: e.g. "shipping zones" or "cash on delivery"...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3.5 px-4 pe-12 bg-card border border-line rounded-brand-lg text-xs sm:text-sm text-ink shadow-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <Search className={`w-5 h-5 text-subtle absolute top-6 ${currentLang === 'ar' ? 'left-4' : 'right-4'}`} />
        </div>
      </div>

      {/* Support Direct Channels Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <div className="p-5 rounded-brand-lg bg-brand-soft/80 border border-brand-line flex items-center gap-4">
          <div className="w-10 h-10 rounded-brand bg-brand text-white flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-brand-active">
              {currentLang === 'ar' ? 'دعم مباشر عبر واتساب' : 'Direct WhatsApp Support'}
            </h3>
            <p className="text-xs text-brand">
              {currentLang === 'ar' ? 'تواصل مع فريق الدعم الفني مباشرة لأي استفسار تشغيلي.' : 'Chat directly with our operational support team.'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-brand-lg bg-surface border border-line flex items-center gap-4">
          <div className="w-10 h-10 rounded-brand bg-secondary text-white flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-ink">
              {currentLang === 'ar' ? 'التوثيق المكتوب والبريد' : 'Merchant Documentation'}
            </h3>
            <p className="text-xs text-ink-soft">
              {currentLang === 'ar' ? 'دليل سريع وإرشادات مختصرة للعمليات الشائعة.' : 'A quick guide with concise guidance for common operations.'}
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
          <div key={top.id} className="bg-card rounded-brand-lg border border-line p-6 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 text-sm font-bold font-heading text-ink border-b border-line pb-3">
              <BookOpen className="w-4 h-4 text-brand" />
              <span>{currentLang === 'ar' ? top.title_ar : top.title_en}</span>
            </div>

            <div className="space-y-2.5">
              {top.articles.map((art, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-brand border border-line bg-surface hover:bg-surface/80 transition-colors cursor-pointer flex items-center justify-between text-xs text-ink-soft"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-subtle" />
                    <span className="font-medium">{currentLang === 'ar' ? art.title_ar : art.title_en}</span>
                  </div>
                  {currentLang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5 text-subtle" /> : <ArrowRight className="w-3.5 h-3.5 text-subtle" />}
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
            <div className="md:col-span-2 text-center text-xs text-subtle bg-card rounded-brand-lg border border-line p-6">
              {currentLang === 'ar' ? 'لا توجد نتائج مطابقة لبحثك.' : 'No guides match your search.'}
            </div>
          )}
      </div>
    </div>
  );
};
