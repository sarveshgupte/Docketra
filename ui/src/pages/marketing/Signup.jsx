import React, { useState } from 'react';

const initialForm = {
  fullName: '',
  email: '',
  phoneNumber: '',
  companyName: '',
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
      const response = await fetch('/api/public/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Create Free Workspace</h1>
        <p className="mt-2 text-sm text-slate-600">Starter plan includes up to 2 users (1 admin + 1 user).</p>
      </div>

      {status === 'success' && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Workspace created. Please check your email to set up your admin account.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <input name="fullName" value={form.fullName} onChange={onChange} placeholder="Full name" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <input name="email" type="email" value={form.email} onChange={onChange} placeholder="Work email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <input name="phoneNumber" value={form.phoneNumber} onChange={onChange} placeholder="Phone number" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <input name="companyName" value={form.companyName} onChange={onChange} placeholder="Company name" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />

        <button type="submit" disabled={status === 'submitting'} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-500">
          {status === 'submitting' ? 'Creating...' : 'Create Free Workspace'}
        </button>
      </form>
    </section>
  );
};
