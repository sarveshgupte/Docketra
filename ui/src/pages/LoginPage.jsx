/**
 * Login Page
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { validateXID, validatePassword } from '../utils/validators';
import { useToast } from '../hooks/useToast';
import { resolvePostAuthNavigation } from '../utils/postAuthNavigation';
import { SESSION_KEYS, STORAGE_KEYS } from '../utils/constants';

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

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);
      sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_FIRM);
      sessionStorage.removeItem(SESSION_KEYS.POST_LOGIN_RETURN_TO);
    } catch (_error) {
      // best-effort cleanup for stale workspace routing hints
    }
  }, []);

  const handleIdentifierChange = (event) => {
    const nextValue = event.target.value.replace(/\s+/g, '').toUpperCase();
    setIdentifier(nextValue);
    setError('');
    setFieldErrors((current) => ({
      ...current,
      identifier: nextValue.length === 0 || validateXID(nextValue) ? '' : 'Please enter a valid xID (for example, X123456).',
    }));
  };

  const handlePasswordChange = (event) => {
    const nextValue = event.target.value;
    setPassword(nextValue);
    setError('');
    setFieldErrors((current) => ({
      ...current,
      password: nextValue.length === 0 || validatePassword(nextValue) ? '' : 'Password must be at least 8 characters.',
    }));
  };

  const canSubmit = validateXID(identifier.trim().toUpperCase()) && validatePassword(password);

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
        const profileResult = await fetchProfile({ force: true });

        if (!profileResult?.success || !profileResult?.data) {
          setError('Login succeeded, but your session could not be established. Please refresh and sign in again.');
          return;
        }

        const nextRoute = resolvePostAuthNavigation({
          locationSearch: location.search,
          user: profileResult.data,
          resolvePostAuthRoute,
        });

        showSuccess('✅ Login successful. Redirecting to your workspace.');
        navigate(nextRoute, { replace: true });
      }
    } catch (err) {
      const errorData = err.response?.data;
      const statusCode = err.response?.status;

      if (errorData?.mustChangePassword) {
        navigate('/change-password', { state: { xID: normalizedIdentifier } });
      } else if (errorData?.passwordSetupRequired) {
        setError('Please set your password using the link sent to your email. If you haven\'t received it, contact your administrator.');
      } else if (errorData?.lockedUntil) {
        setError('Account is locked. Please try again later or contact an administrator.');
      } else if (statusCode === 401) {
        setError('Invalid xID or password. Please verify and try again.');
      } else if (statusCode >= 500) {
        setError('Sign-in is temporarily unavailable. Please retry in a moment.');
      } else {
        setError('Unable to sign in. Please verify your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="find-workspace-page auth-public-page">
      <div className="find-workspace-page__shell">
        <section className="find-workspace-page__context" aria-label="Superadmin login context">
          <p className="find-workspace-page__eyebrow">Platform access</p>
          <h1 className="find-workspace-page__heading">Sign in to Docketra</h1>
          <p className="find-workspace-page__intro">
            Secure access for superadmin operations and platform oversight.
          </p>
          <ul className="find-workspace-page__benefits">
            <li>Use your assigned xID and password</li>
            <li>Protected access with role-based controls</li>
            <li>No sensitive data shown before authentication</li>
          </ul>
        </section>

        <Card className="find-workspace-page__card auth-public-page__card">
          <div className="find-workspace-page__card-header">
            <h2>Enter your credentials</h2>
            <p>Fields marked with * are required.</p>
          </div>

          {successMessage && (
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

          <form onSubmit={handleLogin} noValidate className="find-workspace-page__form">
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

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            disabled={loading || !canSubmit}
          >
            {loading ? 'Signing in' : 'Submit & Sign in'}
          </Button>

          <div className="auth-public-page__links">
            <Link
              to="/forgot-password"
              className="auth-public-page__link"
            >
              Forgot Password?
            </Link>
          </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
