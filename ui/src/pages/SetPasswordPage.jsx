/**
 * Set Password Page
 * Allows users to set their password using a token from email
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { authService } from '../services/authService';
import api from '../services/api';
import { APP_NAME, STORAGE_KEYS, API_BASE_URL } from '../utils/constants';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../utils/validators';
import './SetPasswordPage.css';

export const SetPasswordPage = () => {
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
        const resolvedFirmSlug = response.firmSlug || firmSlug || null;
        const redirectPath = response.redirectUrl
          || (resolvedFirmSlug ? `/${resolvedFirmSlug}/login` : '/login');
        setTimeout(() => {
          window.location.href = redirectPath;
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

  const handleGoogleSignup = () => {
    if (!token || !firmSlug) return;

    const params = new URLSearchParams({
      intent: 'signup',
      firmSlug,
      setupToken: token,
    });

    const targetUrl = new URL(`${API_BASE_URL}/auth/google/start?${params.toString()}`, window.location.origin).toString();
    window.location.assign(targetUrl);
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

          {firmSlug && token && (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                fullWidth
                disabled={loading}
                onClick={handleGoogleSignup}
                className="flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 0, 0)">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.6h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.4c0,-0.74 -0.07,-1.4 -0.33,-2z" fill="#4285F4" />
                    <path d="M12,20.6c2.43,0 4.47,-0.8 5.96,-2.2l-3.3,-2.6c-0.9,0.6 -2.07,0.98 -3.3,0.98 -2.34,0 -4.33,-1.58 -5.04,-3.7H3v2.6c1.5,3 4.5,4.92 8,4.92z" fill="#34A853" />
                    <path d="M6.96,13.08a5.1,5.1 0 0,1 0,-2.16V8.32H3a8.6,8.6 0 0,0 0,7.36l3.96,-2.6z" fill="#FBBC05" />
                    <path d="M12,7.2c1.32,0 2.5,0.45 3.44,1.35l2.58,-2.58C16.46,4.4 14.43,3.6 12,3.6c-3.5,0 -6.5,1.92 -8,4.92l3.96,3.08c0.71,-2.12 2.7,-3.7 5.04,-3.7z" fill="#EA4335" />
                  </g>
                </svg>
                Continue with Google instead
              </Button>
            </div>
          )}

        </form>
      </Card>
    </div>
  );
};
