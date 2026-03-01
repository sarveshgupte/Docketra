import React, { useState } from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [{ id: 'contact-form', label: 'Enterprise Inquiry' }];

const initialForm = {
  name: '',
  email: '',
  firmName: '',
  numberOfUsers: '',
  phone: '',
  requirements: '',
};

export const ContactPage = () => {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
      setForm(initialForm);
    } catch {
      setStatus('error');
    }
  };

  return (
    <LegalLayout title="Contact" description="Contact our enterprise team." sections={SECTIONS}>
      <section id="contact-form">
        <h2 className="text-xl font-semibold text-slate-900">Enterprise Inquiry</h2>
        {status === 'success' ? (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">Inquiry received. Our enterprise team will contact you soon.</div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-label="Contact form">
            <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-all duration-150 focus:border-slate-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]" required />
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Work email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-all duration-150 focus:border-slate-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]" required />
            <input name="firmName" value={form.firmName} onChange={handleChange} placeholder="Firm name" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-all duration-150 focus:border-slate-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]" required />
            <input name="numberOfUsers" type="number" min="1" value={form.numberOfUsers} onChange={handleChange} placeholder="Number of users" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-all duration-150 focus:border-slate-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]" required />
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-all duration-150 focus:border-slate-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]" required />
            <textarea name="requirements" value={form.requirements} onChange={handleChange} placeholder="Requirements" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-all duration-150 focus:border-slate-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]" rows={5} required />
            <button type="submit" disabled={status === 'submitting'} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:scale-[1.01] hover:-translate-y-0.5 hover:bg-slate-700 active:scale-[0.98]">{status === 'submitting' ? 'Submitting...' : 'Send Inquiry'}</button>
          </form>
        )}
      </section>
    </LegalLayout>
  );
};
