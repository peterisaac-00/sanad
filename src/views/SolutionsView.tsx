import React, { useState } from 'react';
import { Language } from '../data/translations';
import {
  Instagram,
  ShoppingBag,
  Globe,
  Store,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  MessageCircle,
  Truck
} from 'lucide-react';

interface SolutionsViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
  onOpenDemoModal: () => void;
}

interface SolutionItem {
  id: string;
  title_ar: string;
  title_en: string;
  icon: React.ElementType;
  headline_ar: string;
  headline_en: string;
  desc_ar: string;
  desc_en: string;
  points_ar: string[];
  points_en: string[];
}

export const SolutionsView: React.FC<SolutionsViewProps> = ({
  currentLang,
  onOpenStoreModal,
  onOpenDemoModal
}) => {
  const [selectedSolution, setSelectedSolution] = useState<string>('social');

  const solutions: SolutionItem[] = [
    {
      id: 'social',
      title_ar: 'تجار السوشيال ميديا وإنستغرام',
      title_en: 'Social & Instagram Sellers',
      icon: Instagram,
      headline_ar: 'توقف عن إهدار ساعات يومياً في محادثات الـ DMs',
      headline_en: 'Stop Wasting Hours in Manual DM Selling',
      desc_ar: 'حوّل متابعي حسابك على إنستغرام وفيسبوك وتيك توك إلى مشترين حقيقيين من خلال رابط سلة واحد في البايو Bio. العميل يختار مقاسه ولونه، يسجل عنوانه، ويتلقى تأكيد طلبه عبر واتساب فورياً.',
      desc_en: 'Direct followers to a single bio link with instantaneous mobile checkout. Shoppers choose sizes, input addresses, and receive automated WhatsApp confirmations.',
      points_ar: [
        'رابط Bio سريع ومناسب لتصفح الهواتف وشبكات المحمول',
        'تأكيد الطلب التلقائي وإرسال الفاتورة للعميل على واتساب',
        '0% عمولة للمنصة لحماية هامش ربحك الذي تبنيه بجهدك',
        'تجميع وتتبع طلبات الـ COD بدون تكرار تسجيل العناوين يدوياً'
      ],
      points_en: [
        'Lightning fast Link-in-Bio mobile storefront optimized for mobile screens',
        'Automated order confirmation and WhatsApp invoice dispatch',
        '0% platform commission preserving 100% of your hard-earned margins',
        'Organized COD order manifests without retyping buyer details manually'
      ]
    },
    {
      id: 'd2c',
      title_ar: 'العلامات التجارية المباشرة (D2C)',
      title_en: 'Direct-to-Consumer (D2C) Brands',
      icon: ShoppingBag,
      headline_ar: 'ابنِ هويتك المستقلة وامتلك علاقتك مع العميل',
      headline_en: 'Build Your Brand Identity & Own Your Customer Data',
      desc_ar: 'لا تحصر علامتك في منصات البيع الجماعية (Marketplaces) التي تقتطع 15-25% من مبيعاتك وتخفي عنك بيانات عملائك. مع سند، تمتلك متجرك بهويتك، نطاقك المستقل، وقاعدة عملائك للتسويق المتكرر.',
      desc_en: 'Break free from marketplace aggregators taking 15-25% cuts and hiding buyer data. Own your storefront domain, logo, and repeat customer retention engine.',
      points_ar: [
        'ربط نطاقك المستقل (.com / .eg / .sa) مجاناً',
        'تكامل كامل مع Meta Conversions API و Google Merchant Center',
        'قسائم التخفيض، العروض المجمعة (Bundles)، ورفع متوسط السلة AOV',
        'ملكية كاملة لقاعدة بيانات العملاء وسجل المشتريات'
      ],
      points_en: [
        'Free custom domain connection (.com / .eg / .sa)',
        'Server-side Meta CAPI & Google Merchant Center dynamic catalog feeds',
        'Smart bundling engines and promo coupons lifting Average Order Value',
        '100% proprietary customer dataset ownership and exportability'
      ]
    },
    {
      id: 'cross-border',
      title_ar: 'التصدير الرقمي من مصر للخليج',
      title_en: 'Cross-Border: Egypt to Gulf Expansion',
      icon: Globe,
      headline_ar: 'انطلق من السوق المصري وافتح مبيعاتك لعملاء الخليج',
      headline_en: 'Expand From Egypt to High-Value Gulf Consumers',
      desc_ar: 'المنتجات المصرية المصنعة محلياً في الأزياء والجلود والمأكولات تحظى بطلب هائل في السعودية والإمارات والكويت. نوفر لك معمارية تعدد العملات والشحن الجوي عابر الحدود لتبيع بسهولة وأمان.',
      desc_en: 'Egyptian fashion, footwear, and artisanal products enjoy immense demand across Saudi Arabia, UAE, and Kuwait. Utilize our multi-currency and international courier engine.',
      points_ar: [
        'عرض الأسعار بالريال السعودي (SAR) والدرهم (AED) والدينار (KWD)',
        'نظام الصرف المزدوج: التحديث الآلي لأسعار الصرف أو التحديد اليدوي',
        'طباعة الفواتير التجارية الدولية وبوالص الشحن الجوي',
        'استقبال المدفوعات بالبطاقات البنكية الدولية و Apple Pay'
      ],
      points_en: [
        'Localized prices in SAR, AED, KWD alongside EGP',
        'Dual FX engine: Automated live exchange rates or custom manual buffer rates',
        'Automated bilingual commercial invoices for customs clearance',
        'Digital checkouts accepting international credit cards and Apple Pay'
      ]
    },
    {
      id: 'retail',
      title_ar: 'المتاجر والمحلات التقليدية',
      title_en: 'Retail Stores Going Digital',
      icon: Store,
      headline_ar: 'وسّع نطاق مبيعاتك خارج حدود شارعك ومحافظتك',
      headline_en: 'Scale Footwear, Fashion & Retail Beyond Physical Stores',
      desc_ar: 'محلّك التجاري يخدم زبائن منطقتك فقط؛ متجرك الإلكتروني على سند يفتح لك مبيعات 27 محافظة في مصر وكافة دول الخليج العربي، مع ضبط حركة المخزون والفواتير بضغطة زر.',
      desc_en: 'Your physical store is limited to foot traffic; your online store on Sanad connects you to millions of shoppers across 27 Egyptian governorates and the Gulf.',
      points_ar: [
        'تتبع دقيق للمخزون لكل مقاس ولون (SKU)',
        'استيراد سريع لكتالوج محلك بملف Excel واحد عبر مركز الترحيل',
        'إصدار فواتير ضريبية وبوالص شحن جاهزة للمناديب',
        'تسعير ثابت 100 ج.م شهرياً لا يرهق ميزانية محلك'
      ],
      points_en: [
        'Granular inventory tracking across sizes, colors, and stock locations',
        'Bulk import your current spreadsheet catalogue in minutes via Migration Center',
        '1-click printable invoices and airway bills ready for courier pick-up',
        'Flat 100 EGP/mo SaaS fee that keeps operational overhead minimal'
      ]
    }
  ];


  const current = solutions.find((s) => s.id === selectedSolution) || solutions[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand-soft px-3 py-1 rounded-brand-sm border border-brand-line">
          {currentLang === 'ar' ? 'حلول مصممة لطبيعة تجارتك' : 'Tailored Commerce Solutions'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-ink tracking-tight">
          {currentLang === 'ar'
            ? 'حلول تجارة حقيقية تلائم مرحلة نمو عملك'
            : 'Pragmatic Commerce Solutions Built for Your Stage of Growth'}
        </h1>
        <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
          {currentLang === 'ar'
            ? 'سواء كنت تبيع ملابس يدوية عبر إنستغرام أو تدير علامة تجارية تطمح للتصدير إلى الخليج العربي، سند تمنحك البنية التحتية المناسبة دون تعقيد.'
            : 'Whether you sell via Instagram DMs or lead an emerging brand expanding to the GCC, Sanad provides the exact infrastructure you need.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-3">
        {solutions.map((sol) => {
          const Icon = sol.icon;
          const isSelected = sol.id === selectedSolution;
          return (
            <button
              key={sol.id}
              onClick={() => setSelectedSolution(sol.id)}
              className={`px-4 py-2.5 rounded-brand text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'bg-secondary text-white shadow-xs'
                  : 'bg-card border border-line text-ink-soft hover:bg-surface'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-brand-on-dark' : 'text-subtle'}`} />
              <span>{currentLang === 'ar' ? sol.title_ar : sol.title_en}</span>
            </button>
          );
        })}
      </div>

      {/* Solution Presentation Card */}
      <div className="bg-card rounded-brand-lg border border-line shadow-sm p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <span className="text-xs font-bold text-brand bg-brand-soft px-2.5 py-1 rounded border border-brand-line">
              {currentLang === 'ar' ? current.title_ar : current.title_en}
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-ink">
              {currentLang === 'ar' ? current.headline_ar : current.headline_en}
            </h2>

            <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
              {currentLang === 'ar' ? current.desc_ar : current.desc_en}
            </p>

            <div className="space-y-2.5 pt-2 border-t border-line">
              {(currentLang === 'ar' ? current.points_ar : current.points_en).map((pt, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-ink-soft">
                  <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 flex flex-wrap gap-3">
              <button
                onClick={onOpenStoreModal}
                className="px-6 py-3 bg-brand hover:bg-brand-hover text-white rounded-brand text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{currentLang === 'ar' ? 'ابدأ متجرك الآن بـ 100 ج.م/شهر' : 'Start Store for 100 EGP/mo'}</span>
                {currentLang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={onOpenDemoModal}
                className="px-5 py-3 border border-line hover:border-subtle/40 text-ink rounded-brand text-xs font-semibold transition-colors cursor-pointer"
              >
                {currentLang === 'ar' ? 'معاينة لوحة تحكم التاجر' : 'Preview Merchant Cockpit'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-secondary text-white rounded-brand-lg p-6 sm:p-8 space-y-4">
            <div className="text-xs font-mono text-brand-on-dark">
              // SOLUTION_PLAYBOOK : 0% COMMISSION
            </div>
            <div className="text-base font-bold text-white">
              {currentLang === 'ar' ? 'القيمة التجارية المضافة:' : 'Strategic Commercial ROI:'}
            </div>
            <div className="space-y-3 text-xs text-white/70">
              <div className="p-3 bg-white/10 rounded-brand-sm border border-white/10">
                <span className="font-bold text-white block mb-0.5">توفير الوقت:</span>
                <span>توفير ما بين ساعتين إلى ثلاث ساعات يومياً كانت تضيع في تسجيل بيانات العملاء عبر الـ DMs.</span>
              </div>
              <div className="p-3 bg-white/10 rounded-brand-sm border border-white/10">
                <span className="font-bold text-white block mb-0.5">حماية الأرباح:</span>
                <span>عدم دفع عمولات تصاعدية تقتطع من هامش ربح التاجر الصافي.</span>
              </div>
              <div className="p-3 bg-white/10 rounded-brand-sm border border-white/10">
                <span className="font-bold text-white block mb-0.5">تكرار الشراء:</span>
                <span>إعادة استهداف العملاء السابقين عبر واتساب وقوائم العروض لرفع معدل تكرار الشراء بنسبة 25%+.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
