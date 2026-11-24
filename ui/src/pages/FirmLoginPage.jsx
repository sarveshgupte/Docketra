import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { validatePassword, validateXID } from '../utils/validators';
import { SESSION_KEYS, STORAGE_KEYS, API_BASE_URL } from '../utils/constants';
import { authService } from '../services/authService';
import { useToast } from '../hooks/useToast';
import { authApi } from '../api/auth.api';
import { toUserFacingError } from '../utils/errorHandling';
import { spacingClasses } from '../theme/tokens';
import { resolvePostAuthNavigation } from '../utils/postAuthNavigation';
import { sanitizeFirmSlug } from '../utils/tenantRouting';
import { isWorkspaceActive } from '../utils/workspaceStatus';
import SeoHead from '../components/common/SeoHead';
import { DocketraLogo } from '../components/common/DocketraLogo';

const mapSafeLoginError = (error) => {
  const status = error?.status || error?.response?.status;
  if (status === 429) return 'Too many attempts. Please wait before retrying.';
  if (status === 401 || status === 403) return 'Invalid credentials or verification code. Please try again.';
  if (status === 404) return 'Invalid workspace URL';
  if (status === 423) return 'This workspace is inactive. Contact your admin.';
  if (status >= 500) return 'Workspace lookup is temporarily unavailable. Please try again.';
  return 'Sign-in failed. Please review the form and try again.';
};

const resolveCredentialErrorMessage = (error) => {
  const backendMessage = String(
    error?.data?.message
    || error?.response?.data?.message
    || error?.message
    || '',
  ).trim().toLowerCase();

  if (backendMessage.includes('wrong password') || backendMessage.includes('incorrect password')) {
    return 'Wrong password.';
  }
  if (backendMessage.includes('invalid xid or password') || backendMessage.includes('invalid credentials')) {
    return 'Invalid xID or password.';
  }
  if (backendMessage.includes('locked by primary admin') || error?.response?.data?.code === 'ACCOUNT_LOCKED_BY_ADMIN') {
    return error?.response?.data?.message || 'This user has been locked by primary admin. Please contact your primary admin.';
  }

  return toUserFacingError(error, mapSafeLoginError(error));
};

const getWorkspaceStatusMessage = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'pending_setup') {
    return 'Workspace setup is not complete yet. Please finish account setup from your invitation email.';
  }
  if (normalized === 'inactive' || normalized === 'suspended') {
    return 'This workspace is inactive. Contact your admin.';
  }
  return 'Invalid workspace URL';
};

