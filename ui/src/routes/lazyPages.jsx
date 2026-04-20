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

const lazyPage = (importer, exportName) => lazy(async () => {
  const module = await importWithRetry(importer);
  const pageExport = module?.[exportName];

  if (!pageExport) {
    throw new Error(`Missing expected export "${exportName}" in lazy module.`);
  }

  return { default: pageExport };
});

export const LoginPage = lazyPage(() => import('../pages/LoginPage'), 'LoginPage');
export const FirmLoginPage = lazyPage(() => import('../pages/FirmLoginPage'), 'FirmLoginPage');
export const ChangePasswordPage = lazyPage(() => import('../pages/ChangePasswordPage'), 'ChangePasswordPage');
export const SetPasswordPage = lazyPage(() => import('../pages/SetPasswordPage'), 'SetPasswordPage');
export const ForgotPasswordPage = lazyPage(() => import('../pages/ForgotPasswordPage'), 'ForgotPasswordPage');
export const ResetPasswordPage = lazyPage(() => import('../pages/ResetPasswordPage'), 'ResetPasswordPage');
export const CompleteProfile = lazyPage(() => import('../pages/CompleteProfile'), 'CompleteProfile');
export const DashboardPage = lazyPage(() => import('../pages/Dashboard'), 'DashboardPage');
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
export const AiSettingsPage = lazyPage(() => import('../pages/AiSettingsPage'), 'AiSettingsPage');
export const PlatformDashboard = lazyPage(() => import('../pages/PlatformDashboard'), 'PlatformDashboard');
export const FirmsManagement = lazyPage(() => import('../pages/FirmsManagement'), 'FirmsManagement');
export const SuperadminOnboardingInsightsPage = lazyPage(() => import('../pages/SuperadminOnboardingInsightsPage'), 'SuperadminOnboardingInsightsPage');
export const SuperadminFirmOnboardingDetailPage = lazyPage(() => import('../pages/SuperadminFirmOnboardingDetailPage'), 'SuperadminFirmOnboardingDetailPage');
export const ReportsDashboard = lazyPage(() => import('../pages/reports/ReportsDashboard'), 'ReportsDashboard');
export const DetailedReports = lazyPage(() => import('../pages/reports/DetailedReports'), 'DetailedReports');
export const CasesPage = lazyPage(() => import('../pages/CasesPage'), 'CasesPage');
export const ClientsPage = lazyPage(() => import('../pages/ClientsPage'), 'ClientsPage');
export const ClientWorkspacePage = lazyPage(() => import('../pages/ClientWorkspacePage'), 'ClientWorkspacePage');
export const MarketingHomePage = lazyPage(() => import('../pages/marketing/HomePage'), 'HomePage');
export const MarketingFeaturesPage = lazyPage(() => import('../pages/marketing/Features'), 'FeaturesPage');
export const MarketingTermsPage = lazyPage(() => import('../pages/marketing/Terms'), 'TermsPage');
export const MarketingPrivacyPage = lazyPage(() => import('../pages/marketing/Privacy'), 'PrivacyPage');
export const MarketingSecurityPage = lazyPage(() => import('../pages/marketing/Security'), 'SecurityPage');
export const MarketingAcceptableUsePage = lazyPage(() => import('../pages/marketing/AcceptableUse'), 'AcceptableUsePage');
export const MarketingAboutPage = lazyPage(() => import('../pages/marketing/About'), 'AboutPage');
export const MarketingContactPage = lazyPage(() => import('../pages/marketing/Contact'), 'ContactPage');
export const MarketingSignupPage = lazy(() => import('../pages/marketing/Signup'));
export const NotFoundPage = lazyPage(() => import('../pages/NotFoundPage'), 'NotFoundPage');
export const OtpVerificationPage = lazyPage(() => import('../pages/OtpVerificationPage'), 'OtpVerificationPage');
export const UploadPage = lazyPage(() => import('../pages/UploadPage'), 'UploadPage');
export const PublicFormPage = lazyPage(() => import('../pages/PublicFormPage'), 'PublicFormPage');
export const CrmClientsPage = lazyPage(() => import('../pages/crm/CrmClientsPage'), 'CrmClientsPage');
export const CrmClientDetailPage = lazyPage(() => import('../pages/crm/CrmClientDetailPage'), 'CrmClientDetailPage');
export const LeadsPage = lazyPage(() => import('../pages/crm/LeadsPage'), 'LeadsPage');

export const PlatformDashboardPage = lazyPage(() => import('../pages/platform/DashboardPage'), 'default');
export const PlatformWorkbasketsPage = lazyPage(() => import('../pages/platform/WorkbasketsPage'), 'default');
export const PlatformWorklistPage = lazyPage(() => import('../pages/platform/WorklistPage'), 'default');
export const PlatformQcQueuePage = lazyPage(() => import('../pages/platform/QcQueuePage'), 'default');
export const PlatformReportsPage = lazyPage(() => import('../pages/platform/ReportsPage'), 'default');
export const PlatformCrmPage = lazyPage(() => import('../pages/platform/CrmPage'), 'default');
export const PlatformCmsPage = lazyPage(() => import('../pages/platform/CmsPage'), 'default');
export const PlatformTaskManagerPage = lazyPage(() => import('../pages/platform/TaskManagerPage'), 'default');
export const PlatformSettingsPage = lazyPage(() => import('../pages/platform/SettingsPage'), 'default');
