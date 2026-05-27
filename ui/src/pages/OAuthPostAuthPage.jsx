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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Soft background glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 shadow-2xl text-center relative z-10">
          <div className="flex justify-center mb-6">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-400">
              <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Completing Sign-in</h1>
          <p className="text-sm text-slate-300">Establishing your secure Google session. Please wait...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Soft background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
      
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 shadow-2xl relative z-10">
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 text-red-400">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-xl font-bold text-white text-center mb-3">Google Sign-in Failed</h1>
        <p className="text-sm text-slate-300 text-center leading-relaxed mb-8">{resolvedError}</p>
        
        <Link
          to={loginPath}
          className="w-full flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:shadow-indigo-500/30 transition-all duration-200"
        >
          Return to login
        </Link>
      </div>
    </div>
  );
};

export default OAuthPostAuthPage;
