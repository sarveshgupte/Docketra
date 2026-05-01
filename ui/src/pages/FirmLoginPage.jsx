import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { validatePassword, validateXID } from '../utils/validators';
import { SESSION_KEYS, STORAGE_KEYS } from '../utils/constants';
import { authService } from '../services/authService';
import { useToast } from '../hooks/useToast';
import { authApi } from '../api/auth.api';
import { toUserFacingError } from '../utils/errorHandling';
import { spacingClasses } from '../theme/tokens';
import { Stack } from '../components/layout/Stack';
import { Row } from '../components/layout/Row';
import { ErrorState } from '../components/feedback/ErrorState';
import { resolvePostAuthNavigation } from '../utils/postAuthNavigation';
import { sanitizeFirmSlug } from '../utils/tenantRouting';
import './LoginPage.css';

const mapSafeLoginError = (error) => {
  const status = error?.status || error?.response?.status;
  if (status === 429) return 'Too many attempts. Please wait before retrying.';
  if (status === 401 || status === 403) return 'Invalid credentials or verification code. Please try again.';
  if (status === 404) return 'Invalid workspace URL';
  if (status === 423) return 'This workspace is inactive. Contact your admin.';
  if (status >= 500) return 'Workspace lookup is temporarily unavailable. Please try again.';
  return 'Sign-in failed. Please review the form and try again.';
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

        if (response.success && response.data?.status === 'active') {
          setFirmData(response.data);
          localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlug);
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
        sessionStorage.setItem(SESSION_KEYS.POST_LOGIN_RETURN_TO, location.search || '');
        setOtp('');
        setStep('otp');
      } else if (response?.accessToken) {
        await completeLogin(response);
      } else {
        setError('Unexpected response. Please try again.');
      }
    } catch (err) {
      const message = toUserFacingError(err, mapSafeLoginError(err));
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

  if (firmLoading) return <div className="auth-wrapper"><Card className="auth-card max-w-form"><Loading message="Loading firm information..." /></Card></div>;

  if (!firmData) {
    return (
      <div className="auth-wrapper">
        <Card className="auth-card max-w-form">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          <div className="mt-4 space-y-3">
            <Button type="button" variant="primary" fullWidth onClick={() => window.location.reload()}>
              Retry Workspace Lookup
            </Button>
            <Link to="/" className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">Back to home</Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <Stack space={12} className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">{firmData.name}</h1>
          <Row justify="center" gap={8}>
            <span className={`h-2.5 w-2.5 rounded-full ${step === 'credentials' ? 'bg-blue-600' : 'bg-blue-200'}`} aria-hidden="true" />
            <span className={`h-2.5 w-2.5 rounded-full ${step === 'otp' ? 'bg-blue-600' : 'bg-blue-200'}`} aria-hidden="true" />
          </Row>
          <p className="text-sm text-gray-500 text-center">Step {step === 'credentials' ? '1' : '2'} of 2</p>
          <p className="text-sm text-gray-500 text-center">{step === 'credentials' ? 'Enter your XID and password' : 'Enter the 6-digit code sent to your email'}</p>
          <p className="text-xs text-gray-500 text-center">{`Firm login URL: /${firmSlug}/login`}</p>
        </Stack>

        {successMessage && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              messageType === 'warning'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : messageType === 'info'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
            role={messageType === 'warning' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {successMessage}
          </div>
        )}

        {error && <ErrorState title="Sign in failed" description={error} />}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentialSubmit} noValidate className={`mt-4 ${spacingClasses.formFieldSpacing}`}>
            <Input label="xID" type="text" value={xid} onChange={(e) => { const value = e.target.value.toUpperCase(); setXid(value); setFieldErrors((prev) => ({ ...prev, xid: value.trim() === '' || validateXID(value.trim()) ? '' : 'Enter a valid xID (example: X123456).' })); }} error={fieldErrors.xid} required placeholder="X123456" autoComplete="username" disabled={loading} autoFocus />
            <Input label="Password" type="password" value={password} onChange={(e) => { const value = e.target.value; setPassword(value); setFieldErrors((prev) => ({ ...prev, password: value.length === 0 || validatePassword(value) ? '' : 'Password must be at least 8 characters.' })); }} error={fieldErrors.password} required placeholder="Enter your password" autoComplete="current-password" disabled={loading} />
            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading || !credentialFormValid}>{loading ? 'Sending OTP...' : 'Next: Verify OTP'}</Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} noValidate className={`mt-4 ${spacingClasses.formFieldSpacing}`}>
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
            {otpHint && <p className="text-xs text-gray-500">{otpHint}</p>}
            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading || !otpFormValid}>{loading ? 'Verifying...' : 'Submit & Sign in'}</Button>
            <Button type="button" variant="outline" fullWidth disabled={loading || cooldown > 0} onClick={handleResendOtp}>
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </Button>
            <Button type="button" variant="outline" fullWidth disabled={loading} onClick={() => setStep('credentials')}>Back</Button>
          </form>
        )}

        <div className={`text-center mt-4 ${spacingClasses.formFieldSpacing}`}>
          <Link to={`/app/${firmSlug}/forgot-password`} className="block text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">Forgot Password?</Link>
          <Link to="/signup" className="block text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">Need a workspace? Create one here.</Link>
        </div>
      </Card>
    </div>
  );
};
