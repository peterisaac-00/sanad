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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 font-bold flex items-center justify-center text-sm">
              سـ
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900">
                {currentLang === 'ar' ? 'بوابة دخول التاجر' : 'Merchant Portal Login'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {currentLang === 'ar' ? 'الوصول إلى لوحة تحكم متجرك' : 'Access your merchant console'}
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
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
                className="w-full py-2.5 px-3 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <Mail className={`w-4 h-4 text-slate-400 absolute top-3 ${currentLang === 'ar' ? 'left-3' : 'right-3'}`} />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
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
                className="w-full py-2.5 px-3 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <Lock className={`w-4 h-4 text-slate-400 absolute top-3 ${currentLang === 'ar' ? 'left-3' : 'right-3'}`} />
            </div>
          </div>

          {error && (
            <div className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              {currentLang === 'ar'
                ? 'عزل آمن للبيانات (Multi-tenant): بيانات كل متجر مشفرة ومستقلة تماماً.'
                : 'Isolated multi-tenant architecture with encrypted merchant databases.'}
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <LogIn className="w-4 h-4 text-emerald-400" />
            <span>{isLoading ? (currentLang === 'ar' ? 'جاري تسجيل الدخول...' : 'Signing in...') : (currentLang === 'ar' ? 'تسجيل الدخول إلى لوحة التحكم' : 'Sign in to Merchant Cockpit')}</span>
          </button>

          <div className="text-center pt-2 border-t border-slate-100 text-slate-600">
            <span>{currentLang === 'ar' ? 'ليس لديك متجر بعد؟' : "Don't have a store yet?"} </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStoreModal();
              }}
              className="text-emerald-700 font-bold hover:underline cursor-pointer"
            >
              {currentLang === 'ar' ? 'أنشئ متجرك بعمولة 0%' : 'Create store with 0% cut'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
