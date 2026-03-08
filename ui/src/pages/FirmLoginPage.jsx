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
import { validateXID, validatePassword } from '../utils/validators';
import { ERROR_CODES, STORAGE_KEYS } from '../utils/constants';
import { isAccessTokenOnlyUser } from '../utils/authUtils';
import { resolveFirmLoginResponseState } from '../utils/firmLoginResponse';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
import './LoginPage.css';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = import.meta.env.PROD ? 30 : 3;
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

    // Validation - xID only (no email)
    if (!validateXID(identifier)) {
      setError('Please enter a valid xID (e.g., X123456)');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters');
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
        xID: identifier,
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
        navigate('/change-password', { state: { xID: identifier } });
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

    const normalizedOtp = otp.trim();
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(normalizedOtp)) {
      setError(`Please enter a valid ${OTP_LENGTH}-digit OTP`);
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
    if (!normalizedEmail) {
      showError('Please enter your registered email address.');
      return;
    }

    setResendLoading(true);
    try {
      const response = await api.post('/auth/resend-credentials', { email: normalizedEmail });
      showSuccess(response?.data?.message || 'Credentials email sent. Please check your inbox.');
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
          <div className="error-message" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#e53e3e', marginBottom: '1rem' }}>{error}</p>
            <p style={{ color: '#718096', fontSize: '0.875rem' }}>
              Please contact your administrator for the correct login URL.
            </p>
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

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {showOtpForm ? (
          <form onSubmit={handleVerifyOtp}>
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
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
              required
              placeholder="123456"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
            />
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginTop: '-0.5rem',
              marginBottom: '0.5rem'
            }}>
              Didn't receive OTP?{' '}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendLoading || resendCountdown > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: (resendLoading || resendCountdown > 0 || loading) ? 'var(--text-secondary)' : '#2563eb',
                  cursor: (resendLoading || resendCountdown > 0 || loading) ? 'not-allowed' : 'pointer',
                  textDecoration: (resendLoading || resendCountdown > 0 || loading) ? 'none' : 'underline',
                  font: 'inherit',
                }}
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
              disabled={loading || resendLoading}
            >
              {loading ? 'Verifying OTP...' : 'Verify OTP'}
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
            <form onSubmit={handleLogin}>
              <Input
                label="xID"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                placeholder="X123456"
                autoFocus
              />
              <p style={{ 
                fontSize: '0.875rem', 
                color: 'var(--text-secondary)', 
                marginTop: '-0.5rem', 
                marginBottom: '1rem'
              }}>
                Enter your user ID (e.g., X000001). Your XID was sent to your email after signup.
              </p>
              <button
                type="button"
                onClick={() => setShowResendForm((prev) => !prev)}
                style={{
                  fontSize: '0.875rem',
                  color: '#3182ce',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  marginTop: '-0.5rem',
                  marginBottom: '1rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {"Didn't receive your XID? Resend credentials"}
              </button>
              {showResendForm && (
                <div style={{ marginBottom: '1rem' }}>
                  <Input
                    label="Registered email"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    placeholder="you@firm.com"
                  />
                  <Button
                    type="button"
                    fullWidth
                    disabled={resendLoading}
                    onClick={handleResendCredentials}
                  >
                    {resendLoading ? 'Resending...' : 'Resend credentials'}
                  </Button>
                </div>
              )}

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />

              <Button 
                type="submit" 
                fullWidth 
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="login-footer">
              <Link to={`/${firmSlug}/forgot-password`} className="link">
                Forgot Password?
              </Link>
            </div>
          </>
        )}

        <div style={{ 
          marginTop: '1.5rem', 
          padding: '1rem', 
          backgroundColor: '#f7fafc', 
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: '#718096',
          textAlign: 'center'
        }}>
          Secure firm-scoped login
        </div>
      </Card>
    </div>
  );
};
