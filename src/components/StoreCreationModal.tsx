import React, { useState } from 'react';
import { Language } from '../data/translations';
import { COUNTRIES_DATA } from '../data/countries';
import { PRICING_MODEL } from '../data/pricing';
import { api } from '../lib/api';
import {
  X,
  Store,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Building2,
  Globe
} from 'lucide-react';

interface StoreCreationModalProps {
  currentLang: Language;
  isOpen: boolean;
  onClose: () => void;
  onSuccessLaunch: () => void;
}

export const StoreCreationModal: React.FC<StoreCreationModalProps> = ({
  currentLang,
  isOpen,
  onClose,
  onSuccessLaunch
}) => {
  const [step, setStep] = useState<number>(1);
  const [storeName, setStoreName] = useState<string>('');
  const [subdomain, setSubdomain] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>('EG');
  const [storeCurrency, setStoreCurrency] = useState<string>('EGP');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');

  if (!isOpen) return null;

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Final step: create the store AND the merchant account atomically.
      // The subscription plan is assigned by the server (billing is handled
      // outside the app). Failures are shown, never silently bypassed.
      setIsSaving(true);
      setSaveError('');
      try {
        await api.register({
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim(),
          storeName: storeName.trim(),
          subdomain: subdomain.trim().toLowerCase(),
          countryCode,
          storeCurrency,
        });
        setIsSuccess(true);
      } catch (err: any) {
        setSaveError(
          err?.message ||
            (currentLang === 'ar' ? 'تعذر إنشاء المتجر. حاول مرة أخرى.' : 'Could not create the store. Try again.')
        );
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleFinish = () => {
    setIsSuccess(false);
    setStep(1);
    onClose();
    onSuccessLaunch();
  };

  const selectedCountry = COUNTRIES_DATA.find((c) => c.code === countryCode) || COUNTRIES_DATA[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 font-bold flex items-center justify-center text-sm">
              سـ
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900">
                {currentLang === 'ar' ? 'إطلاق متجرك الإلكتروني الجديد' : 'Launch Your New Online Store'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {currentLang === 'ar' ? 'خطوات بسيطة بدون عمولة على الطلبات نهائياً' : 'Simple steps with 0% platform commission on orders'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress */}
        {!isSuccess && (
          <div className="px-6 pt-4 pb-2 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 bg-white">
            <span className={step >= 1 ? 'font-bold text-emerald-700' : ''}>
              1. {currentLang === 'ar' ? 'هوية المتجر' : 'Store Identity'}
            </span>
            <span>→</span>
            <span className={step >= 2 ? 'font-bold text-emerald-700' : ''}>
              2. {currentLang === 'ar' ? 'السوق والعملة' : 'Market & Currency'}
            </span>
            <span>→</span>
            <span className={step >= 3 ? 'font-bold text-emerald-700' : ''}>
              3. {currentLang === 'ar' ? 'خطة الاشتراك' : 'Subscription Plan'}
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold font-heading text-slate-900">
                {currentLang === 'ar' ? 'تم تجهيز متجرك الإلكتروني بنجاح!' : 'Your Online Store is Successfully Prepared!'}
              </h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                {currentLang === 'ar'
                  ? `أهلاً بك في منصة سند. متجرك جاهز للعمل على النطاق ${subdomain || 'mystore'}.sanad.app مع تفعيل نسبة 0% عمولة على كافة مبيعاتك.`
                  : `Welcome to Sanad Commerce. Your store is active on ${subdomain || 'mystore'}.sanad.app with 0% platform commission.`}
              </p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-start space-y-1.5 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-500">{currentLang === 'ar' ? 'اسم المتجر:' : 'Store Name:'}</span>
                  <span className="font-bold text-slate-900">{storeName || (currentLang === 'ar' ? 'متجري التجاري' : 'My Store')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{currentLang === 'ar' ? 'سوق الانطلاق:' : 'Market:'}</span>
                  <span className="font-bold text-slate-900">{selectedCountry.flag} {currentLang === 'ar' ? selectedCountry.name_ar : selectedCountry.name_en}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{currentLang === 'ar' ? 'عملة المتجر:' : 'Currency:'}</span>
                  <span className="font-bold text-slate-900">{storeCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{currentLang === 'ar' ? 'الخطة:' : 'Plan:'}</span>
                  <span className="font-bold text-emerald-700">
                    {currentLang === 'ar' ? 'سنوية (افتراضية، تُدار خارج المنصة)' : 'Annual (default, managed outside the app)'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleFinish}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {currentLang === 'ar' ? 'الدخول إلى لوحة التحكم وبدء إضافة المنتجات' : 'Open Admin Cockpit & Add Products'}
              </button>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {currentLang === 'ar' ? 'اسم متجرك التجاري أو علامتك:' : 'Store or Brand Name:'}
                    </label>
                    <input
                      type="text"
                      placeholder={currentLang === 'ar' ? 'مثال: متجر لؤلؤة الشرق للأزياء' : 'e.g. Silk & Linen Boutique'}
                      value={storeName}
                      onChange={(e) => {
                        setStoreName(e.target.value);
                        if (!subdomain) {
                          setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                        }
                      }}
                      className="w-full py-2.5 px-3 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {currentLang === 'ar' ? 'رابط المتجر التجريبي المجاني (Subdomain):' : 'Free Subdomain URL:'}
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        placeholder="mystore"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className={`w-full py-2.5 px-3 border border-slate-300 rounded-s-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${currentLang === 'ar' ? 'rounded-s-lg' : 'rounded-l-lg'}`}
                      />
                      <span className={`py-2.5 px-3 bg-slate-100 border border-slate-300 text-slate-500 text-xs font-mono border-s-0 ${currentLang === 'ar' ? 'rounded-e-lg' : 'rounded-r-lg'}`}>
                        .sanad.app
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {currentLang === 'ar' ? 'يمكنك ربط نطاقك المستقل (.com / .eg / .sa) لاحقاً مجاناً.' : 'You can connect a custom domain (.com / .eg / .sa) later for free.'}
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {currentLang === 'ar' ? 'رقم هاتف / واتساب التاجر:' : 'Merchant Mobile / WhatsApp:'}
                    </label>
                    <input
                      type="tel"
                      placeholder={currentLang === 'ar' ? '010XXXXXXXX أو 05XXXXXXXX' : '+20 100 000 0000'}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full py-2.5 px-3 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {currentLang === 'ar' ? 'البريد الإلكتروني (حساب الدخول):' : 'Email (login account):'}
                      </label>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="name@store.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full py-2.5 px-3 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {currentLang === 'ar' ? 'كلمة المرور (8 أحرف على الأقل):' : 'Password (min 8 chars):'}
                      </label>
                      <input
                        type="password"
                        required
                        autoComplete="new-password"
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full py-2.5 px-3 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {currentLang === 'ar' ? 'سوق الإطلاق الرئيسي لمتجرك:' : 'Primary Launch Market:'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {COUNTRIES_DATA.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setCountryCode(c.code);
                            setStoreCurrency(c.currency_code);
                          }}
                          className={`p-2.5 rounded-lg border text-start flex items-center gap-2 transition-all cursor-pointer ${
                            countryCode === c.code
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <span className="text-base">{c.flag}</span>
                          <div className="truncate">
                            <div>{currentLang === 'ar' ? c.name_ar : c.name_en}</div>
                            <div className="text-[10px] text-slate-500">{c.currency_code}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {currentLang === 'ar' ? 'العملة الأساسية لمتجرك (Merchant Store Currency):' : 'Primary Store Currency:'}
                    </label>
                    <select
                      value={storeCurrency}
                      onChange={(e) => setStoreCurrency(e.target.value)}
                      className="w-full py-2.5 px-3 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="EGP">EGP - الجنيه المصري 🇪🇬</option>
                      <option value="SAR">SAR - الريال السعودي 🇸🇦</option>
                      <option value="AED">AED - الدرهم الإماراتي 🇦🇪</option>
                      <option value="KWD">KWD - الدينار الكويتي 🇰🇼</option>
                      <option value="QAR">QAR - الريال القطري 🇶🇦</option>
                      <option value="BHD">BHD - الدينار البحريني 🇧🇭</option>
                      <option value="OMR">OMR - الريال العُماني 🇴🇲</option>
                      <option value="USD">USD - الدولار الأمريكي 🌐</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {currentLang === 'ar'
                        ? 'تتحكم هذه العملة في تسعير منتجاتك، طلباتك، وسلة الشراء. ويمكنك تفعيل العملات الإضافية بأي وقت.'
                        : 'Controls your product prices, checkout, and invoices. You can enable more currencies anytime.'}
                    </p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-950 block">0% عمولة للمنصة على الطلبات</span>
                      <span className="text-[11px] text-emerald-800">
                        {currentLang === 'ar'
                          ? 'نحن نتقاضى اشتراكك الثابت فقط. لا نقتطع أي نسبة من مبيعاتك مهما بلغت أرباحك.'
                          : 'Zero commission cut on orders. Only your fixed subscription below.'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Server-assigned default plan: subscription billing is handled outside the app. */}
                    <div className="p-4 rounded-xl border border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500 relative">
                      <span className="absolute -top-2.5 end-3 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        {PRICING_MODEL.annual.savings_badge_ar}
                      </span>
                      <div className="font-bold text-slate-900 text-sm">
                        {currentLang === 'ar' ? 'الخطة السنوية (الافتراضية)' : 'Annual Plan (default)'}
                      </div>
                      <div className="text-xl font-bold font-heading text-slate-900 mt-1">
                        1,000 <span className="text-xs font-normal text-slate-500">{currentLang === 'ar' ? 'ج.م / سنة' : 'EGP / yr'}</span>
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                        {currentLang === 'ar' ? 'تُدار الفوترة خارج المنصة' : 'Billing is handled outside the app'}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-900 text-sm">
                        {currentLang === 'ar' ? 'الخطة الشهرية' : 'Monthly Plan'}
                      </div>
                      <div className="text-xl font-bold font-heading text-slate-900 mt-1">
                        100 <span className="text-xs font-normal text-slate-500">{currentLang === 'ar' ? 'ج.م / شهر' : 'EGP / mo'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {currentLang === 'ar' ? 'متاحة عبر إدارة الاشتراكات خارج المنصة' : 'Available via out-of-app subscription management'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer controls */}
        {!isSuccess && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
            {saveError && (
              <div className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {saveError}
              </div>
            )}
            <div className="flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {currentLang === 'ar' ? 'السابق' : 'Back'}
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={handleNext}
              disabled={isSaving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>{isSaving ? (currentLang === 'ar' ? 'جاري حفظ المتجر...' : 'Saving store...') : step === 3 ? (currentLang === 'ar' ? 'تأكيد وإطلاق المتجر' : 'Confirm & Launch Store') : (currentLang === 'ar' ? 'المتابعة' : 'Continue')}</span>
              {currentLang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
