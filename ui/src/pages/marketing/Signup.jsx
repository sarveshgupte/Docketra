import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../../utils/validators';
import { spacingClasses } from '../../theme/tokens';
import { ROUTES } from '../../constants/routes';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;
const getOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '');
const buildFallbackFirmLoginUrl = (firmSlug) => (firmSlug ? `${getOrigin()}/${firmSlug}/login` : '');

const SETUP_PROMISES = [
  '🧠 Company Brain starts with clean firm identity',
  '✅ OTP verification before workspace activation',
  '🔐 Admin access, firm URL, and xID stay explicit',
];

const TRUST_BADGES = ['No card required', 'Role-safe setup', 'Email verified'];

const SETUP_STEPS = [
  { step: '01', title: 'Firm identity', copy: 'Name the workspace and primary admin.' },
  { step: '02', title: 'Email OTP', copy: 'Confirm the admin inbox before activation.' },
  { step: '03', title: 'First login', copy: 'Use the firm URL and xID we generate.' },
];

const getWorkspaceSlugPreview = (firmName) => {
  const slug = String(firmName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'your-firm';
};

const SignupStepDots = ({ step }) => (
  <div className="mt-5 flex items-center justify-center gap-2" aria-label={`Signup step ${step} of 2`}>
    {[1, 2].map((item) => (
      <span
        key={item}
        className={`h-1.5 rounded transition-all ${
          item === step ? 'w-8 bg-slate-950' : 'w-4 bg-slate-200'
        }`}
      />
    ))}
  </div>
);

const SignupShell = ({ children, mode = 'default' }) => (
  <div className="auth-wrapper min-h-screen bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_42%,#e0f2fe_100%)] px-4 py-6 md:px-6 md:py-8">
    <div className={`grid w-full max-w-7xl items-center gap-6 ${mode === 'success' ? 'lg:grid-cols-[0.85fr_1.15fr]' : 'lg:grid-cols-[0.92fr_1.08fr]'}`}>
      {children}
    </div>
  </div>
);

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
  const getEffectiveTurnstileToken = () => {
    const stateToken = String(turnstileToken || '').trim();
    if (stateToken) return stateToken;
    const widgetId = turnstileWidgetIdRef.current;
    const tokenFromWidget = widgetId != null && window.turnstile?.getResponse
      ? String(window.turnstile.getResponse(widgetId) || '').trim()
      : '';
    if (import.meta.env.MODE !== 'production' && isTurnstileConfigured) {
      // safe debug: never log raw token values
      // eslint-disable-next-line no-console
      console.debug('Signup Turnstile token resolution', { hasStateToken: Boolean(stateToken), hasWidgetToken: Boolean(tokenFromWidget) });
    }
    return tokenFromWidget;
  };
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
    const effectiveTurnstileToken = isTurnstileConfigured ? getEffectiveTurnstileToken() : '';
    if (isTurnstileConfigured && !effectiveTurnstileToken) {
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
        turnstileToken: isTurnstileConfigured ? effectiveTurnstileToken : undefined,
      });
      setStep(2);
      setOtp('');
      setOtpInfo(`OTP sent to ${form.email.trim().toLowerCase()}`);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 400 || status === 403) {
        setApiError('We could not verify this signup attempt. Please try again.');
        if (isTurnstileConfigured && turnstileWidgetIdRef.current != null && window.turnstile?.reset) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
        setTurnstileToken('');
      } else setApiError(mapSafeError(error, 'Unable to start signup right now.'));
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
      <SignupShell mode="success">
          <section className="hidden lg:block" aria-label="Workspace signup success">
            <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-950">
              <svg className="h-9 w-9 text-amber-600 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              </svg>
              <div className="flex flex-col leading-none text-left">
                <span className="text-lg font-black text-slate-900 tracking-tight">Docketra</span>
                <span className="text-[8px] font-bold text-amber-700 tracking-wider uppercase mt-0.5">The Company Brain</span>
              </div>
            </Link>
            <p className="mt-10 text-sm font-bold uppercase text-amber-700">🎉 Workspace created</p>
            <h1 className="mt-3 max-w-xl text-5xl font-black leading-[0.98] tracking-normal text-slate-950">
              Welcome to your firm&apos;s new command center.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
              Your workspace is ready. Save the first-login details and continue to onboarding when you are ready.
            </p>
            <div className="mt-8 grid gap-3">
              {['✅ Firm workspace is active', '🔐 Primary admin identity verified', '📬 Welcome credentials can be resent anytime'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <Card className="auth-card w-full max-w-none rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
            <div className="auth-header text-center">
              <p className="auth-kicker">Docketra · Workspace ready</p>
              <h1 className="text-3xl font-black text-slate-950">Workspace created successfully</h1>
              <p className="mt-2 text-sm text-slate-600">Save these details for your first login.</p>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="text-xs font-bold uppercase text-slate-500">Firm URL</p>
                <p className="mt-2 break-words font-semibold text-slate-950">{signupSuccessData.firmUrl || buildFallbackFirmLoginUrl(signupSuccessData.firmSlug)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="text-xs font-bold uppercase text-emerald-700">Your xID</p>
                <p className="mt-2 text-xl font-black text-emerald-950">{signupSuccessData.xid}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              💡 Keep this URL and xID with your onboarding notes. Your team will use the firm URL for future logins.
            </div>
            <div className={`mt-6 ${spacingClasses.formFieldSpacing}`}>
              <Button type="button" variant="primary" fullWidth onClick={handleLoginRedirect}>
                Go to login
              </Button>
              <Button type="button" variant="outline" fullWidth onClick={handleResendWelcomeEmail} disabled={loading}>
                {loading ? 'Sending...' : 'Resend welcome email'}
              </Button>
              {emailStatus ? <p className="text-center text-sm text-slate-600">{emailStatus}</p> : null}
            </div>
          </Card>
      </SignupShell>
    );
  }

  const workspaceSlugPreview = getWorkspaceSlugPreview(form.firmName);

  return (
    <SignupShell>
        <section className="hidden lg:block" aria-label="Workspace signup context">
          <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-950">
            <svg className="h-9 w-9 text-amber-600 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <div className="flex flex-col leading-none text-left">
              <span className="text-lg font-black text-slate-900 tracking-tight">Docketra</span>
              <span className="text-[8px] font-bold text-amber-700 tracking-wider uppercase mt-0.5">The Company Brain</span>
            </div>
          </Link>
          <p className="mt-10 text-sm font-bold uppercase text-amber-700">🚀 Workspace signup</p>
          <h1 className="mt-3 max-w-xl text-5xl font-black leading-[0.98] tracking-normal text-slate-950">
            Create the command center your firm will grow into.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
            Start with secure firm identity, primary admin verification, and a workspace URL your team can remember.
          </p>
          <ul className="mt-8 grid gap-3">
            {SETUP_PROMISES.map((item) => (
              <li key={item} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            {TRUST_BADGES.map((badge) => (
              <span key={badge} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-600">
                <span className="h-1.5 w-1.5 rounded bg-slate-400" />
                {badge}
              </span>
            ))}
          </div>
          <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-2xl">
            <p className="text-sm font-semibold text-sky-200">Setup path</p>
            <div className="mt-4 grid gap-3">
              {SETUP_STEPS.map((item) => (
                <div key={item.step} className="grid grid-cols-[44px_1fr] gap-3 rounded-2xl border border-white/10 bg-white/10 p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-950">{item.step}</span>
                  <span>
                    <span className="block text-sm font-bold">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-300">{item.copy}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Card className="auth-card w-full max-w-none rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur md:p-7">
          <Link to="/" className="mb-5 inline-flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-950 lg:hidden">
            <svg className="h-8 w-8 text-amber-600 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <div className="flex flex-col leading-none text-left">
              <span className="text-base font-black text-slate-900 tracking-tight">Docketra</span>
              <span className="text-[7px] font-bold text-amber-700 tracking-wider uppercase mt-0.5">The Company Brain</span>
            </div>
          </Link>
          <div className="auth-header text-center">
            <p className="auth-kicker">Docketra · Secure workspace setup</p>
            <h1 className="text-3xl font-black text-slate-950 md:text-4xl">{step === 1 ? 'Create your workspace' : 'Verify your email OTP'}</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              {step === 1 ? 'Set up your firm identity, primary admin, and secure workspace handoff in one flow.' : 'Enter the 6-digit code sent to your email so we can activate the workspace.'}
            </p>
            <SignupStepDots step={step} />
          </div>

        {apiError && <div role="alert" className="auth-public-page__error auth-alert">{apiError}</div>}

        {step === 1 ? (
          <form className={`mt-6 ${spacingClasses.formFieldSpacing} w-full`} onSubmit={submitStepOne} noValidate>
            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-sm font-black text-slate-950">👤 Primary admin</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">This person receives OTP, xID, and first-login instructions.</p>
              </div>
              <Input id="signup-name" type="text" name="name" label="Primary Admin Name" className="w-full" value={form.name} onChange={onFormChange} disabled={loading} error={errors.name} required />
              <Input id="signup-email" type="email" name="email" label="Primary Admin Email" className="w-full" value={form.email} onChange={onFormChange} disabled={loading} error={errors.email} required autoComplete="username" />
              <Input id="signup-phone" type="text" name="phone" label="Primary Admin Phone" className="w-full" value={form.phone} onChange={onFormChange} disabled={loading} error={errors.phone} required />
              <Input id="signup-password" type="password" name="password" label="Password" className="w-full" value={form.password} onChange={onFormChange} disabled={loading} error={errors.password} required autoComplete="new-password" />
            </div>
            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px]">
              <div>
                <p className="text-sm font-black text-slate-950">🏢 Firm workspace</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Your firm name becomes the memorable workspace URL.</p>
                <div className="mt-4">
                  <Input id="signup-firm" type="text" name="firmName" label="Firm Name" className="w-full" value={form.firmName} onChange={onFormChange} disabled={loading} error={errors.firmName} required />
                </div>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                <p className="text-xs font-bold uppercase text-sky-700">URL preview</p>
                <p className="mt-2 break-words font-black">docketra.com/{workspaceSlugPreview}</p>
                <p className="mt-3 text-xs leading-5 text-sky-700">Final URL is confirmed after verification.</p>
              </div>
            </div>
            {isTurnstileConfigured ? <div ref={turnstileContainerRef} className="min-h-[65px]" /> : null}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              🔑 {STRONG_PASSWORD_MESSAGE}
            </div>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={loading || (isTurnstileConfigured && !getEffectiveTurnstileToken())}
              loading={loading}
            >
              {loading ? 'Sending verification code...' : 'Send verification code'}
            </Button>
          </form>
        ) : (
          <form className={`mt-6 ${spacingClasses.formFieldSpacing} w-full`} onSubmit={submitOtp} noValidate>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              {otpInfo && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">📬 {otpInfo}</p>}
              <div className="mt-4">
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
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Tip: paste the full code. We keep only the latest six digits.</p>
            </div>
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

        <p className="find-workspace-page__notice rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          🛡️ By signing up, you agree to our <Link to="/terms" target="_blank" rel="noopener noreferrer" className="auth-public-page__inline-link">Terms &amp; Conditions</Link> and <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="auth-public-page__inline-link">Privacy Policy</Link>.
        </p>
        </Card>
    </SignupShell>
  );
}
