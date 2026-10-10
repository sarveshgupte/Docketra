import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth.api';
import { authService } from '../services/authService';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';

const getWorkspaceSlugPreview = (firmName) => {
  const slug = String(firmName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'your-firm';
};

export const OAuthPostAuthPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const [error, setError] = useState('');

  const errorCode = searchParams.get('error');
  const exchangeToken = searchParams.get('exchangeToken');
  const firmSlug = searchParams.get('firmSlug');
  const mode = searchParams.get('mode');
  const googlePendingToken = searchParams.get('googlePendingToken');
  const pendingName = searchParams.get('name') || '';
  const pendingEmail = searchParams.get('email') || '';

  // Pending signup form state
  const [firmName, setFirmName] = useState('');
  const [phone, setPhone] = useState('');
  const [agreedToPilotTerms, setAgreedToPilotTerms] = useState(true);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const initiatedRef = React.useRef(false);

  useEffect(() => {
    if (mode === 'signup_pending') return;
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
  }, [errorCode, exchangeToken, firmSlug, mode, fetchProfile, navigate, resolvePostAuthRoute]);

  const handleCompleteGoogleSignup = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!firmName.trim()) {
      setFormError('Firm name is required');
      return;
    }
    if (!agreedToPilotTerms) {
      setFormError('You must agree to the Docketra Pilot Evaluation Terms to proceed.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const response = await authApi.completeGoogleSignup({
        googlePendingToken,
        firmName: firmName.trim(),
        phone: phone.trim(),
        agreedToPilotTerms: true,
      });

      const responseData = response?.data || {};
      const newExchangeToken = responseData?.exchangeToken;
      const newFirmSlug = responseData?.firmSlug;

      if (newExchangeToken) {
        const payload = await authApi.exchangeGoogleAuth({ exchangeToken: newExchangeToken, firmSlug: newFirmSlug });
        authService.setSessionTokens(payload);
        const profileResult = await fetchProfile({ force: true });
        if (profileResult?.success && profileResult.data) {
          navigate(resolvePostAuthRoute(profileResult.data), { replace: true });
          return;
        }
      }

      if (newFirmSlug) {
        navigate(`/${newFirmSlug}/login`, { replace: true });
        return;
      }

      navigate('/', { replace: true });
    } catch (err) {
      setFormError(err?.message || 'Unable to create workspace. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

  // If in pending signup mode, render workspace creation form
  if (mode === 'signup_pending' && googlePendingToken) {
    return (
      <div className="find-workspace-page auth-public-page">
        <div className="find-workspace-page__shell">
          <section className="find-workspace-page__context" aria-label="Google workspace setup">
            <p className="find-workspace-page__eyebrow">Docketra · Secure workspace setup</p>
            <h1 className="find-workspace-page__heading">Name your workspace</h1>
            <p className="find-workspace-page__intro">
              Welcome{pendingName ? `, ${pendingName}` : ''}! You are authenticating with Google ({pendingEmail}). Enter your firm name to activate your command center.
            </p>
          </section>

          <Card className="find-workspace-page__card auth-public-page__card">
            <div className="find-workspace-page__card-header">
              <h2>Firm Details</h2>
              <p>Your firm name generates your permanent workspace URL.</p>
            </div>

            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 flex items-center justify-between">
              <span className="font-semibold text-slate-900">Signed in as:</span>
              <span className="font-mono text-slate-800">{pendingEmail}</span>
            </div>

            {formError && (
              <div className="auth-public-page__error mb-4" role="alert">
                {formError}
              </div>
            )}

            <form onSubmit={handleCompleteGoogleSignup} noValidate className="space-y-4">
              <div>
                <Input
                  id="google-signup-firm"
                  type="text"
                  label="Firm Name *"
                  placeholder="e.g. Apex Legal & Associates"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  disabled={submitting}
                  required
                  autoFocus
                />
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                <span className="font-bold uppercase tracking-wider text-sky-700 text-[10px] block">Workspace URL Preview</span>
                <span className="font-mono font-bold text-sky-950 mt-1 block">
                  docketra.in/{getWorkspaceSlugPreview(firmName)}
                </span>
              </div>

              <div>
                <Input
                  id="google-signup-phone"
                  type="text"
                  label="Phone Number (optional)"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  disabled={submitting}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={submitting || !firmName.trim()}
                  loading={submitting}
                >
                  {submitting ? 'Creating workspace...' : 'Create & launch workspace'}
                </Button>
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  disabled={submitting}
                  onClick={() => navigate('/signup')}
                >
                  Back to signup
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    );
  }

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
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => navigate('/signup')}
            >
              Return to signup
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OAuthPostAuthPage;
