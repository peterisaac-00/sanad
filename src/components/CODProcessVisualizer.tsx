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
    action_ar: 'حجز المخزون تلقائياً وإصدار رقم طلب فريد. يظهر الطلب في لوحة التحكم للمراجعة.',
    action_en: 'Stock is reserved and a unique order ID is generated. The order appears in the dashboard for review.',
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
    impact_ar: 'يقلل المرتجعات عبر تأكيد العنوان يدوياً',
    impact_en: 'Helps reduce returns through manual address confirmation',
    icon: PhoneCall
  },
  {
    id: 3,
    title_ar: '3. التجهيز والتغليف',
    title_en: '3. Picking & Packaging',
    actor_ar: 'المستودع الداخلي',
    actor_en: 'Internal Packing Station',
    desc_ar: 'تغليف المنتجات وطباعة الفاتورة وقائمة الأصناف يدوياً قبل التسليم للناقل.',
    desc_en: 'Secure product packaging and printing of the invoice and packing slip before courier handoff.',
    action_ar: 'فحص الجودة والمقاس قبل التغليف لتفادي أخطاء تجهيز الطلبات.',
    action_en: 'Pre-dispatch QC check to reduce size and item mismatch errors.',
    impact_ar: 'يقلل أخطاء التجهيز والمقاس',
    impact_en: 'Reduces packing and sizing errors',
    icon: Package
  },
  {
    id: 4,
    title_ar: '4. تسليم الطرد للمندوب',
    title_en: '4. Handed to Courier',
    actor_ar: 'شركة الشحن (خارج سند)',
    actor_en: 'Courier (outside Sanad)',
    desc_ar: 'استلام مندوب الشحن للشحنة، وتسجيل اسم الناقل ورقم البوليصة يدوياً في الطلب.',
    desc_en: 'Courier picks up the parcel; the merchant records the carrier name and waybill number manually.',
    action_ar: 'تحديث حالة الطلب إلى "تم الشحن" يدوياً وإرسال رسالة واتساب جاهزة للعميل. لا يوجد ربط آلي أو تتبع مباشر.',
    action_en: 'Manually mark the order as Shipped and send a prepared WhatsApp message. No carrier integration or live tracking exists.',
    impact_ar: 'تحديثات حالة يدوية واضحة للمشتري',
    impact_en: 'Clear manual status updates for the buyer',
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
    action_ar: 'لا يوجد إشعار صباحي تلقائي؛ يرسل التاجر رسالة واتساب يدوياً يطلب فيها تجهيز المبلغ النقدي.',
    action_en: 'No automatic morning alert exists; the merchant manually sends a WhatsApp message asking the buyer to prepare the cash amount.',
    impact_ar: 'يقلل حالات عدم توفر الفكة عبر التذكير اليدوي',
    impact_en: 'Helps reduce cash-not-ready failures through manual reminders',
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
    impact_ar: 'تحقيق المبيعة وتحصيل المبلغ النقدي',
    impact_en: 'Sale completed and cash collected',
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
    action_ar: 'راجع كشف شركة الشحن وسجّل التحصيل يدوياً في الطلب. لا توجد مطابقة آلية أو ربط بنكي.',
    action_en: 'Review the courier statement and record the collection manually on the order. No automatic reconciliation or bank integration exists.',
    impact_ar: 'إغلاق الدورة النقدية بعد المراجعة اليدوية',
    impact_en: 'Cash cycle closed after manual review',
    icon: Banknote
  },
  {
    id: 8,
    title_ar: '8. إدارة المرتجع إن حدث',
    title_en: '8. Controlled Return Handling',
    actor_ar: 'التاجر وقسم الجرد',
    actor_en: 'Merchant Returns Audit',
    desc_ar: 'في حال تعذر استلام الطلب، يعود الطرد للمستودع ويعاد إدخاله في المخزون يدوياً.',
    desc_en: 'If delivery fails, the parcel returns to the warehouse and is restocked manually.',
    action_ar: 'سجّل سبب الإلغاء وراجع سجل العميل يدوياً؛ لا يوجد حظر تلقائي للعملاء.',
    action_en: 'Record the cancellation reason and review customer history manually; no automatic customer blocking exists.',
    impact_ar: 'حماية رأس المال من الهدر المتكرر',
    impact_en: 'Protects working capital from fraud',
    icon: RotateCcw
  }
];

