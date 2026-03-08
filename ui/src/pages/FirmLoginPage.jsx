/**
 * Firm Login Page
 * Firm-scoped login using path-based URL: /:firmSlug/login
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { validateEmail, validateXID, validatePassword } from '../utils/validators';
import { ERROR_CODES, STORAGE_KEYS } from '../utils/constants';
import { isAccessTokenOnlyUser } from '../utils/authUtils';
import { resolveFirmLoginResponseState } from '../utils/firmLoginResponse';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
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

  const { fetchProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const completeLogin = async (responseData) => {
    const {
      accessToken,
      refreshToken,
      data: userData,
      refreshEnabled,
    } = responseData;

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

  // Load firm metadata
  useEffect(() => {
    const loadFirmData = async () => {
      try {
        setFirmLoading(true);
        const response = await api.get(`/public/firms/${firmSlug}`);
        
        if (response.data.success) {
          const firm = response.data.data;
          
          // Check if firm is active
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setStatusMessage('');
    setFieldErrors({});
    const normalizedIdentifier = identifier.trim().toUpperCase();

    // Validation - xID only (no email)
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
      // Login with firm context via API (not authService to include firmSlug)
      const response = await api.post(`/${firmSlug}/login`, {
        xID: normalizedIdentifier,
        password: password,
        firmSlug: firmSlug, // Include firm context
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
        // Redirect to change password page with identifier
        navigate('/change-password', { state: { xID: normalizedIdentifier } });
      } else if (errorData?.mustSetPassword || errorData?.code === ERROR_CODES.PASSWORD_SETUP_REQUIRED) {
        // User needs to set password via email link
        setError('Please set your password using the link sent to your email. If you haven\'t received it, contact your administrator.');
      } else if (errorData?.lockedUntil) {
        // Account is locked
        setError(errorData?.message || 'Account is locked. Please try again later or contact an administrator.');
      } else {
        setError(errorData?.message || 'Invalid xID or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
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
      <div className="login-page">
        <Card className="login-card">
          <Loading message="Loading firm information..." />
        </Card>
      </div>
    );
  }

  if (!firmData) {
    return (
      <div className="login-page">
        <Card className="login-card">
          <div className="login-header">
            <h1>Docketra</h1>
            <p className="text-secondary">Compliance Workflow Infrastructure</p>
          </div>
          <div className="auth-error-state">
            <div className="neo-alert neo-alert--danger auth-alert" role="alert">
              {error}
            </div>
            <p className="auth-helper-text">
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
    <div className="login-page">
      <Card className="login-card">
        <div className="login-header">
          <h1>{firmData.name}</h1>
          <p className="text-secondary">
            {showOtpForm ? 'Enter the 6-digit code sent to your registered email.' : 'Login to Docketra'}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem' }}>
            Firm ID: {firmData.firmId}
          </p>
        </div>

        {!showOtpForm && (
          <p className="auth-helper-text">
            Use the xID from your welcome email. First-time users should check their inbox for their activation link
            and credentials before signing in here.
          </p>
        )}

        {statusMessage && (
          <div className="neo-alert neo-alert--success auth-alert" role="status" aria-live="polite">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="neo-alert neo-alert--danger auth-alert" role="alert">
            {error}
          </div>
        )}

        {showOtpForm ? (
          <form onSubmit={handleVerifyOtp} noValidate>
            <Input
              label="xID"
              type="text"
              value={identifier}
              readOnly
            />
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
            <p className="auth-helper-text">
              Didn't receive OTP?{' '}
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

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={resendLoading}
            >
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
          <>
            <form onSubmit={handleLogin} noValidate>
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
                {"Didn't receive your XID? Resend credentials"}
              </button>
              {showResendForm && (
                <div>
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

              <Button 
                type="submit" 
                fullWidth 
                loading={loading}
                disabled={resendLoading}
              >
                Sign In
              </Button>
            </form>

            <div className="login-footer">
              <Link to={`/${firmSlug}/forgot-password`} className="link">
                Forgot Password?
              </Link>
            </div>
          </>
        )}

        <div className="auth-secondary-panel">
          Secure firm-scoped login
        </div>
      </Card>
    </div>
  );
};
