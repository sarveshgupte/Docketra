import React, { useContext, useEffect, useMemo, useState } from 'react';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { PageHeader } from '../components/layout/PageHeader';
import { ToastContext } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { getAiConfigurationStatus, saveAiConfiguration, disconnectAiConfiguration } from '../services/aiSettingsService';
import { spacingClasses } from '../theme/tokens';
import { StatusMessageStack } from './platform/PlatformShared';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
];

const normalizeRole = (role) => String(role || '').trim().toUpperCase();

export function AiSettingsPage() {
  const toast = useContext(ToastContext);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loadError, setLoadError] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const isPrimaryAdmin = useMemo(() => normalizeRole(user?.role) === 'PRIMARY_ADMIN', [user?.role]);
  const statusMessages = useMemo(() => ([
    loadError ? { tone: 'error', message: loadError } : null,
    statusMessage.text
      ? {
        tone: statusMessage.type === 'error' ? 'error' : statusMessage.type === 'success' ? 'success' : 'info',
        message: statusMessage.text,
      }
      : null,
  ].filter(Boolean)), [loadError, statusMessage]);

  const loadStatus = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await getAiConfigurationStatus();
      setConnected(Boolean(data?.connected));
      setProvider(String(data?.provider || 'openai').trim().toLowerCase());
      setModel(data?.model || '');
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to load AI settings.';
      setLoadError(message);
      toast?.showError?.(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    if (!apiKey.trim()) {
      toast?.showError?.('API key is required.');
      setStatusMessage({ type: 'error', text: 'Enter an API key before saving AI settings.' });
      return;
    }

    setSaving(true);
    setStatusMessage({ type: 'info', text: 'Saving AI settings…' });
    try {
      const result = await saveAiConfiguration({
        provider,
        apiKey: apiKey.trim(),
        ...(model.trim() ? { model: model.trim() } : {}),
      });
      setConnected(Boolean(result?.connected));
      setApiKey('');
      toast?.showSuccess?.('AI settings updated.');
      setStatusMessage({ type: 'success', text: 'AI settings saved successfully.' });
      await loadStatus();
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to save AI settings.';
      setStatusMessage({ type: 'error', text: message });
      toast?.showError?.(message);
    } finally {
      setSaving(false);
    }
  };

  const onDisconnect = async () => {
    setDisconnecting(true);
    setStatusMessage({ type: 'info', text: 'Disconnecting AI provider…' });
    try {
      await disconnectAiConfiguration();
      setConnected(false);
      setApiKey('');
      toast?.showSuccess?.('AI provider disconnected.');
      setStatusMessage({ type: 'success', text: 'AI provider disconnected.' });
      await loadStatus();
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to disconnect AI provider.';
      setStatusMessage({ type: 'error', text: message });
      toast?.showError?.(message);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <PlatformShell moduleLabel="Settings" title="AI settings" subtitle="Manage firm-level BYOAI provider configuration.">
      <div className="min-h-screen w-full flex-1 bg-gray-50">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <PageHeader
            title="AI Settings"
            subtitle="Manage your firm-level BYOAI provider configuration."
          />

          <StatusMessageStack messages={statusMessages} />

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <div>
                <h2 className="text-lg font-medium text-gray-900">BYOAI Configuration</h2>
                <p className="text-sm text-gray-600 mt-1">Primary Admin can connect or rotate provider credentials. Existing keys are never displayed.</p>
              </div>

              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                <p className="font-medium">Trust and privacy note</p>
                <p className="mt-1">AI access is optional. Docketra does not require BYOAI to operate, and this setting only controls the configured model provider connection for eligible firm features.</p>
              </div>

              {loading ? <p className="text-sm text-gray-500">Loading AI settings...</p> : (
                <>
                  <div className={spacingClasses.formFieldSpacing}>
                    <Select
                      label="Provider"
                      value={provider}
                      onChange={(event) => setProvider(event.target.value)}
                      options={PROVIDER_OPTIONS}
                      disabled={!isPrimaryAdmin || saving || disconnecting}
                    />
                    <Input
                      label="Connection status"
                      value={connected ? 'Connected' : 'Not connected'}
                      readOnly
                    />
                    <Input
                      label="Model (optional)"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="e.g. gpt-4.1-mini"
                      disabled={!isPrimaryAdmin || saving || disconnecting}
                    />
                    <Input
                      label="API key"
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="Enter a new key to connect or rotate"
                      helpText={isPrimaryAdmin ? 'For security, existing keys are never shown.' : 'Only Primary Admin can update AI keys.'}
                      disabled={!isPrimaryAdmin || saving || disconnecting}
                    />
                  </div>

                  <div className={`${spacingClasses.formActions} ${spacingClasses.formActionsGap} flex-wrap justify-between`}>
                    {!isPrimaryAdmin ? (
                      <p className="text-xs text-gray-500">Your role can view AI status, but only Primary Admin can edit this setting.</p>
                    ) : <span />}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="danger"
                        onClick={onDisconnect}
                        loading={disconnecting}
                        disabled={!isPrimaryAdmin || !connected || saving}
                      >
                        Disconnect Provider
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={onSave}
                        loading={saving}
                        disabled={!isPrimaryAdmin || disconnecting}
                      >
                        Save AI Settings
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </PlatformShell>
  );
}

export default AiSettingsPage;
