import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { userApi } from '../api/user.api';
import { toUserFacingError } from '../utils/errorHandling';
import { spacingClasses } from '../theme/tokens';

const phonePattern = /^\d{10}$/;

const OnboardingAside = () => (
  <section className="hidden lg:block" aria-label="Workspace onboarding context">
    <Link to="/" className="inline-flex items-center gap-2 text-lg font-extrabold text-slate-950">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white" aria-hidden="true">✨</span>
      Docketra
    </Link>
    <p className="mt-10 text-sm font-bold uppercase text-amber-700">🏁 Final setup</p>
    <h1 className="mt-3 max-w-xl text-5xl font-black leading-[0.98] tracking-normal text-slate-950">
      Finish the workspace profile before the real work begins.
    </h1>
    <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
      A clean firm profile helps Docketra route users, dashboards, and workspace context correctly from day one.
    </p>
    <div className="mt-8 grid gap-3">
      {['🏢 Firm identity', '📞 Admin contact', '✅ Workspace route ready'].map((item) => (
        <div key={item} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
          {item}
        </div>
      ))}
    </div>
  </section>
);

const OnboardingShell = ({ children }) => (
  <div className="auth-wrapper min-h-screen bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_44%,#e0f2fe_100%)] px-4 py-8">
    <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <OnboardingAside />
      {children}
    </div>
  </div>
);

export function CompleteProfile() {
  const navigate = useNavigate();
  const { fetchProfile, resolvePostAuthRoute, isAuthenticated, isAuthResolved } = useAuth();
  const { showError, showSuccess } = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    firmName: '',
    phone: '',
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadUser = useCallback(async () => {
    setError('');
    setLoadingProfile(true);
    try {
      const response = await userApi.getCurrentUser();
      const user = response?.data || response?.user || response || {};

      setForm((prev) => ({
        ...prev,
        name: user?.name || '',
        email: user?.email || user?.primary_email || '',
      }));
    } catch (loadError) {
      const message = toUserFacingError(loadError, 'Unable to load your profile details.');
      setError(message);
      showError(message);
    } finally {
      setLoadingProfile(false);
    }
  }, [showError]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const trimmedFirmName = form.firmName.trim();
    const normalizedPhone = form.phone.replace(/\D/g, '');
    if (!trimmedFirmName) {
      setError('Firm name is required.');
      return;
    }
    if (!normalizedPhone) {
      setError('Phone number is required.');
      return;
    }
    if (!phonePattern.test(normalizedPhone)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    setSubmitting(true);

    try {
      await userApi.completeProfile({
        name: form.name.trim(),
        firmName: trimmedFirmName,
        phone: normalizedPhone,
      });

      const profileResult = await fetchProfile();
      if (profileResult?.success) {
        showSuccess('Workspace setup complete.');
        navigate(resolvePostAuthRoute(profileResult.data), { replace: true });
      } else {
        navigate('/superadmin', { replace: true });
      }
    } catch (submitError) {
      const message = toUserFacingError(submitError, 'Failed to complete workspace setup.');
      setError(message);
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };


  if (isAuthResolved && !isAuthenticated) {
    return (
      <OnboardingShell>
        <Card className="auth-card w-full max-w-none rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <div className="auth-header text-center">
            <p className="auth-kicker">Docketra · Onboarding</p>
            <h1 className="text-3xl font-black text-slate-950">Sign in required</h1>
            <p className="mt-2 text-sm text-slate-600">Please sign in to continue onboarding.</p>
          </div>
          <div className="mt-5">
            <Link to="/superadmin" className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:text-slate-950">Go to login</Link>
          </div>
        </Card>
      </OnboardingShell>
    );
  }

  if (loadingProfile) {
    return (
      <OnboardingShell>
        <Card className="auth-card w-full max-w-none rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <Loading message="Loading your profile details..." />
        </Card>
      </OnboardingShell>
    );
  }

  if (error && !form.email) {
    return (
      <OnboardingShell>
        <Card className="auth-card w-full max-w-none rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <div className="auth-header text-center">
            <p className="auth-kicker">Docketra · Onboarding</p>
            <h1 className="text-3xl font-black text-slate-950">We couldn&apos;t load onboarding</h1>
          </div>
          <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          <div className="mt-5 space-y-3">
            <Button type="button" variant="primary" fullWidth onClick={loadUser}>Retry</Button>
            <Link to="/superadmin" className="block text-center text-sm font-bold text-slate-700 hover:text-slate-950">Go to login</Link>
          </div>
        </Card>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell>
      <Card className="auth-card w-full max-w-none rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
        <div className="auth-header text-center">
          <p className="auth-kicker">Docketra · Workspace onboarding</p>
          <h1 className="text-3xl font-black text-slate-950 md:text-4xl">Complete your workspace setup</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Step 2 of 2: add your workspace details.</p>
          <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
            <span className="h-2 w-8 rounded-full bg-slate-300" />
            <span className="h-2 w-10 rounded-full bg-slate-950" />
          </div>
        </div>

        <form className={`mt-6 ${spacingClasses.formFieldSpacing}`} onSubmit={handleSubmit}>
          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="text-sm font-black text-slate-950">👤 Admin profile</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Confirm the person who will own the first workspace setup.</p>
            </div>
            <Input
              id="complete-profile-name"
              name="name"
              label="Name"
              value={form.name}
              onChange={onChange}
              disabled={submitting}
              required
            />
            <Input
              id="complete-profile-email"
              name="email"
              label="Email"
              type="email"
              value={form.email}
              disabled
            />
          </div>
          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="text-sm font-black text-slate-950">🏢 Workspace details</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">These details help firm routing and support stay explicit.</p>
            </div>
            <Input
              id="complete-profile-firm"
              name="firmName"
              label="Firm Name"
              value={form.firmName}
              onChange={onChange}
              disabled={submitting}
              autoComplete="organization"
              required
            />
            <Input
              id="complete-profile-phone"
              name="phone"
              label="Phone Number"
              value={form.phone}
              onChange={onChange}
              disabled={submitting}
              autoComplete="tel"
              required
            />
          </div>

          {error ? <p className="auth-public-page__error auth-alert">{error}</p> : null}

          <Button type="submit" variant="primary" fullWidth disabled={submitting} loading={submitting}>
            {submitting ? 'Creating Workspace...' : 'Create Workspace'}
          </Button>
        </form>
      </Card>
    </OnboardingShell>
  );
}

export default CompleteProfile;
