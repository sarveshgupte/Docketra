/**
 * Forgot Password Page
 */

import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { authService } from '../services/authService';
import { STRONG_PASSWORD_MESSAGE, validateEmail, validateStrongPassword, validateXID } from '../utils/validators';
import { spacingClasses } from '../theme/tokens';
import './ForgotPasswordPage.css';

const FALLBACK_RATE_LIMIT_MESSAGE = 'Too many password reset requests. Please wait a few minutes before trying again.';
const getForgotPasswordErrorMessage = (errorData, defaultMessage) => (
  errorData?.message
  || (errorData?.error === 'RATE_LIMIT_EXCEEDED' ? FALLBACK_RATE_LIMIT_MESSAGE : null)
  || errorData?.error
  || defaultMessage
);

const RECOVERY_STEPS = [
  { id: 1, label: 'Find account', icon: '🔎' },
  { id: 2, label: 'Verify OTP', icon: '📬' },
  { id: 3, label: 'New password', icon: '🔐' },
];

const getStepCopy = (step) => {
  if (step === 2) {
    return {
      title: 'Verify the recovery code',
      description: 'Enter the latest 6-digit OTP from your email so we can unlock password reset.',
      kicker: 'Docketra · Email verification',
    };
  }
  if (step === 3) {
    return {
      title: 'Set a stronger password',
      description: 'Choose a new password before returning to your workspace login.',
      kicker: 'Docketra · Password reset',
    };
  }
  return {
    title: 'Recover workspace access',
    description: "We'll send a verification code if the account exists.",
    kicker: 'Docketra · Secure access',
  };
};

