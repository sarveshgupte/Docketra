import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import api from '../services/api';
import { authService } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { spacingClasses } from '../theme/tokens';
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
  const loginToken = String(location.state?.loginToken || '').trim();
  const firmSlug = String(location.state?.firmSlug || '').trim();
  const loginRestartPath = firmSlug ? `/${firmSlug}/login` : '/superadmin';

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
      if (purpose === 'login' && loginToken) {
        await authApi.loginResendOtp({ firmSlug: firmSlug || undefined, loginToken });
      } else {
        await authApi.signupResendOtp(email);
      }
      setCooldown(30);
      setInfo(`A new OTP was sent to ${email}.`);
    } catch (resendError) {
      setError('Unable to resend OTP right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (purpose === 'login' && !loginToken) {
      setError('Login session expired. Please restart login.');
      window.setTimeout(() => navigate(loginRestartPath, { replace: true }), 1200);
      return;
    }

    if (purpose !== 'login' && !email) {
      setError('Missing email. Please restart login/signup.');
      return;
    }

    setLoading(true);
    try {
      const response = purpose === 'login'
        ? await authApi.loginVerify({ firmSlug: firmSlug || undefined, loginToken, otp })
        : await api.post('/auth/verify-otp', { email, otp, purpose }); // AUTH_CONTRACT_ALLOWLIST: signup/generic OTP verification remains intentionally retained.
      const payload = response?.data || response || {};
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
        setError('OTP verified, but your session could not be established. Please sign in again.');
      }
    } catch (submitError) {
      setError('Invalid verification code. Enter the latest 6-digit code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper min-h-screen bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_44%,#e0f2fe_100%)] px-4 py-8">
      <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block" aria-label="OTP verification context">
          <p className="text-sm font-bold uppercase text-amber-700">📬 Email verification</p>
          <h1 className="mt-3 max-w-xl text-5xl font-black leading-[0.98] tracking-normal text-slate-950">
            One code before the workspace opens.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
            OTP keeps login and signup handoffs explicit without exposing workspace data before authentication.
          </p>
          <div className="mt-8 grid gap-3">
            {['🔐 Login token checked', '📬 Latest 6-digit code only', '↩️ Restart path stays available'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="auth-card w-full max-w-none rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <div className="auth-header text-center">
            <p className="auth-kicker">Docketra · Secure access</p>
            <h1 className="text-3xl font-black text-slate-950 md:text-4xl">Verify OTP</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Step 2 of 2 · Enter the 6-digit code sent to {email || 'your email'}.
            </p>
            <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
              <span className="h-2 w-8 rounded-full bg-slate-300" />
              <span className="h-2 w-10 rounded-full bg-slate-950" />
            </div>
          </div>

          <form onSubmit={onSubmit} className={`mt-6 ${spacingClasses.formFieldSpacing}`} noValidate>
            {firmSlug ? <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-xs font-bold text-sky-900">{`Firm login URL: /${firmSlug}/login`}</p> : null}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-black text-slate-950">📬 Email OTP <span className="text-red-500">*</span></p>
              <div className="mt-3 grid grid-cols-6 gap-2 sm:gap-3" onPaste={handleOtpPaste}>
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
              <p className="mt-3 text-xs leading-5 text-slate-500">Tip: You can paste the full OTP directly.</p>
            </div>

            {error && (<ErrorState title="OTP verification failed" description={error} />)}
            {info ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✅ {info}</p> : null}

            <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading || !isOtpValid}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </Button>
            <Button type="button" variant="outline" fullWidth disabled={loading || cooldown > 0} onClick={handleResend} className="mt-2">
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </Button>
            <Button type="button" variant="outline" fullWidth disabled={loading} onClick={() => navigate(loginRestartPath, { replace: true })} className="mt-2">
              Back to sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
