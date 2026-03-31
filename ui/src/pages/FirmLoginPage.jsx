import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { validatePassword, validateXID } from '../utils/validators';
import { STORAGE_KEYS } from '../utils/constants';
import { isAccessTokenOnlyUser } from '../utils/authUtils';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
import './LoginPage.css';

const mapSafeLoginError = (error) => {
  const status = error?.response?.status;
  if (status === 429) return 'Too many attempts. Please wait before retrying.';
  if (status === 401 || status === 403) return 'Invalid credentials or verification code.';
  if (status === 404) return 'Firm not found. Please check your login URL.';
  return 'Sign-in failed. Please try again.';
};

export const FirmLoginPage = () => {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const { fetchProfile } = useAuth();
  const { showError, showSuccess } = useToast();

  const [xid, setXid] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loginToken, setLoginToken] = useState('');
  const [step, setStep] = useState('credentials');
  const [otpHint, setOtpHint] = useState('');
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
        if (response.data.success && response.data.data?.status === 'active') {
          setFirmData(response.data.data);
          localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlug);
        } else {
          setError('This firm is currently inactive.');
          setFirmData(null);
        }
      } catch (_err) {
        setError('Firm not found. Please check your login URL.');
        setFirmData(null);
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      } finally {
        setFirmLoading(false);
      }
    };

    if (firmSlug) loadFirmData();
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
    if (!accessTokenOnly && refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    else localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);

    const profileResult = await fetchProfile();
    if (profileResult?.success) {
      showSuccess('Signed in successfully.');
      navigate(`/app/firm/${firmSlug}/dashboard`, { replace: true });
    }
  };

  const handleCredentialSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    const normalizedXid = xid.trim().toUpperCase();
    if (!validateXID(normalizedXid)) {
      setFieldErrors({ xid: 'Enter a valid xID (example: X123456).' });
      return;
    }
    if (!validatePassword(password)) {
      setFieldErrors({ password: 'Password must be at least 8 characters.' });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/${firmSlug}/login`, { xid: normalizedXid, password });
      if (response?.data?.otpRequired && response?.data?.loginToken) {
        setLoginToken(response.data.loginToken);
        setOtpHint(response?.data?.otpDeliveryHint || 'A verification code was sent to your email.');
        setStep('otp');
      } else if (response?.data?.accessToken) {
        await completeLogin(response.data);
      } else {
        setError('Unexpected response. Please try again.');
      }
    } catch (err) {
      const message = mapSafeLoginError(err);
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) {
      setFieldErrors({ otp: 'Enter a valid 6-digit OTP.' });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/${firmSlug}/verify-otp`, { loginToken, otp: otp.trim() });
      await completeLogin(response.data);
    } catch (err) {
      const message = mapSafeLoginError(err);
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };


  const handleResendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const normalizedXid = xid.trim().toUpperCase();
      const response = await api.post(`/${firmSlug}/resend-otp`, { xid: normalizedXid });
      setOtpHint(response?.data?.message || 'If the account exists, a new OTP has been sent.');
    } catch (err) {
      const message = mapSafeLoginError(err);
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  if (firmLoading) return <div className="auth-wrapper"><Card className="auth-card max-w-form"><Loading message="Loading firm information..." /></Card></div>;

  if (!firmData) {
    return <div className="auth-wrapper"><Card className="auth-card max-w-form"><div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div></Card></div>;
  }

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">{firmData.name}</h1>
          <p className="mt-2 text-sm text-gray-500 text-center">Step {step === 'credentials' ? '1' : '2'} of 2</p>
          <p className="mt-2 text-xs text-gray-500 text-center">{`Firm login URL: /app/${firmSlug}/login`}</p>
        </div>

        {error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentialSubmit} noValidate className="mt-4 space-y-4">
            <Input label="xID" type="text" value={xid} onChange={(e) => setXid(e.target.value)} error={fieldErrors.xid} required placeholder="X123456" autoComplete="username" disabled={loading} autoFocus />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password} required placeholder="Enter your password" autoComplete="current-password" disabled={loading} />
            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>{loading ? 'Sending OTP...' : 'Continue'}</Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} noValidate className="mt-4 space-y-4">
            <Input label="Email OTP" type="text" value={otp} onChange={(e) => setOtp(e.target.value)} error={fieldErrors.otp} required placeholder="6-digit code" disabled={loading} autoFocus />
            {otpHint && <p className="text-xs text-gray-500">{otpHint}</p>}
            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>{loading ? 'Verifying...' : 'Sign in'}</Button>
            <Button type="button" variant="secondary" fullWidth disabled={loading} onClick={handleResendOtp}>Resend OTP</Button>
            <Button type="button" variant="secondary" fullWidth disabled={loading} onClick={() => setStep('credentials')}>Back</Button>
          </form>
        )}

        <div className="text-center space-y-3 mt-4">
          <Link to={`/app/${firmSlug}/forgot-password`} className="block text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">Forgot Password?</Link>
          <Link to="/signup" className="block text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">Need a workspace? Create one here.</Link>
        </div>
      </Card>
    </div>
  );
};
