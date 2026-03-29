import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import GoogleSignIn from '../../components/auth/GoogleSignIn';
import api from '../../services/api';
import { STORAGE_KEYS } from '../../utils/constants';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../../utils/validators';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

export default function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setApiError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setApiError('');

    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (!form.email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!emailPattern.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address';
    }
    if (!form.password) {
      nextErrors.password = 'Password is required';
    } else if (!validateStrongPassword(form.password)) {
      nextErrors.password = STRONG_PASSWORD_MESSAGE;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await api.post('/auth/signup', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      const data = response?.data?.data || response?.data || {};
      const { accessToken, isOnboarded } = data;

      if (accessToken) {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      }

      if (isOnboarded === false) {
        navigate('/complete-profile', { replace: true });
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch (error) {
      setApiError(getErrorMessage(error, 'Unable to sign up with email right now.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">Create your workspace</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">Step 1 of 2: authenticate with Google or email.</p>

        {apiError && (
          <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <GoogleSignIn className="mt-6 mb-2" />

        <div className="mb-2 flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs uppercase tracking-wide text-gray-500">OR</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          <Input
            id="signup-name"
            name="name"
            label="Name"
            value={form.name}
            onChange={onFormChange}
            disabled={loading}
            autoComplete="name"
            error={errors.name}
            required
          />

          <Input
            id="signup-email"
            type="email"
            name="email"
            label="Email"
            value={form.email}
            onChange={onFormChange}
            disabled={loading}
            autoComplete="email"
            error={errors.email}
            required
          />

          <Input
            id="signup-password"
            type="password"
            name="password"
            label="Password"
            value={form.password}
            onChange={onFormChange}
            disabled={loading}
            autoComplete="new-password"
            error={errors.password}
            minLength={8}
            required
          />

          <p className="text-xs text-gray-500">{STRONG_PASSWORD_MESSAGE}</p>

          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {loading ? 'Creating account…' : 'Continue'}
          </Button>

          <p className="text-center text-[12px] text-gray-500 sm:text-[13px]">
            By signing up, you agree to our{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </Card>
    </div>
  );
}
