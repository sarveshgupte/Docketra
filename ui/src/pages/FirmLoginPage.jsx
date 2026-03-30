/**
 * Firm Login Page
 * Firm-scoped login using path-based URL: /:firmSlug/login
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { validateEmail, validatePassword, validateXID } from '../utils/validators';
import { STORAGE_KEYS } from '../utils/constants';
import { isAccessTokenOnlyUser } from '../utils/authUtils';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
import GoogleSignIn from '../components/auth/GoogleSignIn';
import './LoginPage.css';

const getLoginErrorMessage = (error) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;

  if (status === 403) {
    return message || 'This account belongs to a different workspace';
  }

  if (status === 404) {
    return message || 'Firm not found. Please check your workspace URL.';
  }

  if (status === 401) {
    return 'Invalid credentials';
  }

  return message || 'Sign-in failed. Please try again.';
};

export const FirmLoginPage = () => {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const { fetchProfile } = useAuth();
  const { showError, showSuccess } = useToast();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [firmLoading, setFirmLoading] = useState(true);
  const [firmData, setFirmData] = useState(null);

  useEffect(() => {
    const loadFirmData = async () => {
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
        setError('Firm not found. Please check your login URL.');
        setFirmData(null);
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      } finally {
        setFirmLoading(false);
      }
    };

    if (firmSlug) {
      loadFirmData();
    }
  }, [firmSlug]);

  const completeLogin = async (responseData) => {
    const { accessToken, refreshToken, data: userData, refreshEnabled } = responseData;

    const userWithFlags = {
      ...userData,
      refreshEnabled: refreshEnabled !== undefined ? refreshEnabled : userData?.refreshEnabled,
      isSuperAdmin: responseData.isSuperAdmin !== undefined ? responseData.isSuperAdmin : userData?.isSuperAdmin,
    };

    const accessTokenOnly = isAccessTokenOnlyUser(userWithFlags);

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (!accessTokenOnly && refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    } else {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }

    const profileResult = await fetchProfile();
    showSuccess('Signed in successfully.');

    if (profileResult?.success) {
      if (responseData.isOnboarded === false || responseData?.data?.isOnboarded === false) {
        navigate('/complete-profile', { replace: true });
        return;
      }
      navigate(`/app/firm/${firmSlug}/dashboard`, { replace: true });
    }
  };

  const handleLoginIdChange = (event) => {
    setLoginId(event.target.value);
    setError('');
    setFieldErrors((current) => ({ ...current, loginId: '' }));
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    setError('');
    setFieldErrors((current) => ({ ...current, password: '' }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    const normalizedLoginId = loginId.trim();
    const isEmail = normalizedLoginId.includes('@');
    const normalizedXid = normalizedLoginId.toUpperCase();

    if (!normalizedLoginId) {
      setFieldErrors({ loginId: 'Email or xID is required.' });
      return;
    }

    if (isEmail && !validateEmail(normalizedLoginId.toLowerCase())) {
      setFieldErrors({ loginId: 'Please enter a valid email address.' });
      return;
    }

    if (!isEmail && !validateXID(normalizedXid)) {
      setFieldErrors({ loginId: 'Please enter a valid xID (for example, X123456).' });
      return;
    }

    if (!validatePassword(password)) {
      setFieldErrors({ password: 'Password must be at least 8 characters.' });
      return;
    }

    if (!firmData) {
      setError('Firm details are still loading. Please refresh the page.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        loginId: isEmail ? normalizedLoginId.toLowerCase() : normalizedXid,
        password,
        firmSlug,
      });

      await completeLogin(response.data);
    } catch (err) {
      const message = getLoginErrorMessage(err);
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  if (firmLoading) {
    return (
      <div className="auth-wrapper">
        <Card className="auth-card max-w-form">
          <Loading message="Loading firm information..." />
        </Card>
      </div>
    );
  }

  if (!firmData) {
    return (
      <div className="auth-wrapper">
        <Card className="auth-card max-w-form">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">Sign in to Docketra</h1>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
            <p className="auth-helper-text text-center">
              Please contact your administrator for the correct login URL.
            </p>
            <Button type="button" variant="secondary" fullWidth onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">{firmData.name}</h1>
          <p className="mt-2 text-sm text-gray-500 text-center">Sign in using Google or your email/xID and password.</p>
          <p className="mt-2 text-xs text-gray-500 text-center">{`Firm login URL: /${firmSlug}/login`}</p>
        </div>

        {error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <div className="mt-6">
          <GoogleSignIn
            firmSlug={firmSlug}
            redirectAuthenticated={`/${firmSlug}/dashboard`}
            onError={(googleError) => setError(googleError?.message || 'Google sign-in failed')}
          />
        </div>

        <div className="flex items-center gap-2 py-1">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-500">OR</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleLogin} noValidate className="mt-4 space-y-4">
          <Input
            label="Email or xID"
            type="text"
            value={loginId}
            onChange={handleLoginIdChange}
            error={fieldErrors.loginId}
            required
            placeholder="you@firm.com or X123456"
            autoComplete="username"
            disabled={loading}
            autoFocus
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

          <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>

          <div className="text-center space-y-3">
            <Link
              to={`/${firmSlug}/forgot-password`}
              className="block text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Forgot Password?
            </Link>
            <Link
              to="/signup"
              className="block text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Need a workspace? Create one here.
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};
