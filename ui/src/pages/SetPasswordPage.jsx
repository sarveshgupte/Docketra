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
import { API_BASE_URL, APP_NAME, STORAGE_KEYS } from '../utils/constants';
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
        setError('Firm not found. Please check your activation link.');
        setFirmLoading(false);
        return;
      }

      try {
        setFirmLoading(true);
        const response = await api.get(`/public/firms/${firmSlug}`);

        if (response.data.success) {
          const firm = response.data.data;
          if (firm.status !== 'ACTIVE') {
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

  const validatePassword = (pwd) => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*]/.test(pwd)) {
      return 'Password must contain at least one special character (!@#$%^&*)';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing password setup token');
      return;
    }

    if (!firmData || !firmSlug) {
      setError('Firm not found. Please check your activation link.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.setPassword(token, password, firmSlug);

      if (response.success) {
        setSuccess(true);
        // Use redirectUrl from backend (firm-scoped login)
        // Backend returns /f/{firmSlug}/login for admin users
        const redirectPath = response.redirectUrl || (response.firmSlug 
          ? `/f/${response.firmSlug}/login` 
          : '/login');
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

  const handleGoogleLogin = () => {
    if (!firmSlug) {
      setError('Firm not found. Please check your activation link.');
      return;
    }
    window.location.href = `${API_BASE_URL}/auth/google?flow=activation&firmSlug=${encodeURIComponent(firmSlug)}`;
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
          <div className="alert alert-error" style={{ textAlign: 'center', padding: '1.5rem' }}>
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
            <p className="text-secondary">Redirecting to login...</p>
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
          <Button
            type="button"
            variant="secondary"
            fullWidth
            style={{ marginTop: '1rem' }}
            onClick={handleGoogleLogin}
          >
            Continue with Google
          </Button>
          <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            You can use your invited email with Google Sign-In. No new accounts will be created.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="set-password-form">
          {error && (
            <div className="alert alert-error">
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
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
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
            disabled={loading}
          >
            {loading ? 'Setting Password...' : 'Set Password'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
