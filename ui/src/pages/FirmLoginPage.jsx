import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { validatePassword, validateXID } from '../utils/validators';
import { STORAGE_KEYS } from '../utils/constants';
import { authService } from '../services/authService';
import { useToast } from '../hooks/useToast';
import { authApi } from '../api/auth.api';
import { toUserFacingError } from '../utils/errorHandling';
import { spacingClasses } from '../theme/tokens';
import './LoginPage.css';

const mapSafeLoginError = (error) => {
  const status = error?.status || error?.response?.status;
  if (status === 429) return 'Too many attempts. Please wait before retrying.';
  if (status === 401 || status === 403) return 'Invalid credentials or verification code';
  if (status === 404) return 'Invalid workspace URL';
  if (status === 423) return 'This workspace is inactive. Contact your admin.';
  if (status >= 500) return 'Workspace lookup is temporarily unavailable. Please try again.';
  return 'Sign-in failed. Please try again.';
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
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const { showError, showSuccess } = useToast();

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

  useEffect(() => {
    const fetchFirmLoginDetailsFromApiPath = async (slug) => {
      const response = await fetch(`/api/${slug}/login`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      const payload = await response.json().catch(() => null);
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

      const payload = await response.json().catch(() => null);
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
          } catch (_sameOriginApiFallbackError) {
            response = await fetchLegacyFirmLoginDetails(firmSlug);
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

    if (firmSlug) loadFirmData();
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

    const profileResult = await fetchProfile();
    if (profileResult?.success) {
      showSuccess('Signed in successfully.');
      navigate(resolvePostAuthRoute(profileResult.data), { replace: true });
    }
  };

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

    setLoading(true);
    try {
      const response = await authApi.loginInit({ firmSlug, xid: normalizedXid, password });
      if (response?.otpRequired && response?.loginToken) {
        setLoginToken(response.loginToken);
        setOtpHint(response?.otpDeliveryHint || 'A verification code was sent to your email.');
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
      const response = await authApi.loginVerify({ firmSlug, loginToken, otp: otp.trim() });
      await completeLogin(response);
    } catch (err) {
      const status = err?.status;
      const message = status === 400 || status === 401 ? 'Invalid or expired OTP' : toUserFacingError(err, mapSafeLoginError(err));
      setError(message);
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
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">{firmData.name}</h1>
          <p className="mt-2 text-sm text-gray-500 text-center">Step {step === 'credentials' ? '1' : '2'} of 2</p>
          <p className="mt-2 text-sm text-gray-500 text-center">{step === 'credentials' ? 'Enter your XID and password' : 'Enter the 6-digit code sent to your email'}</p>
          <p className="mt-2 text-xs text-gray-500 text-center">{`Firm login URL: /${firmSlug}/login`}</p>
        </div>

        {error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentialSubmit} noValidate className={`mt-4 ${spacingClasses.formFieldSpacing}`}>
            <Input label="xID" type="text" value={xid} onChange={(e) => setXid(e.target.value)} error={fieldErrors.xid} required placeholder="X123456" autoComplete="username" disabled={loading} autoFocus />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password} required placeholder="Enter your password" autoComplete="current-password" disabled={loading} />
            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>{loading ? 'Sending OTP...' : 'Continue'}</Button>
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
            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>{loading ? 'Verifying...' : 'Verify OTP'}</Button>
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