export const ForgotPasswordPage = () => {
  const { firmSlug } = useParams();
  const [resolvedFirmSlug, setResolvedFirmSlug] = useState(firmSlug || '');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [step, setStep] = useState(1);
  const [cooldown, setCooldown] = useState(30);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const isTurnstileConfigured = Boolean(turnstileSiteKey);
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);
  const turnstileTokenRef = useRef('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const navigate = useNavigate();
  const activeFirmSlug = resolvedFirmSlug || firmSlug || '';
  const loginPath = activeFirmSlug ? `/${activeFirmSlug}/login` : '/superadmin';

  const resetRecoveryState = () => {
    setStep(1);
    setOtp('');
    setResetToken('');
    setPassword('');
    setConfirmPassword('');
    setCooldown(0);
    setSuccess('');
    setError('');
    setFieldError('');
  };

  const normalizeLoginIdentifier = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return { value: '', type: 'empty' };
    if (validateEmail(trimmed.toLowerCase())) return { value: trimmed.toLowerCase(), type: 'email' };
    if (validateXID(trimmed)) return { value: trimmed.toUpperCase(), type: 'xid' };
    return { value: trimmed, type: 'invalid' };
  };

  React.useEffect(() => {
    if (step !== 2 || cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [step, cooldown]);

  React.useEffect(() => {
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
        callback: (token) => {
          const nextToken = String(token || '');
          setTurnstileToken(nextToken);
          turnstileTokenRef.current = nextToken;
        },
        'expired-callback': () => {
          setTurnstileToken('');
          turnstileTokenRef.current = '';
        },
        'error-callback': () => {
          setTurnstileToken('');
          turnstileTokenRef.current = '';
        },
      });
    };
    renderWidget();
    const timer = window.setInterval(renderWidget, 250);
    return () => window.clearInterval(timer);
  }, [isTurnstileConfigured, step, turnstileSiteKey]);

  const getEffectiveTurnstileToken = () => {
    const refToken = String(turnstileTokenRef.current || '').trim();
    if (refToken) return refToken;
    const stateToken = String(turnstileToken || '').trim();
    if (stateToken) return stateToken;
    const widgetId = turnstileWidgetIdRef.current;
    return widgetId != null && window.turnstile?.getResponse
      ? String(window.turnstile.getResponse(widgetId) || '').trim()
      : '';
  };

  const handleInit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldError('');
    const normalizedIdentifier = normalizeLoginIdentifier(email);

    if (!normalizedIdentifier.value) {
      setFieldError('Please enter your xID or email address.');
      return;
    }

    if (normalizedIdentifier.type === 'invalid') {
      setFieldError('Enter a valid xID (X123456) or email address.');
      return;
    }

    const effectiveTurnstileToken = isTurnstileConfigured ? getEffectiveTurnstileToken() : '';
    if (import.meta.env.DEV) {
      const widgetId = turnstileWidgetIdRef.current;
      const widgetResponse = widgetId != null && window.turnstile?.getResponse
        ? String(window.turnstile.getResponse(widgetId) || '').trim()
        : '';
      // eslint-disable-next-line no-console
      console.debug('[ForgotPassword] Turnstile token availability', {
        isTurnstileConfigured,
        hasTurnstileRefToken: Boolean(String(turnstileTokenRef.current || '').trim()),
        hasTurnstileStateToken: Boolean(String(turnstileToken || '').trim()),
        hasTurnstileWidgetResponse: Boolean(widgetResponse),
      });
    }
    if (isTurnstileConfigured && !effectiveTurnstileToken) {
      setError('Please complete Turnstile verification before continuing.');
      return;
    }
    setLoading(true);

    try {
      const response = await authService.forgotPasswordInit(normalizedIdentifier.value, activeFirmSlug || undefined, isTurnstileConfigured ? effectiveTurnstileToken : undefined);
      if (response.success) {
        if (response?.firmSlug) {
          setResolvedFirmSlug(response.firmSlug);
        }
        setSuccess('OTP sent to your email.');
        setStep(2);
        setCooldown(30);
      } else {
        setError(getForgotPasswordErrorMessage(response, 'Failed to send OTP'));
      }
    } catch (err) {
      setError(getForgotPasswordErrorMessage(err.response?.data, 'An error occurred. Please try again.'));
      const statusCode = Number(err?.response?.status || 0);
      if (isTurnstileConfigured && (statusCode === 400 || statusCode === 403)) {
        if (turnstileWidgetIdRef.current != null && window.turnstile?.reset) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
        setTurnstileToken('');
        turnstileTokenRef.current = '';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) {
      setFieldError('OTP must be 6 digits.');
      return;
    }
    setLoading(true);
    try {
      const normalizedIdentifier = normalizeLoginIdentifier(email);
      const response = await authService.forgotPasswordVerify(normalizedIdentifier.value, activeFirmSlug || undefined, otp.trim());
      if (response.success) {
        if (response?.firmSlug) {
          setResolvedFirmSlug(response.firmSlug);
        }
        setResetToken(response.resetToken || '');
        setStep(3);
        setSuccess('OTP verified. Set your new password.');
      }
    } catch (err) {
      setError(getForgotPasswordErrorMessage(err.response?.data, 'Invalid or expired OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateStrongPassword(password)) {
      setFieldError(STRONG_PASSWORD_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const normalizedIdentifier = normalizeLoginIdentifier(email);
      const response = await authService.forgotPasswordResetWithOtp(normalizedIdentifier.value, activeFirmSlug || undefined, resetToken, password);
      if (response.success) {
        const nextFirmSlug = response?.firmSlug || activeFirmSlug || '';
        if (response?.firmSlug) {
          setResolvedFirmSlug(response.firmSlug);
        }
        const nextLoginPath = nextFirmSlug ? `/${nextFirmSlug}/login` : '/superadmin';
        resetRecoveryState();
        navigate(nextLoginPath, { state: { message: 'Password reset successfully. Please sign in with your new password.', messageType: 'success' } });
      }
    } catch (err) {
      setError(getForgotPasswordErrorMessage(err.response?.data, 'Unable to reset password'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const normalizedIdentifier = normalizeLoginIdentifier(email);
      await authService.forgotPasswordInit(normalizedIdentifier.value, activeFirmSlug || undefined);
      setSuccess('OTP resent to your email.');
      setCooldown(30);
    } catch (err) {
      setError(getForgotPasswordErrorMessage(err.response?.data, 'Unable to resend OTP'));
    } finally {
      setLoading(false);
    }
  };

  const stepCopy = getStepCopy(step);

  return (
    <div className="auth-wrapper min-h-screen bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_44%,#e0f2fe_100%)] px-4 py-8">
      <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block" aria-label="Password recovery context">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-extrabold text-slate-950">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white" aria-hidden="true">✨</span>
            Docketra
          </Link>
          <p className="mt-10 text-sm font-bold uppercase text-amber-700">🛟 Account recovery</p>
          <h1 className="mt-3 max-w-xl text-5xl font-black leading-[0.98] tracking-normal text-slate-950">
            Get back into the right workspace safely.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
            Recovery stays quiet and enumeration-safe: we only send a code when the account can be verified.
          </p>
          <div className="mt-8 grid gap-3">
            {RECOVERY_STEPS.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm ${
                  item.id === step ? 'border-slate-950 bg-slate-950 text-white' : 'border-white/80 bg-white/75 text-slate-700'
                }`}
              >
                <span aria-hidden="true">{item.icon}</span> Step {item.id}: {item.label}
              </div>
            ))}
          </div>
        </section>

        <Card className="auth-card w-full max-w-none rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <Link to="/" className="mb-5 inline-flex items-center gap-2 text-base font-extrabold text-slate-950 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white" aria-hidden="true">✨</span>
            Docketra
          </Link>
          <div className="auth-header text-center">
            <p className="auth-kicker">{stepCopy.kicker}</p>
            <h1 className="text-3xl font-black text-slate-950 md:text-4xl">{stepCopy.title}</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              {stepCopy.description}
              {firmSlug ? ' Workspace-aware recovery is enabled for this login URL.' : ''}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2" aria-label={`Recovery step ${step} of 3`}>
              {RECOVERY_STEPS.map((item) => (
                <span
                  key={item.id}
                  className={`rounded-2xl px-2 py-2 text-xs font-bold ${
                    item.id === step ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span aria-hidden="true">{item.icon}</span> {item.label}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={step === 1 ? handleInit : step === 2 ? handleVerifyOtp : handleReset} noValidate className={spacingClasses.formFieldSpacing}>
            {step === 1 && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="mb-3 text-sm font-black text-slate-950">🔎 Account lookup</p>
                <Input
                  label="xID or Email"
                  type="text"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                    setFieldError('');
                  }}
                  error={fieldError}
                  required
                  placeholder="X123456 or name@company.com"
                  autoComplete="username"
                  disabled={loading}
                  autoFocus
                  helpText={firmSlug ? 'Use the xID or email registered in this workspace.' : undefined}
                />
              </div>
            )}
            {step === 1 && isTurnstileConfigured ? <div ref={turnstileContainerRef} className="min-h-[65px]" /> : null}
            {step === 2 && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="mb-3 text-sm font-black text-slate-950">📬 Email OTP</p>
                <Input
                  label="OTP"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  error={fieldError}
                  required
                  placeholder="6-digit OTP"
                  autoComplete="one-time-code"
                  disabled={loading}
                  autoFocus
                />
                <p className="mt-3 text-xs leading-5 text-slate-500">Tip: paste the full code. We keep only the latest six digits.</p>
              </div>
            )}
            {step === 3 && <>
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="mb-3 text-sm font-black text-slate-950">🔐 New password</p>
                <Input
                  label="New Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter new password"
                  disabled={loading}
                  autoFocus
                  helpText={STRONG_PASSWORD_MESSAGE}
                />
                <div className="mt-4">
                  <Input
                    label="Confirm Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirm new password"
                    disabled={loading}
                  />
                </div>
              </div>
            </>}

            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status" aria-live="polite">
                ✅ {success}
              </div>
            )}

            {error && (
              <div className="auth-public-page__error auth-alert" role="alert">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading || (step === 1 && isTurnstileConfigured && !getEffectiveTurnstileToken())}>
              {step === 1 ? 'Send verification code' : step === 2 ? 'Verify code' : 'Set new password'}
            </Button>
            {step === 2 && (
              <Button type="button" variant="outline" fullWidth disabled={loading || cooldown > 0} onClick={handleResend}>
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
              </Button>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <Link to={loginPath} className="text-sm font-bold text-slate-700 hover:text-slate-950" onClick={resetRecoveryState}>
                Back to Login
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