export const CODProcessVisualizer: React.FC<CODProcessVisualizerProps> = ({ currentLang }) => {
  const [selectedStage, setSelectedStage] = useState<number>(2);
  const activeStage = STAGES.find((s) => s.id === selectedStage) || STAGES[1];

  return (
    <div className="bg-card rounded-brand-lg border border-line shadow-sm p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand mb-1">
            <Banknote className="w-4 h-4" />
            <span>{currentLang === 'ar' ? 'البنية التحتية التشغيلية للدفع عند الاستلام' : 'COD Operating Infrastructure'}</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-heading text-ink">
            {currentLang === 'ar' ? 'دورة حالات الـ COD من الطلب إلى التحصيل اليدوي' : '8-Stage COD Status Flow (Manual Collection)'}
          </h3>
          <p className="text-xs sm:text-sm text-subtle mt-1">
            {currentLang === 'ar'
              ? 'انقر على أي مرحلة لاستكشاف الإجراء التشغيلي المطبق للتحكم في تكاليف الشحن وتفادي المرتجعات.'
              : 'Click any step to inspect the operational mechanisms engineered to control shipping costs and maximize cash recovery.'}
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-soft rounded-brand-sm border border-brand-line text-xs text-brand font-semibold self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-brand" />
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
              className={`p-3 rounded-brand border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                isSelected
                  ? 'border-brand bg-brand-soft/80 text-brand-active shadow-xs ring-1 ring-brand/30'
                  : 'border-line hover:border-line bg-card text-ink-soft hover:bg-surface'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-brand-sm flex items-center justify-center ${
                  isSelected ? 'bg-brand text-white' : 'bg-surface text-ink-soft'
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
      <div className="bg-surface rounded-brand p-5 border border-line">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand bg-brand-soft/80 px-2 py-0.5 rounded">
                {currentLang === 'ar' ? activeStage.actor_ar : activeStage.actor_en}
              </span>
              <span className="text-xs text-subtle">·</span>
              <span className="text-xs font-semibold text-ink-soft">
                {currentLang === 'ar' ? activeStage.impact_ar : activeStage.impact_en}
              </span>
            </div>

            <h4 className="text-lg font-bold font-heading text-ink">
              {currentLang === 'ar' ? activeStage.title_ar : activeStage.title_en}
            </h4>

            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              {currentLang === 'ar' ? activeStage.desc_ar : activeStage.desc_en}
            </p>

            <div className="p-3 bg-card rounded-brand-sm border border-line text-xs text-ink-soft space-y-1">
              <span className="font-bold text-ink block">
                {currentLang === 'ar' ? 'الإجراء التشغيلي المطبق في نظام سند:' : 'System Action Implemented in Sanad:'}
              </span>
              <span>{currentLang === 'ar' ? activeStage.action_ar : activeStage.action_en}</span>
            </div>
          </div>

          {/* Illustrative benchmarks callout (not live merchant data) */}
          <div className="md:col-span-4 bg-card p-4 rounded-brand border border-line shadow-2xs space-y-3">
            <div className="text-xs font-semibold text-subtle uppercase tracking-wider">
              {currentLang === 'ar' ? 'نتائج توضيحية (مثال)' : 'Illustrative outcomes (example)'}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink-soft">{currentLang === 'ar' ? 'معدل نجاح التسليم:' : 'Delivery Success Rate:'}</span>
                <span className="font-bold text-brand bg-brand-soft px-1.5 py-0.5 rounded">86.4%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink-soft">{currentLang === 'ar' ? 'نسبة خفض المرتجع:' : 'Return Reduction:'}</span>
                <span className="font-bold text-ink">-38.5%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink-soft">{currentLang === 'ar' ? 'كاش معلق للتوريد:' : 'Pending Remittances:'}</span>
                <span className="font-bold text-ink">14,250 {currentLang === 'ar' ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
