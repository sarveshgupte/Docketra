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
  
  // Get success message from location state if present
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

    // Validation - xID only (no email)
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
        
        // Trigger profile hydration to set auth state
        const profileResult = await fetchProfile();
        
        // Explicit post-login navigation (SuperAdmin only)
        if (profileResult?.success) {
          navigate('/app/superadmin', { replace: true });
        }
      }
    } catch (err) {
      const errorData = err.response?.data;
      
      if (errorData?.mustChangePassword) {
        // Redirect to change password page with identifier
        navigate('/change-password', { state: { xID: normalizedIdentifier } });
      } else if (errorData?.passwordSetupRequired) {
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

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-header">
          <h1>Docketra</h1>
          <p className="text-secondary">Compliance Workflow Infrastructure</p>
        </div>

        <p className="auth-helper-text">
          Use the xID from your welcome email. If your account belongs to a firm workspace, sign in from that
          workspace URL so password reset and activation links stay scoped correctly.
        </p>

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

          <div className="login-footer">
            <Link to="/forgot-password" className="forgot-password-link">
              Forgot Password?
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};
