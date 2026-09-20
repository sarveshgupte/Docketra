/**
 * Route Module Loading & Hydration Preload Strategy
 *
 * Why PRELOADED_MODULES exists:
 * In build-time prerendered setups, public marketing routes have complete HTML in the initial
 * response. When React 18 mounts with `hydrateRoot()`, wrapping an unresolved `React.lazy()`
 * component in `<Suspense>` causes a hydration mismatch (Minified React Error #418/#423) because
 * the client initially renders a fallback shell while the server DOM already contains full content.
 *
 * How it works:
 * 1. Before `ReactDOM.hydrateRoot()` runs in `ui/src/index.jsx`, `preloadMatchingRoute()` resolves
 *    the module for the current URL pathname and caches the component in `PRELOADED_MODULES`.
 * 2. On initial mount, `lazyPage()` checks `PRELOADED_MODULES`. If cached, it renders the component
 *    synchronously (and `RouteSuspenseOutlet` bypasses `<Suspense>`), ensuring a 100% clean DOM hydration.
 * 3. Subsequent in-app navigations to other routes not yet loaded continue to use `React.lazy()`,
 *    preserving dynamic bundle splitting and suspense loading shells across the SPA.
 */

import { lazy } from 'react';

const importWithRetry = async (importer, attempts = 2) => {
  let lastError;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await importer();
    } catch (error) {
      lastError = error;
      const isLastAttempt = index === attempts - 1;
      if (isLastAttempt) {
        throw lastError;
      }

      // Brief delay helps when CDN propagation lags after a fresh deploy.
      // Common symptom: "Failed to fetch dynamically imported module".
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  throw lastError;
};

const PRELOADED_MODULES = new Map();

export const preloadRoute = async (importer, exportName) => {
  const module = await importWithRetry(importer);
  const pageExport = module?.[exportName] ?? module?.default;
  if (!pageExport) {
    throw new Error(`Missing expected export "${exportName}" in lazy module.`);
  }
  PRELOADED_MODULES.set(importer, pageExport);
  return pageExport;
};

const lazyPage = (importer, exportName) => {
  const LazyComponent = lazy(async () => {
    const module = await importWithRetry(importer);
    const pageExport = module?.[exportName] ?? module?.default;
    if (!pageExport) {
      throw new Error(`Missing expected export "${exportName}" in lazy module.`);
    }
    PRELOADED_MODULES.set(importer, pageExport);
    return { default: pageExport };
  });

  const RouteComponent = (props) => {
    const preloaded = PRELOADED_MODULES.get(importer);
    if (preloaded) {
      const SyncComp = preloaded;
      return <SyncComp {...props} />;
    }
    return <LazyComponent {...props} />;
  };

  RouteComponent.displayName = `Route(${exportName || 'Page'})`;
  return RouteComponent;
};

