import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth.api';
import { authService } from '../services/authService';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';


export const OAuthPostAuthPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const [error, setError] = useState('');

  const errorCode = searchParams.get('error');
  const exchangeToken = searchParams.get('exchangeToken');
  const firmSlug = searchParams.get('firmSlug');

  const initiatedRef = React.useRef(false);

  useEffect(() => {
    if (errorCode || !exchangeToken) return;
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    const completeGoogleAuth = async () => {
      try {
        const payload = await authApi.exchangeGoogleAuth({ exchangeToken, firmSlug });
        authService.setSessionTokens(payload);

        // CRITICAL FIX: Use force:true to bypass the single-attempt guard.
        // The AuthProvider boot effect already called fetchProfile() which failed
        // with 401 (no session yet) and set authFailureResolvedRef=true.
        // Without force:true, the subsequent fetchProfile() call returns
        // {success:false} immediately without hitting the network.
        const profileResult = await fetchProfile({ force: true });
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

  const loginPath = firmSlug ? `/${firmSlug}/login` : '/';

  const primaryAdminEmail = searchParams.get('primaryAdminEmail') || '';

  const resolvedError = error || (
    errorCode === 'SETUP_TOKEN_INVALID'
      ? 'Your setup token is invalid or expired. Please use the latest invite email from your administrator.'
      : errorCode === 'ACCOUNT_NOT_FOUND'
        ? 'No active account was found for this Google email in the selected workspace.'
        : errorCode === 'GOOGLE_ACCOUNT_MISMATCH'
          ? 'This workspace account is linked to a different Google account.'
          : errorCode === 'FIRM_INACTIVE'
            ? 'This workspace is currently inactive. Please contact your admin.'
            : errorCode === 'ACCOUNT_LOCKED_BY_ADMIN'
              ? `This user has been locked by primary admin. Please contact your primary admin at ${primaryAdminEmail || 'their email'}.`
              : 'Google sign-in failed. Please retry login. If the issue persists, contact your administrator.'
  );

  if (!errorCode && !error) {
    return (
      <div className="find-workspace-page auth-public-page">
        <div className="find-workspace-page__shell">
          <Card className="find-workspace-page__card auth-public-page__card">
            <Loading message="Completing Google sign-in..." />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="find-workspace-page auth-public-page">
      <div className="find-workspace-page__shell">
        <section className="find-workspace-page__context" aria-label="Google authentication status">
          <p className="find-workspace-page__eyebrow">Authentication status</p>
          <h1 className="find-workspace-page__heading">Google Sign-in Failed</h1>
          <p className="find-workspace-page__intro">
            An issue occurred while completing your Google authentication flow.
          </p>
        </section>

        <Card className="find-workspace-page__card auth-public-page__card">
          <div className="find-workspace-page__card-header">
            <h2>Authentication Error</h2>
            <p>Please review the details below.</p>
          </div>

          <div className="auth-public-page__error" role="alert" style={{ marginBottom: '1.5rem' }}>
            {resolvedError}
          </div>

          <div className="mt-4 space-y-3">
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={() => navigate(loginPath)}
            >
              Return to login
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OAuthPostAuthPage;
