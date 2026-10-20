import React, { useState } from 'react';
import { Language } from '../data/translations';
import { X, LogIn, Lock, Mail, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

interface LoginModalProps {
  currentLang: Language;
  isOpen: boolean;
  onClose: () => void;
  onOpenStoreModal: () => void;
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  currentLang,
  isOpen,
  onClose,
  onOpenStoreModal,
  onLoginSuccess
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // Session is issued as an httpOnly cookie; nothing is stored in JS storage.
      await api.login(email.trim().toLowerCase(), password);
      onClose();
      onLoginSuccess();
    } catch (err: any) {
      setError(
        currentLang === 'ar'
          ? 'تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور، أو أنشئ حساب تاجر جديداً.'
          : (err?.message || 'Login failed. Check your email and password.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-secondary/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-card rounded-brand-lg shadow-2xl border border-line w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-brand-sm bg-secondary text-brand-on-dark font-bold flex items-center justify-center text-sm">
              سـ
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-ink">
                {currentLang === 'ar' ? 'بوابة دخول التاجر' : 'Merchant Portal Login'}
              </h3>
              <p className="text-[11px] text-subtle">
                {currentLang === 'ar' ? 'الوصول إلى لوحة تحكم متجرك' : 'Access your merchant console'}
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-ink-soft mb-1">
              {currentLang === 'ar' ? 'البريد الإلكتروني للتاجر:' : 'Merchant Email:'}
            </label>
            <div className="relative">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                placeholder={currentLang === 'ar' ? 'name@store.com' : 'name@store.com'}
                onChange={(e) => setEmail(e.target.value)}
                className="input-control pe-9 text-xs"
              />
              <Mail className={`w-4 h-4 text-subtle absolute top-3 ${currentLang === 'ar' ? 'left-3' : 'right-3'}`} />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-ink-soft mb-1">
              {currentLang === 'ar' ? 'كلمة المرور:' : 'Password:'}
            </label>
            <div className="relative">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                placeholder={currentLang === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password'}
                onChange={(e) => setPassword(e.target.value)}
                className="input-control pe-9 text-xs"
              />
              <Lock className={`w-4 h-4 text-subtle absolute top-3 ${currentLang === 'ar' ? 'left-3' : 'right-3'}`} />
            </div>
          </div>

          {error && (
            <div className="text-[11px] font-semibold text-danger bg-danger-soft border border-danger-line rounded-brand-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="p-2.5 bg-surface rounded-brand-sm border border-line text-[11px] text-subtle flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand flex-shrink-0" />
            <span>
              {currentLang === 'ar'
                ? 'عزل آمن للبيانات (Multi-tenant): بيانات كل متجر مشفرة ومستقلة تماماً.'
                : 'Isolated multi-tenant architecture with encrypted merchant databases.'}
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-brand-sm bg-secondary py-3 text-xs font-bold text-on-secondary shadow-xs transition hover:brightness-110 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4 text-brand-on-dark" />
            <span>{isLoading ? (currentLang === 'ar' ? 'جاري تسجيل الدخول...' : 'Signing in...') : (currentLang === 'ar' ? 'تسجيل الدخول إلى لوحة التحكم' : 'Sign in to Merchant Cockpit')}</span>
          </button>

          <div className="text-center pt-2 border-t border-line text-ink-soft">
            <span>{currentLang === 'ar' ? 'ليس لديك متجر بعد؟' : "Don't have a store yet?"} </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStoreModal();
              }}
              className="text-brand font-bold hover:underline cursor-pointer"
            >
              {currentLang === 'ar' ? 'أنشئ متجرك بعمولة 0%' : 'Create store with 0% cut'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
