/**
 * Firm Login Page
 * Firm-scoped login using path-based URL: /:firmSlug/login
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { validateEmail, validatePassword, validateXID } from '../utils/validators';
import { ERROR_CODES, STORAGE_KEYS } from '../utils/constants';
import { isAccessTokenOnlyUser } from '../utils/authUtils';
import { resolveFirmLoginResponseState } from '../utils/firmLoginResponse';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
import GoogleSignIn from '../components/auth/GoogleSignIn';
import './LoginPage.css';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = import.meta.env.PROD ? 30 : 3;
const RESEND_CREDENTIALS_SUCCESS_MESSAGE = 'Credentials email sent. Please check your inbox.';

const resolveResendCooldownSeconds = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : RESEND_COOLDOWN_SECONDS;
};

export const FirmLoginPage = () => {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const { fetchProfile } = useAuth();
  const { showError, showSuccess } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loginToken, setLoginToken] = useState('');
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [showResendForm, setShowResendForm] = useState(false);
  const [firmLoading, setFirmLoading] = useState(true);
  const [firmData, setFirmData] = useState(null);

  const completeLogin = async (responseData) => {
    const { accessToken, refreshToken, data: userData, refreshEnabled } = responseData;

    const userWithFlags = {
      ...userData,
      refreshEnabled: refreshEnabled !== undefined ? refreshEnabled : userData?.refreshEnabled,
      isSuperAdmin: responseData.isSuperAdmin !== undefined ? responseData.isSuperAdmin : userData?.isSuperAdmin,
    };

    const accessTokenOnly = isAccessTokenOnlyUser(userWithFlags);

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (!accessTokenOnly && refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    } else {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }

    const profileResult = await fetchProfile();

    showSuccess('Signed in successfully.');

    if (profileResult?.success) {
      navigate(`/app/firm/${firmSlug}/dashboard`, { replace: true });
    }
  };

  const resetOtpStep = () => {
    setShowOtpForm(false);
    setOtp('');
    setLoginToken('');
    setPassword('');
    setResendCountdown(0);
    setFieldErrors({});
    setStatusMessage('');
  };

  const handleIdentifierChange = (event) => {
    const nextValue = event.target.value.replace(/\s+/g, '').toUpperCase();
    setIdentifier(nextValue);
    setError('');
    setStatusMessage('');
    setFieldErrors((current) => ({ ...current, identifier: '' }));
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    setError('');
    setStatusMessage('');
    setFieldErrors((current) => ({ ...current, password: '' }));
  };

  const handleOtpChange = (event) => {
    setOtp(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH));
    setError('');
    setStatusMessage('');
    setFieldErrors((current) => ({ ...current, otp: '' }));
  };

  const handleResendEmailChange = (event) => {
    setResendEmail(event.target.value);
    setError('');
    setStatusMessage('');
    setFieldErrors((current) => ({ ...current, resendEmail: '' }));
  };

  useEffect(() => {
    if (!showOtpForm || resendCountdown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setResendCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [showOtpForm, resendCountdown]);

  useEffect(() => {
    const loadFirmData = async () => {
      try {
        setFirmLoading(true);
        const response = await api.get(`/public/firms/${firmSlug}`);

        if (response.data.success) {
          const firm = response.data.data;

          if (firm.status !== 'active') {
            setError('This firm is currently inactive. Please contact support.');
            setFirmData(null);
            localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
          } else {
            setFirmData(firm);
            localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlug);
          }
        }
      } catch (err) {
        console.error('Error loading firm:', err);
        setError('Firm not found. Please check your login URL.');
        setFirmData(null);
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      } finally {
        setFirmLoading(false);
      }
    };

    if (firmSlug) {
      loadFirmData();
    }
  }, [firmSlug]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setStatusMessage('');
    setFieldErrors({});
    const normalizedIdentifier = identifier.trim().toUpperCase();

    if (!validateXID(normalizedIdentifier)) {
      setFieldErrors({ identifier: 'Please enter a valid xID (for example, X123456).' });
      return;
    }

    if (!validatePassword(password)) {
      setFieldErrors({ password: 'Password must be at least 8 characters.' });
      return;
    }

    if (!firmData) {
      setError('Firm details are still loading. Please refresh the page.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(`/${firmSlug}/login`, {
        xID: normalizedIdentifier,
        password,
        firmSlug,
      });

      const loginState = resolveFirmLoginResponseState(response.data);

      if (loginState.nextStep === 'otp') {
        const cooldown = resolveResendCooldownSeconds(loginState.resendCooldownSeconds);
        setShowOtpForm(true);
        setLoginToken(loginState.loginToken);
        setResendCooldownSeconds(cooldown);
        setResendCountdown(cooldown);
        setOtp('');
        setPassword('');
        setShowResendForm(false);
        setStatusMessage('Enter the OTP sent to your registered email to continue.');
        showSuccess('Enter the OTP sent to your email to continue.');
        return;
      }

      if (loginState.nextStep === 'authenticated') {
        await completeLogin(response.data);
        return;
      }

      setError(loginState.error);
    } catch (err) {
      const errorData = err.response?.data;

      if (errorData?.mustChangePassword) {
        navigate('/change-password', { state: { xID: normalizedIdentifier } });
      } else if (errorData?.mustSetPassword || errorData?.code === ERROR_CODES.PASSWORD_SETUP_REQUIRED) {
        setError('Please set your password using the link sent to your email. If you haven\'t received it, contact your administrator.');
      } else if (errorData?.lockedUntil) {
        setError(errorData?.message || 'Account is locked. Please try again later or contact an administrator.');
      } else {
        setError(errorData?.message || 'Invalid xID or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError('');
    setStatusMessage('');
    setFieldErrors((current) => ({ ...current, otp: '' }));

    const normalizedOtp = otp.trim();
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(normalizedOtp)) {
      setFieldErrors({ otp: `Please enter a valid ${OTP_LENGTH}-digit OTP.` });
      return;
    }

    if (!loginToken) {
      setError('Your login session has expired. Please sign in again.');
      resetOtpStep();
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(`/${firmSlug}/verify-otp`, {
        loginToken,
        otp: normalizedOtp,
      });

      if (response.data.success) {
        await completeLogin(response.data);
        return;
      }

      setError(response.data?.message || 'OTP verification failed. Please try again.');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!identifier.trim() || !firmSlug || resendCountdown > 0) {
      return;
    }

    setError('');
    setStatusMessage('');
    setResendLoading(true);

    try {
      const response = await api.post('/auth/resend-otp', {
        xID: identifier.trim().toUpperCase(),
        firmSlug,
      });
      const cooldown = resolveResendCooldownSeconds(response.data?.resendCooldownSeconds || resendCooldownSeconds);
      setResendCooldownSeconds(cooldown);
      setResendCountdown(cooldown);
      setOtp('');
      setFieldErrors((current) => ({ ...current, otp: '' }));
      setStatusMessage('A new OTP has been sent to your registered email.');
      showSuccess('OTP sent again to your email');
    } catch (err) {
      const serverMessage = err.response?.data?.error || err.response?.data?.message || 'Unable to resend OTP right now.';
      setError(serverMessage);
      showError(serverMessage);
      if (err.response?.data?.retryAfter) {
        setResendCountdown(resolveResendCooldownSeconds(err.response.data.retryAfter));
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleResendCredentials = async () => {
    const normalizedEmail = resendEmail.trim().toLowerCase();
    setFieldErrors((current) => ({ ...current, resendEmail: '' }));

    if (!normalizedEmail) {
      setFieldErrors({ resendEmail: 'Please enter your registered email address.' });
      return;
    }

    if (!validateEmail(normalizedEmail)) {
      setFieldErrors({ resendEmail: 'Please enter a valid registered email address.' });
      return;
    }

    setResendLoading(true);
    try {
      const response = await api.post('/auth/resend-credentials', { email: normalizedEmail });
      const successMessage = response?.data?.message || RESEND_CREDENTIALS_SUCCESS_MESSAGE;
      setStatusMessage(successMessage);
      showSuccess(successMessage);
      setResendEmail('');
      setShowResendForm(false);
    } catch (err) {
      showError(err?.response?.data?.message || 'Unable to resend credentials right now.');
    } finally {
      setResendLoading(false);
    }
  };

  if (firmLoading) {
    return (
      <div className="auth-wrapper">
        <Card className="auth-card max-w-form">
          <Loading message="Loading firm information..." />
        </Card>
      </div>
    );
  }

  if (!firmData) {
    return (
      <div className="auth-wrapper">
        <Card className="auth-card max-w-form">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">Docketra</h1>
            <p className="mt-2 text-sm text-gray-500 text-center">Compliance Workflow Infrastructure</p>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
            <p className="auth-helper-text text-center">
              Please contact your administrator for the correct login URL.
            </p>
            <Button type="button" variant="secondary" fullWidth onClick={() => window.location.reload()}>
              Retry
            </Button>
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
          <p className="mt-2 text-sm text-gray-500 text-center">
            {showOtpForm ? 'Enter the 6-digit code sent to your registered email.' : 'Login to Docketra'}
          </p>
          <p className="mt-2 text-xs text-gray-500 text-center">Firm ID: {firmData.firmId}</p>
        </div>

        {!showOtpForm && (
          <p className="mt-6 text-sm text-gray-500 text-center">
            Use the xID from your welcome email. First-time users should check their inbox for their activation link
            and credentials before signing in here.
          </p>
        )}

        {statusMessage && (
          <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status" aria-live="polite">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        {showOtpForm ? (
          <form onSubmit={handleVerifyOtp} noValidate className="mt-6 space-y-4">
            <p className="text-sm text-gray-500">Fields marked with * are required.</p>
            <Input label="xID" type="text" value={identifier} readOnly />

            <Input
              label="OTP"
              type="text"
              value={otp}
              onChange={handleOtpChange}
              error={fieldErrors.otp}
              required
              placeholder="123456"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              disabled={loading || resendLoading}
              helpText="Enter the 6-digit code from your email."
            />

            <p className="auth-helper-text text-center">
              Didn&apos;t receive OTP?{' '}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendLoading || resendCountdown > 0 || loading}
                className="auth-inline-button"
              >
                {resendLoading
                  ? 'Resending...'
                  : resendCountdown > 0
                    ? `Resend OTP in ${resendCountdown}s`
                    : 'Resend OTP'}
              </button>
            </p>

            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={resendLoading}>
              Verify OTP
            </Button>

            <Button
              type="button"
              fullWidth
              disabled={loading || resendLoading}
              onClick={resetOtpStep}
              variant="secondary"
            >
              Back to Sign In
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogin} noValidate className="mt-6 space-y-4">
            <p className="text-sm text-gray-500">Fields marked with * are required.</p>
            <Input
              label="xID"
              type="text"
              value={identifier}
              onChange={handleIdentifierChange}
              error={fieldErrors.identifier}
              required
              placeholder="X123456"
              autoComplete="username"
              disabled={loading || resendLoading}
              autoFocus
              helpText="Enter your user ID (for example, X000001). Your XID was sent to your email after signup."
            />

            <button
              type="button"
              onClick={() => setShowResendForm((prev) => !prev)}
              className="auth-inline-button"
              disabled={loading || resendLoading}
            >
              Didn&apos;t receive your XID? Resend credentials
            </button>

            {showResendForm && (
              <div className="space-y-4">
                <Input
                  label="Registered email"
                  type="email"
                  value={resendEmail}
                  onChange={handleResendEmailChange}
                  error={fieldErrors.resendEmail}
                  required
                  placeholder="you@firm.com"
                  autoComplete="email"
                  disabled={resendLoading || loading}
                />

                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  loading={resendLoading}
                  disabled={loading}
                  onClick={handleResendCredentials}
                >
                  Resend credentials
                </Button>
              </div>
            )}

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              error={fieldErrors.password}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading || resendLoading}
            />

            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={resendLoading}>
              Login
            </Button>

            <div className="flex items-center gap-2 py-1">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-500">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <GoogleSignIn
              firmSlug={firmSlug}
              onError={(googleError) => setError(googleError?.message || 'Google sign-in failed')}
            />

            <div className="text-center space-y-3">
              <Link
                to={`/${firmSlug}/forgot-password`}
                className="block text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Forgot Password?
              </Link>
              <Link
                to="/signup"
                className="block text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Need a workspace? Create one here.
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};
