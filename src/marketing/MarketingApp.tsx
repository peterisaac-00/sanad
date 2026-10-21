import React, { useState, useEffect } from 'react';
import { Language } from '../data/translations';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { GrowthCenterPreview } from '../components/GrowthCenterPreview';
import { navigate } from '../lib/router';
import { useSession } from '../lib/session';

// Views
import { HomeView } from '../views/HomeView';
import { FeaturesView } from '../views/FeaturesView';
import { PricingView } from '../views/PricingView';
import { SolutionsView } from '../views/SolutionsView';
import { TemplatesView } from '../views/TemplatesView';
import { CountriesView } from '../views/CountriesView';
import { IndustriesView } from '../views/IndustriesView';
import { KnowledgeView } from '../views/KnowledgeView';
import { HelpCenterView } from '../views/HelpCenterView';
import { MigrationCenterView } from '../views/MigrationCenterView';
import { AboutView } from '../views/AboutView';
import { FAQView } from '../views/FAQView';

/**
 * Public marketing site. Every commercial CTA now leads to a real route:
 * authentication, registration/onboarding, or the merchant dashboard when a
 * session already exists. The interactive growth preview remains a demo and
 * is labelled as such.
 */
export function MarketingApp() {
  const { session, logout } = useSession();
  const [currentLang, setCurrentLang] = useState<Language>('ar');
  const [activeView, setActiveView] = useState<string>('home');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);

  const goToStart = () => {
    navigate(session ? '/dashboard' : '/auth/register');
  };

  const goToLogin = () => {
    navigate(session ? '/dashboard' : '/auth/login');
  };

  const handleLogout = async () => {
    await logout();
    setIsDemoModalOpen(false);
    navigate('/');
  };

  // Synchronize html dir and lang attributes
  useEffect(() => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

    if (currentLang === 'ar') {
      document.title = 'سند للتجارة | منصة تشغيل التجارة الإلكترونية العربية - 0% عمولة';
    } else {
      document.title = 'Sanad Commerce | Arabic Ecommerce Operating Platform - 0% Commission';
    }
  }, [currentLang]);

  // Handle Hash / Route sync on load
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['features', 'pricing', 'solutions', 'templates', 'countries', 'industries', 'knowledge', 'help', 'migration', 'about', 'faq'].includes(hash)) {
        setActiveView(hash);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (viewId: string) => {
    setActiveView(viewId);
    window.location.hash = viewId === 'home' ? '' : viewId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'features':
        return (
          <FeaturesView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
            onOpenDemoModal={() => setIsDemoModalOpen(true)}
          />
        );
      case 'pricing':
        return (
          <PricingView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
          />
        );
      case 'solutions':
        return (
          <SolutionsView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
            onOpenDemoModal={() => setIsDemoModalOpen(true)}
          />
        );
      case 'templates':
        return (
          <TemplatesView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
          />
        );
      case 'countries':
        return (
          <CountriesView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
          />
        );
      case 'industries':
        return (
          <IndustriesView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
          />
        );
      case 'knowledge':
        return (
          <KnowledgeView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
          />
        );
      case 'help':
        return (
          <HelpCenterView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
          />
        );
      case 'migration':
        return (
          <MigrationCenterView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
          />
        );
      case 'about':
        return (
          <AboutView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
          />
        );
      case 'faq':
        return (
          <FAQView
            currentLang={currentLang}
            onOpenStoreModal={goToStart}
          />
        );
      case 'home':
      default:
        return (
          <HomeView
            currentLang={currentLang}
            onNavigate={handleNavigate}
            onOpenStoreModal={goToStart}
          />
        );
    }
  };

  return (
    <div className={`min-h-screen bg-surface flex flex-col ${currentLang === 'ar' ? 'font-arabic' : 'font-sans'}`}>
      <Navbar
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        activeView={activeView}
        onNavigate={handleNavigate}
        onOpenStoreModal={goToStart}
        onOpenLoginModal={goToLogin}
        onOpenDashboard={() => navigate('/dashboard')}
        session={session}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {renderActiveView()}
      </main>

      <Footer
        currentLang={currentLang}
        onNavigate={handleNavigate}
        onOpenStoreModal={goToStart}
      />

      <GrowthCenterPreview
        currentLang={currentLang}
        isOpen={isDemoModalOpen}
        storeSubdomain={session?.store?.subdomain ?? null}
        onClose={() => setIsDemoModalOpen(false)}
        onOpenStoreModal={() => {
          setIsDemoModalOpen(false);
          goToStart();
        }}
        onOpenLoginModal={() => {
          setIsDemoModalOpen(false);
          goToLogin();
        }}
      />
    </div>
  );
}
