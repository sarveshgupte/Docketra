import { SUPPORT_EMAIL } from '../../config/publicContact';
import React, { useState } from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
import { Button } from '../../components/common/Button';
import { spacingClasses } from '../../theme/tokens';

const SECTIONS = [{ id: 'contact-form', label: 'Early Access Contact' }];

const initialForm = {
  name: '',
  email: '',
  firmName: '',
  numberOfUsers: '',
  phone: '',
  requirements: '',
};

export const ContactPage = () => {
  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  if (!API_BASE && import.meta.env.DEV) {
    console.error('VITE_API_BASE_URL is not defined');
  }
  const endpoint = API_BASE
    ? `${API_BASE.replace(/\/+$/, '')}/api/public/contact`
    : '/api/public/contact';
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch(endpoint, {
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
    <LegalLayout
      title="Contact"
      description="Request early access, ask a security question, or tell us what your firm needs from a Company Brain + Work Execution OS."
      sections={SECTIONS}
      kicker="👋 Talk to Docketra"
      highlights={['Early access requests', 'Security questions', 'Firm workflow discovery']}
    >
      <section id="contact-form" className="max-w-3xl">
        <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">Early Access Contact</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {['🧠 Company Brain setup', '⚙️ Workflow migration', '🔐 Data questions'].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              {item}
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-gray-600">Prefer email? Reach us directly at <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
        {status === 'success' ? (
          <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm font-medium text-green-800">✅ Inquiry received. We will get back to you soon.</div>
        ) : (
          <form onSubmit={handleSubmit} className={`mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 ${spacingClasses.formFieldSpacing}`} aria-label="Contact form">
            <div className="grid gap-4 md:grid-cols-2">
              <Input name="name" value={form.name} onChange={handleChange} label="Your name" required />
              <Input name="email" type="email" value={form.email} onChange={handleChange} label="Work email" required />
              <Input name="firmName" value={form.firmName} onChange={handleChange} label="Firm name" required />
              <Input name="numberOfUsers" type="number" min="1" value={form.numberOfUsers} onChange={handleChange} label="Number of users" required />
              <Input name="phone" value={form.phone} onChange={handleChange} label="Phone" required />
            </div>
            <Textarea name="requirements" value={form.requirements} onChange={handleChange} label="Requirements" rows={5} required />
            <div className={`${spacingClasses.formActions} ${spacingClasses.formActionsGap}`}>
              <Button type="submit" variant="primary" disabled={status === 'submitting'} loading={status === 'submitting'}>
                {status === 'submitting' ? 'Submitting' : 'Send request'}
              </Button>
            </div>
            {status === 'error' && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                We could not send that just now. Please try again or email {SUPPORT_EMAIL}.
              </p>
            )}
          </form>
        )}
      </section>
    </LegalLayout>
  );
};
