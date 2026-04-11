import React from 'react';
import { Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { MarketingLayout } from '../components/routing/MarketingLayout';
import { DefaultRoute } from '../components/routing/DefaultRoute';
import {
  ChangePasswordPage,
  CompleteProfile,
  FirmLoginPage,
  ForgotPasswordPage,
  LoginPage,
  MarketingAboutPage,
  MarketingContactPage,
  MarketingFeaturesPage,
  MarketingHomePage,
  MarketingPrivacyPage,
  MarketingSecurityPage,
  MarketingSignupPage,
  MarketingTermsPage,
  OtpVerificationPage,
  ResetPasswordPage,
  SetPasswordPage,
  UploadPage,
} from './lazyPages';
import { RouteSuspenseOutlet } from './RouteSuspenseOutlet';

const AppFirmRootRedirect = () => {
  const { firmSlug } = useParams();
  return <Navigate to={`/${firmSlug}/login`} replace />;
};

const AppFirmLoginRedirect = () => {
  const { firmSlug } = useParams();
  return <Navigate to={`/${firmSlug}/login`} replace />;
};

const LegacyFirmForgotRedirect = () => {
  const { firmSlug } = useParams();
  return <Navigate to={`/${firmSlug}/forgot-password`} replace />;
};

const LegacySuperadminRedirect = () => {
  const location = useLocation();
  const suffix = location.pathname.replace('/superadmin', '');
  const target = `/app/superadmin${suffix}${location.search || ''}`;
  return <Navigate to={target} replace />;
};

export const PublicRoutes = () => (
  <>
    <Route element={<MarketingLayout />}>
      <Route element={<RouteSuspenseOutlet />}>
        <Route path="/" element={<MarketingHomePage />} />
        <Route path="/features" element={<MarketingFeaturesPage />} />
        <Route path="/terms" element={<MarketingTermsPage />} />
        <Route path="/privacy" element={<MarketingPrivacyPage />} />
        <Route path="/security" element={<MarketingSecurityPage />} />
        <Route path="/about" element={<MarketingAboutPage />} />
        <Route path="/contact" element={<MarketingContactPage />} />
        <Route path="/superadmin" element={<LoginPage />} />
        <Route path="/superadmin/login" element={<LoginPage />} />
      </Route>
    </Route>

    <Route element={<RouteSuspenseOutlet />}>
      <Route path="/signup" element={<MarketingSignupPage />} />
      <Route path="/auth/otp" element={<OtpVerificationPage />} />
      <Route path="/:firmSlug/login" element={<FirmLoginPage />} />
      <Route path="/app/:firmSlug" element={<AppFirmRootRedirect />} />
      <Route path="/app/:firmSlug/login" element={<AppFirmLoginRedirect />} />
      <Route path="/:firmSlug/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/app/:firmSlug/forgot-password" element={<LegacyFirmForgotRedirect />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/onboarding" element={<CompleteProfile />} />
      <Route path="/dashboard" element={<DefaultRoute />} />
      <Route path="/auth/setup-account" element={<SetPasswordPage />} />
      <Route path="/setup-password" element={<SetPasswordPage />} />
      <Route path="/superadmin/*" element={<LegacySuperadminRedirect />} />
      <Route path="/upload/:token" element={<UploadPage />} />
    </Route>
  </>
);
