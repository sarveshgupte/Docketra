import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const { fetchProfile, resolvePostAuthRoute } = useAuth();
  const [name, setName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/user/complete-profile', { name, firmName, phoneNumber });
      const profileResult = await fetchProfile();
      if (profileResult?.success) {
        navigate(resolvePostAuthRoute(profileResult.data), { replace: true });
      } else {
        navigate('/superadmin', { replace: true });
      }
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <h1 className="text-2xl font-semibold text-center text-gray-900">Complete your profile</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">Finish onboarding before using your workspace.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
          <Input label="Firm Name" value={firmName} onChange={(event) => setFirmName(event.target.value)} required />
          <Input label="Phone Number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default CompleteProfilePage;
