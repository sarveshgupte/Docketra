import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { userApi } from '../api/user.api';
import { spacingClasses } from '../theme/tokens';

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, fetchProfile, resolvePostAuthRoute } = useAuth();
  const suggestedName = useMemo(() => user?.name || '', [user?.name]);
  const [name, setName] = useState(suggestedName);
  const [firmName, setFirmName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Name is required.';
    if (!firmName.trim()) nextErrors.firmName = 'Firm name is required.';
    if (!phoneNumber.trim()) {
      nextErrors.phoneNumber = 'Phone number is required.';
    } else if (!/^[+\d][\d\s-]{7,}$/.test(phoneNumber.trim())) {
      nextErrors.phoneNumber = 'Enter a valid phone number.';
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await userApi.completeProfile({ name: name.trim(), firmName: firmName.trim(), phoneNumber: phoneNumber.trim() });
      const profileResult = await fetchProfile();
      if (profileResult?.success) {
        navigate(resolvePostAuthRoute(profileResult.data), { replace: true });
      } else {
        navigate('/superadmin', { replace: true });
      }
    } catch (submitError) {
      setError(submitError?.data?.message || submitError?.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <h1 className="text-2xl font-semibold text-center text-gray-900">Complete your profile</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">Finish onboarding before using your workspace.</p>
        <p className="mt-1 text-xs text-gray-500 text-center">This takes less than a minute. Press Enter to continue once complete.</p>
        <form className={`mt-6 ${spacingClasses.formFieldSpacing}`} onSubmit={handleSubmit}>
          <Input
            label="Name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFieldErrors((current) => ({ ...current, name: '' }));
            }}
            error={fieldErrors.name}
            required
            disabled={loading}
            autoFocus
            autoComplete="name"
            helpText={suggestedName ? 'We prefilled this from your account. Update if needed.' : undefined}
          />
          <Input
            label="Firm Name"
            value={firmName}
            onChange={(event) => {
              setFirmName(event.target.value);
              setFieldErrors((current) => ({ ...current, firmName: '' }));
            }}
            error={fieldErrors.firmName}
            required
            disabled={loading}
            autoComplete="organization"
            helpText="Use your official legal or operating name."
          />
          <Input
            label="Phone Number"
            value={phoneNumber}
            onChange={(event) => {
              setPhoneNumber(event.target.value);
              setFieldErrors((current) => ({ ...current, phoneNumber: '' }));
            }}
            error={fieldErrors.phoneNumber}
            helpText="Include country code if outside your default dialing region."
            required
            disabled={loading}
            autoComplete="tel"
            inputMode="tel"
          />
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          {loading ? <p className="text-xs text-gray-500">Saving your onboarding details and preparing your workspace…</p> : null}
          <Button type="submit" variant="primary" fullWidth disabled={loading} loading={loading}>
            {loading ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default CompleteProfilePage;
