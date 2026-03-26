/**
 * Login Page
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { validateXID, validatePassword } from '../utils/validators';
import { useToast } from '../hooks/useToast';
import './LoginPage.css';

export const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { login, fetchProfile } = useAuth();
  const { showSuccess } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const successMessage = location.state?.message;
  const messageType = location.state?.messageType;

  const handleIdentifierChange = (event) => {
    const nextValue = event.target.value.replace(/\s+/g, '').toUpperCase();
    setIdentifier(nextValue);
    setError('');
    setFieldErrors((current) => ({ ...current, identifier: '' }));
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    setError('');
    setFieldErrors((current) => ({ ...current, password: '' }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
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

    setLoading(true);

    try {
      const response = await login(normalizedIdentifier, password, '/superadmin/login');

      if (response.success) {
        showSuccess('Signed in successfully.');

        const profileResult = await fetchProfile();

        if (profileResult?.success) {
          navigate('/app/superadmin', { replace: true });
        }
      }
    } catch (err) {
      const errorData = err.response?.data;

      if (errorData?.mustChangePassword) {
        navigate('/change-password', { state: { xID: normalizedIdentifier } });
      } else if (errorData?.passwordSetupRequired) {
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

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">Docketra</h1>
          <p className="mt-2 text-sm text-gray-500 text-center">Compliance Workflow Infrastructure</p>
        </div>

        <p className="mt-6 text-sm text-gray-500 text-center">
          Use the xID from your welcome email. If your account belongs to a firm workspace, sign in from that
          workspace URL so password reset and activation links stay scoped correctly.
        </p>

        <form onSubmit={handleLogin} noValidate className="mt-6 space-y-4">
          <Input
            label="xID"
            type="text"
            value={identifier}
            onChange={handleIdentifierChange}
            error={fieldErrors.identifier}
            required
            placeholder="X123456"
            autoComplete="username"
            disabled={loading}
            autoFocus
            helpText="Use your xID (case-insensitive, e.g., x123456 or X123456)."
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            error={fieldErrors.password}
            required
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={loading}
          />

          {successMessage && (
            <div
              className={`neo-alert ${
                messageType === 'warning'
                  ? 'neo-alert--warning'
                  : messageType === 'info'
                    ? 'neo-alert--info'
                    : 'neo-alert--success'
              } auth-alert`}
              role={messageType === 'warning' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {successMessage}
            </div>
          )}

          {error && (
            <div className="neo-alert neo-alert--danger auth-alert" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth loading={loading}>
            Login
          </Button>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};
