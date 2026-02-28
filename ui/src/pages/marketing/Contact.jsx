import React, { useState } from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'support', label: 'Support' },
  { id: 'sales', label: 'Sales' },
  { id: 'security-contact', label: 'Security' },
  { id: 'privacy-grievance', label: 'Privacy & Grievance' },
  { id: 'contact-form', label: 'Send a Message' },
];

const initialForm = { name: '', company: '', email: '', message: '' };

export const ContactPage = () => {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.company.trim()) e.company = 'Company is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (!form.message.trim()) e.message = 'Message is required.';
    return e;
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setStatus('submitting');
    try {
      const res = await fetch('/api/contact', {
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
      description="Get in touch with the Docketra team."
      sections={SECTIONS}
    >
      <section id="support">
        <h2 className="text-xl font-semibold text-slate-900">Support</h2>
        <p className="mt-3 text-sm leading-relaxed">
          For platform support, technical issues, and account-related queries:
        </p>
        <p className="mt-2 text-sm">
          <a
            href="mailto:support@docketra.com"
            className="text-slate-800 underline hover:no-underline"
          >
            support@docketra.com
          </a>
        </p>
      </section>

      <section id="sales">
        <h2 className="text-xl font-semibold text-slate-900">Sales</h2>
        <p className="mt-3 text-sm leading-relaxed">
          For pricing enquiries, enterprise procurement, and demo requests:
        </p>
        <p className="mt-2 text-sm">
          <a
            href="mailto:demo@docketra.com"
            className="text-slate-800 underline hover:no-underline"
          >
            demo@docketra.com
          </a>
        </p>
      </section>

      <section id="security-contact">
        <h2 className="text-xl font-semibold text-slate-900">Security</h2>
        <p className="mt-3 text-sm leading-relaxed">
          To report a security vulnerability or concern:
        </p>
        <p className="mt-2 text-sm">
          <a
            href="mailto:security@docketra.com"
            className="text-slate-800 underline hover:no-underline"
          >
            security@docketra.com
          </a>
        </p>
      </section>

      <section id="privacy-grievance">
        <h2 className="text-xl font-semibold text-slate-900">Privacy &amp; Grievance</h2>
        <p className="mt-3 text-sm leading-relaxed">
          For data privacy requests or grievance escalations under the DPDP Act:
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <a
              href="mailto:privacy@docketra.com"
              className="text-slate-800 underline hover:no-underline"
            >
              privacy@docketra.com
            </a>
          </li>
          <li>
            <a
              href="mailto:grievance@docketra.com"
              className="text-slate-800 underline hover:no-underline"
            >
              grievance@docketra.com
            </a>
          </li>
        </ul>
      </section>

      <section id="contact-form">
        <h2 className="text-xl font-semibold text-slate-900">Send a Message</h2>
        <p className="mt-3 text-sm leading-relaxed">
          Use the form below for general enquiries. We aim to respond within 2 business days.
        </p>

        {status === 'success' ? (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            Your message has been received. We will be in touch shortly.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-6 space-y-4"
            aria-label="Contact form"
          >
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700">
                Name <span aria-hidden="true">*</span>
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                aria-required="true"
                aria-describedby={errors.name ? 'contact-name-error' : undefined}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              {errors.name && (
                <p id="contact-name-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="contact-company" className="block text-sm font-medium text-slate-700">
                Company <span aria-hidden="true">*</span>
              </label>
              <input
                id="contact-company"
                name="company"
                type="text"
                autoComplete="organization"
                value={form.company}
                onChange={handleChange}
                aria-required="true"
                aria-describedby={errors.company ? 'contact-company-error' : undefined}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              {errors.company && (
                <p id="contact-company-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.company}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700">
                Email <span aria-hidden="true">*</span>
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                aria-required="true"
                aria-describedby={errors.email ? 'contact-email-error' : undefined}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              {errors.email && (
                <p id="contact-email-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700">
                Message <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={5}
                value={form.message}
                onChange={handleChange}
                aria-required="true"
                aria-describedby={errors.message ? 'contact-message-error' : undefined}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              {errors.message && (
                <p id="contact-message-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.message}
                </p>
              )}
            </div>

            {status === 'error' && (
              <p role="alert" className="text-xs text-red-600">
                Something went wrong. Please try again or email us directly.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              {status === 'submitting' ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </section>
    </LegalLayout>
  );
};
