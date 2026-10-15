import React, { useState, useRef } from 'react';
import { Language } from '../data/translations';
import { api } from '../lib/api';
import {
  Upload,
  CheckCircle2,
  Download,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  AlertCircle
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
  const [parsed, setParsed] = useState<{ rows: number; columns: string[]; fileName: string } | null>(null);
  const [parseError, setParseError] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const header = 'sku,name_ar,name_en,price_egp,price_sar,stock';
    const example = 'SKU-001,قميص كتان, Linen Shirt,750,57,48';
    const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Sanad_Products_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string): { columns: string[]; rows: number } => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error(currentLang === 'ar' ? 'الملف فارغ أو بدون صفوف بيانات.' : 'File is empty or has no data rows.');
    const columns = lines[0].split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
    return { columns, rows: lines.length - 1 };
  };

  const handleFile = async (file: File) => {
    setParseError('');
    setParsed(null);
    try {
      const text = await file.text();
      const { columns, rows } = parseCsv(text);
      setParsed({ rows, columns, fileName: file.name });
      setIsRecording(true);
      try {
        await api.lead('migration_import', { source: selectedSource, fileName: file.name, rows, columns });
      } finally {
        setIsRecording(false);
      }
    } catch (e: any) {
      setParseError(e?.message || (currentLang === 'ar' ? 'تعذر قراءة الملف.' : 'Could not read the file.'));
    }
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
            onClick={downloadTemplate}
            className="px-4 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer bg-slate-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{currentLang === 'ar' ? 'تحميل قالب Excel النموذجي' : 'Download Sample CSV'}</span>
          </button>
        </div>

        {/* Upload Dropzone: parses a real CSV file locally */}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 ${
            parsed
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50'
          }`}
        >
          {parsed ? (
            <div className="space-y-2 py-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="font-bold text-slate-900 text-sm">
                {currentLang === 'ar'
                  ? `تمت قراءة ${parsed.rows} منتجاً من ${parsed.fileName}`
                  : `${parsed.rows} products parsed from ${parsed.fileName}`}
              </div>
              <div className="text-xs text-slate-500" dir="ltr">
                {parsed.columns.join(' · ')}
              </div>
              {isRecording && (
                <div className="text-[11px] text-slate-400">
                  {currentLang === 'ar' ? 'جاري تسجيل طلب الترحيل...' : 'Recording migration request...'}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-emerald-600 mx-auto shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-xs sm:text-sm">
                  {currentLang === 'ar' ? 'انقر لاختيار ملف المنتجات (CSV) من جهازك' : 'Click to choose your product CSV file'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {currentLang === 'ar' ? 'يُقرأ الملف محلياً في متصفحك، ويُرسل ملخص الأعمدة فقط' : 'Parsed locally in your browser; only the column summary is sent'}
                </div>
              </div>
            </>
          )}
        </div>
        {parseError && (
          <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

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
