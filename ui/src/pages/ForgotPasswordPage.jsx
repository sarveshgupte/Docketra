/**
 * Forgot Password Page
 */

import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { authService } from '../services/authService';
import { STRONG_PASSWORD_MESSAGE, validateEmail, validateStrongPassword } from '../utils/validators';
import { spacingClasses } from '../theme/tokens';
import './ForgotPasswordPage.css';

const FALLBACK_RATE_LIMIT_MESSAGE = 'Too many password reset requests. Please wait a few minutes before trying again.';
const getForgotPasswordErrorMessage = (errorData, defaultMessage) => (
  errorData?.message
  || (errorData?.error === 'RATE_LIMIT_EXCEEDED' ? FALLBACK_RATE_LIMIT_MESSAGE : null)
  || errorData?.error
  || defaultMessage
);

export const ForgotPasswordPage = () => {
  const { firmSlug } = useParams();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [step, setStep] = useState(1);
  const [cooldown, setCooldown] = useState(30);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const loginPath = firmSlug ? `/app/${firmSlug}/login` : '/superadmin';

  React.useEffect(() => {
    if (step !== 2 || cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [step, cooldown]);

  const handleInit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldError('');
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setFieldError('Please enter your email address.');
      return;
    }

    if (!validateEmail(normalizedEmail)) {
      setFieldError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.forgotPasswordInit(normalizedEmail, firmSlug);
      if (response.success) {
        setSuccess('OTP sent to your email.');
        setStep(2);
        setCooldown(30);
      } else {
        setError(getForgotPasswordErrorMessage(response, 'Failed to send OTP'));
      }
    } catch (err) {
      setError(getForgotPasswordErrorMessage(err.response?.data, 'An error occurred. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) {
      setFieldError('OTP must be 6 digits.');
      return;
    }
    setLoading(true);
    try {
      const response = await authService.forgotPasswordVerify(email.trim().toLowerCase(), firmSlug, otp.trim());
      if (response.success) {
        setResetToken(response.resetToken || '');
        setStep(3);
        setSuccess('OTP verified. Set your new password.');
      }
    } catch (err) {
      setError(getForgotPasswordErrorMessage(err.response?.data, 'Invalid or expired OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateStrongPassword(password)) {
      setFieldError(STRONG_PASSWORD_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const response = await authService.forgotPasswordResetWithOtp(email.trim().toLowerCase(), firmSlug, resetToken, password);
      if (response.success) {
        navigate(loginPath, { state: { message: 'Password reset successfully. Please login.', messageType: 'success' } });
      }
    } catch (err) {
      setError(getForgotPasswordErrorMessage(err.response?.data, 'Unable to reset password'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      await authService.forgotPasswordInit(email.trim().toLowerCase(), firmSlug);
      setSuccess('OTP resent to your email.');
      setCooldown(30);
    } catch (err) {
      setError(getForgotPasswordErrorMessage(err.response?.data, 'Unable to resend OTP'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <Card className="forgot-password-card">
        <div className="forgot-password-header">
          <h1>Forgot Password</h1>
          <p className="text-secondary">
            Enter your email address and we'll send an OTP to reset your password.
            {firmSlug ? ' Password recovery is scoped to this workspace.' : ''}
          </p>
        </div>

        <form onSubmit={step === 1 ? handleInit : step === 2 ? handleVerifyOtp : handleReset} noValidate className={spacingClasses.formFieldSpacing}>
          {step === 1 && <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
              setFieldError('');
            }}
            error={fieldError}
            required
            placeholder="Enter your email"
            autoComplete="email"
            disabled={loading}
            autoFocus
            helpText={firmSlug ? 'Use the email address registered in this workspace.' : undefined}
          />}
          {step === 2 && <Input
            label="OTP"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={fieldError}
            required
            placeholder="6-digit OTP"
            autoComplete="one-time-code"
            disabled={loading}
            autoFocus
          />}
          {step === 3 && <>
            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter new password"
              disabled={loading}
              autoFocus
              helpText={STRONG_PASSWORD_MESSAGE}
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm new password"
              disabled={loading}
            />
          </>}

          {success && (
            <div className="neo-alert neo-alert--success auth-alert" role="status" aria-live="polite">
              {success}
            </div>
          )}

          {error && (
            <div className="neo-alert neo-alert--danger auth-alert" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {step === 1 ? 'Send OTP' : step === 2 ? 'Verify OTP' : 'Set New Password'}
          </Button>
          {step === 2 && (
            <Button type="button" variant="outline" fullWidth disabled={loading || cooldown > 0} onClick={handleResend}>
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </Button>
          )}

          <div className="forgot-password-footer">
            <Link to={loginPath} className="forgot-password-link">
              Back to Login
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};
