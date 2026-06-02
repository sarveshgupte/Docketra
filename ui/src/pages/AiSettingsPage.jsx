import React, { useContext, useEffect, useMemo, useState } from 'react';
import { PlatformShell } from '../components/platform/PlatformShell';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { ToastContext } from '../contexts/ToastContext';
import { getAiConfiguration, testAiConfiguration, updateAiConfiguration } from '../services/aiService';
import { StatusMessageStack } from './platform/PlatformShared';
import { buildAiConfigurationPayload, isProviderDisabled } from '../utils/aiConfiguration';

const PROVIDER_OPTIONS = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'docketra_managed', label: 'Docketra Managed AI' },
];
const CREDENTIAL_MODE_OPTIONS = [
  { value: 'none', label: 'none' },
  { value: 'encrypted_key', label: 'encrypted_key' },
  { value: 'credential_ref', label: 'credential_ref' },
];
const FEATURE_KEYS = ['taskDescriptionRefinement', 'documentSummary', 'docketDrafting', 'routingSuggestions'];
const ROLE_KEYS = ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'];
const RETENTION_KEYS = ['zeroRetention', 'savePrompts', 'saveOutputs'];
const PRIVACY_KEYS = ['redactErrors', 'verboseLogging'];

const modeLabel = (provider, enabled) => {
  if (!enabled || isProviderDisabled(provider)) return 'Disabled';
  if (String(provider).toLowerCase() === 'docketra_managed') return 'Docketra-managed AI';
  return 'Firm-connected BYOAI';
};

