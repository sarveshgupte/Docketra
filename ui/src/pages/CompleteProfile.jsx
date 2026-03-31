import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { userApi } from '../api/user.api';

const phonePattern = /^\d{10}$/;

const getErrorMessage = (error, fallback) => (
  error?.data?.message
  || error?.data?.error
  || error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

export function CompleteProfile() {
  const navigate = useNavigate();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    firmName: '',
    phone: '',
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      setError('');
      try {
        const response = await userApi.getCurrentUser();
        const user = response?.data || response?.user || response || {};
        if (!mounted) return;

        setForm((prev) => ({
          ...prev,
          name: user?.name || '',
          email: user?.email || user?.primary_email || '',
        }));
      } catch (loadError) {
        if (mounted) {
          setError(getErrorMessage(loadError, 'Unable to load your profile details.'));
        }
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

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
        navigate(resolvePostAuthRoute(profileResult.data), { replace: true });
      } else {
        navigate('/superadmin', { replace: true });
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Failed to complete workspace setup.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <h1 className="text-2xl font-semibold text-center text-gray-900">Complete your workspace setup</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">Step 2 of 2: add your workspace details.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Input
            id="complete-profile-name"
            name="name"
            label="Name"
            value={form.name}
            onChange={onChange}
            disabled={loadingProfile || submitting}
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
            disabled={loadingProfile || submitting}
            autoComplete="organization"
            required
          />
          <Input
            id="complete-profile-phone"
            name="phone"
            label="Phone Number"
            value={form.phone}
            onChange={onChange}
            disabled={loadingProfile || submitting}
            autoComplete="tel"
            required
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" variant="primary" fullWidth disabled={loadingProfile || submitting}>
            {submitting ? 'Creating Workspace...' : 'Create Workspace'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default CompleteProfile;
