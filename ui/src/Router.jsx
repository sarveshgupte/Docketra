/**
 * Router Configuration
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { FirmLayout } from './components/routing/FirmLayout';
import { MarketingLayout } from './components/routing/MarketingLayout';
import { DefaultRoute } from './components/routing/DefaultRoute';

const lazyPage = (importer, exportName) => React.lazy(
  () => importer().then((module) => ({ default: module[exportName] }))
);

const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage');
const FirmLoginPage = lazyPage(() => import('./pages/FirmLoginPage'), 'FirmLoginPage');
const ChangePasswordPage = lazyPage(() => import('./pages/ChangePasswordPage'), 'ChangePasswordPage');
const SetPasswordPage = lazyPage(() => import('./pages/SetPasswordPage'), 'SetPasswordPage');
const ForgotPasswordPage = lazyPage(() => import('./pages/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyPage(() => import('./pages/ResetPasswordPage'), 'ResetPasswordPage');
const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage');
const WorklistPage = lazyPage(() => import('./pages/WorklistPage'), 'WorklistPage');
const WorkbasketPage = lazyPage(() => import('./pages/WorkbasketPage'), 'WorkbasketPage');
const CaseDetailPage = lazyPage(() => import('./pages/CaseDetailPage'), 'CaseDetailPage');
const CreateCasePage = lazyPage(() => import('./pages/CreateCasePage'), 'CreateCasePage');
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'), 'ProfilePage');
const AdminPage = lazyPage(() => import('./pages/AdminPage'), 'AdminPage');
const PlatformDashboard = lazyPage(() => import('./pages/PlatformDashboard'), 'PlatformDashboard');
const FirmsManagement = lazyPage(() => import('./pages/FirmsManagement'), 'FirmsManagement');
const ReportsDashboard = lazyPage(() => import('./pages/reports/ReportsDashboard'), 'ReportsDashboard');
const DetailedReports = lazyPage(() => import('./pages/reports/DetailedReports'), 'DetailedReports');
const CasesPage = lazyPage(() => import('./pages/CasesPage'), 'CasesPage');
const GoogleCallbackPage = lazyPage(() => import('./pages/GoogleCallbackPage'), 'GoogleCallbackPage');
const MarketingHomePage = lazyPage(() => import('./pages/marketing/HomePage'), 'HomePage');
const MarketingFeaturesPage = lazyPage(() => import('./pages/marketing/Features'), 'FeaturesPage');
const MarketingPricingPage = lazyPage(() => import('./pages/marketing/Pricing'), 'PricingPage');
const MarketingTermsPage = lazyPage(() => import('./pages/marketing/Terms'), 'TermsPage');
const MarketingPrivacyPage = lazyPage(() => import('./pages/marketing/Privacy'), 'PrivacyPage');
const MarketingSecurityPage = lazyPage(() => import('./pages/marketing/Security'), 'SecurityPage');
const MarketingAboutPage = lazyPage(() => import('./pages/marketing/About'), 'AboutPage');
const MarketingContactPage = lazyPage(() => import('./pages/marketing/Contact'), 'ContactPage');
const MarketingSignupPage = lazyPage(() => import('./pages/marketing/Signup'), 'SignupPage');
const NotFoundPage = lazyPage(() => import('./pages/NotFoundPage'), 'NotFoundPage');

const RouteLoadingFallback = () => <div className="sr-only" role="status">Loading page…</div>;

const RouteSuspenseOutlet = () => (
  // Keep suspense at the route-group level so layout shells render immediately.
  // Chunk load failures are still caught by the root ErrorBoundary in index.jsx.
  <Suspense fallback={<RouteLoadingFallback />}>
    <Outlet />
  </Suspense>
);

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
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
        <Route element={<MarketingLayout />}>
          <Route element={<RouteSuspenseOutlet />}>
            <Route path="/" element={<MarketingHomePage />} />
            <Route path="/features" element={<MarketingFeaturesPage />} />
            <Route path="/pricing" element={<MarketingPricingPage />} />
            <Route path="/terms" element={<MarketingTermsPage />} />
            <Route path="/privacy" element={<MarketingPrivacyPage />} />
            <Route path="/security" element={<MarketingSecurityPage />} />
            <Route path="/about" element={<MarketingAboutPage />} />
            <Route path="/contact" element={<MarketingContactPage />} />
            <Route path="/signup" element={<MarketingSignupPage />} />
            <Route path="/superadmin" element={<LoginPage />} />
            <Route path="/superadmin/login" element={<LoginPage />} />
          </Route>
        </Route>

        <Route element={<RouteSuspenseOutlet />}>
          <Route path="/:firmSlug/login" element={<FirmLoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/auth/setup-account" element={<SetPasswordPage />} />
          <Route path="/setup-password" element={<SetPasswordPage />} />
          <Route path="/google-callback" element={<GoogleCallbackPage />} />

          <Route
            path="/app/superadmin"
            element={(
              <ProtectedRoute requireSuperadmin>
                <PlatformDashboard />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/app/superadmin/firms"
            element={(
              <ProtectedRoute requireSuperadmin>
                <FirmsManagement />
              </ProtectedRoute>
            )}
          />
        </Route>

        <Route path="/app/firm/:firmSlug" element={<FirmLayout />}>
          <Route element={<RouteSuspenseOutlet />}>
            <Route
              path="dashboard"
              element={(
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="worklist"
              element={(
                <ProtectedRoute>
                  <WorklistPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="my-worklist"
              element={(
                <ProtectedRoute>
                  <WorklistPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="global-worklist"
              element={(
                <ProtectedRoute>
                  <WorkbasketPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="cases/:caseId"
              element={(
                <ProtectedRoute>
                  <CaseDetailPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="cases"
              element={(
                <ProtectedRoute>
                  <CasesPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="cases/create"
              element={(
                <ProtectedRoute>
                  <CreateCasePage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="profile"
              element={(
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="admin"
              element={(
                <ProtectedRoute requireAdmin>
                  <AdminPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="admin/reports"
              element={(
                <ProtectedRoute requireAdmin>
                  <ReportsDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path="admin/reports/detailed"
              element={(
                <ProtectedRoute requireAdmin>
                  <DetailedReports />
                </ProtectedRoute>
              )}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route element={<RouteSuspenseOutlet />}>
          <Route path="/superadmin/*" element={<LegacySuperadminRedirect />} />
          <Route path="/firm/*" element={<LegacyFirmRedirect />} />
          <Route path="/f/:firmSlug/*" element={<LegacyFirmScopedRedirect />} />
          <Route path="/app/firm" element={<DefaultRoute />} />
          <Route path="/:firmSlug/*" element={<LegacySlugRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
  );
};
