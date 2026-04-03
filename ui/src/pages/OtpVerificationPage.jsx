import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import api from '../services/api';
import { authService } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { spacingClasses } from '../theme/tokens';
import { Stack } from '../components/layout/Stack';
import { Row } from '../components/layout/Row';
import { ErrorState } from '../components/feedback/ErrorState';

export const OtpVerificationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const email = String(location.state?.email || '').trim().toLowerCase();
  const purpose = location.state?.purpose || 'login';

  const isOtpValid = /^\d{6}$/.test(otp);

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
        <Stack space={8} className="items-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">Verify OTP</h1>
          <Row justify="center" gap={8}>
            <span className="h-2.5 w-2.5 rounded-full bg-blue-200" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true" />
          </Row>
          <p className="text-sm text-gray-500 text-center">Step 2 of 2 · Enter the 6-digit code sent to {email || 'your email'}.</p>
        </Stack>

        <form onSubmit={onSubmit} className={`mt-6 ${spacingClasses.formFieldSpacing}`} noValidate>
          <Input
            label="OTP"
            type="text"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            required
            disabled={loading}
          />

          {error && (<ErrorState title="OTP verification failed" description={error} />)}

          <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading || !isOtpValid}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
