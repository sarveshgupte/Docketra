import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import GoogleSignIn from '../../components/auth/GoogleSignIn';
import api from '../../services/api';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../../utils/validators';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9]{10}$/;
const partialPhonePattern = /^[0-9]{0,10}$/;
const OTP_LENGTH = 6;
const OTP_RESEND_COOLDOWN = 60;
const PASSWORD_HINT_ID = 'signup-password-policy-hint';
const OTP_HINT_ID = 'signup-otp-hint';

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

const resolveSafeLoginPath = ({ redirectPathFromApi, firmSlug, fallbackPath }) => {
  const isSafeRedirectPath = typeof redirectPathFromApi === 'string'
    && redirectPathFromApi.startsWith('/')
    && !redirectPathFromApi.startsWith('//')
    && !/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(redirectPathFromApi);

  if (isSafeRedirectPath) {
    return redirectPathFromApi;
  }

  if (firmSlug) {
    return `/${firmSlug}/login`;
  }

  return fallbackPath;
};

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiMessage, setApiMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    firmName: '',
    password: '',
    phone: '',
  });
  const [signupEmail, setSignupEmail] = useState('');
  const [loginRedirectPath, setLoginRedirectPath] = useState('/signup');
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [errors, setErrors] = useState({});
  const [resendTimer, setResendTimer] = useState(OTP_RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef([]);
  const autoSubmittedOtpRef = useRef('');
  const otp = useMemo(() => otpDigits.join(''), [otpDigits]);
  const getDescribedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined;

  useEffect(() => {
    if (step !== 'otp') return;
    setResendTimer(OTP_RESEND_COOLDOWN);
    setCanResend(false);
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    autoSubmittedOtpRef.current = '';
    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 0);
  }, [step]);

  useEffect(() => {
    if (step !== 'otp') return;
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [step, resendTimer]);

  const onFormChange = (event) => {
    const { name, value } = event.target;
    if (name === 'phone' && !partialPhonePattern.test(value)) {
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setApiError('');
    setApiMessage('');
  };

  const submitManualSignup = async (event) => {
    event.preventDefault();
    setApiError('');
    setApiMessage('');

    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (!form.email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!emailPattern.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address';
    }
    if (!form.firmName.trim()) nextErrors.firmName = 'Firm name is required';
    if (!form.password) {
      nextErrors.password = 'Password is required';
    } else if (!validateStrongPassword(form.password)) {
      nextErrors.password = STRONG_PASSWORD_MESSAGE;
    }
    if (!phonePattern.test(form.phone)) {
      nextErrors.phone = 'Phone number must be 10 digits';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const email = form.email.trim();
      const response = await api.post('/public/initiate-signup', {
        name: form.name.trim(),
        email,
        firmName: form.firmName.trim(),
        password: form.password,
        phone: form.phone.trim(),
      });
      setSignupEmail(response?.data?.email || email);
      setStep('otp');
      setApiMessage(response?.data?.message || 'OTP sent to your email.');
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to start signup. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpCode = async (otpCode) => {
    setApiError('');
    setApiMessage('Verifying OTP...');

    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otpCode.trim())) {
      setErrors({ otp: 'Enter a valid 6-digit OTP' });
      setApiMessage('');
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const response = await api.post('/public/verify-otp', {
        email: signupEmail,
        otp: otpCode.trim(),
      });
      const firmSlug = response?.data?.firmSlug;
      const redirectPathFromApi = response?.data?.redirectPath;
      const safeRedirectPath = resolveSafeLoginPath({
        redirectPathFromApi,
        firmSlug,
        fallbackPath: loginRedirectPath.startsWith('/') ? loginRedirectPath : '/signup',
      });
      setLoginRedirectPath(safeRedirectPath);
      setStep('success');
      setApiMessage('');
    } catch (error) {
      setApiMessage('');
      const verificationError = error?.response?.status === 400
        ? 'Invalid OTP. Please try again.'
        : getErrorMessage(error, 'Verification failed. Please try again.');
      setApiError(verificationError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== 'otp' || loading) return;
    if (otp.length !== OTP_LENGTH || otpDigits.some((digit) => digit === '')) return;
    if (autoSubmittedOtpRef.current === otp) return;
    autoSubmittedOtpRef.current = otp;
    verifyOtpCode(otp);
  }, [otpDigits, step, loading]);

  const submitOtpVerification = async (event) => {
    event.preventDefault();
    await verifyOtpCode(otp);
  };

  const updateOtpDigits = (updater) => {
    setApiError('');
    setApiMessage('');
    setErrors((prev) => ({ ...prev, otp: '' }));
    setOtpDigits(updater);
    autoSubmittedOtpRef.current = '';
  };

  const handleOtpChange = (index, rawValue) => {
    const value = rawValue.replace(/\D/g, '');
    if (!value) {
      updateOtpDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    updateOtpDigits((prev) => {
      const next = [...prev];
      const digits = value.slice(0, OTP_LENGTH - index).split('');
      digits.forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      return next;
    });

    const nextFocusIndex = Math.min(index + value.length, OTP_LENGTH - 1);
    otpInputRefs.current[nextFocusIndex]?.focus();
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    const pastedValue = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pastedValue) return;
    event.preventDefault();
    updateOtpDigits(() => {
      const next = Array(OTP_LENGTH).fill('');
      pastedValue.split('').forEach((digit, index) => {
        next[index] = digit;
      });
      return next;
    });
    const nextFocusIndex = pastedValue.length < OTP_LENGTH ? pastedValue.length : OTP_LENGTH - 1;
    otpInputRefs.current[nextFocusIndex]?.focus();
  };

  const resendOtp = async () => {
    if (!canResend || loading) return;
    setApiError('');
    setApiMessage('');
    setErrors((prev) => ({ ...prev, otp: '' }));
    setLoading(true);
    try {
      const response = await api.post('/public/resend-otp', { email: signupEmail });
      setApiMessage(response?.data?.message || 'OTP resent successfully.');
      setResendTimer(OTP_RESEND_COOLDOWN);
      setCanResend(false);
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to resend OTP right now.'));
    } finally {
      setLoading(false);
    }
  };

  const resendCredentialsEmail = async () => {
    if (!signupEmail || loading) return;
    setApiError('');
    setApiMessage('');
    setLoading(true);
    try {
      const response = await api.post('/auth/resend-credentials', { email: signupEmail });
      setApiMessage(response?.data?.message || 'Credentials email sent. Please check your inbox.');
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to resend credentials email right now.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">Starter Signup</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">Create your free Starter workspace in minutes.</p>

        {apiError && (
          <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {apiError}
          </div>
        )}
        {apiMessage && (
          <div role="status" aria-live="polite" className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            {apiMessage}
          </div>
        )}

        {step === 'form' && (
          <>
            <GoogleSignIn className="mt-6 mb-2" />

            <div className="mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs uppercase tracking-wide text-gray-500">OR</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <form className="mt-4 space-y-4" onSubmit={submitManualSignup} noValidate>
            <p className="text-sm text-gray-500">Fields marked with * are required.</p>
            <Input
              id="signup-name"
              name="name"
              label="Name"
              value={form.name}
              onChange={onFormChange}
              disabled={loading}
              autoComplete="name"
              error={errors.name}
              required
            />

            <Input
              id="signup-email"
              type="email"
              name="email"
              label="Email"
              value={form.email}
              onChange={onFormChange}
              disabled={loading}
              autoComplete="email"
              error={errors.email}
              required
            />

            <Input
              id="signup-firm-name"
              name="firmName"
              label="Firm Name"
              value={form.firmName}
              onChange={onFormChange}
              disabled={loading}
              autoComplete="organization"
              error={errors.firmName}
              required
            />

            <Input
              id="signup-password"
              type="password"
              name="password"
              label="Password"
              value={form.password}
              onChange={onFormChange}
              disabled={loading}
              autoComplete="new-password"
              error={errors.password}
              aria-describedby={getDescribedBy(PASSWORD_HINT_ID)}
              minLength={8}
              required
            />

            <Input
              id="signup-phone"
              name="phone"
              label="Phone Number (+91)"
              value={form.phone}
              onChange={onFormChange}
              disabled={loading}
              autoComplete="tel"
              inputMode="numeric"
              pattern="[0-9]{10}"
              title="Enter a 10-digit Indian mobile number"
              maxLength={10}
              error={errors.phone}
              helpText="Enter a 10-digit Indian mobile number"
              required
            />

            <p id={PASSWORD_HINT_ID} className="text-xs text-gray-500">{STRONG_PASSWORD_MESSAGE}</p>

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              {loading ? 'Submitting…' : 'Sign up with Email'}
            </Button>

            <p className="text-center text-[12px] text-gray-500 sm:text-[13px]">
              By signing up, you agree to our{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
                Terms &amp; Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
                Privacy Policy
              </Link>
              .
            </p>
            </form>
          </>
        )}

        {step === 'otp' && (
          <form className="mt-6 space-y-4" onSubmit={submitOtpVerification} noValidate>
            <Input id="otp-email" label="Email" value={signupEmail} readOnly />

            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-gray-900 text-center">
                6-digit OTP<span className="ml-1 text-red-500" aria-hidden="true">*</span>
              </legend>
              <p id={OTP_HINT_ID} className="mt-2 text-sm text-gray-500 text-center">
                Enter the one-time password sent to your email.
              </p>
              <div className="mt-4 flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, index) => (
                  <Input
                    key={`otp-digit-${index}`}
                    id={`otp-code-${index}`}
                    ref={(element) => {
                      otpInputRefs.current[index] = element;
                    }}
                    value={digit}
                    onChange={(event) => handleOtpChange(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    className="w-11 [&_.input]:px-0 [&_.input]:text-center"
                    disabled={loading}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    aria-label={`OTP digit ${index + 1}`}
                    aria-invalid={errors.otp ? 'true' : undefined}
                    aria-describedby={getDescribedBy(errors.otp ? 'signup-otp-error' : null, OTP_HINT_ID)}
                    required
                  />
                ))}
              </div>
              {errors.otp && <p id="signup-otp-error" className="mt-2 text-xs text-red-600 text-center">{errors.otp}</p>}
            </fieldset>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" variant="primary" fullWidth loading={loading}>
                Verify OTP
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={resendOtp}
                disabled={loading || !canResend}
                fullWidth
              >
                {canResend ? 'Resend OTP' : `Resend OTP (${resendTimer}s)`}
              </Button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status" aria-live="polite">
              <p className="font-semibold">🎉 Your firm account has been created successfully.</p>
              <p className="mt-2">Your login credentials have been sent to your registered email address.</p>
              <p className="mt-2">Please check your email to find your XID and login instructions.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="primary" onClick={() => navigate(loginRedirectPath)} fullWidth>
                Go to Login
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={resendCredentialsEmail}
                disabled={loading}
                loading={loading}
                fullWidth
              >
                Resend Credentials Email
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
