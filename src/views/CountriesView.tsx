import React, { useState } from 'react';
import { Language } from '../data/translations';
import { COUNTRIES_DATA, CountryInfo } from '../data/countries';
import {
  Globe,
  Truck,
  CreditCard,
  Banknote,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Building
} from 'lucide-react';

interface CountriesViewProps {
  currentLang: Language;
  onOpenStoreModal: () => void;
}

export const CountriesView: React.FC<CountriesViewProps> = ({ currentLang, onOpenStoreModal }) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('EG');

  const activeCountry =
    COUNTRIES_DATA.find((c) => c.code === selectedCountryCode) || COUNTRIES_DATA[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
          {currentLang === 'ar' ? 'الانتشار والأسواق الإقليمية' : 'Regional Markets Architecture'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-heading text-slate-900 tracking-tight">
          {currentLang === 'ar'
            ? 'بنية تحتية تنطلق من مصر وتخدم العالم العربي'
            : 'Infrastructure Starting in Egypt & Serving the Arab World'}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {currentLang === 'ar'
            ? 'لكل سوق عربي خصائصه: طرق الدفع المفضلة، شركات الشحن المحلية، ونسب الإقبال على الدفع عند الاستلام. سند مهيأة معمارياً لخدمة هذه الأسواق بدون استنساخ سطحي.'
            : 'Every Arab market features distinct dynamics: courier ecosystems, local card schemes, and COD shares. Sanad is natively architected for localized execution.'}
        </p>
      </div>

      {/* Country Selection Chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {COUNTRIES_DATA.map((c) => {
          const isSelected = c.code === selectedCountryCode;
          return (
            <button
              key={c.code}
              onClick={() => setSelectedCountryCode(c.code)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-base">{c.flag}</span>
              <span>{currentLang === 'ar' ? c.name_ar : c.name_en}</span>
              {c.status === 'launch' && (
                <span className="text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded font-extrabold">
                  {currentLang === 'ar' ? 'الإطلاق' : 'Launch'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detailed Country Sheet */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
        {/* Country Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <span className="text-5xl sm:text-6xl">{activeCountry.flag}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
                  {currentLang === 'ar' ? activeCountry.name_ar : activeCountry.name_en}
                </h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  activeCountry.status === 'launch'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {activeCountry.status === 'launch' ? (currentLang === 'ar' ? 'سوق الإطلاق الرئيسي 🇪🇬' : 'Launch Market') : (currentLang === 'ar' ? 'جاهز للتوسع الخليجي 🇸🇦' : 'Expansion Market')}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                {currentLang === 'ar' ? activeCountry.description_ar : activeCountry.description_en}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 text-xs text-start self-start md:self-auto">
            <div className="text-slate-500 font-semibold">{currentLang === 'ar' ? 'العملة الرسمية للتجارة:' : 'Official Currency:'}</div>
            <div className="text-lg font-bold font-heading text-slate-900">
              {activeCountry.currency_code} ({currentLang === 'ar' ? activeCountry.currency_symbol_ar : activeCountry.currency_symbol_en})
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              {currentLang === 'ar' ? 'ضريبة القيمة المضافة:' : 'VAT Rate:'} {activeCountry.vat_rate}
            </div>
          </div>
        </div>

        {/* 4 Pillars of the Localized Market */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. Payment Methods */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>{currentLang === 'ar' ? 'المدفوعات والمحافظ المحلية' : 'Local Payments Ecosystem'}</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {activeCountry.popular_payment_methods.map((method, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{method}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 2. Couriers & Logistics */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Truck className="w-4 h-4 text-emerald-600" />
              <span>{currentLang === 'ar' ? 'شركات الشحن واللوجستيات' : 'Couriers & Logistics'}</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {activeCountry.local_couriers.map((courier, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{courier}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. COD Dynamics */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span>{currentLang === 'ar' ? 'واقع الدفع عند الاستلام' : 'COD Market Dynamics'}</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {activeCountry.cod_prevalence}
            </p>
            <div className="pt-2 text-[11px] text-slate-500">
              {currentLang === 'ar'
                ? 'يدعم نظام سند التتبع الكامل لدورة حياة الطرد وتأكيد العناوين لتفادي المرتجعات.'
                : 'Sanad provides automated verification workflows to minimize delivery drops.'}
            </div>
          </div>

          {/* 4. Cross-border Focus */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>{currentLang === 'ar' ? 'فرص التجارة عابرة الحدود' : 'Cross-Border Opportunity'}</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {activeCountry.cross_border_focus}
            </p>
          </div>
        </div>

        {/* Major Cities / Governorates Supported */}
        <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-900">
              {currentLang === 'ar' ? 'أبرز المدن والمحافظات المشمولة في تسعير الشحن:' : 'Key Cities & Regions with Granular Shipping Rules:'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-slate-700 font-medium">
            {activeCountry.key_cities.map((city, idx) => (
              <span key={idx} className="bg-white px-2 py-0.5 rounded border border-slate-200">
                {city}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {currentLang === 'ar'
                ? `تريد بيع منتجاتك في ${activeCountry.name_ar}؟`
                : `Ready to Sell in ${activeCountry.name_en}?`}
            </h4>
            <p className="text-xs text-slate-500">
              {currentLang === 'ar'
                ? 'ابدأ متجرك بعملتك المفضلة مع 0% عمولة للمنصة على كافة الطلبات.'
                : 'Start your store in your preferred currency with 0% platform commission.'}
            </p>
          </div>

          <button
            onClick={onOpenStoreModal}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 self-stretch sm:self-auto justify-center"
          >
            <span>{currentLang === 'ar' ? 'ابدأ متجرك الآن' : 'Start Your Store Now'}</span>
            {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
