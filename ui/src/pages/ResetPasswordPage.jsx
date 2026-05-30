/**
 * Reset Password Page (for forgot password flow)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { authService } from '../services/authService';
import { STRONG_PASSWORD_MESSAGE, validateStrongPassword } from '../utils/validators';
import { spacingClasses } from '../theme/tokens';
import './ResetPasswordPage.css';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    if (!validateStrongPassword(password)) {
      setError(STRONG_PASSWORD_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.resetPasswordWithToken(token, password);
      
      if (response.success) {
        // Navigate to login with success message
        navigate('/superadmin', {
          state: {
            message: 'Password reset successfully. You can now log in with your new password.',
            messageType: 'success'
          }
        });
      } else {
        setError(response.message || 'Failed to reset password');
      }
    } catch (err) {
      setError('Unable to reset password with this link. It may have expired. Please request a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper min-h-screen bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_44%,#e0f2fe_100%)] px-4 py-8">
      <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block" aria-label="Reset password context">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-extrabold text-slate-950">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white" aria-hidden="true">✨</span>
            Docketra
          </Link>
          <p className="mt-10 text-sm font-bold uppercase text-amber-700">🔐 Password reset</p>
          <h1 className="mt-3 max-w-xl text-5xl font-black leading-[0.98] tracking-normal text-slate-950">
            Give your workspace account a clean new lock.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
            Use a strong password, then return to login with the reset confirmed.
          </p>
          <div className="mt-8 grid gap-3">
            {['✅ Token checked before reset', '🔑 Strong password required', '↩️ Returns you to login'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                {item}
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
            <p className="auth-kicker">Docketra · Secure access</p>
            <h1 className="text-3xl font-black text-slate-950 md:text-4xl">Reset Password</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Use a strong password to secure your workspace account.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className={spacingClasses.formFieldSpacing}>
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="mb-3 text-sm font-black text-slate-950">🔑 New password</p>
              <Input
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter new password (at least 8 characters)"
                autoComplete="new-password"
                disabled={loading}
                helpText={STRONG_PASSWORD_MESSAGE}
                autoFocus
              />

              <div className="mt-4">
                <Input
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="auth-public-page__error auth-alert" role="alert">
                {error}
              </div>
            )}

            {!token && (
              <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center" role="navigation" aria-label="Recovery actions">
                <Link to="/forgot-password" className="text-sm font-bold text-amber-900 hover:underline">
                  Request a new reset link
                </Link>
                <Link to="/superadmin" className="text-sm font-bold text-amber-900 hover:underline">
                  Back to login
                </Link>
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={!token} loading={loading}>
              Reset Password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
