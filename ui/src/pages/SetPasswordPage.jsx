/**
 * Set Password Page
 * Allows users to set their password using a token from email
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { authService } from '../services/authService';
import api from '../services/api';
import { APP_NAME, STORAGE_KEYS } from '../utils/constants';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../utils/validators';
import './SetPasswordPage.css';

export const SetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { firmSlug } = useParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [firmLoading, setFirmLoading] = useState(true);
  const [firmData, setFirmData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing password setup token');
    }
  }, [token]);

  useEffect(() => {
    const loadFirmData = async () => {
      if (!firmSlug) {
        setFirmData({});
        setFirmLoading(false);
        return;
      }

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
        setError('Firm not found. Please check your activation link.');
        setFirmData(null);
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      } finally {
        setFirmLoading(false);
      }
    };

    loadFirmData();
  }, [firmSlug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing password setup token');
      return;
    }

    if (!firmData) {
      setError('Firm not found. Please check your activation link.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
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
      const response = await authService.setPassword(token, password);

      if (response.success) {
        setSuccess(true);
        // Use redirectUrl from backend (firm-scoped login)
        // Backend returns /{firmSlug}/login for admin users
        const redirectPath = response.redirectUrl || (response.firmSlug 
          ? `/${response.firmSlug}/login` 
          : '/superadmin');
        setTimeout(() => {
          navigate(redirectPath);
        }, 2000);
      } else {
        setError(response.message || 'Failed to set password');
      }
    } catch (err) {
      const errorData = err.response?.data;
      const errorCode = errorData?.code;
      if (errorCode === 'FIRM_NOT_FOUND') {
        setError('Firm not found. Please check your activation link.');
      } else if (errorCode === 'ACTIVATION_TOKEN_INVALID') {
        setError('Activation token invalid or expired.');
      } else if (errorCode === 'ACCOUNT_ALREADY_ACTIVATED') {
        setError('Account already activated. Please log in.');
      } else if (errorCode === 'ACTIVATION_TOKEN_FIRM_MISMATCH') {
        setError('Activation token does not belong to this firm.');
      } else {
        setError(errorData?.message || 'Failed to set password.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (firmLoading) {
    return (
      <div className="set-password-page">
        <Card className="set-password-card">
          <Loading message="Loading firm information..." />
        </Card>
      </div>
    );
  }

  if (!firmData) {
    return (
      <div className="set-password-page">
        <Card className="set-password-card">
          <div className="set-password-header">
            <h1>{APP_NAME}</h1>
            <p className="text-secondary">Account Activation</p>
          </div>
          <div className="alert alert-error" style={{ textAlign: 'center', padding: '1.5rem' }} role="alert">
            {error || 'Firm not found. Please check your activation link.'}
          </div>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="set-password-page">
        <Card className="set-password-card">
          <div className="set-password-success">
            <h1>✓ Password Set Successfully</h1>
            <p>Your password has been set. You can now log in.</p>
            <p className="text-secondary" aria-live="polite">Redirecting to login...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="set-password-page">
      <Card className="set-password-card">
        <div className="set-password-header">
          <h1>Set Your Password</h1>
          <p className="text-secondary">
            Welcome to {APP_NAME}! Please set your password to activate your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="set-password-form" noValidate>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <Input
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="new-password"
            disabled={loading}
            helpText={STRONG_PASSWORD_MESSAGE}
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
            autoComplete="new-password"
            disabled={loading}
          />

          <div className="password-requirements">
            <p className="text-secondary">Password Requirements:</p>
            <ul>
              <li className={password.length >= 8 ? 'valid' : ''}>
                At least 8 characters
              </li>
              <li className={/[A-Z]/.test(password) ? 'valid' : ''}>
                One uppercase letter
              </li>
              <li className={/[a-z]/.test(password) ? 'valid' : ''}>
                One lowercase letter
              </li>
              <li className={/[0-9]/.test(password) ? 'valid' : ''}>
                One number
              </li>
              <li className={/[!@#$%^&*]/.test(password) ? 'valid' : ''}>
                One special character (!@#$%^&*)
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
          >
            Set Password
          </Button>
        </form>
      </Card>
    </div>
  );
};
