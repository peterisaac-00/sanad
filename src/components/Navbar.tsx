import React, { useState } from 'react';
import { Language, UI_TRANSLATIONS } from '../data/translations';
import {
  Globe,
  Store,
  Menu,
  X,
  ChevronDown,
  Layers,
  CreditCard,
  Truck,
  BookOpen,
  HelpCircle,
  TrendingUp,
  LogIn,
  CheckCircle2
} from 'lucide-react';

interface NavbarProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  activeView: string;
  onNavigate: (viewId: string) => void;
  onOpenStoreModal: () => void;
  onOpenLoginModal: () => void;
  onOpenDemoModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLang,
  onLanguageChange,
  activeView,
  onNavigate,
  onOpenStoreModal,
  onOpenLoginModal,
  onOpenDemoModal
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [solutionsDropdownOpen, setSolutionsDropdownOpen] = useState(false);
  const t = UI_TRANSLATIONS[currentLang];

  const handleNavClick = (viewId: string) => {
    onNavigate(viewId);
    setMobileMenuOpen(false);
    setSolutionsDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
      {/* Top micro banner communicating the core commercial value */}
      <div className="bg-slate-900 text-slate-100 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-center md:text-start">
          <div className="flex items-center gap-2 mx-auto md:mx-0">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t.badge_zero_commission}
            </span>
            <span className="text-slate-400 hidden sm:inline">·</span>
            <span className="text-slate-300 hidden sm:inline">
              {currentLang === 'ar' ? '100 ج.م شهرياً أو 1,000 ج.م سنوياً (وفر 200 ج.م)' : '100 EGP/mo or 1,000 EGP/yr (Save 200 EGP)'}
            </span>
            <span className="text-slate-400 hidden md:inline">·</span>
            <span className="text-slate-300 hidden md:inline">
              {currentLang === 'ar' ? 'انطلاقة مصر 🇪🇬 وبنية تحتية جاهزة للخليج 🇸🇦 🇦🇪' : 'Egypt Launch 🇪🇬 & Gulf-Ready 🇸🇦 🇦🇪'}
            </span>
          </div>

          <div className="flex items-center gap-3 mx-auto md:mx-0">
            <button
              onClick={onOpenDemoModal}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 transition-colors cursor-pointer"
            >
              {t.cta_interactive_demo}
            </button>
            <span className="text-slate-500">|</span>
            {/* Language Switcher */}
            <button
              onClick={() => onLanguageChange(currentLang === 'ar' ? 'en' : 'ar')}
              className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer font-medium"
              title="تغيير لغة الموقع / Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.switch_language}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main navigation bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNavClick('home')}
              className="flex items-center gap-2.5 text-start cursor-pointer focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-emerald-400 font-bold text-xl shadow-xs border border-slate-800">
                <span>سـ</span>
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-lg font-bold text-slate-900 tracking-tight leading-none">
                  {t.brand_name}
                </span>
                <span className="text-[11px] font-normal text-slate-500 leading-tight mt-0.5">
                  {t.brand_tagline}
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => handleNavClick('features')}
              className={`transition-colors hover:text-slate-900 cursor-pointer py-1 ${activeView === 'features' ? 'text-emerald-600 font-semibold' : ''}`}
            >
              {t.nav_features}
            </button>

            <button
              onClick={() => handleNavClick('pricing')}
              className={`transition-colors hover:text-slate-900 cursor-pointer py-1 flex items-center gap-1 ${activeView === 'pricing' ? 'text-emerald-600 font-semibold' : ''}`}
            >
              <span>{t.nav_pricing}</span>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                0%
              </span>
            </button>

            {/* Dropdown for Solutions & Markets */}
            <div className="relative">
              <button
                onClick={() => setSolutionsDropdownOpen(!solutionsDropdownOpen)}
                className={`flex items-center gap-1 transition-colors hover:text-slate-900 cursor-pointer py-1 ${['solutions', 'countries', 'industries', 'templates'].includes(activeView) ? 'text-emerald-600 font-semibold' : ''}`}
              >
                <span>{t.nav_solutions}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {solutionsDropdownOpen && (
                <div
                  onMouseLeave={() => setSolutionsDropdownOpen(false)}
                  className={`absolute top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${currentLang === 'ar' ? 'right-0' : 'left-0'}`}
                >
                  <button
                    onClick={() => handleNavClick('solutions')}
                    className="w-full text-start px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-slate-900">{currentLang === 'ar' ? 'حلول التجارة والنمو' : 'Commerce Solutions'}</div>
                      <div className="text-[11px] text-slate-500">{currentLang === 'ar' ? 'للتجار المبتدئين والعلامات الصاعدة' : 'For social sellers & brands'}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleNavClick('countries')}
                    className="w-full text-start px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-slate-900">{t.nav_countries}</div>
                      <div className="text-[11px] text-slate-500">{currentLang === 'ar' ? 'مصر، السعودية، الإمارات والخليج' : 'Egypt, KSA, UAE, GCC'}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleNavClick('industries')}
                    className="w-full text-start px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Store className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-slate-900">{t.nav_industries}</div>
                      <div className="text-[11px] text-slate-500">{currentLang === 'ar' ? 'الأزياء، التجميل، الإلكترونيات' : 'Fashion, Beauty, Tech'}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleNavClick('templates')}
                    className="w-full text-start px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 mt-1 pt-1.5"
                  >
                    <div className="w-4 h-4 text-emerald-600 font-bold text-center text-xs">◈</div>
                    <div>
                      <div className="font-semibold text-slate-900">{t.nav_templates}</div>
                      <div className="text-[11px] text-slate-500">{currentLang === 'ar' ? 'معاينة تصاميم المتاجر العربية' : 'Arabic Storefronts Showcase'}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => handleNavClick('knowledge')}
              className={`transition-colors hover:text-slate-900 cursor-pointer py-1 ${activeView === 'knowledge' ? 'text-emerald-600 font-semibold' : ''}`}
            >
              {t.nav_knowledge}
            </button>

            <button
              onClick={() => handleNavClick('migration')}
              className={`transition-colors hover:text-slate-900 cursor-pointer py-1 ${activeView === 'migration' ? 'text-emerald-600 font-semibold' : ''}`}
            >
              {t.nav_migration}
            </button>

            <button
              onClick={() => handleNavClick('faq')}
              className={`transition-colors hover:text-slate-900 cursor-pointer py-1 ${activeView === 'faq' ? 'text-emerald-600 font-semibold' : ''}`}
            >
              {t.nav_faq}
            </button>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={onOpenLoginModal}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.nav_login}</span>
            </button>

            <button
              onClick={onOpenStoreModal}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <Store className="w-3.5 h-3.5" />
              <span>{t.cta_start_store}</span>
            </button>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={onOpenStoreModal}
              className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              {t.nav_signup}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-100 text-xs">
            <button
              onClick={() => handleNavClick('features')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-slate-800 font-medium"
            >
              {t.nav_features}
            </button>
            <button
              onClick={() => handleNavClick('pricing')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-emerald-700 font-semibold"
            >
              {t.nav_pricing}
            </button>
            <button
              onClick={() => handleNavClick('solutions')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-slate-800 font-medium"
            >
              {t.nav_solutions}
            </button>
            <button
              onClick={() => handleNavClick('countries')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-slate-800 font-medium"
            >
              {t.nav_countries}
            </button>
            <button
              onClick={() => handleNavClick('industries')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-slate-800 font-medium"
            >
              {t.nav_industries}
            </button>
            <button
              onClick={() => handleNavClick('templates')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-slate-800 font-medium"
            >
              {t.nav_templates}
            </button>
            <button
              onClick={() => handleNavClick('knowledge')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-slate-800 font-medium"
            >
              {t.nav_knowledge}
            </button>
            <button
              onClick={() => handleNavClick('migration')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-slate-800 font-medium"
            >
              {t.nav_migration}
            </button>
            <button
              onClick={() => handleNavClick('faq')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-slate-800 font-medium"
            >
              {t.nav_faq}
            </button>
            <button
              onClick={() => handleNavClick('about')}
              className="p-2 rounded-lg text-start hover:bg-slate-50 text-slate-800 font-medium"
            >
              {t.nav_about}
            </button>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={onOpenDemoModal}
              className="w-full py-2.5 px-3 bg-slate-900 text-white rounded-lg text-xs font-semibold text-center flex items-center justify-center gap-1.5"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>{t.cta_interactive_demo}</span>
            </button>

            <button
              onClick={onOpenLoginModal}
              className="w-full py-2 px-3 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium text-center"
            >
              {t.nav_login}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
