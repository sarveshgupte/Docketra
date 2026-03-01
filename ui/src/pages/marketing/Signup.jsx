import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)] bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

export default function Signup() {
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiMessage, setApiMessage] = useState('');
  const [googleReady, setGoogleReady] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [signupEmail, setSignupEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [firmName, setFirmName] = useState('');
  const [result, setResult] = useState({ xid: '', firmUrl: '' });
  const [errors, setErrors] = useState({});

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    if (window.google?.accounts?.id) {
      setGoogleReady(true);
      return;
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => setGoogleReady(true), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
  }, [googleClientId]);

  const requestGoogleIdToken = () => new Promise((resolve, reject) => {
    const googleAccounts = window.google?.accounts?.id;
    if (!googleAccounts) {
      reject(new Error('Google Sign-In is currently unavailable.'));
      return;
    }

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Google Sign-In timed out. Please try again.'));
    }, 60000);

    googleAccounts.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        if (!response?.credential) {
          reject(new Error('Google Sign-In failed. Please try again.'));
          return;
        }
        resolve(response.credential);
      },
    });

    googleAccounts.prompt((notification) => {
      if (settled) return;
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        settled = true;
        window.clearTimeout(timeoutId);
        reject(new Error('Google Sign-In was cancelled or unavailable.'));
      }
    });
  });

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
      await api.post('/public/initiate-signup', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      });
      setSignupEmail(form.email.trim());
      setStep('otp');
      setOtp('');
      setApiMessage('OTP sent to your email.');
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to start signup. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const submitOtpVerification = async (event) => {
    event.preventDefault();
    setApiError('');
    setApiMessage('');

    if (!/^\d{6}$/.test(otp.trim())) {
      setErrors({ otp: 'Enter a valid 6-digit OTP' });
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await api.post('/public/verify-otp', {
        email: signupEmail,
        otp: otp.trim(),
      });
      setStep('firm');
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to verify OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setApiError('');
    setApiMessage('');
    setErrors((prev) => ({ ...prev, otp: '' }));
    setLoading(true);
    try {
      const response = await api.post('/public/resend-otp', { email: signupEmail });
      setApiMessage(response?.data?.message || 'OTP resent successfully.');
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to resend OTP right now.'));
    } finally {
      setLoading(false);
    }
  };

  const submitGoogleSignup = async () => {
    setApiError('');
    setApiMessage('');

    if (!googleClientId) {
      setApiError('Google Sign-In is not configured.');
      return;
    }

    setLoading(true);
    try {
      const idToken = await requestGoogleIdToken();
      const response = await api.post('/public/google-auth', { idToken });
      const email = response?.data?.email;
      if (!email) {
        throw new Error('Unable to verify Google account email.');
      }
      setSignupEmail(email);
      setStep('firm');
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to continue with Google.'));
    } finally {
      setLoading(false);
    }
  };

  const submitFirm = async (event) => {
    event.preventDefault();
    setApiError('');
    setApiMessage('');

    if (!firmName.trim()) {
      setErrors({ firmName: 'Firm name is required' });
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const response = await api.post('/public/complete-signup', {
        email: signupEmail,
        firmName: firmName.trim(),
      });
      setResult({
        xid: response?.data?.xid || '',
        firmUrl: response?.data?.firmUrl || '',
      });
      setStep('success');
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to complete signup. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full bg-white py-20">
      <div className="mx-auto max-w-lg px-6">
        <div className="signup-form-card p-8">
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
                <label htmlFor="signup-password" className={labelClass}>Password</label>
                <input
                  id="signup-password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={onFormChange}
                  className={inputClass}
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
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
              <button
                type="button"
                onClick={submitGoogleSignup}
                disabled={loading || !googleReady}
                className="marketing-btn-secondary inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" /> : null}
                {googleReady ? 'Continue with Google' : 'Loading Google Sign-In…'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form className="mt-6 space-y-4" onSubmit={submitOtpVerification}>
              <div>
                <label htmlFor="otp-email" className={labelClass}>Email</label>
                <input id="otp-email" value={signupEmail} className={inputClass} readOnly />
              </div>
              <div>
                <label htmlFor="otp-code" className={labelClass}>6-digit OTP</label>
                <input
                  id="otp-code"
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setErrors((prev) => ({ ...prev, otp: '' }));
                  }}
                  className={inputClass}
                  disabled={loading}
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
                {errors.otp && <p className="mt-1 text-xs text-red-600">{errors.otp}</p>}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading}
                  className="marketing-btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                  Verify OTP
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                  className="marketing-btn-secondary inline-flex w-full items-center justify-center px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          {step === 'firm' && (
            <form className="mt-6 space-y-4" onSubmit={submitFirm}>
              <div>
                <label htmlFor="firm-email" className={labelClass}>Email</label>
                <input id="firm-email" value={signupEmail} className={inputClass} readOnly />
              </div>
              <div>
                <label htmlFor="firm-name" className={labelClass}>Firm Name</label>
                <input
                  id="firm-name"
                  value={firmName}
                  onChange={(event) => {
                    setFirmName(event.target.value);
                    setErrors((prev) => ({ ...prev, firmName: '' }));
                  }}
                  className={inputClass}
                  disabled={loading}
                  required
                />
                {errors.firmName && <p className="mt-1 text-xs text-red-600">{errors.firmName}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="marketing-btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                Complete Signup
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="mt-6 space-y-4 rounded-lg border border-green-200 bg-green-50 p-5 text-sm text-green-800">
              <h2 className="text-lg font-semibold text-green-900">🎉 Signup successful</h2>
              <p><span className="font-medium">XID:</span> {result.xid || '—'}</p>
              <p>
                <span className="font-medium">Firm URL:</span>{' '}
                {result.firmUrl ? (
                  <a href={result.firmUrl} className="underline" target="_blank" rel="noreferrer">
                    {result.firmUrl}
                  </a>
                ) : '—'}
              </p>
              <p>Details have been sent to your email.</p>
              {result.firmUrl && (
                <a
                  href={result.firmUrl}
                  className="marketing-btn-primary inline-flex items-center justify-center px-4 py-2 text-sm font-medium"
                  target="_blank"
                  rel="noreferrer"
                >
                  Go to Firm
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
