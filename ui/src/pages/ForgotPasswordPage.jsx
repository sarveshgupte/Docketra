/**
 * Forgot Password Page
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { authService } from '../services/authService';
import { validateEmail } from '../utils/validators';
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const redirectTimeoutRef = useRef(null);
  const loginPath = firmSlug ? `/${firmSlug}/login` : '/superadmin';

  useEffect(() => () => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldError('');
    setRedirecting(false);
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
      const response = await authService.forgotPassword(normalizedEmail, firmSlug);
      
      if (response.success) {
        setSuccess(response.message);
        setRedirecting(true);
        // Clear form
        setEmail('');
        // Redirect to login after 3 seconds
        redirectTimeoutRef.current = setTimeout(() => {
          navigate(loginPath, {
            state: {
              message: 'If your email is registered, you will receive a password reset link.',
              messageType: 'success'
            }
          });
        }, 3000);
      } else {
        setError(getForgotPasswordErrorMessage(response, 'Failed to send reset email'));
      }
    } catch (err) {
      setError(getForgotPasswordErrorMessage(err.response?.data, 'An error occurred. Please try again.'));
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
            Enter your email address and we'll send you a link to reset your password.
            {firmSlug ? ' Reset links for firm accounts are sent only within this workspace.' : ''}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <Input
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
            disabled={loading || redirecting}
            autoFocus
            helpText={firmSlug ? 'Use the email address registered in this workspace.' : undefined}
          />

          {success && (
            <div className="neo-alert neo-alert--success auth-alert" role="status" aria-live="polite">
              {success}
              {redirecting && (
                <div className="forgot-password-redirect-note">
                  Redirecting you to login in a few seconds…
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="neo-alert neo-alert--danger auth-alert" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth loading={loading}>
            Send Reset Link
          </Button>

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
