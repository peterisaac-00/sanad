import React, { useMemo } from 'react';
import { SessionProvider } from './lib/session';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/ui';
import { usePath } from './lib/router';
import { MarketingApp } from './marketing/MarketingApp';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage';
import { ResetPasswordPage } from './auth/ResetPasswordPage';
import { VerifyEmailPage } from './auth/VerifyEmailPage';
import { TeamInvitePage } from './auth/TeamInvitePage';
import { TeamLoginPage } from './auth/TeamLoginPage';
import { OnboardingPage } from './onboarding/OnboardingPage';
import { DashboardShell } from './dashboard/DashboardShell';
import { DashboardRouter } from './dashboard/DashboardRouter';
import { AdminApp } from './admin/AdminApp';
import { StorefrontApp } from './storefront/StorefrontApp';

interface SiteBoot {
  mode?: string;
  custom_domain?: boolean;
  store?: { subdomain?: string } | null;
}

function readSiteBoot(): SiteBoot | null {
  const tag = document.querySelector('meta[name="sanad-site"]');
  const raw = tag?.getAttribute("content");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SiteBoot) : null;
  } catch {
    return null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function RoutedApp() {
  const path = usePath();
  const site = useMemo(readSiteBoot, []);
  const customSubdomain = site?.custom_domain && site.store?.subdomain ? site.store.subdomain : null;

  if (customSubdomain) {
    return <StorefrontApp key={`custom:${customSubdomain}`} subdomain={customSubdomain} base="" />;
  }

  const storeMatch = path.match(/^\/store\/([^/]+)(?:\/|$)/);
  if (storeMatch) {
    return <StorefrontApp key={storeMatch[1]} subdomain={safeDecode(storeMatch[1])} base={`/store/${safeDecode(storeMatch[1])}`} />;
  }

  if (path === '/team/invite' || path.startsWith('/team/invite/')) {
    return <TeamInvitePage />;
  }
  if (path === '/team/login' || path.startsWith('/team/login/')) {
    return <TeamLoginPage />;
  }

  if (path === '/auth/login' || path === '/auth' || path.startsWith('/auth/login/')) {
    return <LoginPage />;
  }
  if (path === '/auth/register' || path.startsWith('/auth/register/')) {
    return <RegisterPage />;
  }
  if (path === '/auth/forgot-password' || path.startsWith('/auth/forgot-password/')) {
    return <ForgotPasswordPage />;
  }
  if (path === '/auth/reset-password' || path.startsWith('/auth/reset-password/')) {
    return <ResetPasswordPage />;
  }
  if (path === '/auth/verify-email' || path.startsWith('/auth/verify-email/')) {
    return <VerifyEmailPage />;
  }
  if (path.startsWith('/auth/')) {
    return <LoginPage />;
  }

  if (path === '/onboarding' || path.startsWith('/onboarding/')) {
    return <OnboardingPage />;
  }

  if (path === '/admin' || path.startsWith('/admin/')) {
    return <AdminApp />;
  }

  if (path === '/dashboard' || path.startsWith('/dashboard/')) {
    return (
      <DashboardShell>
        <DashboardRouter />
      </DashboardShell>
    );
  }

  return (
    <div data-theme="light" className="min-h-screen bg-canvas">
      <MarketingApp />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SessionProvider>
          <RoutedApp />
        </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
