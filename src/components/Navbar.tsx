import React, { useState } from 'react';
import { Language, UI_TRANSLATIONS } from '../data/translations';
import { BrandLogo } from './Brand';
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
  LogOut,
  CheckCircle2
} from 'lucide-react';

interface NavbarProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  activeView: string;
  onNavigate: (viewId: string) => void;
  onOpenStoreModal: () => void;
  onOpenLoginModal: () => void;
  onOpenDashboard: () => void;
  onOpenDemoModal: () => void;
  session: { merchant: any; store: any } | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLang,
  onLanguageChange,
  activeView,
  onNavigate,
  onOpenStoreModal,
  onOpenLoginModal,
  onOpenDashboard,
  onOpenDemoModal,
  session,
  onLogout
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
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur-md transition-all">
      {/* Top micro banner communicating the core commercial value */}
      <div className="bg-secondary px-4 py-1.5 text-xs text-on-secondary">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-center md:text-start">
          <div className="mx-auto flex items-center gap-2 md:mx-0">
            <span className="inline-flex items-center gap-1 font-semibold text-brand-on-dark">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t.badge_zero_commission}
            </span>
            <span className="hidden text-white/40 sm:inline">·</span>
            <span className="hidden text-white/70 sm:inline">
              {currentLang === 'ar' ? '100 ج.م شهرياً أو 1,000 ج.م سنوياً (وفر 200 ج.م)' : '100 EGP/mo or 1,000 EGP/yr (Save 200 EGP)'}
            </span>
            <span className="hidden text-white/40 md:inline">·</span>
            <span className="hidden text-white/70 md:inline">
              {currentLang === 'ar' ? 'انطلاقة مصر 🇪🇬 وبنية تحتية جاهزة للخليج 🇸🇦 🇦🇪' : 'Egypt Launch 🇪🇬 & Gulf-Ready 🇸🇦 🇦🇪'}
            </span>
          </div>

          <div className="mx-auto flex items-center gap-3 md:mx-0">
            <button
              onClick={onOpenDemoModal}
              className="cursor-pointer text-xs font-medium text-brand-on-dark underline underline-offset-2 transition-colors hover:text-white"
            >
              {t.cta_interactive_demo}
            </button>
            <span className="text-white/30">|</span>
            {/* Language Switcher */}
            <button
              onClick={() => onLanguageChange(currentLang === 'ar' ? 'en' : 'ar')}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-white/75 transition-colors hover:text-white"
              title="تغيير لغة الموقع / Switch Language"
            >
              <Globe className="h-3.5 w-3.5 text-brand-on-dark" />
              <span>{t.switch_language}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main navigation bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNavClick('home')}
              className="flex cursor-pointer items-center gap-2.5 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
            >
              <BrandLogo size="md" title={t.brand_name} tagline={t.brand_tagline} />
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-subtle">
            <button
              onClick={() => handleNavClick('features')}
              className={`transition-colors hover:text-ink cursor-pointer py-1 ${activeView === 'features' ? 'text-brand font-semibold' : ''}`}
            >
              {t.nav_features}
            </button>

            <button
              onClick={() => handleNavClick('pricing')}
              className={`transition-colors hover:text-ink cursor-pointer py-1 flex items-center gap-1 ${activeView === 'pricing' ? 'text-brand font-semibold' : ''}`}
            >
              <span>{t.nav_pricing}</span>
              <span className="text-[10px] text-brand font-bold bg-brand-soft px-1.5 py-0.2 rounded border border-brand-line">
                0%
              </span>
            </button>

            {/* Dropdown for Solutions & Markets */}
            <div className="relative">
              <button
                onClick={() => setSolutionsDropdownOpen(!solutionsDropdownOpen)}
                className={`flex items-center gap-1 transition-colors hover:text-ink cursor-pointer py-1 ${['solutions', 'countries', 'industries', 'templates'].includes(activeView) ? 'text-brand font-semibold' : ''}`}
              >
                <span>{t.nav_solutions}</span>
                <ChevronDown className="w-3.5 h-3.5 text-subtle" />
              </button>

              {solutionsDropdownOpen && (
                <div
                  onMouseLeave={() => setSolutionsDropdownOpen(false)}
                  className={`absolute top-full mt-2 w-64 bg-card rounded-brand shadow-xl border border-line py-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${currentLang === 'ar' ? 'right-0' : 'left-0'}`}
                >
                  <button
                    onClick={() => handleNavClick('solutions')}
                    className="w-full text-start px-4 py-2 text-xs text-ink-soft hover:bg-surface flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-brand" />
                    <div>
                      <div className="font-semibold text-ink">{currentLang === 'ar' ? 'حلول التجارة والنمو' : 'Commerce Solutions'}</div>
                      <div className="text-[11px] text-subtle">{currentLang === 'ar' ? 'للتجار المبتدئين والعلامات الصاعدة' : 'For social sellers & brands'}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleNavClick('countries')}
                    className="w-full text-start px-4 py-2 text-xs text-ink-soft hover:bg-surface flex items-center gap-2"
                  >
                    <Truck className="w-4 h-4 text-brand" />
                    <div>
                      <div className="font-semibold text-ink">{t.nav_countries}</div>
                      <div className="text-[11px] text-subtle">{currentLang === 'ar' ? 'مصر، السعودية، الإمارات والخليج' : 'Egypt, KSA, UAE, GCC'}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleNavClick('industries')}
                    className="w-full text-start px-4 py-2 text-xs text-ink-soft hover:bg-surface flex items-center gap-2"
                  >
                    <Store className="w-4 h-4 text-brand" />
                    <div>
                      <div className="font-semibold text-ink">{t.nav_industries}</div>
                      <div className="text-[11px] text-subtle">{currentLang === 'ar' ? 'الأزياء، التجميل، الإلكترونيات' : 'Fashion, Beauty, Tech'}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleNavClick('templates')}
                    className="w-full text-start px-4 py-2 text-xs text-ink-soft hover:bg-surface flex items-center gap-2 border-t border-line mt-1 pt-1.5"
                  >
                    <div className="w-4 h-4 text-brand font-bold text-center text-xs">◈</div>
                    <div>
                      <div className="font-semibold text-ink">{t.nav_templates}</div>
                      <div className="text-[11px] text-subtle">{currentLang === 'ar' ? 'معاينة تصاميم المتاجر العربية' : 'Arabic Storefronts Showcase'}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => handleNavClick('knowledge')}
              className={`transition-colors hover:text-ink cursor-pointer py-1 ${activeView === 'knowledge' ? 'text-brand font-semibold' : ''}`}
            >
              {t.nav_knowledge}
            </button>

            <button
              onClick={() => handleNavClick('migration')}
              className={`transition-colors hover:text-ink cursor-pointer py-1 ${activeView === 'migration' ? 'text-brand font-semibold' : ''}`}
            >
              {t.nav_migration}
            </button>

            <button
              onClick={() => handleNavClick('faq')}
              className={`transition-colors hover:text-ink cursor-pointer py-1 ${activeView === 'faq' ? 'text-brand font-semibold' : ''}`}
            >
              {t.nav_faq}
            </button>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            {session ? (
              <>
                <span className="text-xs text-subtle max-w-44 truncate" title={session.merchant?.email}>
                  {session.merchant?.email}
                </span>
                <button
                  onClick={onOpenDashboard}
                  className="bg-secondary text-on-secondary hover:brightness-110 text-xs font-semibold px-4 py-2.5 rounded-brand-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-brand-on-dark" />
                  <span>{currentLang === 'ar' ? 'لوحة التحكم' : 'Console'}</span>
                </button>
                <button
                  onClick={onLogout}
                  className="text-xs font-semibold text-ink-soft hover:text-ink px-3 py-2 rounded-brand-sm hover:bg-surface transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5 text-subtle" />
                  <span>{currentLang === 'ar' ? 'خروج' : 'Logout'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onOpenLoginModal}
                  className="text-xs font-semibold text-ink-soft hover:text-ink px-3 py-2 rounded-brand-sm hover:bg-surface transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-subtle" />
                  <span>{t.nav_login}</span>
                </button>

                <button
                  onClick={onOpenStoreModal}
                  className="bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-active text-xs font-semibold px-4 py-2.5 rounded-brand-sm shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>{t.cta_start_store}</span>
                </button>
              </>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={onOpenStoreModal}
              className="bg-brand text-on-brand text-xs font-semibold px-3 py-1.5 rounded-brand-sm"
            >
              {session ? (currentLang === 'ar' ? 'لوحة التحكم' : 'Dashboard') : t.nav_signup}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-subtle hover:text-ink rounded-brand-sm hover:bg-surface transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-line bg-card px-4 pt-3 pb-6 space-y-3">
          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-line text-xs">
            <button
              onClick={() => handleNavClick('features')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-ink font-medium"
            >
              {t.nav_features}
            </button>
            <button
              onClick={() => handleNavClick('pricing')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-brand font-semibold"
            >
              {t.nav_pricing}
            </button>
            <button
              onClick={() => handleNavClick('solutions')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-ink font-medium"
            >
              {t.nav_solutions}
            </button>
            <button
              onClick={() => handleNavClick('countries')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-ink font-medium"
            >
              {t.nav_countries}
            </button>
            <button
              onClick={() => handleNavClick('industries')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-ink font-medium"
            >
              {t.nav_industries}
            </button>
            <button
              onClick={() => handleNavClick('templates')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-ink font-medium"
            >
              {t.nav_templates}
            </button>
            <button
              onClick={() => handleNavClick('knowledge')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-ink font-medium"
            >
              {t.nav_knowledge}
            </button>
            <button
              onClick={() => handleNavClick('migration')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-ink font-medium"
            >
              {t.nav_migration}
            </button>
            <button
              onClick={() => handleNavClick('faq')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-ink font-medium"
            >
              {t.nav_faq}
            </button>
            <button
              onClick={() => handleNavClick('about')}
              className="p-2 rounded-brand-sm text-start hover:bg-surface text-ink font-medium"
            >
              {t.nav_about}
            </button>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={onOpenDemoModal}
              className="w-full py-2.5 px-3 bg-secondary text-on-secondary rounded-brand-sm text-xs font-semibold text-center flex items-center justify-center gap-1.5"
            >
              <TrendingUp className="w-4 h-4 text-brand-on-dark" />
              <span>{t.cta_interactive_demo}</span>
            </button>

            {session ? (
              <>
                <button
                  onClick={() => {
                    onOpenDashboard();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-3 bg-secondary text-on-secondary rounded-brand-sm text-xs font-semibold text-center flex items-center justify-center gap-1.5"
                >
                  <TrendingUp className="w-4 h-4 text-brand-on-dark" />
                  <span>{currentLang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</span>
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2 px-3 border border-line text-ink-soft rounded-brand-sm text-xs font-medium text-center"
                >
                  {currentLang === 'ar' ? `خروج (${session.merchant?.email})` : `Logout (${session.merchant?.email})`}
                </button>
              </>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="w-full py-2 px-3 border border-line text-ink-soft rounded-brand-sm text-xs font-medium text-center"
              >
                {t.nav_login}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
