import React, { useState } from 'react';
import { Language } from '../data/translations';
import {
  Smartphone,
  Tablet,
  Monitor,
  CheckCircle2,
  ShoppingBag,
  Heart,
  MessageCircle,
  Eye,
  Store,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface TemplatesViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

interface TemplateStore {
  id: string;
  name_ar: string;
  name_en: string;
  industry_ar: string;
  industry_en: string;
  hero_title_ar: string;
  hero_title_en: string;
  hero_subtitle_ar: string;
  hero_subtitle_en: string;
  primary_color: string;
  sample_products: {
    title_ar: string;
    title_en: string;
    price_egp: number;
    price_sar: number;
    badge_ar?: string;
    image_accent: string;
  }[];
}

const TEMPLATES: TemplateStore[] = [
  {
    id: 'fashion',
    name_ar: 'قالب سحر الشرق للأزياء (Fashion)',
    name_en: 'Saraya Fashion Theme',
    industry_ar: 'ملابس، عبايات، أحذية',
    industry_en: 'Apparel, Abayas & Shoes',
    hero_title_ar: 'تشكيلة صيف 2026: خامات كتان طبيعي وتطريز عربي',
    hero_title_en: 'Summer Collection 2026: Pure Linen & Arabic Craft',
    hero_subtitle_ar: 'شحن سريع لكافة المحافظات وخيار الدفع عند الاستلام مع إمكانية المعاينة.',
    hero_subtitle_en: 'Fast nationwide shipping with Cash on Delivery and inspection options.',
    primary_color: 'bg-secondary',
    sample_products: [
      { title_ar: 'قميص كتان طبيعي فاخر', title_en: 'Natural Linen Shirt', price_egp: 750, price_sar: 57, badge_ar: 'الأكثر طلباً', image_accent: 'bg-stone-200' },
      { title_ar: 'عباية حرير مطرزة يدوياً', title_en: 'Embroidered Silk Abaya', price_egp: 1850, price_sar: 140, badge_ar: 'كمية محدودة', image_accent: 'bg-stone-300' },
      { title_ar: 'حذاء كاجوال جلد طبيعي', title_en: 'Casual Leather Loafers', price_egp: 980, price_sar: 74, image_accent: 'bg-stone-200' },
      { title_ar: 'فستان صيفي مطبوع', title_en: 'Summer Printed Dress', price_egp: 890, price_sar: 68, image_accent: 'bg-stone-100' }
    ]
  },
  {
    id: 'beauty',
    name_ar: 'قالب إشراقة للعناية والتجميل (Beauty)',
    name_en: 'Glow Beauty & Skincare',
    industry_ar: 'عناية بالبشرة، عطور، زيوت طبيعية',
    industry_en: 'Skincare, Fragrances & Oils',
    hero_title_ar: 'روتين العناية المتكامل بمكونات طبيعية نقية 100%',
    hero_title_en: 'Pure Skincare Essentials with 100% Organic Botanicals',
    hero_subtitle_ar: 'باقات توفيرية مع شحن مجاني للطلبات فوق 500 ج.م في مصر و 200 ر.س بالخليج.',
    hero_subtitle_en: 'Bundle savings with free shipping over 500 EGP or 200 SAR.',
    primary_color: 'bg-danger',
    sample_products: [
      { title_ar: 'مجموعة الترطيب العميق اليومية', title_en: 'Daily Hydration Kit', price_egp: 620, price_sar: 47, badge_ar: 'عرض باقة', image_accent: 'bg-danger-soft' },
      { title_ar: 'سيروم فيتامين C النقي المركز', title_en: 'Vitamin C Pure Serum', price_egp: 450, price_sar: 34, image_accent: 'bg-danger-soft' },
      { title_ar: 'زيت الأرجان العضوي المعصور بارداً', title_en: 'Cold-Pressed Argan Oil', price_egp: 380, price_sar: 29, image_accent: 'bg-danger-soft' },
      { title_ar: 'عطر مسك الليل الفاخر 50ml', title_en: 'Night Musk Perfume 50ml', price_egp: 950, price_sar: 72, badge_ar: 'فاخر', image_accent: 'bg-danger-soft' }
    ]
  },
  {
    id: 'electronics',
    name_ar: 'قالب تك زون للإلكترونيات (Tech)',
    name_en: 'TechZone Gadgets & Gear',
    industry_ar: 'هواتف، شواحن، إكسسوارات وساعات',
    industry_en: 'Smartphones, Audio & Wearables',
    hero_title_ar: 'إكسسوارات الهواتف الذكية مع ضمان استبدال رسمي لمدة عام',
    hero_title_en: 'Premium Smartphone Accessories with 1-Year Warranty',
    hero_subtitle_ar: 'مواصفات قياسية وتأكيد فوري للطلب عبر واتساب مع رقم بوليصة الشحن.',
    hero_subtitle_en: 'Full technical specs and instant WhatsApp order tracking numbers.',
    primary_color: 'bg-secondary',
    sample_products: [
      { title_ar: 'شاحن GaN فائق السرعة 65W', title_en: '65W Fast GaN Charger', price_egp: 550, price_sar: 42, badge_ar: 'ضمان سنة', image_accent: 'bg-line' },
      { title_ar: 'سماعة رأس لاسلكية بخاصية عزل الضجيج', title_en: 'ANC Wireless Headphones', price_egp: 1400, price_sar: 106, image_accent: 'bg-line' },
      { title_ar: 'باور بانك مغناطيسي 10000mAh', title_en: 'Magnetic Powerbank 10k', price_egp: 720, price_sar: 55, image_accent: 'bg-line' },
      { title_ar: 'حامل هاتف للسيارة لاسلكي ذكي', title_en: 'Smart Wireless Car Mount', price_egp: 390, price_sar: 30, image_accent: 'bg-surface' }
    ]
  }
];

export const TemplatesView: React.FC<TemplatesViewProps> = ({ currentLang, onOpenStoreModal }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('fashion');
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop'>('mobile');
  const [selectedCurrency, setSelectedCurrency] = useState<'EGP' | 'SAR'>('EGP');

  const currentTemplate =
    TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand-soft px-3 py-1 rounded-brand-sm border border-brand-line">
          {currentLang === 'ar' ? 'معرض المتاجر العربية' : 'Arabic Storefronts Showcase'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-ink tracking-tight">
          {currentLang === 'ar'
            ? 'تصاميم عربية مصممة هندسياً لرفع معدل الشراء'
            : 'Arabic Storefronts Engineered for High Conversion'}
        </h1>
        <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
          {currentLang === 'ar'
            ? 'ليست مجرد قوالب مترجمة؛ إنها واجهات تسوق تحترم خطوط القراءة العربية وسرعة التصفح وتجربة الشراء بالهاتف المحمول.'
            : 'Native RTL shopping experiences crafted for mobile buyers with instant WhatsApp checkout and clear COD workflows.'}
        </p>

        {/* Template Selector & Device Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <div className="inline-flex p-1 bg-surface rounded-brand border border-line">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplateId(tmpl.id)}
                className={`px-3 py-1.5 rounded-brand-sm text-xs font-bold transition-all cursor-pointer ${
                  selectedTemplateId === tmpl.id
                    ? 'bg-card text-ink shadow-xs'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {currentLang === 'ar' ? tmpl.name_ar : tmpl.name_en}
              </button>
            ))}
          </div>

          {/* Device toggle */}
          <div className="inline-flex p-1 bg-surface rounded-brand border border-line">
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`p-1.5 rounded-brand-sm text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                deviceMode === 'mobile' ? 'bg-card text-ink shadow-xs' : 'text-ink-soft'
              }`}
              title="معاينة الهاتف المحمول"
            >
              <Smartphone className="w-4 h-4 text-brand" />
              <span className="hidden sm:inline">{currentLang === 'ar' ? 'شاشة الهاتف' : 'Mobile'}</span>
            </button>

            <button
              onClick={() => setDeviceMode('desktop')}
              className={`p-1.5 rounded-brand-sm text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                deviceMode === 'desktop' ? 'bg-card text-ink shadow-xs' : 'text-ink-soft'
              }`}
              title="معاينة الحاسوب"
            >
              <Monitor className="w-4 h-4 text-brand" />
              <span className="hidden sm:inline">{currentLang === 'ar' ? 'شاشة الحاسوب' : 'Desktop'}</span>
            </button>
          </div>

          {/* Currency Toggle inside preview */}
          <div className="inline-flex p-1 bg-surface rounded-brand border border-line text-xs">
            <button
              onClick={() => setSelectedCurrency('EGP')}
              className={`px-2.5 py-1 rounded-brand-sm font-bold transition-all cursor-pointer ${
                selectedCurrency === 'EGP' ? 'bg-card text-ink shadow-xs' : 'text-ink-soft'
              }`}
            >
              EGP 🇪🇬
            </button>
            <button
              onClick={() => setSelectedCurrency('SAR')}
              className={`px-2.5 py-1 rounded-brand-sm font-bold transition-all cursor-pointer ${
                selectedCurrency === 'SAR' ? 'bg-card text-ink shadow-xs' : 'text-ink-soft'
              }`}
            >
              SAR 🇸🇦
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Store Preview Frame */}
      <div className="flex justify-center">
        <div
          className={`bg-card border border-line rounded-brand-lg shadow-xl overflow-hidden transition-all duration-300 ${
            deviceMode === 'mobile' ? 'w-full max-w-sm ring-8 ring-secondary/10' : 'w-full max-w-5xl'
          }`}
        >
          {/* Mock Browser/App Bar */}
          <div className="bg-secondary text-white/70 px-4 py-2 flex items-center justify-between text-xs border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-danger" />
              <div className="w-2.5 h-2.5 rounded-full bg-warning" />
              <div className="w-2.5 h-2.5 rounded-full bg-brand" />
              <span className="ms-2 font-mono text-[10px] text-white/50">
                https://demo.{selectedTemplateId}.sanad.app
              </span>
            </div>
            <span className="rounded border border-brand-on-dark/30 bg-brand-on-dark/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-on-dark">
              0% عمولة
            </span>
          </div>

          {/* Storefront Mock Content */}
          <div className="p-4 sm:p-6 space-y-6 bg-surface min-h-[500px]">
            {/* Storefront Nav */}
            <div className="bg-card p-3 rounded-brand border border-line flex items-center justify-between">
              <div className="font-heading font-extrabold text-ink text-sm">
                {currentLang === 'ar' ? currentTemplate.name_ar.split('(')[0] : currentTemplate.name_en}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded">
                  {selectedCurrency === 'EGP' ? 'الجنيه 🇪🇬' : 'الريال 🇸🇦'}
                </span>
                <div className="w-7 h-7 rounded-brand-sm bg-surface flex items-center justify-center text-ink-soft">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Storefront Hero Banner */}
            <div className={`${currentTemplate.primary_color} text-white p-5 sm:p-7 rounded-brand-lg space-y-2`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                {currentLang === 'ar' ? 'تشكيلة حصرية' : 'Exclusive Arrivals'}
              </span>
              <h3 className="font-heading font-bold text-base sm:text-xl text-white">
                {currentLang === 'ar' ? currentTemplate.hero_title_ar : currentTemplate.hero_title_en}
              </h3>
              <p className="text-xs text-white/70">
                {currentLang === 'ar' ? currentTemplate.hero_subtitle_ar : currentTemplate.hero_subtitle_en}
              </p>
            </div>

            {/* Product Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-ink">
                <span>{currentLang === 'ar' ? 'المنتجات المختارة' : 'Featured Products'}</span>
                <span className="text-subtle font-normal">{currentLang === 'ar' ? 'الدفع عند الاستلام متاح' : 'COD Available'}</span>
              </div>

              <div className={`grid gap-3 ${deviceMode === 'mobile' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
                {currentTemplate.sample_products.map((prod, idx) => {
                  const price = selectedCurrency === 'EGP' ? prod.price_egp : prod.price_sar;
                  const currSymbol = selectedCurrency === 'EGP' ? (currentLang === 'ar' ? 'ج.م' : 'EGP') : (currentLang === 'ar' ? 'ر.س' : 'SAR');

                  return (
                    <div key={idx} className="bg-card rounded-brand border border-line overflow-hidden p-2.5 flex flex-col justify-between space-y-2 shadow-2xs">
                      <div className={`w-full aspect-square rounded-brand-sm ${prod.image_accent} flex items-center justify-center text-subtle relative`}>
                        <ShoppingBag className="w-6 h-6 text-subtle/70" />
                        {prod.badge_ar && (
                          <span className="absolute end-1.5 top-1.5 rounded bg-secondary px-1.5 py-0.2 text-[9px] font-bold text-on-secondary">
                            {prod.badge_ar}
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="font-bold text-ink text-xs truncate">
                          {currentLang === 'ar' ? prod.title_ar : prod.title_en}
                        </div>
                        <div className="text-xs font-bold text-brand mt-1">
                          {price.toLocaleString()} <span className="text-[10px] font-normal text-subtle">{currSymbol}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <button className="flex-1 rounded-brand-sm bg-secondary py-1.5 text-[10px] font-bold text-on-secondary transition hover:brightness-110 cursor-pointer">
                          {currentLang === 'ar' ? 'طلب سريع' : 'Quick Buy'}
                        </button>
                        <button className="rounded-brand-sm bg-brand-soft p-1.5 text-brand transition hover:bg-brand/15 cursor-pointer" title="استفسار واتساب">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Storefront Footer note */}
            <div className="text-center text-[11px] text-subtle pt-3 border-t border-line">
              {currentLang === 'ar'
                ? 'مدعوم بمنصة سند للتجارة · 0% عمولة على المبيعات'
                : 'Powered by Sanad Commerce · 0% Commission on Orders'}
            </div>
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="text-center space-y-3 pt-6">
        <h3 className="text-xl font-bold font-heading text-ink">
          {currentLang === 'ar' ? 'أعجبك التصميم؟ أطلق متجرك المماثل في دقائق' : 'Ready to Launch a Similar Store?'}
        </h3>
        <p className="text-xs sm:text-sm text-subtle max-w-md mx-auto">
          {currentLang === 'ar'
            ? 'احصل على متجرك بنطاقك المخصص و 0% عمولة واشتراك شهري ثابت 100 ج.م فقط.'
            : 'Get your storefront with custom domain, 0% cut, and flat 100 EGP/mo.'}
        </p>
        <button
          onClick={onOpenStoreModal}
          className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-brand shadow-xs transition-colors cursor-pointer"
        >
          {currentLang === 'ar' ? 'ابدأ متجرك الآن' : 'Start Your Store Now'}
        </button>
      </div>
    </div>
  );
};
