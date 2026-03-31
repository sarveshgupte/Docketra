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
      <div className="auth-wrapper">
        <Card className="auth-card max-w-form">
          <h1 className="text-2xl font-semibold text-center text-gray-900">Sign in required</h1>
          <p className="mt-2 text-sm text-gray-500 text-center">Please sign in to continue onboarding.</p>
          <div className="mt-5">
            <Link to="/superadmin" className="block text-center text-sm font-medium text-blue-600 hover:underline">Go to login</Link>
          </div>
        </Card>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="auth-wrapper">
        <Card className="auth-card max-w-form">
          <Loading message="Loading your profile details..." />
        </Card>
      </div>
    );
  }

  if (error && !form.email) {
    return (
      <div className="auth-wrapper">
        <Card className="auth-card max-w-form">
          <h1 className="text-2xl font-semibold text-center text-gray-900">We couldn&apos;t load onboarding</h1>
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          <div className="mt-5 space-y-3">
            <Button type="button" variant="primary" fullWidth onClick={loadUser}>Retry</Button>
            <Link to="/superadmin" className="block text-center text-sm font-medium text-blue-600 hover:underline">Go to login</Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <h1 className="text-2xl font-semibold text-center text-gray-900">Complete your workspace setup</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">Step 2 of 2: add your workspace details.</p>

        <form className={`mt-6 ${spacingClasses.formFieldSpacing}`} onSubmit={handleSubmit}>
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" variant="primary" fullWidth disabled={submitting} loading={submitting}>
            {submitting ? 'Creating Workspace...' : 'Create Workspace'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default CompleteProfile;
