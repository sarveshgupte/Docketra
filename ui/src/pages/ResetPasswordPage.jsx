/**
 * Reset Password Page (for forgot password flow)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { authService } from '../services/authService';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../utils/validators';
import { spacingClasses } from '../theme/tokens';
import './ResetPasswordPage.css';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    if (!validateStrongPassword(password)) {
      setError(STRONG_PASSWORD_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.resetPasswordWithToken(token, password);
      
      if (response.success) {
        // Navigate to login with success message
        navigate('/superadmin', {
          state: {
            message: 'Password reset successfully. You can now log in with your new password.',
            messageType: 'success'
          }
        });
      } else {
        setError(response.message || 'Failed to reset password');
      }
    } catch (err) {
      const errorData = err.response?.data;
      setError(errorData?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-password-page">
      <Card className="reset-password-card">
        <div className="reset-password-header">
          <h1>Reset Password</h1>
          <p className="text-secondary">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className={spacingClasses.formFieldSpacing}>
          <Input
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter new password (at least 8 characters)"
            autoComplete="new-password"
            disabled={loading}
            helpText={STRONG_PASSWORD_MESSAGE}
            autoFocus
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm new password"
            autoComplete="new-password"
            disabled={loading}
          />

          {error && (
            <div className="neo-alert neo-alert--danger auth-alert" role="alert">
              {error}
            </div>
          )}

          {!token && (
            <div className="reset-password-actions" role="navigation" aria-label="Recovery actions">
              <Link to="/forgot-password" className="reset-password-link">
                Request a new reset link
              </Link>
              <Link to="/superadmin" className="reset-password-link">
                Back to login
              </Link>
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={!token} loading={loading}>
            Reset Password
          </Button>
        </form>
      </Card>
    </div>
  );
};
