import { lazy } from 'react';

const lazyPage = (importer, exportName) => lazy(
  () => importer().then((module) => ({ default: module[exportName] }))
);

export const LoginPage = lazyPage(() => import('../pages/LoginPage'), 'LoginPage');
export const FirmLoginPage = lazyPage(() => import('../pages/FirmLoginPage'), 'FirmLoginPage');
export const ChangePasswordPage = lazyPage(() => import('../pages/ChangePasswordPage'), 'ChangePasswordPage');
export const SetPasswordPage = lazyPage(() => import('../pages/SetPasswordPage'), 'SetPasswordPage');
export const ForgotPasswordPage = lazyPage(() => import('../pages/ForgotPasswordPage'), 'ForgotPasswordPage');
export const ResetPasswordPage = lazyPage(() => import('../pages/ResetPasswordPage'), 'ResetPasswordPage');
export const CompleteProfile = lazyPage(() => import('../pages/CompleteProfile'), 'CompleteProfile');
export const DashboardPage = lazyPage(() => import('../pages/DashboardPage'), 'DashboardPage');
export const WorklistPage = lazyPage(() => import('../pages/WorklistPage'), 'WorklistPage');
export const WorkbasketPage = lazyPage(() => import('../pages/WorkbasketPage'), 'WorkbasketPage');
export const CaseDetailPage = lazyPage(() => import('../pages/CaseDetailPage'), 'CaseDetailPage');
export const CreateCasePage = lazyPage(() => import('../pages/CreateCasePage'), 'CreateCasePage');
export const ProfilePage = lazyPage(() => import('../pages/ProfilePage'), 'ProfilePage');
export const AdminPage = lazyPage(() => import('../pages/AdminPage'), 'AdminPage');
export const FirmSettingsPage = lazyPage(() => import('../pages/FirmSettingsPage'), 'FirmSettingsPage');
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

export const FAQPage = lazy(() => import('../pages/FAQPage').then(module => ({ default: module.FAQPage })));
