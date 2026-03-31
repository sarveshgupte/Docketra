import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import api from '../../services/api';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../../utils/validators';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;

const mapSafeError = (error, fallback) => {
  const status = error?.response?.status;
  if (status === 429) return 'Too many attempts. Please wait and try again.';
  if (status === 409) return 'Email or phone is already registered.';
  if (status === 400 || status === 401) return 'Please check your details and try again.';
  return fallback;
};

export default function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState({});
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
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

  const submitStepOne = async (event) => {
    event.preventDefault();
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
    try {
      await api.post('/auth/signup/init', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firmName: form.firmName.trim(),
        phone: form.phone.trim(),
      });
      setStep(2);
      setOtpInfo(`OTP sent to ${form.email.trim().toLowerCase()}`);
    } catch (error) {
      setApiError(mapSafeError(error, 'Unable to start signup right now.'));
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setErrors({ otp: 'Enter the 6-digit OTP.' });
      return;
    }

    setLoading(true);
    setApiError('');
    try {
      const response = await api.post('/auth/signup/verify', {
        email: form.email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      const redirectPath = response?.data?.data?.redirectPath || '/';
      navigate(redirectPath, { replace: true });
    } catch (error) {
      const status = error?.response?.status;
      if (status === 400) setApiError('OTP expired or invalid. Please request a new code.');
      else setApiError(mapSafeError(error, 'Unable to verify OTP right now.'));
    } finally {
      setLoading(false);
    }
  };


  const resendOtp = async () => {
    setLoading(true);
    setApiError('');
    try {
      const response = await api.post('/auth/signup/resend', { email: form.email.trim().toLowerCase() });
      setOtpInfo(response?.data?.message || 'OTP sent.');
    } catch (error) {
      setApiError(mapSafeError(error, 'Unable to resend OTP right now.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card max-w-form">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 text-center">Create your workspace</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">Step {step} of 2</p>

        {apiError && <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{apiError}</div>}

        {step === 1 ? (
          <form className="mt-4 space-y-4" onSubmit={submitStepOne} noValidate>
            <Input id="signup-name" type="text" name="name" label="Name" value={form.name} onChange={onFormChange} disabled={loading} error={errors.name} required />
            <Input id="signup-email" type="email" name="email" label="Email" value={form.email} onChange={onFormChange} disabled={loading} error={errors.email} required />
            <Input id="signup-password" type="password" name="password" label="Password" value={form.password} onChange={onFormChange} disabled={loading} error={errors.password} required />
            <Input id="signup-firm" type="text" name="firmName" label="Firm name" value={form.firmName} onChange={onFormChange} disabled={loading} error={errors.firmName} required />
            <Input id="signup-phone" type="text" name="phone" label="Phone" value={form.phone} onChange={onFormChange} disabled={loading} error={errors.phone} required />
            <p className="text-xs text-gray-500">{STRONG_PASSWORD_MESSAGE}</p>
            <Button type="submit" variant="primary" fullWidth loading={loading}>{loading ? 'Sending OTP…' : 'Continue'}</Button>
          </form>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={submitOtp} noValidate>
            {otpInfo && <p className="text-xs text-gray-500">{otpInfo}</p>}
            <Input id="signup-otp" type="text" name="otp" label="Email OTP" value={otp} onChange={(e) => { setOtp(e.target.value); setErrors((prev) => ({ ...prev, otp: '' })); }} disabled={loading} error={errors.otp} required />
            <Button type="submit" variant="primary" fullWidth loading={loading}>{loading ? 'Verifying…' : 'Verify & create workspace'}</Button>
            <Button type="button" variant="secondary" fullWidth disabled={loading} onClick={resendOtp}>Resend OTP</Button>
            <Button type="button" variant="secondary" fullWidth disabled={loading} onClick={() => setStep(1)}>Back</Button>
          </form>
        )}

        <p className="mt-4 text-center text-[12px] text-gray-500 sm:text-[13px]">
          By signing up, you agree to our <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Terms &amp; Conditions</Link> and <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Privacy Policy</Link>.
        </p>
      </Card>
    </div>
  );
}
