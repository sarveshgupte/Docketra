/**
 * Router Configuration
 */

import React from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { FirmLayout } from './components/routing/FirmLayout';
import { MarketingLayout } from './components/routing/MarketingLayout';
import { DefaultRoute } from './components/routing/DefaultRoute';
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
import { SuperadminDashboard } from './pages/SuperadminDashboard';
import { PlatformDashboard } from './pages/PlatformDashboard';
import { FirmsManagement } from './pages/FirmsManagement';
import { ReportsDashboard } from './pages/reports/ReportsDashboard';
import { DetailedReports } from './pages/reports/DetailedReports';
import { FilteredCasesPage } from './pages/FilteredCasesPage';
import { CasesPage } from './pages/CasesPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import { MarketingHomePage, MarketingFeaturesPage, MarketingPricingPage, MarketingTermsPage, MarketingPrivacyPage, MarketingSecurityPage, MarketingAboutPage, MarketingContactPage } from './pages/marketing/MarketingPages';
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
  'set-password',
  'superadmin',
  'terms',
]);
const FIRM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_FIRM_SUFFIX = '/dashboard';

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
          {/* 
            Routing policy:
            1) Public marketing/auth pages are outside /app/*
            2) Protected application pages live under /app/*
            3) Legacy redirects are retained for /superadmin/*, /firm/*, /f/:firmSlug/* and /:firmSlug/* (safe subset) for backward compatibility
            4) Unknown routes resolve to NotFoundPage (404 policy), including unknown nested firm routes
          */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<MarketingHomePage />} />
            <Route path="/features" element={<MarketingFeaturesPage />} />
            <Route path="/pricing" element={<MarketingPricingPage />} />
            <Route path="/terms" element={<MarketingTermsPage />} />
            <Route path="/privacy" element={<MarketingPrivacyPage />} />
            <Route path="/security" element={<MarketingSecurityPage />} />
            <Route path="/about" element={<MarketingAboutPage />} />
            <Route path="/contact" element={<MarketingContactPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Public Auth Routes */}
          <Route path="/f/:firmSlug/login" element={<FirmLoginPage />} />
          <Route path="/f/:firmSlug/set-password" element={<SetPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/auth/setup-password" element={<SetPasswordPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/google-callback" element={<GoogleCallbackPage />} />
          
          {/* SuperAdmin Routes - NOT firm-scoped */}
          <Route
            path="/app/superadmin"
            element={
              <ProtectedRoute requireSuperadmin>
                <PlatformDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/app/superadmin/firms"
            element={
              <ProtectedRoute requireSuperadmin>
                <FirmsManagement />
              </ProtectedRoute>
            }
          />
          
          {/* Firm-Scoped Routes for Regular Users */}
          <Route path="/app/firm/:firmSlug" element={<FirmLayout />}>
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="worklist"
              element={
                <ProtectedRoute>
                  <WorklistPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="my-worklist"
              element={
                <ProtectedRoute>
                  <WorklistPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="global-worklist"
              element={
                <ProtectedRoute>
                  <WorkbasketPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="cases/:caseId"
              element={
                <ProtectedRoute>
                  <CaseDetailPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="cases"
              element={
                <ProtectedRoute>
                  <CasesPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="cases/create"
              element={
                <ProtectedRoute>
                  <CreateCasePage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="admin/reports"
              element={
                <ProtectedRoute requireAdmin>
                  <ReportsDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="admin/reports/detailed"
              element={
                <ProtectedRoute requireAdmin>
                  <DetailedReports />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/superadmin/*" element={<LegacySuperadminRedirect />} />
          <Route path="/firm/*" element={<LegacyFirmRedirect />} />
          <Route path="/f/:firmSlug/*" element={<LegacyFirmScopedRedirect />} />
          <Route path="/app/firm" element={<DefaultRoute />} />
          {/* Legacy /:firmSlug/* is retained for backwards-compatible deep links and safely blocked for reserved app/auth prefixes. */}
          <Route path="/:firmSlug/*" element={<LegacySlugRedirect />} />
          {/* Final catch-all: any route not matched by public/protected/legacy rules renders 404. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
  );
};
