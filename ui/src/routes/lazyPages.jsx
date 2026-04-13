import { lazy } from 'react';
import { DashboardPage as DashboardPageComponent } from '../pages/DashboardPage';
import { WorklistPage as WorklistPageComponent } from '../pages/WorklistPage';
import { WorkbasketPage as WorkbasketPageComponent } from '../pages/WorkbasketPage';
import { FirmSettingsPage as FirmSettingsPageComponent } from '../pages/FirmSettingsPage';
import { WorkSettingsPage as WorkSettingsPageComponent } from '../pages/WorkSettingsPage';

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
export const DashboardPage = DashboardPageComponent;
export const WorklistPage = WorklistPageComponent;
export const WorkbasketPage = WorkbasketPageComponent;
export const ComplianceCalendarPage = lazyPage(() => import('../pages/ComplianceCalendarPage'), 'ComplianceCalendarPage');
export const CaseDetailPage = lazyPage(() => import('../pages/CaseDetailPage'), 'CaseDetailPage');
export const CreateCasePage = lazyPage(() => import('../pages/CreateCasePage'), 'CreateCasePage');
export const ProfilePage = lazyPage(() => import('../pages/ProfilePage'), 'ProfilePage');
export const ProductUpdatesHistoryPage = lazyPage(() => import('../pages/ProductUpdatesHistoryPage'), 'ProductUpdatesHistoryPage');
export const AdminPage = lazyPage(() => import('../pages/AdminPage'), 'AdminPage');
export const FirmSettingsPage = FirmSettingsPageComponent;
export const WorkSettingsPage = WorkSettingsPageComponent;
export const StorageSettingsPage = lazyPage(() => import('../pages/StorageSettingsPage'), 'StorageSettingsPage');
export const PlatformDashboard = lazyPage(() => import('../pages/PlatformDashboard'), 'PlatformDashboard');
export const FirmsManagement = lazyPage(() => import('../pages/FirmsManagement'), 'FirmsManagement');
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
export const MarketingAboutPage = lazyPage(() => import('../pages/marketing/About'), 'AboutPage');
export const MarketingContactPage = lazyPage(() => import('../pages/marketing/Contact'), 'ContactPage');
export const MarketingSignupPage = lazy(() => import('../pages/marketing/Signup'));
export const NotFoundPage = lazyPage(() => import('../pages/NotFoundPage'), 'NotFoundPage');
export const OtpVerificationPage = lazyPage(() => import('../pages/OtpVerificationPage'), 'OtpVerificationPage');
export const UploadPage = lazyPage(() => import('../pages/UploadPage'), 'UploadPage');
