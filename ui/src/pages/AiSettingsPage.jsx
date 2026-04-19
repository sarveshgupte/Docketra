import React, { useContext, useEffect, useMemo, useState } from 'react';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { ToastContext } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { getAiConfigurationStatus, saveAiConfiguration, disconnectAiConfiguration } from '../services/aiSettingsService';
import { spacingClasses } from '../theme/tokens';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'claude', label: 'Anthropic Claude' },
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

  const isPrimaryAdmin = useMemo(() => normalizeRole(user?.role) === 'PRIMARY_ADMIN', [user?.role]);

  const loadStatus = async () => {
    try {
      const data = await getAiConfigurationStatus();
      setConnected(Boolean(data?.connected));
      setProvider(String(data?.provider || 'openai').trim().toLowerCase());
      setModel(data?.model || '');
    } catch (error) {
      toast?.showError?.(error?.response?.data?.message || 'Failed to load AI settings.');
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
      return;
    }

    setSaving(true);
    try {
      const result = await saveAiConfiguration({
        provider,
        apiKey: apiKey.trim(),
        ...(model.trim() ? { model: model.trim() } : {}),
      });
      setConnected(Boolean(result?.connected));
      setApiKey('');
      toast?.showSuccess?.('AI settings updated.');
      await loadStatus();
    } catch (error) {
      toast?.showError?.(error?.response?.data?.message || 'Failed to save AI settings.');
    } finally {
      setSaving(false);
    }
  };

  const onDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectAiConfiguration();
      setConnected(false);
      setApiKey('');
      toast?.showSuccess?.('AI provider disconnected.');
      await loadStatus();
    } catch (error) {
      toast?.showError?.(error?.response?.data?.message || 'Failed to disconnect AI provider.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <PlatformShell moduleLabel="Settings" title="AI settings" subtitle="Manage firm-level BYOAI provider configuration.">
        <div className="min-h-screen bg-gray-50">
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">AI Settings</h1>
              <p className="text-sm text-gray-500">Connect your preferred provider for BYOAI features.</p>
            </div>
            <Card>
              <p className="text-sm text-gray-500">Loading AI settings...</p>
            </Card>
          </div>
        </div>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell moduleLabel="Settings" title="AI settings" subtitle="Manage firm-level BYOAI provider configuration.">
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">AI Settings</h1>
            <p className="text-sm text-gray-500">Manage your firm-level BYOAI provider configuration.</p>
          </div>

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Provider Configuration</h2>
                <p className="text-sm text-gray-500">Primary Admin can connect or rotate API credentials.</p>
              </div>

              <div className={spacingClasses.formFieldSpacing}>
                <Select
                  label="Provider"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  options={PROVIDER_OPTIONS}
                  disabled={!isPrimaryAdmin || saving || disconnecting}
                />
                <Input
                  label="Connection Status"
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
                  label="API Key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Enter a new key to connect or rotate"
                  helpText={isPrimaryAdmin ? 'For security, existing keys are never shown.' : 'Only Primary Admin can update AI keys.'}
                  disabled={!isPrimaryAdmin || saving || disconnecting}
                />
              </div>

              <div className={`${spacingClasses.formActions} ${spacingClasses.formActionsGap}`}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={onSave}
                  loading={saving}
                  disabled={!isPrimaryAdmin || disconnecting}
                >
                  Save AI Settings
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDisconnect}
                  loading={disconnecting}
                  disabled={!isPrimaryAdmin || !connected || saving}
                >
                  Disconnect Provider
                </Button>
                {!isPrimaryAdmin ? (
                  <p className="text-xs text-gray-500">Your role can view AI status, but only Primary Admin can edit this setting.</p>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PlatformShell>
  );
}

export default AiSettingsPage;
