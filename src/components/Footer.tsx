import React from 'react';
import { Language, UI_TRANSLATIONS } from '../data/translations';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { COUNTRIES_DATA } from '../data/countries';
import { BrandLogo } from './Brand';

interface FooterProps {
  currentLang: Language;
  onNavigate: (viewId: string) => void;
  onOpenStoreModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ currentLang, onNavigate }) => {
  const t = UI_TRANSLATIONS[currentLang];

  return (
    <footer className="border-t border-white/10 bg-secondary pb-12 pt-16 text-on-secondary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-10 border-b border-white/10 pb-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand & Mission Statement */}
          <div className="space-y-4 lg:col-span-2">
            <BrandLogo size="md" dark title={t.brand_name} tagline={t.brand_tagline} />

            <p className="max-w-sm text-sm leading-relaxed text-white/60">
              {currentLang === 'ar'
                ? 'منصة تشغيل التجارة الإلكترونية العربية. بنية تحتية رقمية حقيقية صُممت للتاجر العربي، تبدأ من مصر وتتوسع معمارياً للخليج العربي مع التزام صارم بـ 0% عمولة على المبيعات.'
                : 'The Arabic ecommerce operating platform. Robust digital infrastructure built for Arab merchants, starting from Egypt and architected for the GCC with a strict 0% commission commitment.'}
            </p>

            {/* Commercial Fixed Pricing Summary Card */}
            <div className="max-w-sm space-y-2 rounded-brand border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center gap-1.5 text-brand-on-dark">
                  <CheckCircle2 className="h-4 w-4" />
                  0% عمولة على الطلبات
                </span>
                <span className="text-white/50">
                  {currentLang === 'ar' ? 'سعر اشتراك ثابت' : 'Fixed SaaS pricing'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-1 text-xs text-white/70">
                <span>{currentLang === 'ar' ? 'شهرياً: 100 ج.م' : 'Monthly: 100 EGP'}</span>
                <span>{currentLang === 'ar' ? 'سنوياً: 1,000 ج.م (وفر 200 ج.م)' : 'Annual: 1,000 EGP (Save 200 EGP)'}</span>
              </div>
            </div>
          </div>

          {/* Core Systems */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              {currentLang === 'ar' ? 'الأنظمة والمزايا' : 'Systems & Features'}
            </h4>
            <ul className="space-y-2 text-xs text-white/60">
              <li>
                <button onClick={() => onNavigate('features')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'محرك المتجر والواجهة' : 'Storefront Engine'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('features')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'دورة حياة الـ COD المتكاملة' : 'Full COD Lifecycle'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('features')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'مناطق الشحن واللوجستيات' : 'Shipping & Logistics'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('features')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'مركز WhatsApp التجاري' : 'WhatsApp Commerce Hub'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('features')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'منظومة Meta & Google' : 'Meta & Google Feeds'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('migration')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'مركز الترحيل (CSV / Excel)' : 'Migration Center'}
                </button>
              </li>
            </ul>
          </div>

          {/* Target Markets */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              {currentLang === 'ar' ? 'الأسواق الإقليمية' : 'Target Markets'}
            </h4>
            <ul className="space-y-2 text-xs text-white/60">
              {COUNTRIES_DATA.map((c) => (
                <li key={c.code}>
                  <button
                    onClick={() => onNavigate('countries')}
                    className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-white"
                  >
                    <span>{c.flag}</span>
                    <span>{currentLang === 'ar' ? c.name_ar : c.name_en}</span>
                    {c.status === 'launch' && (
                      <span className="rounded border border-brand-on-dark/30 bg-brand-on-dark/15 px-1 py-0.2 text-[10px] text-brand-on-dark">
                        {currentLang === 'ar' ? 'الإطلاق' : 'Launch'}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Knowledge & Trust */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              {currentLang === 'ar' ? 'المعرفة والموثوقية' : 'Knowledge & Trust'}
            </h4>
            <ul className="space-y-2 text-xs text-white/60">
              <li>
                <button onClick={() => onNavigate('knowledge')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'دليل خفض مرتجعات COD' : 'COD Optimization Guide'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('knowledge')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'دليل التصدير من مصر للخليج' : 'Egypt to Gulf Playbook'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('pricing')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'جدول شفافية الرسوم الخارجية' : 'Third-Party Fee Disclosures'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('help')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'مركز المساعدة والتوثيق' : 'Help & Documentation'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('about')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'عن سند ومبادئ المنصة' : 'About & Mission'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('faq')} className="cursor-pointer transition-colors hover:text-white">
                  {currentLang === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar & Legal Architecture */}
        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-white/50 md:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-on-dark" />
            <span>
              © {new Date().getFullYear()} {currentLang === 'ar' ? 'سند للتجارة. جميع الحقوق محفوظة للتاجر العربي.' : 'Sanad Commerce. All rights reserved for Arab merchants.'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-white/60">
              {currentLang === 'ar' ? 'ملكية البيانات كاملة للتاجر (تصدير متاح 100%)' : 'Full merchant data ownership & unrestricted export'}
            </span>
            <span className="text-white/25">·</span>
            <button onClick={() => onNavigate('about')} className="transition-colors hover:text-white">
              {currentLang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </button>
            <span className="text-white/25">·</span>
            <button onClick={() => onNavigate('about')} className="transition-colors hover:text-white">
              {currentLang === 'ar' ? 'الشروط والأحكام' : 'Terms of Service'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
