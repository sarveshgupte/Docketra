import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../../utils/validators';
import { spacingClasses } from '../../theme/tokens';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;
const getOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '');
const buildFallbackFirmLoginUrl = (firmSlug) => (firmSlug ? `${getOrigin()}/${firmSlug}/login` : '');

const mapSafeError = (error, fallback) => {
  const status = error?.response?.status;
  if (status === 429) return 'Too many attempts. Please wait and try again.';
  if (status === 409) return 'Email or phone is already registered.';
  if (status === 400 || status === 401) return 'Please check your details and try again.';
  return fallback;
};

export default function Signup() {
  const navigate = useNavigate();
  const { signup, verifySignup, resendSignupOtp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState({});
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
  const [cooldown, setCooldown] = useState(30);
  const [signupSuccessData, setSignupSuccessData] = useState(null);
  const otpInputRef = useRef(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    firmName: '',
    phone: '',
  });

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setApiError('');
  };

  useEffect(() => {
    if (step === 2) {
      otpInputRef.current?.focus();
      setCooldown(30);
    }
    setErrors({});
    setApiError('');
  }, [step]);

  useEffect(() => {
    if (step !== 2 || cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, cooldown]);

  useEffect(() => {
    if (step === 2 && !form.email.trim()) {
      setStep(1);
    }
  }, [form.email, step]);

  const submitStepOne = async (event) => {
    event.preventDefault();
    if (loading) return;
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (!form.email.trim()) nextErrors.email = 'Email is required';
    else if (!emailPattern.test(form.email.trim())) nextErrors.email = 'Enter a valid email address';
    if (!form.password) nextErrors.password = 'Password is required';
    else if (!validateStrongPassword(form.password)) nextErrors.password = STRONG_PASSWORD_MESSAGE;
    if (!form.firmName.trim()) nextErrors.firmName = 'Firm name is required';
    if (!phonePattern.test(form.phone.trim())) nextErrors.phone = 'Phone must be 10 digits';

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    setApiError('');
    try {
      await signup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firmName: form.firmName.trim(),
        phone: form.phone.trim(),
      });
      setStep(2);
      setOtp('');
      setOtpInfo(`OTP sent to ${form.email.trim().toLowerCase()}`);
    } catch (error) {
      setApiError(mapSafeError(error, 'Unable to start signup right now.'));
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    if (loading) return;
    setErrors({});
    if (!/^\d{6}$/.test(otp.trim())) {
      setErrors({ otp: 'Enter the 6-digit OTP.' });
      return;
    }

    setLoading(true);
    setApiError('');
    try {
      const response = await verifySignup({
        email: form.email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      const responseData = response?.data || {};
      const resolvedFirmSlug = responseData?.firmSlug || '';
      const resolvedRedirectPath = responseData?.redirectPath || '';
      const resolvedFirmUrl = responseData?.firmUrl
        || (resolvedRedirectPath ? `${getOrigin()}${resolvedRedirectPath}` : buildFallbackFirmLoginUrl(resolvedFirmSlug));
      setSignupSuccessData({
        firmSlug: resolvedFirmSlug,
        firmUrl: resolvedFirmUrl,
        redirectPath: resolvedRedirectPath,
        xid: responseData?.xid || '',
      });
    } catch (error) {
      const status = error?.response?.status;
      if (status === 400 || status === 401) setApiError('Invalid or expired OTP');
      else setApiError(mapSafeError(error, 'Unable to verify OTP right now.'));
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (loading || cooldown > 0) return;
    setLoading(true);
    setApiError('');
    try {
      const response = await resendSignupOtp(form.email.trim().toLowerCase());
      setOtpInfo(response?.data?.message || 'OTP sent.');
      setOtp('');
      setCooldown(30);
    } catch (error) {
      setApiError(mapSafeError(error, 'Unable to resend OTP right now.'));
    } finally {
      setLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    const redirectPath = signupSuccessData?.redirectPath;
    const slug = signupSuccessData?.firmSlug;
    const firmUrl = signupSuccessData?.firmUrl;

    if (redirectPath) {
      navigate(redirectPath, { replace: true });
      return;
    }

    if (firmUrl) {
      window.location.assign(firmUrl);
      return;
    }

    if (slug) {
      navigate(`/${slug}/login`, { replace: true });
      return;
    }
    navigate('/', { replace: true });
  };

  if (signupSuccessData) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-center">🎉 Workspace created successfully</h1>
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
            <p><span className="font-medium">Firm URL:</span> {signupSuccessData.firmUrl || buildFallbackFirmLoginUrl(signupSuccessData.firmSlug)}</p>
            <p><span className="font-medium">Your XID:</span> {signupSuccessData.xid}</p>
          </div>
          <Button type="button" variant="primary" fullWidth onClick={handleLoginRedirect}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold text-center">Create your workspace</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">Step {step} of 2</p>
        <p className="mt-2 text-sm text-gray-500 text-center">{step === 1 ? 'Takes less than 1 minute' : 'Enter the 6-digit code sent to your email'}</p>

        {apiError && <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{apiError}</div>}

        {step === 1 ? (
          <form className={`mt-6 ${spacingClasses.formFieldSpacing} w-full`} onSubmit={submitStepOne} noValidate>
            <Input id="signup-name" type="text" name="name" label="Name" className="w-full" value={form.name} onChange={onFormChange} disabled={loading} error={errors.name} required />
            <Input id="signup-email" type="email" name="email" label="Email" className="w-full" value={form.email} onChange={onFormChange} disabled={loading} error={errors.email} required autoComplete="username" />
            <Input id="signup-password" type="password" name="password" label="Password" className="w-full" value={form.password} onChange={onFormChange} disabled={loading} error={errors.password} required autoComplete="current-password" />
            <Input id="signup-firm" type="text" name="firmName" label="Firm name" className="w-full" value={form.firmName} onChange={onFormChange} disabled={loading} error={errors.firmName} required />
            <Input id="signup-phone" type="text" name="phone" label="Phone" className="w-full" value={form.phone} onChange={onFormChange} disabled={loading} error={errors.phone} required />
            <p className="text-xs text-gray-500">{STRONG_PASSWORD_MESSAGE}</p>
            <Button type="submit" variant="primary" fullWidth disabled={loading} loading={loading}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </Button>
          </form>
        ) : (
          <form className={`mt-6 ${spacingClasses.formFieldSpacing} w-full`} onSubmit={submitOtp} noValidate>
            {otpInfo && <p className="text-xs text-gray-500">{otpInfo}</p>}
            <Input
              ref={otpInputRef}
              id="signup-otp"
              type="text"
              name="otp"
              label="Email OTP"
              className="w-full"
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrors((prev) => ({ ...prev, otp: '' })); }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                if (pasted.length === 6) {
                  e.preventDefault();
                  setOtp(pasted);
                }
              }}
              disabled={loading}
              error={errors.otp}
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <Button type="submit" variant="primary" fullWidth disabled={loading} loading={loading}>
              {loading ? 'Verifying...' : 'Verify & create workspace'}
            </Button>
            <Button
              type="button"
              disabled={loading || cooldown > 0}
              onClick={resendOtp}
              variant="outline"
              fullWidth
            >
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={() => setStep(1)}
              variant="outline"
              fullWidth
            >
              Back
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-[12px] text-gray-500 sm:text-[13px]">
          By signing up, you agree to our <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Terms &amp; Conditions</Link> and <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
