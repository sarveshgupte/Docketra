import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)] bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RESEND_COOLDOWN = 60;
const OTP_LENGTH = 6;
const OTP_BLOCK_DURATION_SECONDS = 15 * 60;

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

export default function Signup() {
  const isGoogleLoginEnabled = String(import.meta.env.VITE_ENABLE_GOOGLE_LOGIN || '').toLowerCase() === 'true';
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
  const [otpDigits, setOtpDigits] = useState(() => Array(OTP_LENGTH).fill(''));
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(OTP_RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);
  const [otpBlockedSeconds, setOtpBlockedSeconds] = useState(0);
  const otpInputRefs = useRef([]);
  const otpValue = useMemo(() => otpDigits.join(''), [otpDigits]);
  const isOtpBlocked = otpBlockedSeconds > 0;

  const extractBlockedSeconds = (message) => {
    const secondsMatch = message.match(/(\d+)\s*seconds?/i);
    if (secondsMatch) return Number(secondsMatch[1]);
    const minutesMatch = message.match(/(\d+)\s*minutes?/i);
    if (minutesMatch) return Number(minutesMatch[1]) * 60;
    return OTP_BLOCK_DURATION_SECONDS;
  };

  const focusOtpInput = (index) => {
    const input = otpInputRefs.current[index];
    if (input) input.focus();
  };

  const resetOtpState = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setResendTimer(OTP_RESEND_COOLDOWN);
    setCanResend(false);
    setOtpBlockedSeconds(0);
    setErrors((prev) => ({ ...prev, otp: '' }));
  };

  useEffect(() => {
    if (step !== 'otp') return;
    resetOtpState();
  }, [step]);

  useEffect(() => {
    if (step !== 'otp') return;

    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => {
      setResendTimer((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendTimer, step]);

  useEffect(() => {
    if (step !== 'otp' || otpBlockedSeconds <= 0) return undefined;

    const timer = setTimeout(() => {
      setOtpBlockedSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [otpBlockedSeconds, step]);

  useEffect(() => {
    if (step === 'otp') {
      focusOtpInput(0);
    }
  }, [step]);

  const onFormChange = (event) => {
    const { name, value } = event.target;
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
    } else if (form.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
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
        phone: form.phone.trim() || undefined,
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

  const submitOtpVerification = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    setApiError('');
    setApiMessage('');

    if (!/^\d{6}$/.test(otpValue.trim())) {
      setErrors({ otp: 'Enter a valid 6-digit OTP' });
      return;
    }
    if (isOtpBlocked) {
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await api.post('/public/verify-otp', {
        email: signupEmail,
        otp: otpValue.trim(),
      });

      const response = await api.post('/public/complete-signup', {
        email: signupEmail,
      });
      const firmSlug = response?.data?.firmSlug;
      const redirectPathFromApi = response?.data?.redirectPath;
      const safeRedirectPath = typeof redirectPathFromApi === 'string'
        && redirectPathFromApi.startsWith('/')
        && !redirectPathFromApi.startsWith('//')
        && !/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(redirectPathFromApi)
        ? redirectPathFromApi
        : (firmSlug ? `/${firmSlug}/login` : null);
      if (!safeRedirectPath) {
        setApiError('Unable to resolve firm login URL. Please try signing in from your firm login page.');
        return;
      }
      window.location.assign(safeRedirectPath);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to complete signup. Please try again.');
      if (error?.response?.status === 429 && /too many incorrect otp attempts/i.test(message)) {
        const retryAfterSeconds = Number(error?.response?.data?.retryAfterSeconds);
        const blockedSeconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds
          : extractBlockedSeconds(message);
        setOtpBlockedSeconds(blockedSeconds);
        setErrors((prev) => ({ ...prev, otp: '' }));
        setApiError('');
      } else if (message === 'Invalid OTP') {
        setApiError('Invalid OTP. Please try again.');
      } else {
        setApiError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== 'otp') return;
    if (otpValue.length === OTP_LENGTH && /^\d{6}$/.test(otpValue) && !loading && !isOtpBlocked) {
      submitOtpVerification();
    }
  }, [otpValue, loading, step, isOtpBlocked]);

  const resendOtp = async () => {
    setApiError('');
    setApiMessage('');
    setErrors((prev) => ({ ...prev, otp: '' }));
    setLoading(true);
    try {
      const response = await api.post('/public/resend-otp', { email: signupEmail });
      setApiMessage(response?.data?.message || 'OTP resent successfully.');
      setResendTimer(OTP_RESEND_COOLDOWN);
      setCanResend(false);
      setOtpBlockedSeconds(0);
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to resend OTP right now.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, rawValue) => {
    const value = rawValue.replace(/\D/g, '').slice(-1);
    setApiError('');
    setApiMessage('');
    setErrors((prev) => ({ ...prev, otp: '' }));

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    if (value && index < OTP_LENGTH - 1) {
      focusOtpInput(index + 1);
    }
  };

  const handleOtpKeyDown = (event, index) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      focusOtpInput(index - 1);
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const nextDigits = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((digit, idx) => {
      nextDigits[idx] = digit;
    });
    setOtpDigits(nextDigits);
    setErrors((prev) => ({ ...prev, otp: '' }));
    focusOtpInput(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  return (
    <section className="flex min-h-screen w-full items-center justify-center bg-white px-6 py-10">
      <div className="signup-form-card w-full max-w-[420px] p-8">
          <h1 className="type-section text-gray-900">Starter Signup</h1>
          <p className="mt-2 text-sm text-gray-600">Create your free Starter workspace in minutes.</p>

          {apiError && (
            <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {apiError}
            </div>
          )}
          {apiMessage && (
            <div role="status" className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
              {apiMessage}
            </div>
          )}

          {step === 'form' && (
            <form className="mt-6 space-y-4" onSubmit={submitManualSignup}>
              <div>
                <label htmlFor="signup-name" className={labelClass}>Name</label>
                <input
                  id="signup-name"
                  name="name"
                  value={form.name}
                  onChange={onFormChange}
                  className={inputClass}
                  disabled={loading}
                  autoComplete="name"
                  required
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="signup-email" className={labelClass}>Email</label>
                <input
                  id="signup-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onFormChange}
                  className={inputClass}
                  disabled={loading}
                  autoComplete="email"
                  required
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="signup-firm-name" className={labelClass}>Firm Name</label>
                <input
                  id="signup-firm-name"
                  name="firmName"
                  value={form.firmName}
                  onChange={onFormChange}
                  className={inputClass}
                  disabled={loading}
                  required
                />
                {errors.firmName && <p className="mt-1 text-xs text-red-600">{errors.firmName}</p>}
              </div>
              <div>
                <label htmlFor="signup-password" className={labelClass}>Password</label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={onFormChange}
                    className={`${inputClass} pr-10`}
                    disabled={loading}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-gray-500 hover:text-gray-700"
                    disabled={loading}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <path d="M2.46 12C3.73 7.94 7.52 5 12 5c4.48 0 8.27 2.94 9.54 7-1.27 4.06-5.06 7-9.54 7-4.48 0-8.27-2.94-9.54-7Z" />
                      <circle cx="12" cy="12" r="3" />
                      {showPassword && <path d="M4 4l16 16" />}
                    </svg>
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>
              <div>
                <label htmlFor="signup-phone" className={labelClass}>Phone (optional)</label>
                <input
                  id="signup-phone"
                  name="phone"
                  value={form.phone}
                  onChange={onFormChange}
                  className={inputClass}
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="marketing-btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                {loading ? 'Submitting…' : 'Sign up with Email'}
              </button>
              {isGoogleLoginEnabled && (
                <button
                  type="button"
                  disabled={loading}
                  className="marketing-btn-secondary inline-flex w-full items-center justify-center px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue with Google
                </button>
              )}
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
          )}

          {step === 'otp' && (
            <form className="mt-6 space-y-4" onSubmit={submitOtpVerification}>
              <div>
                <label htmlFor="otp-email" className={labelClass}>Email</label>
                <input id="otp-email" value={signupEmail} className={inputClass} readOnly />
              </div>
              <div>
                <label htmlFor="otp-digit-0" className={labelClass}>6-digit OTP</label>
                <div className="flex items-center gap-2" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, index) => (
                    <input
                      key={`otp-digit-${index + 1}`}
                      id={`otp-digit-${index}`}
                      ref={(node) => {
                        otpInputRefs.current[index] = node;
                      }}
                      value={digit}
                      onChange={(event) => handleOtpChange(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(event, index)}
                      className="h-12 w-12 rounded-lg border border-gray-300 text-center text-lg font-semibold text-gray-900 outline-none transition-colors duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)] bg-white"
                      disabled={loading || isOtpBlocked}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      required
                    />
                  ))}
                </div>
                {loading && <p className="mt-2 text-xs text-gray-600">Verifying OTP...</p>}
                {isOtpBlocked && !loading && (
                  <p className="mt-2 text-xs text-red-600">
                    Too many incorrect OTP attempts. Please try again in {otpBlockedSeconds}s.
                  </p>
                )}
                {errors.otp && <p className="mt-1 text-xs text-red-600">{errors.otp}</p>}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading || isOtpBlocked}
                  className="marketing-btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                  {loading ? 'Verifying OTP...' : (isOtpBlocked ? `Verify OTP (${otpBlockedSeconds}s)` : 'Verify OTP')}
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading || !canResend}
                  className="marketing-btn-secondary inline-flex w-full items-center justify-center px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {canResend ? 'Resend OTP' : `Resend OTP (${resendTimer}s)`}
                </button>
              </div>
            </form>
          )}

      </div>
    </section>
  );
}
