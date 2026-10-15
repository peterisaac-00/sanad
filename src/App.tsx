import React, { useState, useEffect } from 'react';
import { Language, UI_TRANSLATIONS } from './data/translations';
import { api } from './lib/api';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { StoreCreationModal } from './components/StoreCreationModal';
import { LoginModal } from './components/LoginModal';
import { GrowthCenterPreview } from './components/GrowthCenterPreview';

// Views
import { HomeView } from './views/HomeView';
import { FeaturesView } from './views/FeaturesView';
import { PricingView } from './views/PricingView';
import { SolutionsView } from './views/SolutionsView';
import { TemplatesView } from './views/TemplatesView';
import { CountriesView } from './views/CountriesView';
import { IndustriesView } from './views/IndustriesView';
import { KnowledgeView } from './views/KnowledgeView';
import { HelpCenterView } from './views/HelpCenterView';
import { MigrationCenterView } from './views/MigrationCenterView';
import { AboutView } from './views/AboutView';
import { FAQView } from './views/FAQView';

export default function App() {
  const [currentLang, setCurrentLang] = useState<Language>('ar');
  const [activeView, setActiveView] = useState<string>('home');
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);
  const [session, setSession] = useState<{ merchant: any; store: any } | null>(null);

  const refreshSession = async () => {
    try {
      const me = await api.me();
      setSession(me);
    } catch {
      setSession(null);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore network errors on logout; session state is cleared regardless
    }
    setSession(null);
    setIsDemoModalOpen(false);
  };

  // Restore session from the httpOnly cookie on load.
  useEffect(() => {
    refreshSession();
  }, []);

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
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
            onOpenDemoModal={() => setIsDemoModalOpen(true)}
          />
        );
      case 'pricing':
        return (
          <PricingView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />
        );
      case 'solutions':
        return (
          <SolutionsView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
            onOpenDemoModal={() => setIsDemoModalOpen(true)}
          />
        );
      case 'templates':
        return (
          <TemplatesView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />
        );
      case 'countries':
        return (
          <CountriesView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />
        );
      case 'industries':
        return (
          <IndustriesView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />
        );
      case 'knowledge':
        return (
          <KnowledgeView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />
        );
      case 'help':
        return (
          <HelpCenterView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />
        );
      case 'migration':
        return (
          <MigrationCenterView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />
        );
      case 'about':
        return (
          <AboutView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />
        );
      case 'faq':
        return (
          <FAQView
            currentLang={currentLang}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />
        );
      case 'home':
      default:
        return (
          <HomeView
            currentLang={currentLang}
            onNavigate={handleNavigate}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
            onOpenDemoModal={() => setIsDemoModalOpen(true)}
          />
        );
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col ${currentLang === 'ar' ? 'font-arabic' : 'font-sans'}`}>
      {/* Navbar with bilingual & currency switcher */}
      <Navbar
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        activeView={activeView}
        onNavigate={handleNavigate}
        onOpenStoreModal={() => setIsStoreModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenDemoModal={() => setIsDemoModalOpen(true)}
        session={session}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {renderActiveView()}
      </main>

      {/* Semantic Footer with Breadcrumb Hierarchy and Comprehensive Links */}
      <Footer
        currentLang={currentLang}
        onNavigate={handleNavigate}
        onOpenStoreModal={() => setIsStoreModalOpen(true)}
      />

      {/* Interactive Modals */}
      <StoreCreationModal
        currentLang={currentLang}
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
        onSuccessLaunch={() => refreshSession().finally(() => setIsDemoModalOpen(true))}
      />

      <LoginModal
        currentLang={currentLang}
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onOpenStoreModal={() => {
          setIsLoginModalOpen(false);
          setIsStoreModalOpen(true);
        }}
        onLoginSuccess={() => {
          setIsLoginModalOpen(false);
          refreshSession().finally(() => setIsDemoModalOpen(true));
        }}
      />

      <GrowthCenterPreview
        currentLang={currentLang}
        isOpen={isDemoModalOpen}
        storeSubdomain={session?.store?.subdomain ?? null}
        onClose={() => setIsDemoModalOpen(false)}
        onOpenStoreModal={() => {
          setIsDemoModalOpen(false);
          setIsStoreModalOpen(true);
        }}
        onOpenLoginModal={() => {
          setIsDemoModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />
    </div>
  );
}
