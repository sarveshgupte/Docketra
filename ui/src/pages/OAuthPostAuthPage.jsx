import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export const OAuthPostAuthPage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search || '');
  const errorCode = searchParams.get('error');
  const firmSlug = searchParams.get('firmSlug');

  if (!errorCode) {
    if (firmSlug) {
      return <Navigate to={`/${firmSlug}/login`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  if (errorCode === 'PASSWORD_SETUP_REQUIRED') {
    const loginPath = firmSlug ? `/${firmSlug}/login` : '/';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Password setup required</h1>
          <p className="text-sm text-gray-700 leading-6">
            Your Google account is verified, but this account still requires initial password setup.
            Please complete setup from your invite email and then sign in again.
          </p>
          <a
            href={loginPath}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Return to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Google sign-in failed</h1>
        <p className="text-sm text-gray-700">Please retry login. If the issue persists, contact your administrator.</p>
      </div>
    </div>
  );
};

export default OAuthPostAuthPage;
