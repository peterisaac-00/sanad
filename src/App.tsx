import React from 'react';
import { SessionProvider } from './lib/session';
import { ToastProvider } from './components/ui';
import { usePath } from './lib/router';
import { MarketingApp } from './marketing/MarketingApp';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { OnboardingPage } from './onboarding/OnboardingPage';
import { DashboardShell } from './dashboard/DashboardShell';
import { DashboardRouter } from './dashboard/DashboardRouter';
import { StorefrontApp } from './storefront/StorefrontApp';

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function RoutedApp() {
  const path = usePath();

  const storeMatch = path.match(/^\/store\/([^/]+)(?:\/|$)/);
  if (storeMatch) {
    return <StorefrontApp key={storeMatch[1]} subdomain={safeDecode(storeMatch[1])} />;
  }

  if (path === '/auth/login' || path === '/auth' || path.startsWith('/auth/login/')) {
    return <LoginPage />;
  }
  if (path === '/auth/register' || path.startsWith('/auth/register/')) {
    return <RegisterPage />;
  }
  if (path.startsWith('/auth/')) {
    return <LoginPage />;
  }

  if (path === '/onboarding' || path.startsWith('/onboarding/')) {
    return <OnboardingPage />;
  }

  if (path === '/dashboard' || path.startsWith('/dashboard/')) {
    return (
      <DashboardShell>
        <DashboardRouter />
      </DashboardShell>
    );
  }

  return <MarketingApp />;
}

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <RoutedApp />
      </SessionProvider>
    </ToastProvider>
  );
}
