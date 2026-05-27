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

  const [xid, setXid] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loginToken, setLoginToken] = useState('');
  const [step, setStep] = useState('credentials');
  const [otpHint, setOtpHint] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [firmLoading, setFirmLoading] = useState(true);
  const [firmData, setFirmData] = useState(null);
  const [cooldown, setCooldown] = useState(30);
  const otpInputRef = useRef(null);
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
    showSuccess('✅ Signed in successfully. Redirecting to your workspace.');
    navigate(nextRoute, { replace: true });
  };

  const handleGoogleLogin = () => {
    const params = new URLSearchParams({
      intent: 'login',
      firmSlug: firmSlug || '',
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
      const response = await authApi.loginVerify({ firmSlug, loginToken: tokenForVerification, otp: otp.trim() });
      await completeLogin(response);
    } catch (err) {
      const status = err?.status;
      const message = status === 400 || status === 401 ? 'Invalid or expired OTP. Request a new code and try again.' : toUserFacingError(err, mapSafeLoginError(err));
      setError(message);
      if (status === 401) {
        clearPendingLoginState();
        setStep('credentials');
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

  if (firmLoading) return <div className="find-workspace-page auth-public-page"><div className="find-workspace-page__shell"><Card className="find-workspace-page__card auth-public-page__card"><Loading message="Loading firm information..." /></Card></div></div>;

  if (!firmData) {
    return (
      <div className="find-workspace-page auth-public-page">
        <div className="find-workspace-page__shell">
          <Card className="find-workspace-page__card auth-public-page__card">
            <div className="auth-public-page__error">{error}</div>
            <div className="mt-4 space-y-3">
              <Button type="button" variant="primary" fullWidth onClick={() => window.location.reload()}>
                Retry Workspace Lookup
              </Button>
              <Link to="/" className="auth-public-page__link auth-public-page__link--center">Back to home</Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="find-workspace-page auth-public-page">
      <div className="find-workspace-page__shell">
        <section className="find-workspace-page__context" aria-label="Firm login context">
          <p className="find-workspace-page__eyebrow">Workspace login</p>
          <h1 className="find-workspace-page__heading">{firmData.name}</h1>
          <p className="find-workspace-page__intro">
            {step === 'credentials' ? 'Secure cloud workspace sign in.' : 'Enter the 6-digit verification code sent to your email.'}
          </p>
          <ul className="find-workspace-page__benefits">
            <li>Step {step === 'credentials' ? '1' : '2'} of 2</li>
            <li>Firm URL: /{firmSlug}/login</li>
            <li>Only authenticated users can access workspace data</li>
          </ul>
        </section>

        <Card className="find-workspace-page__card auth-public-page__card">
          <div className="find-workspace-page__card-header">
            <h2>{step === 'credentials' ? 'Enter your credentials' : 'Verify your email OTP'}</h2>
            <p>{step === 'credentials' ? 'Use your xID and password.' : 'Use the latest code from your email.'}</p>
          </div>

          {successMessage && step === 'credentials' && (
            <div
              className={`auth-public-page__status ${
                messageType === 'warning'
                  ? 'auth-public-page__status--warning'
                  : messageType === 'info'
                    ? 'auth-public-page__status--info'
                    : 'auth-public-page__status--success'
              }`}
              role={messageType === 'warning' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {successMessage}
            </div>
          )}

          {error && <div className="auth-public-page__error" role="alert">{error}</div>}

          {step === 'credentials' ? (
            <>
              <div className="google-container mt-2">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  disabled={loading}
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                    <g transform="matrix(1, 0, 0, 1, 0, 0)">
                      <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.6h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.4c0,-0.74 -0.07,-1.4 -0.33,-2z" fill="#4285F4" />
                      <path d="M12,20.6c2.43,0 4.47,-0.8 5.96,-2.2l-3.3,-2.6c-0.9,0.6 -2.07,0.98 -3.3,0.98 -2.34,0 -4.33,-1.58 -5.04,-3.7H3v2.6c1.5,3 4.5,4.92 8,4.92z" fill="#34A853" />
                      <path d="M6.96,13.08a5.1,5.1 0 0,1 0,-2.16V8.32H3a8.6,8.6 0 0,0 0,7.36l3.96,-2.6z" fill="#FBBC05" />
                      <path d="M12,7.2c1.32,0 2.5,0.45 3.44,1.35l2.58,-2.58C16.46,4.4 14.43,3.6 12,3.6c-3.5,0 -6.5,1.92 -8,4.92l3.96,3.08c0.71,-2.12 2.7,-3.7 5.04,-3.7z" fill="#EA4335" />
                    </g>
                  </svg>
                  Continue with Google
                </Button>
              </div>
              
              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={handleCredentialSubmit} noValidate className={`find-workspace-page__form ${spacingClasses.formFieldSpacing}`}>
                <Input label="xID" type="text" value={xid} onChange={(e) => { const value = e.target.value.toUpperCase(); setXid(value); setFieldErrors((prev) => ({ ...prev, xid: value.trim() === '' || validateXID(value.trim()) ? '' : 'Enter a valid xID (example: X123456).' })); }} error={fieldErrors.xid} required placeholder="X123456" autoComplete="username" disabled={loading} autoFocus />
                <Input label="Password" type="password" value={password} onChange={(e) => { const value = e.target.value; setPassword(value); setFieldErrors((prev) => ({ ...prev, password: value.length === 0 || validatePassword(value) ? '' : 'Password must be at least 8 characters.' })); }} error={fieldErrors.password} required placeholder="Enter your password" autoComplete="current-password" disabled={loading} />
                <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading || !credentialFormValid}>{loading ? 'Sending OTP...' : 'Next: Verify OTP'}</Button>
              </form>
            </>
          ) : (
            <form onSubmit={handleOtpSubmit} noValidate className={`find-workspace-page__form ${spacingClasses.formFieldSpacing}`}>
            <Input
              ref={otpInputRef}
              label="Email OTP"
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
            {otpHint && <p className="find-workspace-page__security-note">{otpHint}</p>}
            <p className="find-workspace-page__security-note">Tip: You can paste the full OTP directly.</p>
            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading || !otpFormValid}>{loading ? 'Verifying...' : 'Submit & Sign in'}</Button>
            <Button type="button" variant="outline" fullWidth disabled={loading || cooldown > 0} onClick={handleResendOtp}>
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
            >
              Back
            </Button>
            </form>
          )}

          <div className={`auth-public-page__links ${spacingClasses.formFieldSpacing}`}>
            <Link to={`/app/${firmSlug}/forgot-password`} className="auth-public-page__link">Forgot Password?</Link>
            <Link to="/signup" className="auth-public-page__link">Need a workspace? Create one here.</Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
