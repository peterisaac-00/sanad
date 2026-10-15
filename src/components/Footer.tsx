import React from 'react';
import { Language, UI_TRANSLATIONS } from '../data/translations';
import { ShieldCheck, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { COUNTRIES_DATA } from '../data/countries';

interface FooterProps {
  currentLang: Language;
  onNavigate: (viewId: string) => void;
  onOpenStoreModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ currentLang, onNavigate, onOpenStoreModal }) => {
  const t = UI_TRANSLATIONS[currentLang];

  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800/80">
          {/* Brand & Mission Statement */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold text-lg">
                سـ
              </div>
              <span className="font-heading text-xl font-bold text-white tracking-tight">
                {t.brand_name}
              </span>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              {currentLang === 'ar'
                ? 'منصة تشغيل التجارة الإلكترونية العربية. بنية تحتية رقمية حقيقية صُممت للتاجر العربي، تبدأ من مصر وتتوسع معمارياً للخليج العربي مع التزام صارم بـ 0% عمولة على المبيعات.'
                : 'The Arabic ecommerce operating platform. Robust digital infrastructure built for Arab merchants, starting from Egypt and architected for the GCC with a strict 0% commission commitment.'}
            </p>

            {/* Commercial Fixed Pricing Summary Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2 max-w-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  0% عمولة على الطلبات
                </span>
                <span className="text-slate-400">
                  {currentLang === 'ar' ? 'سعر اشتراك ثابت' : 'Fixed SaaS pricing'}
                </span>
              </div>
              <div className="text-xs text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800">
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
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => onNavigate('features')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'محرك المتجر والواجهة' : 'Storefront Engine'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('features')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'دورة حياة الـ COD المتكاملة' : 'Full COD Lifecycle'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('features')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'مناطق الشحن واللوجستيات' : 'Shipping & Logistics'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('features')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'مركز WhatsApp التجاري' : 'WhatsApp Commerce Hub'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('features')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'منظومة Meta & Google' : 'Meta & Google Feeds'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('migration')} className="hover:text-white transition-colors cursor-pointer">
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
            <ul className="space-y-2 text-xs text-slate-400">
              {COUNTRIES_DATA.map((c) => (
                <li key={c.code}>
                  <button
                    onClick={() => onNavigate('countries')}
                    className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{c.flag}</span>
                    <span>{currentLang === 'ar' ? c.name_ar : c.name_en}</span>
                    {c.status === 'launch' && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800">
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
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => onNavigate('knowledge')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'دليل خفض مرتجعات COD' : 'COD Optimization Guide'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('knowledge')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'دليل التصدير من مصر للخليج' : 'Egypt to Gulf Playbook'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('pricing')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'جدول شفافية الرسوم الخارجية' : 'Third-Party Fee Disclosures'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('help')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'مركز المساعدة والتوثيق' : 'Help & Documentation'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('about')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'عن سند ومبادئ المنصة' : 'About & Mission'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('faq')} className="hover:text-white transition-colors cursor-pointer">
                  {currentLang === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar & Legal Architecture */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>
              © {new Date().getFullYear()} {currentLang === 'ar' ? 'سند للتجارة. جميع الحقوق محفوظة للتاجر العربي.' : 'Sanad Commerce. All rights reserved for Arab merchants.'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-slate-400">
              {currentLang === 'ar' ? 'ملكية البيانات كاملة للتاجر (تصدير متاح 100%)' : 'Full merchant data ownership & unrestricted export'}
            </span>
            <span className="text-slate-700">·</span>
            <button onClick={() => onNavigate('about')} className="hover:text-slate-300 transition-colors">
              {currentLang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </button>
            <span className="text-slate-700">·</span>
            <button onClick={() => onNavigate('about')} className="hover:text-slate-300 transition-colors">
              {currentLang === 'ar' ? 'الشروط والأحكام' : 'Terms of Service'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