export const FirmLoginPage = () => {
  const { firmSlug: rawFirmSlug } = useParams();
  const firmSlug = sanitizeFirmSlug(rawFirmSlug);
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const { showError, showSuccess } = useToast();

  const successMessage = location.state?.message;
  const messageType = location.state?.messageType;
  const isPasswordResetSuccess = successMessage === 'Password reset successfully. Please sign in with your new password.';

  const [xid, setXid] = useState(() => {
    if (location.state?.xid) return location.state.xid;
    try {
      return sessionStorage.getItem('docketra_last_xid') || '';
    } catch (_) {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loginToken, setLoginToken] = useState('');
  const [step, setStep] = useState('credentials');

  useEffect(() => {
    if (location.state?.xid && !xid) {
      setXid(location.state.xid);
    }
  }, [location.state?.xid]);
  const [otpHint, setOtpHint] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [firmLoading, setFirmLoading] = useState(true);
  const [firmData, setFirmData] = useState(null);
  const [cooldown, setCooldown] = useState(30);
  const otpInputRef = useRef(null);
  const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const isTurnstileConfigured = Boolean(turnstileSiteKey);
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);
  const turnstileTokenRef = useRef('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const clearPendingLoginState = () => {
    sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);
    sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_FIRM);
    sessionStorage.removeItem(SESSION_KEYS.POST_LOGIN_RETURN_TO);
  };

  useEffect(() => {
    if (!firmSlug) {
      setFirmLoading(false);
      setFirmData(null);
      setError('Invalid workspace URL');
      clearPendingLoginState();
      return undefined;
    }

    const fetchFirmLoginDetailsFromApiPath = async (slug) => {
      const response = await fetch(`/api/${slug}/login`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;
      if (!response.ok || !payload?.success) {
        const error = new Error(payload?.message || 'Workspace lookup failed');
        error.status = response.status;
        throw error;
      }

      return payload;
    };

    const fetchLegacyFirmLoginDetails = async (slug) => {
      const response = await fetch(`/${slug}/login`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;
      if (!response.ok || !payload?.success) {
        const error = new Error(payload?.message || 'Workspace lookup failed');
        error.status = response.status;
        throw error;
      }

      return payload;
    };

    const loadFirmData = async () => {
      try {
        setFirmLoading(true);
        let response = null;
        try {
          response = await authApi.getFirmLoginDetails(firmSlug);
        } catch (primaryLookupError) {
          try {
            response = await fetchFirmLoginDetailsFromApiPath(firmSlug);
          } catch (sameOriginApiFallbackError) {
            try {
              response = await authApi.getFirmPublicDetails(firmSlug);
            } catch (_publicLookupError) {
              response = await fetchLegacyFirmLoginDetails(firmSlug);
            }
            if (import.meta.env.DEV) {
              // Keep fallback instrumentation in development only.
              // eslint-disable-next-line no-console
              console.info('[FirmLoginPage] Same-origin API lookup failed', {
                firmSlug,
                status: sameOriginApiFallbackError?.status || null,
              });
            }
          }
          if (import.meta.env.DEV) {
            // Keep fallback instrumentation in development only.
            // eslint-disable-next-line no-console
            console.info('[FirmLoginPage] Fallback workspace lookup used', {
              firmSlug,
              status: primaryLookupError?.status || primaryLookupError?.response?.status || null,
            });
          }
        }

        if (response.success && isWorkspaceActive(response.data)) {
          setFirmData(response.data);
        } else {
          setError(getWorkspaceStatusMessage(response?.data?.status));
          setFirmData(null);
        }
      } catch (err) {
        setError(mapSafeLoginError(err));
        setFirmData(null);
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      } finally {
        setFirmLoading(false);
      }
    };

    loadFirmData();
  }, [firmSlug]);

  const clearRecoveryAndOtpState = React.useCallback(() => {
    clearPendingLoginState();
    setLoginToken('');
    setOtp('');
    setOtpHint('');
    setCooldown(0);
    setFieldErrors({});
    setError('');
    setStep('credentials');
  }, []);

  useEffect(() => {
    if (isPasswordResetSuccess) {
      clearRecoveryAndOtpState();
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [clearRecoveryAndOtpState, isPasswordResetSuccess, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (step === 'otp') {
      otpInputRef.current?.focus();
      setCooldown(30);
    }
    setError('');
    setFieldErrors({});
  }, [step]);

  useEffect(() => {
    if (step !== 'otp' || cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, cooldown]);

  useEffect(() => {
    if (step === 'otp' && !loginToken) {
      setStep('credentials');
    }
  }, [step, loginToken]);

  useEffect(() => {
    if (!isTurnstileConfigured || step !== 'otp') return undefined;
    const existingScript = document.querySelector('script[data-turnstile-script="true"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = 'true';
      document.body.appendChild(script);
    }
    const renderWidget = () => {
      if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        size: 'invisible',
        callback: (token) => {
          const nextToken = String(token || '');
          setTurnstileToken(nextToken);
          turnstileTokenRef.current = nextToken;
        },
        'expired-callback': () => {
          setTurnstileToken('');
          turnstileTokenRef.current = '';
        },
        'error-callback': () => {
          setTurnstileToken('');
          turnstileTokenRef.current = '';
        },
      });
    };
    renderWidget();
    const timer = window.setInterval(renderWidget, 250);
    return () => window.clearInterval(timer);
  }, [isTurnstileConfigured, step, turnstileSiteKey]);

  const getEffectiveTurnstileToken = React.useCallback(() => {
    const refToken = String(turnstileTokenRef.current || '').trim();
    if (refToken) return refToken;
    const stateToken = String(turnstileToken || '').trim();
    if (stateToken) return stateToken;
    const widgetId = turnstileWidgetIdRef.current;
    return widgetId != null && window.turnstile?.getResponse
      ? String(window.turnstile.getResponse(widgetId) || '').trim()
      : '';
  }, [turnstileToken]);


  const completeLogin = async (responseData) => {
    authService.setSessionTokens(responseData);

    const profileResult = await fetchProfile({ force: true });
    if (!profileResult?.success || !profileResult?.data) {
      throw new Error('Login succeeded, but your session could not be established. Please refresh and sign in again.');
    }

    const nextRoute = resolvePostAuthNavigation({
      locationSearch: location.search,
      user: profileResult.data,
      resolvePostAuthRoute,
    });

    if (!nextRoute || nextRoute === '/') {
      throw new Error('Your session loaded, but no workspace route is available. Please contact your admin.');
    }

    clearPendingLoginState();
    showSuccess('Signed in successfully. Redirecting to your workspace.');
    navigate(nextRoute, { replace: true });
  };

  const handleGoogleLogin = () => {
    const params = new URLSearchParams({
      intent: 'login',
      firmSlug: firmSlug || '',
      returnTo: window.location.origin,
    });

    const targetUrl = new URL(`${API_BASE_URL}/auth/google/start?${params.toString()}`, window.location.origin).toString();
    window.location.assign(targetUrl);
  };

  const credentialFormValid = validateXID(xid.trim().toUpperCase()) && validatePassword(password);
  const otpFormValid = /^\d{6}$/.test(otp.trim());

  const handleCredentialSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setFieldErrors({});

    const normalizedXid = xid.trim().toUpperCase();
    if (!validateXID(normalizedXid)) {
      setFieldErrors({ xid: 'Enter a valid xID (example: X123456).' });
      return;
    }
    if (!validatePassword(password)) {
      setFieldErrors({ password: 'Password must be at least 8 characters.' });
      return;
    }

    clearPendingLoginState();
    setLoading(true);
    try {
      const response = await authApi.loginInit({ firmSlug, xid: normalizedXid, password });
      if (response?.otpRequired && response?.loginToken) {
        setLoginToken(response.loginToken);
        setOtpHint(response?.otpDeliveryHint || 'A verification code was sent to your email.');
        sessionStorage.setItem(SESSION_KEYS.PENDING_LOGIN_TOKEN, response.loginToken);
        sessionStorage.setItem(SESSION_KEYS.PENDING_LOGIN_FIRM, firmSlug || '');
        setOtp('');
        setStep('otp');
      } else if (response?.accessToken) {
        await completeLogin(response);
      } else {
        setError('Unexpected response. Please try again.');
      }
    } catch (err) {
      const message = resolveCredentialErrorMessage(err);
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setFieldErrors({});
    if (!/^\d{6}$/.test(otp.trim())) {
      setFieldErrors({ otp: 'Enter a valid 6-digit OTP.' });
      return;
    }

    let effectiveTurnstileToken = isTurnstileConfigured ? getEffectiveTurnstileToken() : '';
    if (isTurnstileConfigured && !effectiveTurnstileToken) {
      if (turnstileWidgetIdRef.current != null && window.turnstile?.execute) {
        try { window.turnstile.execute(turnstileWidgetIdRef.current); } catch (_) {}
      }
      effectiveTurnstileToken = getEffectiveTurnstileToken();
    }

    setLoading(true);
    try {
      const pendingFirm = sanitizeFirmSlug(sessionStorage.getItem(SESSION_KEYS.PENDING_LOGIN_FIRM));
      const pendingToken = sessionStorage.getItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);
      const tokenForVerification = pendingFirm && pendingFirm === firmSlug ? pendingToken : loginToken;
      if (!tokenForVerification) {
        clearPendingLoginState();
        setStep('credentials');
        setError('Your login verification session expired. Please sign in again.');
        return;
      }
      if (pendingFirm && pendingFirm !== firmSlug) {
        clearPendingLoginState();
        setStep('credentials');
        setError('Workspace changed during verification. Please sign in again.');
        return;
      }
      const response = await authApi.loginVerify({ 
        firmSlug, 
        loginToken: tokenForVerification, 
        otp: otp.trim(),
        turnstileToken: isTurnstileConfigured ? effectiveTurnstileToken : undefined
      });
      await completeLogin(response);
    } catch (err) {
      const status = err?.status;
      const message = status === 400 || status === 401 ? 'Invalid or expired OTP. Request a new code and try again.' : toUserFacingError(err, mapSafeLoginError(err));
      setError(message);
      if (status === 401) {
        clearPendingLoginState();
        setStep('credentials');
      }
      if (isTurnstileConfigured) {
        if (turnstileWidgetIdRef.current != null && window.turnstile?.reset) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
        setTurnstileToken('');
        turnstileTokenRef.current = '';
      }
      showError(message);
    } finally {
      setLoading(false);
    }
  };


  const handleResendOtp = async () => {
    if (loading || cooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      const response = await authApi.loginResendOtp({ firmSlug, loginToken });
      setOtpHint(response?.message || 'If the account exists, a new OTP has been sent.');
      setOtp('');
      setCooldown(30);
    } catch (err) {
      const message = toUserFacingError(err, mapSafeLoginError(err));
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  if (firmLoading) return (
    <div className="min-h-screen flex flex-col bg-slate-50/70">
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <DocketraLogo />
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xl shadow-slate-900/[0.03] text-center">
          <Loading message="Loading firm workspace..." />
        </div>
      </main>
    </div>
  );

  if (!firmData) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50/70">
        <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <DocketraLogo />
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xl shadow-slate-900/[0.03] text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 border border-rose-100 text-rose-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Workspace needs a second look</h2>
            <p className="mt-2 text-xs text-slate-500">
              We could not open this firm login page yet.
            </p>
            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700" role="alert">
                {error}
              </div>
            )}
            <div className="mt-6 space-y-2.5">
              <Button type="button" variant="primary" fullWidth onClick={() => window.location.reload()} className="h-10 rounded-xl">
                Retry Workspace Lookup
              </Button>
              <Link to="/find-workspace" className="block text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1 transition-colors">
                Find another workspace
              </Link>
              <Link to="/" className="block text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors">
                Back to home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-wrapper min-h-screen flex flex-col bg-gradient-to-b from-slate-50/80 via-white to-slate-50/80 text-slate-900 selection:bg-indigo-500/20">
      <SeoHead
        title={`${firmData.name || 'Firm'} • Sign In • DocketsHQ`}
        description={`Secure sign-in for ${firmData.name || 'your firm'} workspace on DocketsHQ.`}
      />

      {/* Top Navbar Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-100/80 sm:border-none">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <DocketraLogo />
        </Link>
      </header>

      {/* Main Centered Sign-In Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 w-full max-w-md mx-auto">
        {/* Workspace Identity Monogram & Headline */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-indigo-200/70 text-indigo-700 font-extrabold text-xl shadow-xs ring-4 ring-white">
            {firmData.name ? firmData.name.charAt(0).toUpperCase() : 'W'}
          </div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900">
            {step === 'credentials' ? `Sign in to ${firmData.name}` : 'Verify your email OTP'}
          </h1>
          <div className="mt-2 flex items-center justify-center">
            {step === 'credentials' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Verified Workspace • {typeof window !== 'undefined' ? window.location.host : 'docketshq.com'}/{firmSlug}
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                {otpHint || 'Enter the 6-digit code sent to your registered email.'}
              </span>
            )}
          </div>
        </div>

        {/* The Card */}
        <div className="auth-card w-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-slate-900/[0.04]">
          {successMessage && step === 'credentials' && (
            <div
              className={`mb-4 rounded-xl p-3 text-xs font-medium border ${
                messageType === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : messageType === 'info'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
              role={messageType === 'warning' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 flex items-start gap-2" role="alert">
              <svg className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {step === 'credentials' ? (
            <>
              {/* Google SSO Button */}
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="w-full h-11 flex items-center justify-center gap-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-semibold text-sm transition-all shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Hairline Divider */}
              <div className="relative flex items-center justify-center my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200/90" />
                </div>
                <span className="relative bg-white px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  or sign in with xID
                </span>
              </div>

              {/* Credential Form */}
              <form onSubmit={handleCredentialSubmit} noValidate className="space-y-4">
                <Input
                  label="Firm xID"
                  type="text"
                  value={xid}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setXid(value);
                    setFieldErrors((prev) => ({
                      ...prev,
                      xid: value.trim() === '' || validateXID(value.trim()) ? '' : 'Enter a valid xID (example: X123456).',
                    }));
                  }}
                  error={fieldErrors.xid}
                  required
                  placeholder="X123456"
                  autoComplete="username"
                  disabled={loading}
                  autoFocus
                />

                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);
                    setFieldErrors((prev) => ({
                      ...prev,
                      password: value.length === 0 || validatePassword(value) ? '' : 'Password must be at least 8 characters.',
                    }));
                  }}
                  error={fieldErrors.password}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                />

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={loading}
                  disabled={loading || !credentialFormValid}
                  className="h-11 rounded-xl text-sm font-semibold shadow-sm bg-slate-900 hover:bg-slate-800 text-white transition-all mt-2"
                >
                  {loading ? 'Sending OTP...' : 'Next: Verify OTP'}
                </Button>
              </form>
            </>
          ) : (
            <form onSubmit={handleOtpSubmit} noValidate className="space-y-4">
              <Input
                ref={otpInputRef}
                label="6-Digit Verification Code"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                  if (pasted.length === 6) {
                    e.preventDefault();
                    setOtp(pasted);
                  }
                }}
                error={fieldErrors.otp}
                required
                placeholder="6-digit code"
                disabled={loading}
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
              />

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center space-y-1">
                {otpHint && <p className="text-xs text-slate-600 font-medium">{otpHint}</p>}
                <p className="text-[11px] text-slate-400">Tip: You can paste the full OTP directly.</p>
              </div>

              {isTurnstileConfigured && <div ref={turnstileContainerRef} style={{ display: 'none' }} />}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
                disabled={loading || !otpFormValid}
                className="h-11 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
              >
                {loading ? 'Verifying...' : 'Submit & Sign in'}
              </Button>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  disabled={loading || cooldown > 0}
                  onClick={handleResendOtp}
                  className="text-xs h-9 rounded-lg"
                >
                  {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  disabled={loading}
                  onClick={() => {
                    clearPendingLoginState();
                    setLoginToken('');
                    clearRecoveryAndOtpState();
                  }}
                  className="text-xs h-9 rounded-lg text-slate-600"
                >
                  Back
                </Button>
              </div>
            </form>
          )}

          {/* Links Row */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              to={`/app/${firmSlug}/forgot-password`}
              className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              Forgot Password?
            </Link>
            <Link
              to="/find-workspace"
              className="text-slate-500 hover:text-slate-800 font-medium transition-colors"
            >
              Switch Workspace
            </Link>
          </div>
        </div>

        {/* HubSpot-style Trust Callout Banner */}
        <div className="w-full mt-4 rounded-xl border border-slate-200/70 bg-white/70 backdrop-blur-xs px-4 py-3 text-center shadow-xs">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-800">
            <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Private Google Drive Storage</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Client files are stored directly in your firm&apos;s Google Drive.
          </p>
        </div>
      </main>

      {/* Slack / HubSpot Style Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-400 border-t border-slate-200/60 mt-auto">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-1.5 text-[11px]">
          <Link to="/security" className="hover:text-slate-600 transition-colors">Security Overview</Link>
          <span>•</span>
          <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
          <span>•</span>
          <a href="mailto:support@docketra.in" className="hover:text-slate-600 transition-colors">Contact Support</a>
        </div>
        <p className="text-[11px]">© {new Date().getFullYear()} DocketsHQ. The Company Brain for Professional Practices.</p>
      </footer>
    </div>
  );
};