export function AiSettingsPage() {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const toast = useContext(ToastContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [loadError, setLoadError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [hasEncryptedKey, setHasEncryptedKey] = useState(false);
  const [hasCredentialRef, setHasCredentialRef] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [formState, setFormState] = useState({ enabled: false, provider: 'disabled', model: '', credentialMode: 'none', encryptedKey: '', credentialRef: '', features: {}, allowedRoles: [], retention: {}, privacy: {} });

  const loadConfiguration = async () => {
    setLoading(true); setLoadError(''); setForbidden(false);
    try {
      const config = await getAiConfiguration();
      setHasEncryptedKey(Boolean(config?.hasEncryptedKey));
      setHasCredentialRef(Boolean(config?.hasCredentialRef));
      setFormState({
        enabled: Boolean(config?.enabled),
        provider: config?.provider || 'disabled',
        model: config?.model || '',
        credentialMode: config?.credentialMode || 'none',
        encryptedKey: '',
        credentialRef: '',
        features: FEATURE_KEYS.reduce((acc, key) => ({ ...acc, [key]: Boolean(config?.features?.[key]) }), {}),
        allowedRoles: ROLE_KEYS.filter((role) => Boolean(config?.roleAccess?.[role])),
        retention: RETENTION_KEYS.reduce((acc, key) => ({ ...acc, [key]: Boolean(config?.retention?.[key]) }), {}),
        privacy: PRIVACY_KEYS.reduce((acc, key) => ({ ...acc, [key]: Boolean(config?.privacy?.[key]) }), {}),
      });
    } catch (error) {
      if (error?.response?.status === 403) {
        setForbidden(true);
        setLoadError('Only Admin or Primary Admin can manage AI settings.');
      } else {
        setLoadError(error?.response?.data?.message || 'Failed to load AI settings.');
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { void loadConfiguration(); }, []);

  const statusMessages = useMemo(() => [
    loadError ? { tone: 'error', message: loadError } : null,
    statusMessage.text ? { tone: statusMessage.type || 'info', message: statusMessage.text } : null,
  ].filter(Boolean), [loadError, statusMessage]);

  const onSave = async () => {
    setSaving(true); setStatusMessage({ type: 'info', text: 'Saving AI settings…' });
    try {
      const payload = buildAiConfigurationPayload(formState);
      await updateAiConfiguration(payload);
      toast?.showSuccess?.('AI settings saved.');
      setStatusMessage({ type: 'success', text: 'AI settings saved.' });
      await loadConfiguration();
    } catch (error) {
      if (error?.response?.status === 403) {
        setStatusMessage({ type: 'error', text: 'Only Admin or Primary Admin can manage AI settings.' });
      } else {
        setStatusMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to save AI settings.' });
      }
    } finally { setSaving(false); }
  };

  const onTest = async () => {
    setTesting(true);
    try { setTestResult(await testAiConfiguration()); } catch (error) {
      setTestResult(error?.response?.data || { success: false, safeMessage: 'Configuration test failed.' });
    } finally { setTesting(false); }
  };

  return (
    <PlatformShell moduleLabel="Settings" title="AI settings" subtitle="Configure optional AI assistance for your workspace.">
      <div className="platform-page section-group">
        
        {/* Go Back to Settings Link */}
        <div className="flex items-center mb-6">
          <button
            type="button"
            onClick={() => navigate(ROUTES.SETTINGS(firmSlug))}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-600 transition"
          >
            ← Go back to settings
          </button>
        </div>

        <StatusMessageStack messages={statusMessages} />
        <Card className="settings-status-card"><div className="settings-form-split">
          <div className="settings-form-split__meta">
            <h2 className="text-lg font-semibold text-[var(--dt-text)]">Provider status and configuration</h2>
            <p className="text-sm text-[var(--dt-text-secondary)]">AI is optional. Configure provider access, safeguards, and usage controls for assisted workflows.</p>
          </div>
          <div className="settings-form-split__controls">
          {loading ? <p className="text-sm text-[var(--dt-text-muted)]">Loading AI settings...</p> : (
            <>
              <p className="text-sm text-[var(--dt-text-secondary)]">AI is optional. Configure it only when your firm is ready to use assisted drafting and summaries.</p>
              {forbidden ? null : <>
                <Input label="Current AI mode" value={modeLabel(formState.provider, formState.enabled)} readOnly />
                <Select label="Provider" value={formState.provider} onChange={(e) => setFormState((s) => ({ ...s, provider: e.target.value, enabled: !isProviderDisabled(e.target.value) }))} options={PROVIDER_OPTIONS} />
                <Input label="Model" value={formState.model} onChange={(e) => setFormState((s) => ({ ...s, model: e.target.value }))} placeholder="e.g. gpt-4.1-mini" />
                <Select label="Credential mode" value={formState.credentialMode} onChange={(e) => setFormState((s) => ({ ...s, credentialMode: e.target.value }))} options={CREDENTIAL_MODE_OPTIONS} />
                <Input label="New API key" type="password" value={formState.encryptedKey} onChange={(e) => setFormState((s) => ({ ...s, encryptedKey: e.target.value }))} placeholder={hasEncryptedKey ? 'Existing key is configured. Enter a new key only to rotate.' : 'Enter new key'} />
                <Input label="New credential reference" value={formState.credentialRef} onChange={(e) => setFormState((s) => ({ ...s, credentialRef: e.target.value }))} placeholder={hasCredentialRef ? 'Existing reference is configured. Enter a new reference only to rotate.' : 'Enter credential reference'} />
                <h3 className="text-base font-medium">Feature toggles</h3>
                {FEATURE_KEYS.map((k) => <label key={k} className="flex gap-2 items-center"><input type="checkbox" checked={Boolean(formState.features[k])} onChange={(e) => setFormState((s) => ({ ...s, features: { ...s.features, [k]: e.target.checked } }))} />{k}</label>)}
                <h3 className="text-base font-medium">Role access controls</h3>
                {ROLE_KEYS.map((role) => <label key={role} className="flex gap-2 items-center"><input type="checkbox" checked={formState.allowedRoles.includes(role)} onChange={(e) => setFormState((s) => ({ ...s, allowedRoles: e.target.checked ? [...new Set([...s.allowedRoles, role])] : s.allowedRoles.filter((r) => r !== role) }))} />{role}</label>)}
                <h3 className="text-base font-medium">Retention & privacy</h3>
                <p className="text-xs text-[var(--dt-text-muted)]">Raw prompts/outputs are not retained by default. Enabling retention should require firm/legal approval.</p>
                {RETENTION_KEYS.map((k) => <label key={k} className="flex gap-2 items-center"><input type="checkbox" checked={Boolean(formState.retention[k])} disabled={formState.retention.zeroRetention && (k === 'savePrompts' || k === 'saveOutputs')} onChange={(e) => setFormState((s) => ({ ...s, retention: { ...s.retention, [k]: e.target.checked, ...(k === 'zeroRetention' && e.target.checked ? { savePrompts: false, saveOutputs: false } : {}) } }))} />{k}</label>)}
                {PRIVACY_KEYS.map((k) => <label key={k} className="flex gap-2 items-center"><input type="checkbox" checked={Boolean(formState.privacy[k])} onChange={(e) => setFormState((s) => ({ ...s, privacy: { ...s.privacy, [k]: e.target.checked } }))} />{k}</label>)}
                <div className="settings-action-bar">
                  <Button type="button" variant="secondary" onClick={onTest} loading={testing}>Test connection</Button>
                  <Button type="button" variant="primary" onClick={onSave} loading={saving}>Save settings</Button>
                </div>
                {testResult ? <div className="rounded border border-[var(--dt-border-whisper)] p-3 text-sm"><p><strong>Result:</strong> {testResult?.success ? 'success' : 'failure'}</p><p><strong>reasonCode:</strong> {testResult?.reasonCode || '-'}</p><p><strong>safeMessage:</strong> {testResult?.safeMessage || '-'}</p><p><strong>credentialStatus:</strong> {testResult?.credentialStatus || '-'}</p><p><strong>policyVersion:</strong> {testResult?.policyVersion || '-'}</p></div> : null}
              </>}
            </>
          )}
          </div>
        </div></Card>
      </div>
    </PlatformShell>
  );
}

export default AiSettingsPage;
