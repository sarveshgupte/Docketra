import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../../utils/validators';
import { spacingClasses } from '../../theme/tokens';
import { ROUTES } from '../../constants/routes';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;
const getOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '');
const buildFallbackFirmLoginUrl = (firmSlug) => (firmSlug ? `${getOrigin()}/${firmSlug}/login` : '');

const mapSafeError = (error, fallback) => {
  const status = error?.response?.status;
  if (status === 429) return 'Too many attempts. Please wait and try again.';
  if (status === 409) return 'This email or phone may already be registered. Use login or password recovery.';
  if (status === 400 || status === 401) return 'Please check your details and try again.';
  return fallback;
};

export default function Signup() {
  const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const isTurnstileConfigured = Boolean(turnstileSiteKey);
  const navigate = useNavigate();
  const { signup, verifySignup, resendSignupOtp, resendCredentials, isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState({});
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
  const [cooldown, setCooldown] = useState(30);
  const [signupSuccessData, setSignupSuccessData] = useState(null);
  const [emailStatus, setEmailStatus] = useState('');
  const otpInputRef = useRef(null);
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState('');
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
    if (!isAuthenticated) return;
    const firmSlug = user?.firmSlug;
    if (firmSlug) {
      navigate(ROUTES.DASHBOARD(firmSlug), { replace: true });
      return;
    }
    navigate('/find-workspace', { replace: true });
  }, [isAuthenticated, user?.firmSlug, navigate]);

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

  useEffect(() => {
    if (!isTurnstileConfigured || step !== 1) return undefined;
    const existingScript = document.querySelector('script[data-turnstile-script="true"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = 'true';
      document.body.appendChild(script);
    }
    const renderWidget = () => {
      if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token) => setTurnstileToken(String(token || '')),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      });
    };
    const timer = window.setInterval(renderWidget, 200);
    renderWidget();
    return () => window.clearInterval(timer);
  }, [isTurnstileConfigured, step, turnstileSiteKey]);

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
    if (isTurnstileConfigured && !turnstileToken) {
      setLoading(false);
      setApiError('We could not verify this signup attempt. Please try again.');
      return;
    }
    try {
      await signup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firmName: form.firmName.trim(),
        phone: form.phone.trim(),
        turnstileToken: isTurnstileConfigured ? turnstileToken : undefined,
      });
      setStep(2);
      setOtp('');
      setOtpInfo(`OTP sent to ${form.email.trim().toLowerCase()}`);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 400 || status === 403) setApiError('We could not verify this signup attempt. Please try again.');
      else setApiError(mapSafeError(error, 'Unable to start signup right now.'));
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
      setEmailStatus('');
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


  const handleResendWelcomeEmail = async () => {
    if (loading) return;
    const email = form.email.trim().toLowerCase();
    if (!emailPattern.test(email)) {
      setEmailStatus('Unable to resend welcome email because the signup email is missing.');
      return;
    }

    setLoading(true);
    setApiError('');
    setEmailStatus('');
    try {
      const response = await resendCredentials(email);
      setEmailStatus(response?.message || 'If an account exists, credentials have been sent to your email.');
    } catch (error) {
      setEmailStatus(mapSafeError(error, 'Unable to resend welcome email right now.'));
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
      <div className="auth-wrapper">
        <div className="auth-card max-w-form">
          <div className="auth-header">
            <p className="auth-kicker">Docketra · Built for professional firms</p>
            <h1 className="text-xl font-semibold text-center">🎉 Workspace created successfully</h1>
          </div>
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
            <p><span className="font-medium">Firm URL:</span> {signupSuccessData.firmUrl || buildFallbackFirmLoginUrl(signupSuccessData.firmSlug)}</p>
            <p><span className="font-medium">Your XID:</span> {signupSuccessData.xid}</p>
          </div>
          <Button type="button" variant="primary" fullWidth onClick={handleLoginRedirect}>
            Go to Login
          </Button>
          <Button type="button" variant="outline" fullWidth onClick={handleResendWelcomeEmail} disabled={loading}>
            {loading ? 'Sending...' : 'Resend welcome email'}
          </Button>
          {emailStatus ? <p className="mt-2 text-xs text-gray-500">{emailStatus}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card max-w-form">
        <div className="auth-header">
          <p className="auth-kicker">Docketra · Built for professional firms</p>
          <h1 className="text-xl font-semibold text-center">Create your workspace</h1>
        </div>
        <p className="mt-2 text-sm text-gray-500 text-center">Step {step} of 2</p>
        <p className="mt-2 text-sm text-gray-500 text-center">{step === 1 ? 'Takes less than 1 minute' : 'Enter the 6-digit code sent to your email'}</p>

        {apiError && <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{apiError}</div>}

        {step === 1 ? (
          <form className={`mt-6 ${spacingClasses.formFieldSpacing} w-full`} onSubmit={submitStepOne} noValidate>
            <Input id="signup-name" type="text" name="name" label="Primary Admin Name" className="w-full" value={form.name} onChange={onFormChange} disabled={loading} error={errors.name} required />
            <Input id="signup-email" type="email" name="email" label="Primary Admin Email" className="w-full" value={form.email} onChange={onFormChange} disabled={loading} error={errors.email} required autoComplete="username" />
            <Input id="signup-password" type="password" name="password" label="Password" className="w-full" value={form.password} onChange={onFormChange} disabled={loading} error={errors.password} required autoComplete="current-password" />
            <Input id="signup-firm" type="text" name="firmName" label="Firm Name" className="w-full" value={form.firmName} onChange={onFormChange} disabled={loading} error={errors.firmName} required />
            <Input id="signup-phone" type="text" name="phone" label="Primary Admin Phone" className="w-full" value={form.phone} onChange={onFormChange} disabled={loading} error={errors.phone} required />
            {isTurnstileConfigured ? <div ref={turnstileContainerRef} className="min-h-[65px]" /> : null}
            <p className="text-xs text-gray-500">{STRONG_PASSWORD_MESSAGE}</p>
            <p className="text-xs text-gray-500">Your workspace URL will look like: docketra.com/gupte-opc</p>
            <Button type="submit" variant="primary" fullWidth disabled={loading} loading={loading}>
              {loading ? 'Sending verification code...' : 'Send verification code'}
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