export const LoginPage = lazyPage(() => import('../pages/LoginPage'), 'LoginPage');
export const FirmLoginPage = lazyPage(() => import('../pages/FirmLoginPage'), 'FirmLoginPage');
export const ChangePasswordPage = lazyPage(() => import('../pages/ChangePasswordPage'), 'ChangePasswordPage');
export const SetPasswordPage = lazyPage(() => import('../pages/SetPasswordPage'), 'SetPasswordPage');
export const ForgotPasswordPage = lazyPage(() => import('../pages/ForgotPasswordPage'), 'ForgotPasswordPage');
export const ResetPasswordPage = lazyPage(() => import('../pages/ResetPasswordPage'), 'ResetPasswordPage');
export const CompleteProfile = lazyPage(() => import('../pages/CompleteProfile'), 'CompleteProfile');
export const WorkspaceSetupPage = lazyPage(() => import('../pages/onboarding/WorkspaceSetupPage'), 'WorkspaceSetupPage');
export const DashboardPage = lazyPage(() => import('../pages/Dashboard'), 'DashboardPage');
export const PcsCommandCenter = lazyPage(() => import('../pages/dashboard/PcsCommandCenter'), 'default');
export const WorklistPage = lazyPage(() => import('../pages/WorklistPage'), 'WorklistPage');
export const WorkbasketPage = lazyPage(() => import('../pages/WorkbasketPage'), 'WorkbasketPage');
export const ComplianceCalendarPage = lazyPage(() => import('../pages/ComplianceCalendarPage'), 'ComplianceCalendarPage');
export const CaseDetailPage = lazyPage(() => import('../pages/CaseDetailPage'), 'CaseDetailPage');
export const CreateCasePage = lazyPage(() => import('../pages/CreateCasePage'), 'CreateCasePage');
export const ProfilePage = lazyPage(() => import('../pages/ProfilePage'), 'ProfilePage');
export const ProductUpdatesHistoryPage = lazyPage(() => import('../pages/ProductUpdatesHistoryPage'), 'ProductUpdatesHistoryPage');
export const AdminPage = lazyPage(() => import('../pages/AdminPage'), 'AdminPage');
export const HierarchyPage = lazyPage(() => import('../pages/HierarchyPage'), 'HierarchyPage');
export const AuditLogsPage = lazyPage(() => import('../pages/AuditLogsPage'), 'AuditLogsPage');
export const FirmSettingsPage = lazyPage(() => import('../pages/FirmSettingsPage'), 'FirmSettingsPage');
export const WorkSettingsPage = lazyPage(() => import('../pages/WorkSettingsPage'), 'WorkSettingsPage');
export const StorageSettingsPage = lazyPage(() => import('../pages/StorageSettingsPage'), 'StorageSettingsPage');
export const DataStorageMapPage = lazyPage(() => import('../pages/DataStorageMapPage'), 'DataStorageMapPage');
export const StorageOAuthSuccessPage = lazyPage(() => import('../pages/StorageOAuthSuccessPage'), 'StorageOAuthSuccessPage');
export const AiSettingsPage = lazyPage(() => import('../pages/AiSettingsPage'), 'AiSettingsPage');
export const PlatformDashboard = lazyPage(() => import('../pages/SuperadminDashboard'), 'SuperadminDashboard');
export const FirmsManagement = lazyPage(() => import('../pages/FirmsManagement'), 'FirmsManagement');
export const SuperadminOnboardingInsightsPage = lazyPage(() => import('../pages/SuperadminOnboardingInsightsPage'), 'SuperadminOnboardingInsightsPage');
export const SuperadminFirmOnboardingDetailPage = lazyPage(() => import('../pages/SuperadminFirmOnboardingDetailPage'), 'SuperadminFirmOnboardingDetailPage');
export const SuperadminDiagnosticsPage = lazyPage(() => import('../pages/SuperadminDiagnosticsPage'), 'SuperadminDiagnosticsPage');
export const SuperadminFirmDetailPage = lazyPage(() => import('../pages/SuperadminFirmDetailPage'), 'SuperadminFirmDetailPage');
export const SuperadminAuditLogPage = lazyPage(() => import('../pages/SuperadminAuditLogPage'), 'SuperadminAuditLogPage');
export const SuperadminFirmHealthPage = lazyPage(() => import('../pages/SuperadminFirmHealthPage'), 'SuperadminFirmHealthPage');
export const SuperadminPlansPage = lazyPage(() => import('../pages/SuperadminPlansPage'), 'SuperadminPlansPage');
export const SuperadminPilotReadinessPage = lazyPage(() => import('../pages/SuperadminPilotReadinessPage'), 'SuperadminPilotReadinessPage');
export const SuperadminFeatureFlagsPage = lazyPage(() => import('../pages/SuperadminFeatureFlagsPage'), 'SuperadminFeatureFlagsPage');
export const SuperadminAiAssistantPage = lazyPage(() => import('../pages/SuperadminAiAssistantPage'), 'SuperadminAiAssistantPage');
export const ReportsDashboard = lazyPage(() => import('../pages/reports/ReportsDashboard'), 'ReportsDashboard');
export const DetailedReports = lazyPage(() => import('../pages/reports/DetailedReports'), 'DetailedReports');
export const CasesPage = lazyPage(() => import('../pages/CasesPage'), 'CasesPage');
export const ClientsPage = lazyPage(() => import('../pages/ClientsPage'), 'ClientsPage');
export const ClientWorkspacePage = lazyPage(() => import('../pages/ClientWorkspacePage'), 'ClientWorkspacePage');
export const ClientDetailPage = lazyPage(() => import('../pages/clients/ClientDetailPage'), 'default');
const marketingHomeImporter = () => import('../pages/marketing/HomePage');
const marketingFeaturesImporter = () => import('../pages/marketing/Features');
const marketingPricingImporter = () => import('../pages/marketing/Pricing');
const marketingTermsImporter = () => import('../pages/marketing/Terms');
const marketingPrivacyImporter = () => import('../pages/marketing/Privacy');
const marketingSecurityImporter = () => import('../pages/marketing/Security');
const marketingAcceptableUseImporter = () => import('../pages/marketing/AcceptableUse');
const marketingAboutImporter = () => import('../pages/marketing/About');
const marketingContactImporter = () => import('../pages/marketing/Contact');
const marketingSignupImporter = () => import('../pages/marketing/Signup');
const marketingCompareImporter = () => import('../pages/marketing/DocketraVsExcelWhatsAppPage');
const marketingCsImporter = () => import('../pages/marketing/CompanySecretariesSolutionPage');
const marketingLegalImporter = () => import('../pages/marketing/CorporateLegalTeamsSolutionPage');
const marketingCaImporter = () => import('../pages/marketing/CharteredAccountantsSolutionPage');

