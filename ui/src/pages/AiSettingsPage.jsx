import React, { useContext, useEffect, useMemo, useState } from 'react';
import { PlatformShell } from '../components/platform/PlatformShell';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
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

const FEATURE_META = {
  taskDescriptionRefinement: {
    label: 'Task description refinement',
    description: 'Polish task briefs before they enter team queues.',
  },
  documentSummary: {
    label: 'Document summaries',
    description: 'Summarize uploaded documents for quicker review.',
  },
  docketDrafting: {
    label: 'Docket drafting',
    description: 'Assist with first-pass docket and compliance drafts.',
  },
  routingSuggestions: {
    label: 'Routing suggestions',
    description: 'Suggest workbasket routing from task context.',
  },
};

const ROLE_META = {
  PRIMARY_ADMIN: {
    label: 'Primary admin',
    description: 'Owner-level configuration and override access.',
  },
  ADMIN: {
    label: 'Admin',
    description: 'Manage workspace setup and AI operations.',
  },
  MANAGER: {
    label: 'Manager',
    description: 'Use AI for team review and routing workflows.',
  },
  USER: {
    label: 'User',
    description: 'Use approved AI actions in day-to-day work.',
  },
};

const RETENTION_META = {
  zeroRetention: {
    label: 'Zero retention',
    description: 'Keep raw prompts and outputs out of firm storage.',
  },
  savePrompts: {
    label: 'Save prompts',
    description: 'Retain submitted prompts for audit review.',
  },
  saveOutputs: {
    label: 'Save outputs',
    description: 'Retain generated responses for quality checks.',
  },
};

const PRIVACY_META = {
  redactErrors: {
    label: 'Redact error details',
    description: 'Hide sensitive provider payload details from error logs.',
  },
  verboseLogging: {
    label: 'Verbose logging',
    description: 'Capture additional diagnostics while testing rollout.',
  },
};

const modeLabel = (provider, enabled) => {
  if (!enabled || isProviderDisabled(provider)) return 'Disabled';
  if (String(provider).toLowerCase() === 'docketra_managed') return 'Docketra-managed AI';
  return 'Firm-connected BYOAI';
};

const providerLabel = (provider) => PROVIDER_OPTIONS.find((option) => option.value === provider)?.label || 'Disabled';

const countEnabled = (values = {}) => Object.values(values).filter(Boolean).length;

