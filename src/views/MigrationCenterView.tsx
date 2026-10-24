import React from 'react';
import { Language } from '../data/translations';
import { AlertCircle, CheckCircle2, FileSpreadsheet, ListChecks, ShieldCheck } from 'lucide-react';

interface MigrationCenterViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

/**
 * There is no CSV/Excel importer, column mapper, or automated migration in the
 * product. This page must not pretend otherwise; it documents the manual path.
 */
export const MigrationCenterView: React.FC<MigrationCenterViewProps> = ({
  currentLang,
  onOpenStoreModal
}) => {
  const isAr = currentLang === 'ar';

  const unavailable = [
    isAr ? 'رفع ملف CSV أو Excel واستيراد المنتجات تلقائياً.' : 'Uploading a CSV or Excel file to import products automatically.',
    isAr ? 'مطابقة الأعمدة أو تحويل صور المنتجات آلياً.' : 'Automatic column mapping or product image conversion.',
    isAr ? 'استيراد الطلبات أو العملاء أو سجل المخزون من منصة أخرى.' : 'Importing orders, customers, or stock history from another platform.',
    isAr ? 'الاحتفاظ بالروابط القديمة أو إعادة توجيهها تلقائياً.' : 'Preserving or redirecting old URLs automatically.',
  ];

  const steps = [
    {
      title: isAr ? 'جهّز قائمة المنتجات' : 'Prepare your product list',
      body: isAr
        ? 'اجمع اسم المنتج، الكود (SKU)، السعر، المخزون، والمقاسات/الألوان في ملف واحد للرجوع إليه.'
        : 'Collect product name, SKU, price, stock, and variants in one reference file.',
    },
    {
      title: isAr ? 'أنشئ متجرك وأضف المنتجات' : 'Create your store and add products',
      body: isAr
        ? 'أضف المنتجات من لوحة التحكم يدوياً. لا يوجد زر استيراد جماعي في النسخة الحالية.'
        : 'Add products from the dashboard manually. There is no bulk-import button in the current release.',
    },
    {
      title: isAr ? 'أعد إدخال العملاء المهمين' : 'Re-enter your key customers',
      body: isAr
        ? 'أضف العملاء الذين تحتاجهم للبدء. تصدير العملاء من سند متاح بصيغة CSV، لكن الاستيراد غير متاح.'
        : 'Add the customers you need to start with. Sanad can export customers as CSV, but importing them is not available.',
    },
    {
      title: isAr ? 'راجع الطلبات المفتوحة يدوياً' : 'Review open orders manually',
      body: isAr
        ? 'سجّل الطلبات الجارية كطلبات يدوية خارجية حتى لا تفقد متابعة أي عميل.'
        : 'Record in-flight orders as external manual orders so no customer follow-up is lost.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-soft px-3 py-1 text-xs font-bold text-warning">
          <AlertCircle className="h-4 w-4" />
          {isAr ? 'الترحيل التلقائي غير متاح' : 'Automatic migration is not available'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-ink tracking-tight">
          {isAr ? 'انقل بياناتك إلى سند يدوياً' : 'Move Your Data to Sanad Manually'}
        </h1>
        <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
          {isAr
            ? 'لا يوجد مركز ترحيل يرفع الملفات أو يطابق الحقول تلقائياً. نوضح هنا ما لا يعمل وما يمكنك فعله الآن حتى تبدأ بدون وعود غير حقيقية.'
            : 'There is no migration center that uploads files or maps fields automatically. Here is what does not work and what you can do today, without false promises.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-brand-lg border border-warning-line bg-warning-soft/50 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-warning">
            <AlertCircle className="h-4 w-4" />
            {isAr ? 'ما لا نقدمه' : 'What we do not offer'}
          </div>
          <ul className="space-y-2 text-xs leading-6 text-ink-soft">
            {unavailable.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-brand-lg border border-success-line bg-success-soft/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-success">
            <CheckCircle2 className="h-4 w-4" />
            {isAr ? 'ما يمكنك فعله الآن' : 'What you can do now'}
          </div>
          <ul className="space-y-2 text-xs leading-6 text-ink-soft">
            <li>
              • {isAr ? 'إنشاء متجر واختيار عملته الأساسية.' : 'Create a store and choose its base currency.'}
            </li>
            <li>
              • {isAr ? 'إضافة المنتجات والمناطق وأسعار الشحن يدوياً.' : 'Add products, zones, and shipping rates manually.'}
            </li>
            <li>
              • {isAr ? 'تصدير الطلبات والعملاء من سند بصيغة CSV.' : 'Export orders and customers from Sanad as CSV.'}
            </li>
            <li>
              • {isAr ? 'تسجيل الطلبات الخارجية كطلبات يدوية.' : 'Record external orders as manual orders.'}
            </li>
          </ul>
        </div>
      </div>

      <div className="rounded-brand-lg border border-line bg-card p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-2 text-sm font-bold text-ink">
          <ListChecks className="h-4 w-4 text-brand" />
          {isAr ? 'خطوات الترحيل اليدوي' : 'Manual migration steps'}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-brand border border-line bg-surface p-4">
              <div className="mb-1 text-[10px] font-bold text-brand">
                {isAr ? `الخطوة ${index + 1}` : `Step ${index + 1}`}
              </div>
              <div className="text-sm font-bold text-ink">{step.title}</div>
              <p className="mt-1 text-[11px] leading-6 text-subtle">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-brand-lg border border-line bg-brand-soft/40 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold text-brand">
              <ShieldCheck className="h-4 w-4" />
              {isAr ? 'ابدأ بخطوة صغيرة وآمنة' : 'Start with a small, safe step'}
            </div>
            <p className="text-xs leading-6 text-ink-soft">
              {isAr
                ? 'أنشئ المتجر، أضف أول 10 منتجات، وجرّب طلباً واحداً قبل نقل بقية الكتالوج.'
                : 'Create the store, add your first 10 products, and test one order before moving the rest of the catalogue.'}
            </p>
          </div>
          <button
            onClick={onOpenStoreModal}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-brand bg-brand px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-brand-hover"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {isAr ? 'ابدأ متجرك الآن' : 'Start Your Store Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
