import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth.api';
import { authService } from '../services/authService';

export const OAuthPostAuthPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const [error, setError] = useState('');

  const errorCode = searchParams.get('error');
  const exchangeToken = searchParams.get('exchangeToken');
  const firmSlug = searchParams.get('firmSlug');

  useEffect(() => {
    const completeGoogleAuth = async () => {
      if (errorCode || !exchangeToken) return;

      try {
        const payload = await authApi.exchangeGoogleAuth({ exchangeToken, firmSlug });
        authService.setSessionTokens(payload);

        const profileResult = await fetchProfile();
        if (profileResult?.success && profileResult.data) {
          navigate(resolvePostAuthRoute(profileResult.data), { replace: true });
          return;
        }

        setError('Google sign-in completed, but we could not load your profile. Please retry login.');
      } catch (_err) {
        setError('Google sign-in failed. Please retry or use xID/password login.');
      }
    };

    completeGoogleAuth();
  }, [errorCode, exchangeToken, firmSlug, fetchProfile, navigate, resolvePostAuthRoute]);

  if (!errorCode && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-blue-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Completing Google sign-in</h1>
          <p className="text-sm text-gray-700">Please wait while we securely sign you in.</p>
        </div>
      </div>
    );
  }

  const loginPath = firmSlug ? `/${firmSlug}/login` : '/';

  const resolvedError = error || (
    errorCode === 'SETUP_TOKEN_INVALID'
      ? 'Your setup token is invalid or expired. Please use the latest invite email from your administrator.'
      : errorCode === 'ACCOUNT_NOT_FOUND'
        ? 'No active account was found for this Google email in the selected workspace.'
        : errorCode === 'GOOGLE_ACCOUNT_MISMATCH'
          ? 'This workspace account is linked to a different Google account.'
          : errorCode === 'FIRM_INACTIVE'
            ? 'This workspace is currently inactive. Please contact your admin.'
            : 'Google sign-in failed. Please retry login. If the issue persists, contact your administrator.'
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Google sign-in failed</h1>
        <p className="text-sm text-gray-700">{resolvedError}</p>
        <Link
          to={loginPath}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Return to login
        </Link>
      </div>
    </div>
  );
};

export default OAuthPostAuthPage;
