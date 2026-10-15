import React, { useState } from 'react';
import { Language } from '../data/translations';
import {
  RefreshCw,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Download,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Database
} from 'lucide-react';

interface MigrationCenterViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

export const MigrationCenterView: React.FC<MigrationCenterViewProps> = ({
  currentLang,
  onOpenStoreModal
}) => {
  const [selectedSource, setSelectedSource] = useState<string>('excel');
  const [isSimulatingUpload, setIsSimulatingUpload] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

  const handleSimulate = () => {
    setIsSimulatingUpload(true);
    setTimeout(() => {
      setIsSimulatingUpload(false);
      setUploadSuccess(true);
    }, 1200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
          {currentLang === 'ar' ? 'مركز الترحيل السريع' : 'Fast Migration Center'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-slate-900 tracking-tight">
          {currentLang === 'ar'
            ? 'انقل متجرك إلى سند بدون فقدان دقيقة واحدة أو منتج واحد'
            : 'Migrate to Sanad in Minutes Without Losing a Single Product'}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {currentLang === 'ar'
            ? 'انقل منتجاتك، أسعارك، مقاساتك، وصورك من أي منصة سابقة عبر ملفات Excel و CSV المنظمة، وتخلص من العمولات المقتطعة للأبد.'
            : 'Import products, variants, and inventory from legacy systems via standardized CSV/Excel files and escape percentage commission cuts.'}
        </p>
      </div>

      {/* Migration Supported Platforms */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
        {[
          { id: 'excel', name_ar: 'ملف Excel / CSV', name_en: 'Excel / CSV Sheets', desc_ar: 'قالب مفتوح لأي تاجر' },
          { id: 'shopify', name_ar: 'شوبيفاي Shopify', name_en: 'Shopify Export', desc_ar: 'تصدير الكتالوج والعملاء' },
          { id: 'woocommerce', name_ar: 'ووكومرس WooCommerce', name_en: 'WooCommerce', desc_ar: 'استيراد بضغطة زر' },
          { id: 'salla-zid', name_ar: 'سلة وزد وسهلة', name_en: 'Salla & Zid', desc_ar: 'مطابقة الحقول تلقائياً' }
        ].map((platform) => (
          <button
            key={platform.id}
            onClick={() => setSelectedSource(platform.id)}
            className={`p-4 rounded-2xl border text-center transition-all cursor-pointer space-y-1 ${
              selectedSource === platform.id
                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500'
                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="font-heading text-sm">{platform.name_ar}</div>
            <div className="text-[11px] text-slate-500 font-normal">{platform.desc_ar}</div>
          </button>
        ))}
      </div>

      {/* Interactive Spreadsheet Uploader Simulator */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900">
              {currentLang === 'ar' ? 'نموذج مطابقة البيانات الذكي (Data Mapper)' : 'Smart Spreadsheet Data Mapper'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentLang === 'ar' ? 'يدعم قراءة الأعمدة بالعربية والإنجليزية تلقائياً.' : 'Reads Arabic & English column headers seamlessly.'}
            </p>
          </div>

          <button
            onClick={() => alert(currentLang === 'ar' ? 'تم تنزيل قالب المنتجات النموذجي (Sanad_Products_Template.xlsx)' : 'Downloaded sample spreadsheet template')}
            className="px-4 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer bg-slate-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{currentLang === 'ar' ? 'تحميل قالب Excel النموذجي' : 'Download Sample CSV'}</span>
          </button>
        </div>

        {/* Upload Dropzone Simulation */}
        <div
          onClick={handleSimulate}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 ${
            uploadSuccess
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50'
          }`}
        >
          {isSimulatingUpload ? (
            <div className="space-y-2 py-4">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <div className="text-xs font-bold text-slate-800">
                {currentLang === 'ar' ? 'جاري فحص وتدقيق أعمدة الملف والمنتجات...' : 'Validating spreadsheet columns and SKUs...'}
              </div>
            </div>
          ) : uploadSuccess ? (
            <div className="space-y-2 py-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="font-bold text-slate-900 text-sm">
                {currentLang === 'ar' ? 'تمت قراءة 48 منتجاً بنجاح مع كافة المقاسات والأسعار!' : '48 products parsed successfully with sizes and prices!'}
              </div>
              <div className="text-xs text-slate-500">
                {currentLang === 'ar' ? 'جاهز للاستيراد بضغطة زر واحدة إلى لوحة تحكم متجرك.' : 'Ready to load directly into your store.'}
              </div>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-emerald-600 mx-auto shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-xs sm:text-sm">
                  {currentLang === 'ar' ? 'انقر هنا لتجربة استيراد ملف المنتجات (Excel / CSV)' : 'Click here to test importing your product spreadsheet'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {currentLang === 'ar' ? 'يدعم ملفات .xlsx و .csv حتى 10,000 منتج' : 'Supports .xlsx & .csv up to 10,000 SKUs'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Data Ownership Principles */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <span className="font-bold text-slate-900 block">
              {currentLang === 'ar' ? 'مبدأ ملكية بيانات التاجر:' : 'Absolute Merchant Data Ownership:'}
            </span>
            <span>
              {currentLang === 'ar'
                ? 'مثلما تستورد بياناتك بسهولة، يمكنك تصدير كافة منتجاتك وطلباتك وعملائك في أي وقت وبصيغ مفتوحة دون احتجاز بياناتك.'
                : 'Just as easily as you import, you can export all your products, orders, and customer databases anytime.'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center pt-2">
          <button
            onClick={onOpenStoreModal}
            className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
          >
            <span>{currentLang === 'ar' ? 'ابدأ ترحيل متجرك الآن بـ 100 ج.م/شهر' : 'Start Your Migration Now'}</span>
            {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