export const MarketingHomePage = lazyPage(marketingHomeImporter, 'HomePage');
export const MarketingFeaturesPage = lazyPage(marketingFeaturesImporter, 'FeaturesPage');
export const MarketingPricingPage = lazyPage(marketingPricingImporter, 'PricingPage');
export const MarketingTermsPage = lazyPage(marketingTermsImporter, 'TermsPage');
export const MarketingPrivacyPage = lazyPage(marketingPrivacyImporter, 'PrivacyPage');
export const MarketingSecurityPage = lazyPage(marketingSecurityImporter, 'SecurityPage');
export const MarketingAcceptableUsePage = lazyPage(marketingAcceptableUseImporter, 'AcceptableUsePage');
export const MarketingAboutPage = lazyPage(marketingAboutImporter, 'AboutPage');
export const MarketingContactPage = lazyPage(marketingContactImporter, 'ContactPage');
export const MarketingSignupPage = lazyPage(marketingSignupImporter, 'default');
export const MarketingCompareExcelWhatsAppPage = lazyPage(marketingCompareImporter, 'DocketraVsExcelWhatsAppPage');
export const MarketingCompanySecretariesPage = lazyPage(marketingCsImporter, 'CompanySecretariesSolutionPage');
export const MarketingCorporateLegalTeamsPage = lazyPage(marketingLegalImporter, 'CorporateLegalTeamsSolutionPage');
export const MarketingCharteredAccountantsPage = lazyPage(marketingCaImporter, 'CharteredAccountantsSolutionPage');

