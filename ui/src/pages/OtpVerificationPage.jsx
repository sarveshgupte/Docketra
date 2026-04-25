import React, { useEffect, useRef, useState } from 'react';
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
import { authApi } from '../api/auth.api';
import { resolvePostAuthNavigation } from '../utils/postAuthNavigation';

export const OtpVerificationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [info, setInfo] = useState('');
  const inputRefs = useRef([]);

  const email = String(location.state?.email || '').trim().toLowerCase();
  const purpose = location.state?.purpose || 'login';

  const otp = otpDigits.join('');
  const isOtpValid = /^\d{6}$/.test(otp);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    const next = [...otpDigits];
    for (let index = 0; index < 6; index += 1) {
      next[index] = pasted[index] || '';
    }
    setOtpDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleResend = async () => {
    if (!email || cooldown > 0 || loading) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await authApi.signupResendOtp(email);
      setCooldown(30);
      setInfo(`A new OTP was sent to ${email}.`);
    } catch (resendError) {
      setError(resendError?.response?.data?.message || 'Unable to resend OTP right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
      const profileResult = await fetchProfile({ force: true });
      if (profileResult?.success) {
        const nextRoute = resolvePostAuthNavigation({
          locationSearch: location.search,
          user: profileResult.data,
          resolvePostAuthRoute,
        });
        navigate(nextRoute, { replace: true });
      } else {
        setError('OTP verified, but your workspace context could not be loaded. Please sign in again.');
      }
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Invalid OTP. Enter the latest 6-digit code and try again.');
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
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Email OTP <span className="text-red-500">*</span></p>
            <div className="grid grid-cols-6 gap-2" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, index) => (
                <Input
                  key={`otp-${index + 1}`}
                  ref={(element) => { inputRefs.current[index] = element; }}
                  label=""
                  type="text"
                  value={digit}
                  onChange={(event) => handleOtpDigit(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Backspace' && !digit && index > 0) {
                      inputRefs.current[index - 1]?.focus();
                    }
                  }}
                  required
                  disabled={loading}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className="text-center"
                />
              ))}
            </div>
            <p className="text-xs text-gray-500">Tip: You can paste the full OTP directly.</p>
          </div>

          {error && (<ErrorState title="OTP verification failed" description={error} />)}
          {info ? <p className="text-sm text-emerald-600">{info}</p> : null}

          <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading || !isOtpValid}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </Button>
          <Button type="button" variant="outline" fullWidth disabled={loading || cooldown > 0} onClick={handleResend}>
            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
