import React, { useState } from 'react';
import { Language } from '../data/translations';
import {
  CheckCircle2,
  Clock,
  PhoneCall,
  Package,
  Truck,
  UserCheck,
  Banknote,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';

interface CODProcessVisualizerProps {
  currentLang: Language;
}

interface StageInfo {
  id: number;
  title_ar: string;
  title_en: string;
  actor_ar: string;
  actor_en: string;
  desc_ar: string;
  desc_en: string;
  action_ar: string;
  action_en: string;
  impact_ar: string;
  impact_en: string;
  icon: any;
}

const STAGES: StageInfo[] = [
  {
    id: 1,
    title_ar: '1. الطلب الوارد',
    title_en: '1. Order Placed',
    actor_ar: 'المتسوق عبر المتجر',
    actor_en: 'Shopper on Storefront',
    desc_ar: 'يسجل العميل طلبه باختيار خيار الدفع عند الاستلام وكتابة رقم هاتفه وعنوانه.',
    desc_en: 'Customer places order selecting Cash on Delivery with phone number and delivery address.',
    action_ar: 'حجز المخزون تلقائياً وإصدار رقم طلب فريد وإرسال إشعار فوري للتاجر.',
    action_en: 'Stock reserved, unique order ID generated, merchant notified.',
    impact_ar: 'بداية العداد الزمني لمعدل الاستجابة',
    impact_en: 'Response clock starts ticking',
    icon: Clock
  },
  {
    id: 2,
    title_ar: '2. تأكيد الواتساب / الهاتف',
    title_en: '2. Verification via WhatsApp',
    actor_ar: 'فريق العمليات / التاجر',
    actor_en: 'Merchant Operations Team',
    desc_ar: 'إرسال رسالة واتساب بنقرة واحدة لتأكيد دقة العنوان ورقم الشقة وجدية الاستلام.',
    desc_en: '1-click WhatsApp message to verify building/apartment number and purchase intent.',
    action_ar: 'فلترة الطلبات الوهمية قبل شحن الطرد ودفع مصاريف الشحن لشركة الشحن.',
    action_en: 'Filters out ghost/fake orders before courier airway bill issuance.',
    impact_ar: 'يخفض المرتجعات بنسبة تصل إلى 28%',
    impact_en: 'Reduces return rate by up to 28%',
    icon: PhoneCall
  },
  {
    id: 3,
    title_ar: '3. التجهيز والتغليف',
    title_en: '3. Picking & Packaging',
    actor_ar: 'المستودع الداخلي',
    actor_en: 'Internal Packing Station',
    desc_ar: 'تغليف المنتجات وطباعة بوليصة الشحن مع الفاتورة الضريبية وقائمة الأصناف بدقة.',
    desc_en: 'Secure product packaging, barcode generation, and packing slip printing.',
    action_ar: 'فحص الجودة والمقاس قبل التغليف لتفادي أخطاء تجهيز الطلبات.',
    action_en: 'Pre-dispatch QC check to eliminate size and item mismatch errors.',
    impact_ar: 'يقضي تماماً على مرتجعات الخطأ في المقاس',
    impact_en: 'Eliminates picking mistakes entirely',
    icon: Package
  },
  {
    id: 4,
    title_ar: '4. تسليم الطرد للمندوب',
    title_en: '4. Handed to Courier',
    actor_ar: 'شركة الشحن (بوسطة/أرامكس/سمسا)',
    actor_en: 'Courier (Bosta / Aramex / SMSA)',
    desc_ar: 'استلام مندوب الشحن للشحنة وتسجيلها في نظام التتبع مع رمز الباركود الموحد.',
    desc_en: 'Courier picks up parcel and registers shipment in the tracking system.',
    action_ar: 'تحديث حالة الطلب إلى "تم الشحن" وإرسال رابط التتبع المباشر للعميل عبر واتساب.',
    action_en: 'Status updates to Shipped; tracking URL sent to buyer via WhatsApp.',
    impact_ar: 'شفافية كاملة للمشتري',
    impact_en: 'Full buyer tracking visibility',
    icon: Truck
  },
  {
    id: 5,
    title_ar: '5. جاري التوصيل صباحاً',
    title_en: '5. Out for Delivery Alert',
    actor_ar: 'مندوب التوصيل',
    actor_en: 'Last-Mile Delivery Driver',
    desc_ar: 'خروج المندوب لتسليم الشحنة في اليوم المحدد لمنطقة العميل السكنية.',
    desc_en: 'Driver begins route in customer neighbourhood.',
    action_ar: 'إشعار صباحي تلقائي للمشتري: "طردك سيصلك اليوم، برجاء تجهيز مبلغ X ج.م كاش".',
    action_en: 'Morning alert: "Your parcel arrives today, please prepare exact cash X EGP".',
    impact_ar: 'يحل مشكلة "المشتري لا يملك فكة أو غير متواجد"',
    impact_en: 'Solves "no cash available / not home" issue',
    icon: UserCheck
  },
  {
    id: 6,
    title_ar: '6. تم التسليم والتحصيل',
    title_en: '6. Delivered & Cash Collected',
    actor_ar: 'المشتري ومندوب الشحن',
    actor_en: 'Shopper & Delivery Courier',
    desc_ar: 'استلام العميل للطرد بنجاح وتسليم المبلغ النقدي كاملاً لمندوب التوصيل.',
    desc_en: 'Customer inspects parcel and hands full cash amount to courier driver.',
    action_ar: 'تسجيل التحصيل في النظام وتحديث حالة الطلب إلى "تم التسليم بنجاح".',
    action_en: 'Remittance recorded in system, status changed to Delivered.',
    impact_ar: 'تحقيق المبيعة وحفظ هامش الربح 100%',
    impact_en: 'Order completed, 100% margin locked',
    icon: CheckCircle2
  },
  {
    id: 7,
    title_ar: '7. توريد الكاش لحسابك',
    title_en: '7. Cash Remittance Settled',
    actor_ar: 'الإدارة المالية لشركة الشحن',
    actor_en: 'Courier Finance Department',
    desc_ar: 'تحويل شركة الشحن لمبالغ التحصيلات النقدية المجمعة مباشرة لحسابك البنكي أو المحفظة.',
    desc_en: 'Courier transfers collected COD funds directly into merchant bank account.',
    action_ar: 'مطابقة المبالغ المحولة تلقائياً مع كشف حساب الطرود المسلمة في لوحة تحكمك.',
    action_en: 'Automated 1-to-1 reconciliation against delivered order manifests.',
    impact_ar: 'إغلاق الدورة النقدية ومطابقة الحسابات بدقة',
    impact_en: 'Cash cycle closed with zero missing revenue',
    icon: Banknote
  },
  {
    id: 8,
    title_ar: '8. إدارة المرتجع إن حدث',
    title_en: '8. Controlled Return Handling',
    actor_ar: 'التاجر وقسم الجرد',
    actor_en: 'Merchant Returns Audit',
    desc_ar: 'في حال تعذر استلام الطلب، يعود الطرد للمستودع وإعادة إدراجه في المخزون فورياً.',
    desc_en: 'If delivery fails, parcel is inspected, re-stocked, and customer flagged if bad faith.',
    action_ar: 'تسجيل سبب الإلغاء وحظر العميل في حال تكرار الامتناع عن الاستلام لحمايتك.',
    action_en: 'Cancellations categorized; habitual return abusers flagged to safeguard margins.',
    impact_ar: 'حماية رأس المال من الهدر المتكرر',
    impact_en: 'Protects working capital from fraud',
    icon: RotateCcw
  }
];

export const CODProcessVisualizer: React.FC<CODProcessVisualizerProps> = ({ currentLang }) => {
  const [selectedStage, setSelectedStage] = useState<number>(2);
  const activeStage = STAGES.find((s) => s.id === selectedStage) || STAGES[1];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 mb-1">
            <Banknote className="w-4 h-4" />
            <span>{currentLang === 'ar' ? 'البنية التحتية التشغيلية للدفع عند الاستلام' : 'COD Operating Infrastructure'}</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            {currentLang === 'ar' ? 'دورة حياة الـ COD المتكاملة (من الطلب إلى توريد الكاش)' : 'The 8-Stage COD Lifecycle Pipeline'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {currentLang === 'ar'
              ? 'انقر على أي مرحلة لاستكشاف الإجراء التشغيلي المطبق للتحكم في تكاليف الشحن وتفادي المرتجعات.'
              : 'Click any step to inspect the operational mechanisms engineered to control shipping costs and maximize cash recovery.'}
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 font-semibold self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{currentLang === 'ar' ? 'متوسط نجاح تسليم: 85%+' : 'Target Delivery Success: 85%+'}</span>
        </div>
      </div>

      {/* 8-Stage Interactive Navigation Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 py-6">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          const isSelected = stage.id === selectedStage;
          return (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-xs ring-1 ring-emerald-500'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold leading-tight">
                {currentLang === 'ar' ? stage.title_ar : stage.title_en}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Stage Detail Panel */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                {currentLang === 'ar' ? activeStage.actor_ar : activeStage.actor_en}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-slate-600">
                {currentLang === 'ar' ? activeStage.impact_ar : activeStage.impact_en}
              </span>
            </div>

            <h4 className="text-lg font-bold font-heading text-slate-900">
              {currentLang === 'ar' ? activeStage.title_ar : activeStage.title_en}
            </h4>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {currentLang === 'ar' ? activeStage.desc_ar : activeStage.desc_en}
            </p>

            <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
              <span className="font-bold text-slate-900 block">
                {currentLang === 'ar' ? 'الإجراء التشغيلي المطبق في نظام سند:' : 'System Action Implemented in Sanad:'}
              </span>
              <span>{currentLang === 'ar' ? activeStage.action_ar : activeStage.action_en}</span>
            </div>
          </div>

          {/* Illustrative benchmarks callout (not live merchant data) */}
          <div className="md:col-span-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {currentLang === 'ar' ? 'نتائج توضيحية (مثال)' : 'Illustrative outcomes (example)'}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">{currentLang === 'ar' ? 'معدل نجاح التسليم:' : 'Delivery Success Rate:'}</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">86.4%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">{currentLang === 'ar' ? 'نسبة خفض المرتجع:' : 'Return Reduction:'}</span>
                <span className="font-bold text-slate-900">-38.5%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">{currentLang === 'ar' ? 'كاش معلق للتوريد:' : 'Pending Remittances:'}</span>
                <span className="font-bold text-slate-900">14,250 {currentLang === 'ar' ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
