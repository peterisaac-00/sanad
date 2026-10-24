import React from 'react';
import { Language } from '../data/translations';
import { ShieldCheck, Heart, Globe, CheckCircle2, Lock, ArrowLeft, ArrowRight } from 'lucide-react';

interface AboutViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ currentLang, onOpenStoreModal }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand-soft px-3 py-1 rounded-brand-sm border border-brand-line">
          {currentLang === 'ar' ? 'رؤية ومبادئ المنصة' : 'Mission & Core Architecture'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-ink tracking-tight">
          {currentLang === 'ar'
            ? 'بنية تحتية حقيقية بُنيت للتاجر العربي'
            : 'Genuine Infrastructure Built for Arab Merchants'}
        </h1>
        <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
          {currentLang === 'ar'
            ? 'تأسست سند لتكون السند التشغيلي الحقيقي للتاجر في مصر والعالم العربي؛ لا نقتطع من أرباحك، ولا نفرض عليك أدوات شكلية، بل نمنحك نظاماً تشغيلياً رصيناً.'
            : 'Sanad was architected to be the reliable operational backbone for merchants in Egypt and the region: 0% cut, no hype, only robust systems.'}
        </p>
      </div>

      {/* 5 Founding Principles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-brand-lg border border-line shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-brand bg-brand-soft/70 text-brand flex items-center justify-center font-bold">
            0%
          </div>
          <h3 className="font-heading font-bold text-base text-ink">
            {currentLang === 'ar' ? 'الالتزام بـ 0% عمولة' : '0% Commission Commitment'}
          </h3>
          <p className="text-xs text-ink-soft leading-relaxed">
            {currentLang === 'ar'
              ? 'نرفض تماماً نموذج اقتطاع نسبة من مبيعات التجار. التاجر يخاطر برأس ماله وبضاعته؛ ومهمة منصتنا تقديم برمجيات ممتازة بسعر اشتراك ثابت وواضح: 100 ج.م شهرياً أو 1,000 ج.م سنوياً.'
              : 'We firmly reject taxing merchant GMV. Merchants bear inventory risk; our job is providing outstanding SaaS infrastructure for a flat fee.'}
          </p>
        </div>

        <div className="bg-card p-6 rounded-brand-lg border border-line shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-brand bg-secondary text-white flex items-center justify-center font-bold">
            <Globe className="w-5 h-5 text-brand-on-dark" />
          </div>
          <h3 className="font-heading font-bold text-base text-ink">
            {currentLang === 'ar' ? 'هوية عربية أصيلة' : 'Authentic Arabic Identity'}
          </h3>
          <p className="text-xs text-ink-soft leading-relaxed">
            {currentLang === 'ar'
              ? 'المنصة لم تُترجم لغرض التسويق؛ بل صُممت هندسياً من أول سطر برمجي لدعم اللغة العربية والخطوط الطباعية وثقافة التجارة في مصر والخليج.'
              : 'Engineered from line one for native Arabic RTL, nuanced typography, and regional commerce realities.'}
          </p>
        </div>

        <div className="bg-card p-6 rounded-brand-lg border border-line shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-brand bg-brand-soft/70 text-brand flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="font-heading font-bold text-base text-ink">
            {currentLang === 'ar' ? 'سيادة ملكية البيانات' : 'Merchant Data Sovereignty'}
          </h3>
          <p className="text-xs text-ink-soft leading-relaxed">
            {currentLang === 'ar'
              ? 'بيانات متجرك، منتجاتك، عملاؤك، وأرقام هواتفهم ملكية حصرية لك وحدك. يمكنك تصدير الطلبات والعملاء بملفات CSV في أي وقت؛ تصدير كامل البيانات بصيغ أخرى قيد التطوير.'
              : 'Your store records, catalog, and customers belong strictly to you. Export orders and customers as CSV at any time; a complete export in other formats is planned.'}
          </p>
        </div>
      </div>

      {/* Legal Transparency & Terms Section */}
      <div className="bg-surface rounded-brand-lg border border-line p-6 sm:p-10 space-y-6">
        <div className="space-y-1">
          <h3 className="font-heading font-bold text-lg sm:text-xl text-ink">
            {currentLang === 'ar' ? 'السياسات التعاقدية وحماية التاجر' : 'Contractual Terms & Merchant Rights'}
          </h3>
          <p className="text-xs text-subtle">
            {currentLang === 'ar' ? 'شروط واضحة ومباشرة بدون شروط مخفية أو بنود غامضة.' : 'Direct terms with complete legal clarity.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-ink-soft leading-relaxed">
          <div className="p-4 bg-card rounded-brand border border-line space-y-2">
            <span className="font-bold text-ink block">
              {currentLang === 'ar' ? '1. سياسة الاشتراكات والإلغاء:' : '1. Subscription & Cancellation:'}
            </span>
            <span>
              {currentLang === 'ar'
                ? 'الاشتراك الشهري (100 ج.م) يتجدد شهرياً ويمكنك إلغاء التجديد بالتواصل مع الدعم قبل موعده. الاشتراك السنوي (1,000 ج.م) يوفر لك 200 ج.م ويغطي 12 شهراً كاملاً.'
                : 'Monthly plans (100 EGP) renew monthly; contact support before renewal to cancel. Annual plans (1,000 EGP) save 200 EGP and cover 12 full months.'}
            </span>
          </div>

          <div className="p-4 bg-card rounded-brand border border-line space-y-2">
            <span className="font-bold text-ink block">
              {currentLang === 'ar' ? '2. استقلال أموال المبيعات:' : '2. Direct Merchant Payouts:'}
            </span>
            <span>
              {currentLang === 'ar'
                ? 'المنصة لا تحتجز أي أموال تخص مبيعاتك. الدفع عند الاستلام يُحصَّل ويُورَّد من شركة الشحن إلى حسابك مباشرة. الدفع الإلكتروني غير متاح حالياً؛ وعند إضافته لاحقاً ستذهب الأموال من بوابة الدفع إلى حسابك البنكي مباشرة.'
                : 'Sanad never acts as a funds custodian. COD cash is collected and remitted by the courier directly to you. Online payments are not available yet; when added, payouts will flow from the gateway to your bank directly.'}
            </span>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onOpenStoreModal}
            className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-brand shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <span>{currentLang === 'ar' ? 'ابدأ متجرك على سند الآن' : 'Start Your Store on Sanad'}</span>
            {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
