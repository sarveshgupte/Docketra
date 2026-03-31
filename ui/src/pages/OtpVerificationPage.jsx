import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import api from '../services/api';
import { authService } from '../services/authService';
import { useAuth } from '../hooks/useAuth';

export const OtpVerificationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const email = String(location.state?.email || '').trim().toLowerCase();
  const purpose = location.state?.purpose || 'login';

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email) {
      setError('Missing email. Please restart login/signup.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', { email, otp, purpose });
      const payload = response?.data || {};
      authService.setSessionTokens(payload);
      const profileResult = await fetchProfile();
      if (profileResult?.success) {
        navigate(resolvePostAuthRoute(profileResult.data), { replace: true });
      } else {
        navigate('/superadmin', { replace: true });
      }
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">Verify OTP</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">Enter the 6-digit code sent to {email || 'your email'}.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            label="OTP"
            type="text"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            required
            disabled={loading}
          />

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading || otp.length !== 6}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
