/**
 * Router Configuration
 */

import React from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { FirmLayout } from './components/routing/FirmLayout';
import { MarketingLayout } from './components/routing/MarketingLayout';
import { DefaultRoute } from './components/routing/DefaultRoute';
import { PageWrapper } from './components/layout/PageWrapper';
import { LoginPage } from './pages/LoginPage';
import { FirmLoginPage } from './pages/FirmLoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorklistPage } from './pages/WorklistPage';
import { WorkbasketPage } from './pages/WorkbasketPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { CreateCasePage } from './pages/CreateCasePage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { PlatformDashboard } from './pages/PlatformDashboard';
import { FirmsManagement } from './pages/FirmsManagement';
import { ReportsDashboard } from './pages/reports/ReportsDashboard';
import { DetailedReports } from './pages/reports/DetailedReports';
import { CasesPage } from './pages/CasesPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import {
  MarketingHomePage,
  MarketingFeaturesPage,
  MarketingPricingPage,
  MarketingTermsPage,
  MarketingPrivacyPage,
  MarketingSecurityPage,
  MarketingAboutPage,
  MarketingContactPage,
  MarketingSignupPage,
} from './pages/marketing/MarketingPages';
import { NotFoundPage } from './pages/NotFoundPage';

const LEGACY_SLUG_BLOCKLIST = new Set([
  'about',
  'app',
  'auth',
  'change-password',
  'contact',
  'f',
  'features',
  'forgot-password',
  'google-callback',
  'login',
  'pricing',
  'privacy',
  'reset-password',
  'security',
  'signup',
  'set-password',
  'superadmin',
  'terms',
]);
const FIRM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_FIRM_SUFFIX = '/dashboard';

const withPageTransition = (component) => <PageWrapper>{component}</PageWrapper>;

const LegacyFirmScopedRedirect = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const suffix = location.pathname.replace(`/f/${firmSlug}`, '') || DEFAULT_FIRM_SUFFIX;
  const target = `/app/firm/${firmSlug}${suffix}${location.search || ''}`;
  return <Navigate to={target} replace />;
};

const LegacySuperadminRedirect = () => {
  const location = useLocation();
  const suffix = location.pathname.replace('/superadmin', '');
  const target = `/app/superadmin${suffix}${location.search || ''}`;
  return <Navigate to={target} replace />;
};

const LegacyFirmRedirect = () => {
  const location = useLocation();
  const suffix = location.pathname.startsWith('/firm') ? location.pathname.slice('/firm'.length) : '';
  const target = `/app/firm${suffix}${location.search || ''}`;
  return <Navigate to={target} replace />;
};

const LegacySlugRedirect = () => {
  const { firmSlug, '*': legacyPath = '' } = useParams();
  const location = useLocation();
  const normalizedFirmSlug = (firmSlug || '').toLowerCase();

  if (!FIRM_SLUG_PATTERN.test(normalizedFirmSlug) || LEGACY_SLUG_BLOCKLIST.has(normalizedFirmSlug)) {
    return <NotFoundPage />;
  }

  const suffix = legacyPath ? `/${legacyPath}` : DEFAULT_FIRM_SUFFIX;
  const target = `/app/firm/${normalizedFirmSlug}${suffix}${location.search || ''}`;
  return <Navigate to={target} replace />;
};

export const Router = () => {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={withPageTransition(<MarketingHomePage />)} />
        <Route path="/features" element={withPageTransition(<MarketingFeaturesPage />)} />
        <Route path="/pricing" element={withPageTransition(<MarketingPricingPage />)} />
        <Route path="/terms" element={withPageTransition(<MarketingTermsPage />)} />
        <Route path="/privacy" element={withPageTransition(<MarketingPrivacyPage />)} />
        <Route path="/security" element={withPageTransition(<MarketingSecurityPage />)} />
        <Route path="/about" element={withPageTransition(<MarketingAboutPage />)} />
        <Route path="/contact" element={withPageTransition(<MarketingContactPage />)} />
        <Route path="/signup" element={withPageTransition(<MarketingSignupPage />)} />
        <Route path="/superadmin" element={withPageTransition(<LoginPage />)} />
        <Route path="/superadmin/login" element={withPageTransition(<LoginPage />)} />
      </Route>

      <Route path="/:firmSlug/login" element={withPageTransition(<FirmLoginPage />)} />
      <Route path="/forgot-password" element={withPageTransition(<ForgotPasswordPage />)} />
      <Route path="/reset-password" element={withPageTransition(<ResetPasswordPage />)} />
      <Route path="/change-password" element={withPageTransition(<ChangePasswordPage />)} />
      <Route path="/auth/setup-account" element={withPageTransition(<SetPasswordPage />)} />
      <Route path="/setup-password" element={withPageTransition(<SetPasswordPage />)} />
      <Route path="/google-callback" element={withPageTransition(<GoogleCallbackPage />)} />

      <Route
        path="/app/superadmin"
        element={withPageTransition(
          <ProtectedRoute requireSuperadmin>
            <PlatformDashboard />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/app/superadmin/firms"
        element={withPageTransition(
          <ProtectedRoute requireSuperadmin>
            <FirmsManagement />
          </ProtectedRoute>
        )}
      />

      <Route path="/app/firm/:firmSlug" element={<FirmLayout />}>
        <Route
          path="dashboard"
          element={withPageTransition(
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="worklist"
          element={withPageTransition(
            <ProtectedRoute>
              <WorklistPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="my-worklist"
          element={withPageTransition(
            <ProtectedRoute>
              <WorklistPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="global-worklist"
          element={withPageTransition(
            <ProtectedRoute>
              <WorkbasketPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="cases/:caseId"
          element={withPageTransition(
            <ProtectedRoute>
              <CaseDetailPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="cases"
          element={withPageTransition(
            <ProtectedRoute>
              <CasesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="cases/create"
          element={withPageTransition(
            <ProtectedRoute>
              <CreateCasePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="profile"
          element={withPageTransition(
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="admin"
          element={withPageTransition(
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="admin/reports"
          element={withPageTransition(
            <ProtectedRoute requireAdmin>
              <ReportsDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="admin/reports/detailed"
          element={withPageTransition(
            <ProtectedRoute requireAdmin>
              <DetailedReports />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={withPageTransition(<NotFoundPage />)} />
      </Route>
      <Route path="/superadmin/*" element={<LegacySuperadminRedirect />} />
      <Route path="/firm/*" element={<LegacyFirmRedirect />} />
      <Route path="/f/:firmSlug/*" element={<LegacyFirmScopedRedirect />} />
      <Route path="/app/firm" element={<DefaultRoute />} />
      <Route path="/:firmSlug/*" element={<LegacySlugRedirect />} />
      <Route path="*" element={withPageTransition(<NotFoundPage />)} />
    </Routes>
  );
};