function ToggleRow({ checked, description, disabled = false, label, name, onChange }) {
  return (
    <label className={`ai-toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="ai-toggle-row__copy">
        <span className="ai-toggle-row__title">{label}</span>
        <span className="ai-toggle-row__description">{description}</span>
      </span>
      <span className="custom-toggle ai-toggle-row__switch">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="custom-toggle-slider" />
      </span>
    </label>
  );
}

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

  const currentMode = modeLabel(formState.provider, formState.enabled);
  const enabledFeatureCount = countEnabled(formState.features);
  const enabledGuardrailCount = countEnabled(formState.retention) + countEnabled(formState.privacy);

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
      <div className="platform-page platform-page--wide ai-settings-page section-group">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => navigate(ROUTES.SETTINGS(firmSlug))}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 transition hover:text-indigo-600"
          >
            &larr; Go back to settings
          </button>
        </div>

        <StatusMessageStack messages={statusMessages} />

        <section className="ai-settings-hero settings-status-card" aria-labelledby="ai-settings-title">
          <div className="ai-settings-hero__copy">
            <p className="ai-settings-eyebrow">AI governance</p>
            <h2 id="ai-settings-title">Provider status and configuration</h2>
            <p>AI is optional. Configure provider access, safeguards, and usage controls only when your firm is ready to use assisted drafting and summaries.</p>
          </div>
          <div className="ai-readiness-strip" aria-label="AI readiness summary">
            <div className="ai-readiness-strip__item">
              <span>Mode</span>
              <strong className={formState.enabled ? 'is-enabled' : 'is-disabled'}>{currentMode}</strong>
            </div>
            <div className="ai-readiness-strip__item">
              <span>Provider</span>
              <strong>{providerLabel(formState.provider)}</strong>
            </div>
            <div className="ai-readiness-strip__item">
              <span>Credential</span>
              <strong>{hasEncryptedKey || hasCredentialRef ? 'Configured' : 'Not set'}</strong>
            </div>
            <div className="ai-readiness-strip__item">
              <span>Controls</span>
              <strong>{enabledFeatureCount} features</strong>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="panel ai-settings-loading">
            <p className="muted">Loading AI settings...</p>
          </section>
        ) : forbidden ? null : (
          <div className="settings-form-split ai-settings-layout">
            <aside className="settings-form-split__meta ai-settings-brief" aria-label="AI rollout summary">
              <div className="ai-brief-block">
                <span className="ai-brief-block__kicker">Rollout stance</span>
                <strong>{formState.enabled ? 'Ready for controlled use' : 'Off by default'}</strong>
                <p>Keep access narrow until your team has provider credentials, approved roles, and retention policy aligned.</p>
              </div>
              <div className="ai-brief-list">
                <div>
                  <span>Allowed roles</span>
                  <strong>{formState.allowedRoles.length || 0}</strong>
                </div>
                <div>
                  <span>Feature toggles</span>
                  <strong>{enabledFeatureCount}</strong>
                </div>
                <div>
                  <span>Guardrails active</span>
                  <strong>{enabledGuardrailCount}</strong>
                </div>
              </div>
              <p className="ai-settings-note">Raw prompts/outputs are not retained by default. Enabling retention should require firm/legal approval.</p>
            </aside>

            <div className="settings-form-split__controls ai-settings-controls">
              <section className="ai-settings-panel" aria-labelledby="ai-provider-heading">
                <div className="ai-settings-panel__header">
                  <div>
                    <span className="ai-settings-eyebrow">01 / Provider setup</span>
                    <h3 id="ai-provider-heading">Connect the model source</h3>
                  </div>
                  <span className={`ai-status-pill ${formState.enabled ? 'ai-status-pill--enabled' : 'ai-status-pill--disabled'}`}>
                    {currentMode}
                  </span>
                </div>
                <div className="ai-settings-grid">
                  <Select
                    label="Provider"
                    value={formState.provider}
                    onChange={(e) => setFormState((s) => ({ ...s, provider: e.target.value, enabled: !isProviderDisabled(e.target.value) }))}
                    options={PROVIDER_OPTIONS}
                  />
                  <Input
                    label="Model"
                    value={formState.model}
                    onChange={(e) => setFormState((s) => ({ ...s, model: e.target.value }))}
                    placeholder="e.g. gpt-4.1-mini"
                  />
                  <Select
                    label="Credential mode"
                    value={formState.credentialMode}
                    onChange={(e) => setFormState((s) => ({ ...s, credentialMode: e.target.value }))}
                    options={CREDENTIAL_MODE_OPTIONS}
                  />
                  <Input
                    label="New credential reference"
                    value={formState.credentialRef}
                    onChange={(e) => setFormState((s) => ({ ...s, credentialRef: e.target.value }))}
                    placeholder={hasCredentialRef ? 'Existing reference is configured. Enter a new reference only to rotate.' : 'Enter credential reference'}
                  />
                </div>
                <Input
                  label="New API key"
                  type="password"
                  value={formState.encryptedKey}
                  onChange={(e) => setFormState((s) => ({ ...s, encryptedKey: e.target.value }))}
                  placeholder={hasEncryptedKey ? 'Existing key is configured. Enter a new key only to rotate.' : 'Enter new key'}
                  helpText="Leave blank to keep the existing encrypted key."
                />
              </section>

              <section className="ai-settings-panel" aria-labelledby="ai-features-heading">
                <div className="ai-settings-panel__header">
                  <div>
                    <span className="ai-settings-eyebrow">02 / Usage controls</span>
                    <h3 id="ai-features-heading">Feature toggles</h3>
                  </div>
                  <span className="ai-count-pill">{enabledFeatureCount} active</span>
                </div>
                <div className="ai-toggle-grid ai-toggle-grid--two">
                  {FEATURE_KEYS.map((key) => (
                    <ToggleRow
                      key={key}
                      name={`feature-${key}`}
                      checked={Boolean(formState.features[key])}
                      label={FEATURE_META[key].label}
                      description={FEATURE_META[key].description}
                      onChange={(checked) => setFormState((s) => ({ ...s, features: { ...s.features, [key]: checked } }))}
                    />
                  ))}
                </div>
              </section>

              <section className="ai-settings-panel" aria-labelledby="ai-roles-heading">
                <div className="ai-settings-panel__header">
                  <div>
                    <span className="ai-settings-eyebrow">03 / Access</span>
                    <h3 id="ai-roles-heading">Role access controls</h3>
                  </div>
                  <span className="ai-count-pill">{formState.allowedRoles.length} roles</span>
                </div>
                <div className="ai-toggle-grid">
                  {ROLE_KEYS.map((role) => (
                    <ToggleRow
                      key={role}
                      name={`role-${role}`}
                      checked={formState.allowedRoles.includes(role)}
                      label={ROLE_META[role].label}
                      description={ROLE_META[role].description}
                      onChange={(checked) => setFormState((s) => ({
                        ...s,
                        allowedRoles: checked
                          ? [...new Set([...s.allowedRoles, role])]
                          : s.allowedRoles.filter((item) => item !== role),
                      }))}
                    />
                  ))}
                </div>
              </section>

              <section className="ai-settings-panel" aria-labelledby="ai-retention-heading">
                <div className="ai-settings-panel__header">
                  <div>
                    <span className="ai-settings-eyebrow">04 / Retention and privacy</span>
                    <h3 id="ai-retention-heading">Guardrails</h3>
                  </div>
                  <span className="ai-count-pill">{enabledGuardrailCount} active</span>
                </div>
                <div className="ai-toggle-grid ai-toggle-grid--two">
                  {RETENTION_KEYS.map((key) => (
                    <ToggleRow
                      key={key}
                      name={`retention-${key}`}
                      checked={Boolean(formState.retention[key])}
                      disabled={formState.retention.zeroRetention && (key === 'savePrompts' || key === 'saveOutputs')}
                      label={RETENTION_META[key].label}
                      description={RETENTION_META[key].description}
                      onChange={(checked) => setFormState((s) => ({
                        ...s,
                        retention: {
                          ...s.retention,
                          [key]: checked,
                          ...(key === 'zeroRetention' && checked ? { savePrompts: false, saveOutputs: false } : {}),
                        },
                      }))}
                    />
                  ))}
                  {PRIVACY_KEYS.map((key) => (
                    <ToggleRow
                      key={key}
                      name={`privacy-${key}`}
                      checked={Boolean(formState.privacy[key])}
                      label={PRIVACY_META[key].label}
                      description={PRIVACY_META[key].description}
                      onChange={(checked) => setFormState((s) => ({ ...s, privacy: { ...s.privacy, [key]: checked } }))}
                    />
                  ))}
                </div>
              </section>

              {testResult ? (
                <section className={`ai-test-result ${testResult?.success ? 'ai-test-result--success' : 'ai-test-result--error'}`} aria-live="polite">
                  <div>
                    <span className="ai-settings-eyebrow">Connection test</span>
                    <strong>{testResult?.success ? 'Provider connection succeeded' : 'Provider connection failed'}</strong>
                  </div>
                  <dl>
                    <div><dt>Reason</dt><dd>{testResult?.reasonCode || '-'}</dd></div>
                    <div><dt>Message</dt><dd>{testResult?.safeMessage || '-'}</dd></div>
                    <div><dt>Credential</dt><dd>{testResult?.credentialStatus || '-'}</dd></div>
                    <div><dt>Policy</dt><dd>{testResult?.policyVersion || '-'}</dd></div>
                  </dl>
                </section>
              ) : null}

              <div className="settings-action-bar ai-settings-actions">
                <Button type="button" variant="secondary" onClick={onTest} loading={testing} size="sm">Test connection</Button>
                <Button type="button" variant="primary" onClick={onSave} loading={saving} size="sm">Save settings</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PlatformShell>
  );
}

export default AiSettingsPage;
