import React, { useState } from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
import { Button } from '../../components/common/Button';
import { spacingClasses } from '../../theme/tokens';

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
    <LegalLayout title="Contact" description="Contact our enterprise team." sections={SECTIONS}>
      <section id="contact-form" className="max-w-2xl">
        <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">Enterprise Inquiry</h2>
        {status === 'success' ? (
          <div className="mt-12 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">Inquiry received. Our enterprise team will contact you soon.</div>
        ) : (
          <form onSubmit={handleSubmit} className={`mt-12 ${spacingClasses.formFieldSpacing}`} aria-label="Contact form">
            <Input name="name" value={form.name} onChange={handleChange} label="Your name" required />
            <Input name="email" type="email" value={form.email} onChange={handleChange} label="Work email" required />
            <Input name="firmName" value={form.firmName} onChange={handleChange} label="Firm name" required />
            <Input name="numberOfUsers" type="number" min="1" value={form.numberOfUsers} onChange={handleChange} label="Number of users" required />
            <Input name="phone" value={form.phone} onChange={handleChange} label="Phone" required />
            <Textarea name="requirements" value={form.requirements} onChange={handleChange} label="Requirements" rows={5} required />
            <div className={`${spacingClasses.formActions} ${spacingClasses.formActionsGap}`}>
              <Button type="submit" variant="primary" disabled={status === 'submitting'} loading={status === 'submitting'}>
                {status === 'submitting' ? 'Submitting' : 'Send Inquiry'}
              </Button>
            </div>
          </form>
        )}
      </section>
    </LegalLayout>
  );
};
