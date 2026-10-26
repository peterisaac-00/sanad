import React, { lazy, Suspense, useMemo } from 'react';
import { SessionProvider } from './lib/session';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/ui';
import { usePath } from './lib/router';
const MarketingApp = lazy(() => import('./marketing/MarketingApp').then((m) => ({ default: m.MarketingApp })));
const LoginPage = lazy(() => import('./auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('./auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const TeamInvitePage = lazy(() => import('./auth/TeamInvitePage').then((m) => ({ default: m.TeamInvitePage })));
const TeamLoginPage = lazy(() => import('./auth/TeamLoginPage').then((m) => ({ default: m.TeamLoginPage })));
const OnboardingPage = lazy(() => import('./onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const DashboardShell = lazy(() => import('./dashboard/DashboardShell').then((m) => ({ default: m.DashboardShell })));
const DashboardRouter = lazy(() => import('./dashboard/DashboardRouter').then((m) => ({ default: m.DashboardRouter })));
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })));
const StorefrontApp = lazy(() => import('./storefront/StorefrontApp').then((m) => ({ default: m.StorefrontApp })));

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

/**
 * Vite serves the SPA directly in development, so the Express boot <meta> tag
 * is not present. `<subdomain>.localhost` is enough to preview the same host
 * shape used by `<subdomain>.soqeg.com` in production.
 */
function devHostSubdomain(): string | null {
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith(".localhost")) return null;
  const label = host.slice(0, -".localhost".length);
  return label && !label.includes(".") ? label : null;
}

function RoutedApp() {
  const path = usePath();
  const site = useMemo(readSiteBoot, []);
  const hostedSubdomain =
    site?.store?.subdomain &&
    (site.mode === "custom_domain" || site.mode === "platform_subdomain")
      ? site.store.subdomain
      : devHostSubdomain();

  if (hostedSubdomain) {
    return <StorefrontApp key={`host:${hostedSubdomain}`} subdomain={hostedSubdomain} base="" />;
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
            <Suspense fallback={<div className="min-h-screen bg-canvas" aria-busy="true" />}>
              <RoutedApp />
            </Suspense>
        </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