const ROUTE_PRELOAD_MAP = {
  '/': [marketingHomeImporter, 'HomePage'],
  '/features': [marketingFeaturesImporter, 'FeaturesPage'],
  '/pricing': [marketingPricingImporter, 'PricingPage'],
  '/solutions/company-secretaries': [marketingCsImporter, 'CompanySecretariesSolutionPage'],
  '/solutions/chartered-accountants': [marketingCaImporter, 'CharteredAccountantsSolutionPage'],
  '/solutions/corporate-legal-teams': [marketingLegalImporter, 'CorporateLegalTeamsSolutionPage'],
  '/compare/docketra-vs-excel-whatsapp': [marketingCompareImporter, 'DocketraVsExcelWhatsAppPage'],
  '/about': [marketingAboutImporter, 'AboutPage'],
  '/contact': [marketingContactImporter, 'ContactPage'],
  '/security': [marketingSecurityImporter, 'SecurityPage'],
  '/signup': [marketingSignupImporter, 'default'],
  '/terms': [marketingTermsImporter, 'TermsPage'],
  '/privacy': [marketingPrivacyImporter, 'PrivacyPage'],
  '/acceptable-use': [marketingAcceptableUseImporter, 'AcceptableUsePage'],
};

export const preloadMatchingRoute = async (pathname = (typeof window !== 'undefined' ? window.location.pathname : '/')) => {
  const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
  const entry = ROUTE_PRELOAD_MAP[normalized];
  if (entry) {
    const [importer, exportName] = entry;
    await preloadRoute(importer, exportName);
  }
};

export const isRoutePreloaded = (pathname = (typeof window !== 'undefined' ? window.location.pathname : '/')) => {
  const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
  const entry = ROUTE_PRELOAD_MAP[normalized];
  if (!entry) return false;
  const [importer] = entry;
  return PRELOADED_MODULES.has(importer);
};
export const NotFoundPage = lazyPage(() => import('../pages/NotFoundPage'), 'NotFoundPage');
export const OtpVerificationPage = lazyPage(() => import('../pages/OtpVerificationPage'), 'OtpVerificationPage');
export const OAuthPostAuthPage = lazyPage(() => import('../pages/OAuthPostAuthPage'), 'OAuthPostAuthPage');
export const UploadPage = lazyPage(() => import('../pages/UploadPage'), 'UploadPage');
export const PublicFormPage = lazyPage(() => import('../pages/PublicFormPage'), 'PublicFormPage');
export const CrmClientsPage = lazyPage(() => import('../pages/crm/CrmClientsPage'), 'CrmClientsPage');
export const CrmClientDetailPage = lazyPage(() => import('../pages/crm/CrmClientDetailPage'), 'CrmClientDetailPage');
export const LeadsPage = lazyPage(() => import('../pages/crm/LeadsPage'), 'LeadsPage');
export const CompanyBrainPage = lazyPage(() => import('../pages/CompanyBrainPage'), 'CompanyBrainPage');
export const KnowledgeLibraryPage = lazyPage(() => import('../pages/KnowledgeLibraryPage'), 'KnowledgeLibraryPage');

export const PlatformDashboardPage = lazyPage(() => import('../pages/platform/DashboardPage'), 'default');
export const PlatformWorkbasketsPage = lazyPage(() => import('../pages/platform/WorkbasketsPage'), 'default');
export const PlatformWorklistPage = lazyPage(() => import('../pages/platform/WorklistPage'), 'default');
export const PlatformQcQueuePage = lazyPage(() => import('../pages/platform/QcQueuePage'), 'default');
export const PlatformReportsPage = lazyPage(() => import('../pages/platform/ReportsPage'), 'default');
export const PlatformCrmPage = lazyPage(() => import('../pages/platform/CrmPage'), 'default');
export const PlatformCmsPage = lazyPage(() => import('../pages/platform/CmsPage'), 'default');
export const PlatformTaskManagerPage = lazyPage(() => import('../pages/platform/TaskManagerPage'), 'default');
export const PlatformSettingsPage = lazyPage(() => import('../pages/platform/SettingsPage'), 'default');
export const DocketraIntelligencePage = lazyPage(() => import('../pages/platform/DocketraIntelligencePage'), 'default');

export const FindWorkspacePage = lazyPage(() => import('../pages/FindWorkspacePage'), 'FindWorkspacePage');
