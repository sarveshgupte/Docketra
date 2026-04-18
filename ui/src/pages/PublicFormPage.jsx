import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { publicFormsApi } from '../api/forms.api';

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'phone' },
];
const HONEYPOT_KEY = 'website';

const normalizeFieldKey = (value) => String(value || '').trim();

const resolveFieldType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'email' || type === 'phone' || type === 'text') return type;
  return 'text';
};

const toInputType = (fieldType) => {
  if (fieldType === 'email') return 'email';
  if (fieldType === 'phone') return 'tel';
  return 'text';
};

const getRequiredFlag = (field) => (
  Boolean(field?.required) || String(field?.key || '').trim().toLowerCase() === 'name'
);

export const PublicFormPage = () => {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const embedMode = searchParams.get('embed') === 'true';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formConfig, setFormConfig] = useState(null);
  const [formState, setFormState] = useState({ [HONEYPOT_KEY]: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fields = useMemo(() => {
    const configuredFields = Array.isArray(formConfig?.fields) ? formConfig.fields : [];
    if (configuredFields.length === 0) return DEFAULT_FIELDS;
    return configuredFields.map((field, index) => {
      const key = normalizeFieldKey(field?.key) || `field_${index + 1}`;
      return {
        key,
        label: String(field?.label || key).trim() || key,
        type: resolveFieldType(field?.type),
        required: getRequiredFlag(field),
      };
    });
  }, [formConfig?.fields]);

  const hasNameField = useMemo(
    () => fields.some((field) => field.key.toLowerCase() === 'name'),
    [fields],
  );

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

  useEffect(() => {
    const nextState = fields.reduce((acc, field) => {
      acc[field.key] = '';
      return acc;
    }, { [HONEYPOT_KEY]: '' });
    setFormState(nextState);
  }, [fields]);

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
    if (!hasNameField) {
      setError('This form is currently unavailable. Please contact support.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const fieldPayload = fields.reduce((acc, field) => {
        const value = String(formState[field.key] || '').trim();
        if (value) {
          acc[field.key] = value;
        }
        return acc;
      }, {});

      const payload = {
        ...fieldPayload,
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
      setFormState(fields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), { [HONEYPOT_KEY]: '' }));
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
        {!hasNameField && (
          <p style={{ color: '#B45309', marginBottom: 12 }}>
            This form is misconfigured and cannot accept submissions right now.
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <input type="text" name="website" value={formState.website} onChange={handleChange} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
          {fields.map((field) => {
            const inputId = `public-form-${field.key}`;
            return (
              <div key={field.key} style={{ marginBottom: 12 }}>
                <label htmlFor={inputId} style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                  {field.label}
                  {field.required ? ' *' : ''}
                </label>
                <input
                  id={inputId}
                  name={field.key}
                  type={toInputType(field.type)}
                  value={formState[field.key] || ''}
                  onChange={handleChange}
                  required={field.required}
                  style={{ width: '100%' }}
                />
              </div>
            );
          })}

          <button type="submit" disabled={submitting || !hasNameField} style={{ width: '100%', padding: '10px 14px' }}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default PublicFormPage;
