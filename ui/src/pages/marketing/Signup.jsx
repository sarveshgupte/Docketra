import React, { useState } from 'react';

const initialForm = {
  companyName: '',
  email: '',
  password: '',
};

export const SignupPage = () => {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setStatus('submitting');
    setError('');

    try {
      const payload = {
        companyName: form.companyName,
        email: form.email,
        password: form.password,
      };

      const response = await fetch('/api/public/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to create workspace. Please try again.');
      }

      setStatus('success');
      setForm(initialForm);
    } catch (submitError) {
      setStatus('error');
      setError(submitError.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
        <h2 className="text-2xl font-semibold tracking-tight leading-tight">Create Free Workspace</h2>
        <p className="mt-6 text-gray-600 leading-relaxed">Starter plan includes up to 2 users.</p>

        {status === 'success' && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Workspace created. Please check your email to set up your admin account.
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            name="companyName"
            value={form.companyName}
            onChange={onChange}
            placeholder="Firm Name"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-gray-900"
            required
          />
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder="Admin Email"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-gray-900"
            required
          />
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="Password"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-gray-900"
            required
          />

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full mt-4 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'submitting' ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
};
