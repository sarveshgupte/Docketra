/**
 * Login Page
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { validateXID, validatePassword } from '../utils/validators';
import { useToast } from '../hooks/useToast';
import { spacingClasses } from '../theme/tokens';
import './LoginPage.css';

export const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { login, fetchProfile, resolvePostAuthRoute } = useAuth();
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
          navigate(resolvePostAuthRoute(profileResult.data), { replace: true });
        }
      }
    } catch (err) {
      const errorData = err.response?.data;
      const statusCode = err.response?.status;

      if (errorData?.mustChangePassword) {
        navigate('/change-password', { state: { xID: normalizedIdentifier } });
      } else if (errorData?.passwordSetupRequired) {
        setError('Please set your password using the link sent to your email. If you haven\'t received it, contact your administrator.');
      } else if (errorData?.lockedUntil) {
        setError(errorData?.message || 'Account is locked. Please try again later or contact an administrator.');
      } else if (statusCode === 401) {
        setError('Invalid xID or password');
      } else if (statusCode >= 500) {
        setError('Something went wrong. Try again');
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
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">Sign in to Docketra</h1>
        </div>

        <p className="mt-6 text-sm text-gray-500 text-center">
          Sign in to your workspace using your xID and password.
        </p>

        <form onSubmit={handleLogin} noValidate className={`mt-4 ${spacingClasses.formFieldSpacing}`}>
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

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Signing in' : 'Sign in'}
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
