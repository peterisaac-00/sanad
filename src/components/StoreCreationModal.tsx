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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-secondary/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-card rounded-brand-lg shadow-2xl border border-line w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-brand-sm bg-secondary text-brand-on-dark font-bold flex items-center justify-center text-sm">
              سـ
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-ink">
                {currentLang === 'ar' ? 'إطلاق متجرك الإلكتروني الجديد' : 'Launch Your New Online Store'}
              </h3>
              <p className="text-[11px] text-subtle">
                {currentLang === 'ar' ? 'خطوات بسيطة بدون عمولة على الطلبات نهائياً' : 'Simple steps with 0% platform commission on orders'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-subtle hover:text-ink-soft rounded-brand-sm hover:bg-line/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress */}
        {!isSuccess && (
          <div className="px-6 pt-4 pb-2 flex items-center justify-between text-xs text-subtle border-b border-line bg-card">
            <span className={step >= 1 ? 'font-bold text-brand' : ''}>
              1. {currentLang === 'ar' ? 'هوية المتجر' : 'Store Identity'}
            </span>
            <span>→</span>
            <span className={step >= 2 ? 'font-bold text-brand' : ''}>
              2. {currentLang === 'ar' ? 'السوق والعملة' : 'Market & Currency'}
            </span>
            <span>→</span>
            <span className={step >= 3 ? 'font-bold text-brand' : ''}>
              3. {currentLang === 'ar' ? 'خطة الاشتراك' : 'Subscription Plan'}
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-brand-soft text-brand rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold font-heading text-ink">
                {currentLang === 'ar' ? 'تم تجهيز متجرك الإلكتروني بنجاح!' : 'Your Online Store is Successfully Prepared!'}
              </h4>
              <p className="text-xs text-ink-soft max-w-sm mx-auto leading-relaxed">
                {currentLang === 'ar'
                  ? `أهلاً بك في منصة سند. متجرك جاهز للعمل على النطاق ${subdomain || 'mystore'}.sanad.app مع تفعيل نسبة 0% عمولة على كافة مبيعاتك.`
                  : `Welcome to Sanad Commerce. Your store is active on ${subdomain || 'mystore'}.sanad.app with 0% platform commission.`}
              </p>
              <div className="bg-surface p-4 rounded-brand border border-line text-xs text-start space-y-1.5 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-subtle">{currentLang === 'ar' ? 'اسم المتجر:' : 'Store Name:'}</span>
                  <span className="font-bold text-ink">{storeName || (currentLang === 'ar' ? 'متجري التجاري' : 'My Store')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtle">{currentLang === 'ar' ? 'سوق الانطلاق:' : 'Market:'}</span>
                  <span className="font-bold text-ink">{selectedCountry.flag} {currentLang === 'ar' ? selectedCountry.name_ar : selectedCountry.name_en}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtle">{currentLang === 'ar' ? 'عملة المتجر:' : 'Currency:'}</span>
                  <span className="font-bold text-ink">{storeCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtle">{currentLang === 'ar' ? 'الخطة:' : 'Plan:'}</span>
                  <span className="font-bold text-brand">
                    {currentLang === 'ar' ? 'سنوية (افتراضية، تُدار خارج المنصة)' : 'Annual (default, managed outside the app)'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleFinish}
                className="w-full cursor-pointer rounded-brand-sm bg-brand py-3 text-xs font-bold text-on-brand shadow-xs transition-colors hover:bg-brand-hover"
              >
                {currentLang === 'ar' ? 'الدخول إلى لوحة التحكم وبدء إضافة المنتجات' : 'Open Admin Cockpit & Add Products'}
              </button>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-ink-soft mb-1">
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
                      className="input-control text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-ink-soft mb-1">
                      {currentLang === 'ar' ? 'رابط المتجر التجريبي المجاني (Subdomain):' : 'Free Subdomain URL:'}
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        placeholder="mystore"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className={`w-full py-2.5 px-3 border border-line rounded-s-lg text-ink text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 ${currentLang === 'ar' ? 'rounded-s-lg' : 'rounded-l-lg'}`}
                      />
                      <span className={`py-2.5 px-3 bg-surface border border-line text-subtle text-xs font-mono border-s-0 ${currentLang === 'ar' ? 'rounded-e-lg' : 'rounded-r-lg'}`}>
                        .sanad.app
                      </span>
                    </div>
                    <p className="text-[11px] text-subtle mt-1">
                      {currentLang === 'ar' ? 'يمكنك ربط نطاقك المستقل (.com / .eg / .sa) قريباً؛ ربط النطاقات قيد التطوير.' : 'Custom domain connection (.com / .eg / .sa) is planned; it is not available yet.'}
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-ink-soft mb-1">
                      {currentLang === 'ar' ? 'رقم هاتف / واتساب التاجر:' : 'Merchant Mobile / WhatsApp:'}
                    </label>
                    <input
                      type="tel"
                      placeholder={currentLang === 'ar' ? '010XXXXXXXX أو 05XXXXXXXX' : '+20 100 000 0000'}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-control text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-ink-soft mb-1">
                        {currentLang === 'ar' ? 'البريد الإلكتروني (حساب الدخول):' : 'Email (login account):'}
                      </label>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="name@store.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-control text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-ink-soft mb-1">
                        {currentLang === 'ar' ? 'كلمة المرور (8 أحرف على الأقل):' : 'Password (min 8 chars):'}
                      </label>
                      <input
                        type="password"
                        required
                        autoComplete="new-password"
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-control text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-ink-soft mb-1">
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
                          className={`p-2.5 rounded-brand-sm border text-start flex items-center gap-2 transition-all cursor-pointer ${
                            countryCode === c.code
                              ? 'border-brand bg-brand-soft text-brand-active font-bold ring-1 ring-brand/30'
                              : 'border-line text-ink-soft hover:border-brand/40'
                          }`}
                        >
                          <span className="text-base">{c.flag}</span>
                          <div className="truncate">
                            <div>{currentLang === 'ar' ? c.name_ar : c.name_en}</div>
                            <div className="text-[10px] text-subtle">{c.currency_code}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-ink-soft mb-1">
                      {currentLang === 'ar' ? 'العملة الأساسية لمتجرك (Merchant Store Currency):' : 'Primary Store Currency:'}
                    </label>
                    <select
                      value={storeCurrency}
                      onChange={(e) => setStoreCurrency(e.target.value)}
                      className="input-control text-xs"
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
                    <p className="text-[10px] text-subtle mt-1">
                      {currentLang === 'ar'
                        ? 'تتحكم هذه العملة في تسعير منتجاتك، طلباتك، وسلة الشراء. ويمكنك تفعيل العملات الإضافية بأي وقت.'
                        : 'Controls your product prices, checkout, and invoices. You can enable more currencies anytime.'}
                    </p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-brand-soft rounded-brand border border-brand-line flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand flex-shrink-0" />
                    <div>
                      <span className="font-bold text-brand-active block">0% عمولة للمنصة على الطلبات</span>
                      <span className="text-[11px] text-brand">
                        {currentLang === 'ar'
                          ? 'نحن نتقاضى اشتراكك الثابت فقط. لا نقتطع أي نسبة من مبيعاتك مهما بلغت أرباحك.'
                          : 'Zero commission cut on orders. Only your fixed subscription below.'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Server-assigned default plan: subscription billing is handled outside the app. */}
                    <div className="p-4 rounded-brand border border-brand bg-brand-soft/50 ring-1 ring-brand/30 relative">
                      <span className="absolute -top-2.5 end-3 rounded bg-brand px-2 py-0.5 text-[10px] font-bold text-on-brand">
                        {PRICING_MODEL.annual.savings_badge_ar}
                      </span>
                      <div className="font-bold text-ink text-sm">
                        {currentLang === 'ar' ? 'الخطة السنوية (الافتراضية)' : 'Annual Plan (default)'}
                      </div>
                      <div className="text-xl font-bold font-heading text-ink mt-1">
                        1,000 <span className="text-xs font-normal text-subtle">{currentLang === 'ar' ? 'ج.م / سنة' : 'EGP / yr'}</span>
                      </div>
                      <div className="text-[11px] text-brand font-semibold mt-1">
                        {currentLang === 'ar' ? 'تُدار الفوترة خارج المنصة' : 'Billing is handled outside the app'}
                      </div>
                    </div>

                    <div className="p-4 rounded-brand border border-line">
                      <div className="font-bold text-ink text-sm">
                        {currentLang === 'ar' ? 'الخطة الشهرية' : 'Monthly Plan'}
                      </div>
                      <div className="text-xl font-bold font-heading text-ink mt-1">
                        100 <span className="text-xs font-normal text-subtle">{currentLang === 'ar' ? 'ج.م / شهر' : 'EGP / mo'}</span>
                      </div>
                      <div className="text-[11px] text-subtle mt-1">
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
          <div className="p-4 bg-surface border-t border-line space-y-2">
            {saveError && (
              <div className="text-[11px] font-semibold text-danger bg-danger-soft border border-danger-line rounded-brand-sm px-3 py-2">
                {saveError}
              </div>
            )}
            <div className="flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-3 py-2 border border-line rounded-brand-sm text-xs font-medium text-ink-soft hover:bg-surface transition-colors"
              >
                {currentLang === 'ar' ? 'السابق' : 'Back'}
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={handleNext}
              disabled={isSaving}
              className="flex cursor-pointer items-center gap-1.5 rounded-brand-sm bg-brand px-5 py-2.5 text-xs font-bold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
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
