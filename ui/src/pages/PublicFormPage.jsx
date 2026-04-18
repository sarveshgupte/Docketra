import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { publicFormsApi } from '../api/forms.api';

const EMPTY_FORM = { name: '', email: '', phone: '', message: '', website: '' };

export const PublicFormPage = () => {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const embedMode = searchParams.get('embed') === 'true';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formConfig, setFormConfig] = useState(null);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await publicFormsApi.getForm(formId, { embed: embedMode ? 'true' : undefined });
        setFormConfig(response?.data || null);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load form.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [formId, embedMode]);

  const pageContainerStyle = useMemo(() => ({
    minHeight: embedMode ? 'auto' : '100vh',
    padding: embedMode ? '8px' : '32px 16px',
    background: formConfig?.themeMode === 'dark' ? '#0F172A' : '#F8FAFC',
    color: formConfig?.themeMode === 'dark' ? '#F8FAFC' : '#0F172A',
  }), [embedMode, formConfig?.themeMode]);

  const cardStyle = {
    maxWidth: 640,
    margin: '0 auto',
    background: formConfig?.themeMode === 'dark' ? '#111827' : '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #E5E7EB',
    boxShadow: embedMode ? 'none' : '0 10px 30px rgba(15, 23, 42, 0.08)',
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: formState.name,
        email: formState.email || undefined,
        phone: formState.phone || undefined,
        message: formState.message || undefined,
        website: formState.website || '',
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        utm_source: searchParams.get('utm_source') || undefined,
        utm_campaign: searchParams.get('utm_campaign') || undefined,
        utm_medium: searchParams.get('utm_medium') || undefined,
        submissionMode: embedMode ? 'embedded_form' : 'public_form',
      };

      const response = await publicFormsApi.submitForm(formId, payload, { embed: embedMode ? 'true' : undefined });
      const message = response?.data?.successMessage || formConfig?.successMessage || 'Thank you. Your submission has been received.';
      const redirectUrl = response?.data?.redirectUrl;

      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      setSuccess(message);
      setFormState(EMPTY_FORM);
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit form.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={pageContainerStyle}>Loading form…</div>;
  }

  if (!formConfig) {
    return <div style={pageContainerStyle}>Form not available.</div>;
  }

  return (
    <main style={pageContainerStyle}>
      <section style={cardStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>{formConfig.embedTitle || formConfig.name}</h1>
        {!embedMode && <p style={{ marginTop: 0, marginBottom: 20, color: '#64748B' }}>Submit your intake details below.</p>}
        {error && <p style={{ color: '#B91C1C', marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: '#047857', marginBottom: 12 }}>{success}</p>}
        <form onSubmit={handleSubmit}>
          <input type="text" name="website" value={formState.website} onChange={handleChange} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
          <label htmlFor="public-form-name">Name</label>
          <input id="public-form-name" name="name" type="text" value={formState.name} onChange={handleChange} required style={{ width: '100%', marginBottom: 12 }} />

          <label htmlFor="public-form-email">Email</label>
          <input id="public-form-email" name="email" type="email" value={formState.email} onChange={handleChange} style={{ width: '100%', marginBottom: 12 }} />

          <label htmlFor="public-form-phone">Phone</label>
          <input id="public-form-phone" name="phone" type="text" value={formState.phone} onChange={handleChange} style={{ width: '100%', marginBottom: 12 }} />

          <label htmlFor="public-form-message">Message</label>
          <textarea id="public-form-message" name="message" value={formState.message} onChange={handleChange} rows={4} style={{ width: '100%', marginBottom: 12 }} />

          <button type="submit" disabled={submitting} style={{ width: '100%', padding: '10px 14px' }}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default PublicFormPage;
