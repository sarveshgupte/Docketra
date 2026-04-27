import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { adminApi } from '../api/admin.api';
import { slaApi } from '../api/sla.api';
import { categoryService } from '../services/categoryService';
import { getFirmConfig, setFirmConfig } from '../utils/firmConfig';
import { formatDateTime } from '../utils/formatDateTime';
import { StatusMessageStack } from './platform/PlatformShared';

const enabledDisabledOptions = [
  { value: 'true', label: 'Enabled' },
  { value: 'false', label: 'Disabled' },
];

const defaultSlaForm = {
  id: '',
  category: '',
  subcategory: '',
  workbasketId: '',
  slaHours: '',
  isActive: true,
};

const getRuleScopeLabel = (rule) => {
  const scopes = [];
  if (rule.category) scopes.push(rule.category);
  if (rule.subcategory) scopes.push(rule.subcategory);
  if (rule.workbasketName || rule.workbasketId) scopes.push(rule.workbasketName || rule.workbasketId);
  if (scopes.length === 0) return 'Default';
  return scopes.join(' • ');
};

export const FirmSettingsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const [config, setConfig] = useState(getFirmConfig());
  const [activity, setActivity] = useState([]);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [activityError, setActivityError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [categories, setCategories] = useState([]);
  const [workbaskets, setWorkbaskets] = useState([]);
  const [slaRules, setSlaRules] = useState([]);
  const [loadingSlaData, setLoadingSlaData] = useState(true);
  const [savingSlaRule, setSavingSlaRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState('');
  const [slaMessage, setSlaMessage] = useState({ type: '', text: '' });
  const [slaForm, setSlaForm] = useState(defaultSlaForm);

  const categoryOptions = useMemo(() => ([
    { value: '', label: 'All categories' },
    ...categories.map((category) => ({
      value: category.name,
      label: category.name,
    })),
  ]), [categories]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.name === slaForm.category),
    [categories, slaForm.category],
  );

  const subcategoryOptions = useMemo(() => ([
    { value: '', label: 'All subcategories' },
    ...((selectedCategory?.subcategories || [])
      .filter((subcategory) => subcategory?.isActive !== false)
      .map((subcategory) => ({ value: subcategory.name, label: subcategory.name }))),
  ]), [selectedCategory]);

  const workbasketOptions = useMemo(() => ([
    { value: '', label: 'All workbaskets' },
    ...workbaskets.map((workbasket) => ({
      value: String(workbasket._id),
      label: workbasket.name,
    })),
  ]), [workbaskets]);

  const loadFirmSettings = async () => {
    setLoadingConfig(true);
    try {
      const response = await adminApi.getFirmSettings();
      const serverConfig = response?.data?.firm;
      if (serverConfig) {
        const merged = setFirmConfig(serverConfig);
        setConfig(merged);
      }
    } catch {
      // Fall back to locally cached config to keep UI functional.
      setConfig(getFirmConfig());
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadActivity = async () => {
    setLoadingActivity(true);
    setActivityError('');
    try {
      const response = await adminApi.getFirmSettingsActivity({ limit: 50 });
      const records = response?.data || [];
      const normalizedActivity = records
        .map((entry) => ({
          id: entry.id || `${entry.source || 'audit'}-${entry.timestamp || ''}-${entry.action || ''}-${entry.xID || ''}`,
          actor: entry.xID || 'SYSTEM',
          timestamp: entry.timestamp,
          description: entry.description || entry.action || 'Admin activity recorded',
        }))
        .filter((entry) => entry.timestamp)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);
      setActivity(normalizedActivity);
    } catch {
      setActivity([]);
      setActivityError('Could not load admin audit activity. You can retry without losing settings changes.');
    } finally {
      setLoadingActivity(false);
    }
  };

  const loadSlaData = async () => {
    setLoadingSlaData(true);
    setSlaMessage({ type: '', text: '' });
    try {
      const [categoryResponse, workbasketResponse, slaResponse] = await Promise.all([
        categoryService.getAdminCategories(false),
        adminApi.listWorkbaskets({ includeInactive: true }),
        slaApi.getRules({ includeInactive: true }),
      ]);
      setCategories(Array.isArray(categoryResponse?.data) ? categoryResponse.data : []);
      setWorkbaskets(Array.isArray(workbasketResponse?.data) ? workbasketResponse.data : []);
      setSlaRules(Array.isArray(slaResponse?.data) ? slaResponse.data : []);
    } catch {
      setCategories([]);
      setWorkbaskets([]);
      setSlaRules([]);
      setSlaMessage({ type: 'error', text: 'Could not load SLA configuration.' });
    } finally {
      setLoadingSlaData(false);
    }
  };

  useEffect(() => {
    loadActivity();
    loadFirmSettings();
    loadSlaData();
  }, []);

  const handleNumberChange = (event) => {
    const { name, value } = event.target;
    setSaveMessage({ type: '', text: '' });
    setConfig((prev) => ({ ...prev, [name]: value }));
    setHasUnsavedChanges(true);
  };

  const handleToggleChange = (event) => {
    const { name, value } = event.target;
    setSaveMessage({ type: '', text: '' });
    setConfig((prev) => ({ ...prev, [name]: value === 'true' }));
    setHasUnsavedChanges(true);
  };

  const handleTextChange = (event) => {
    const { name, value } = event.target;
    setSaveMessage({ type: '', text: '' });
    setConfig((prev) => ({ ...prev, [name]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    const firmPayload = {
      slaDefaultDays: Number(config.slaDefaultDays) || 0,
      escalationInactivityThresholdHours: Number(config.escalationInactivityThresholdHours) || 0,
      workloadThreshold: Number(config.workloadThreshold) || 15,
      enablePerformanceView: Boolean(config.enablePerformanceView),
      enableEscalationView: Boolean(config.enableEscalationView),
      enableBulkActions: Boolean(config.enableBulkActions),
      brandLogoUrl: typeof config.brandLogoUrl === 'string' ? config.brandLogoUrl.trim() : '',
    };
    try {
      const response = await adminApi.updateFirmSettings({ firm: firmPayload });
      const saved = setFirmConfig(response?.data?.firm || firmPayload);
      setConfig(saved);
      setHasUnsavedChanges(false);
      setSaveMessage({ type: 'success', text: 'Firm settings saved successfully.' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Could not save settings. Please retry.' });
    }
  };

  const handleSlaFormChange = (event) => {
    const { name, value } = event.target;
    setSlaMessage({ type: '', text: '' });
    setSlaForm((prev) => ({
      ...prev,
      [name]: name === 'isActive' ? value === 'true' : value,
      ...(name === 'category' ? { subcategory: '' } : {}),
    }));
  };

  const resetSlaForm = () => {
    setSlaForm(defaultSlaForm);
    setSlaMessage({ type: '', text: '' });
  };

  const handleEditRule = (rule) => {
    setSlaForm({
      id: rule._id || rule.id || '',
      category: rule.category || '',
      subcategory: rule.subcategory || '',
      workbasketId: rule.workbasketId || '',
      slaHours: String(rule.slaHours || ''),
      isActive: rule.isActive !== false,
    });
    setSlaMessage({ type: '', text: '' });
  };

  const handleSaveRule = async () => {
    if (!slaForm.slaHours || Number(slaForm.slaHours) <= 0) {
      setSlaMessage({ type: 'error', text: 'Enter a valid SLA hour value.' });
      return;
    }

    setSavingSlaRule(true);
    try {
      await slaApi.saveRule({
        ...(slaForm.id ? { id: slaForm.id } : {}),
        category: slaForm.category || null,
        subcategory: slaForm.subcategory || null,
        workbasketId: slaForm.workbasketId || null,
        slaHours: Number(slaForm.slaHours),
        isActive: Boolean(slaForm.isActive),
      });
      await loadSlaData();
      resetSlaForm();
      setSlaMessage({ type: 'success', text: 'SLA rule saved.' });
    } catch {
      setSlaMessage({ type: 'error', text: 'Could not save the SLA rule.' });
    } finally {
      setSavingSlaRule(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!ruleId) return;
    setDeletingRuleId(ruleId);
    setSlaMessage({ type: '', text: '' });
    try {
      await slaApi.deleteRule(ruleId);
      await loadSlaData();
      if (slaForm.id === ruleId) {
        resetSlaForm();
      }
      setSlaMessage({ type: 'success', text: 'SLA rule deleted.' });
    } catch {
      setSlaMessage({ type: 'error', text: 'Could not delete the SLA rule.' });
    } finally {
      setDeletingRuleId('');
    }
  };

  const primaryStatusMessages = [
    saveMessage.text
      ? { tone: saveMessage.type === 'success' ? 'success' : 'error', message: saveMessage.text }
      : null,
  ].filter(Boolean);
  const slaStatusMessages = [
    slaMessage.text
      ? { tone: slaMessage.type === 'success' ? 'success' : 'error', message: slaMessage.text }
      : null,
  ].filter(Boolean);

  return (
    <PlatformShell moduleLabel="Settings" title="Firm settings" subtitle="Configure operational defaults, SLA policy, and feature visibility for this firm.">
      <div className="min-h-screen w-full flex-1 bg-[var(--dt-bg-warm)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 space-y-8">
          <PageHeader
            title="Firm Settings"
            description="Configure operational defaults and feature visibility for this firm."
          />

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
            <div className="space-y-2 lg:col-span-1">
              <h2 className="text-lg font-medium text-[var(--dt-text)]">Operational Configuration</h2>
              <p className="text-sm text-[var(--dt-text-muted)]">Set the default thresholds that guide case routing, SLAs, and escalation timing.</p>
            </div>
            <Card className="lg:col-span-2 lg:max-w-4xl">
              <div className="space-y-5">
                <Input
                  label="SLA default days"
                  name="slaDefaultDays"
                  type="number"
                  min="1"
                  value={config.slaDefaultDays}
                  onChange={handleNumberChange}
                />
                <Input
                  label="Escalation inactivity threshold (hours)"
                  name="escalationInactivityThresholdHours"
                  type="number"
                  min="1"
                  value={config.escalationInactivityThresholdHours}
                  onChange={handleNumberChange}
                />
                <Input
                  label="Workload threshold"
                  name="workloadThreshold"
                  type="number"
                  min="1"
                  value={config.workloadThreshold}
                  onChange={handleNumberChange}
                />
                <Input
                  label="Firm/company logo URL"
                  name="brandLogoUrl"
                  type="url"
                  placeholder="https://example.com/company-logo.png"
                  value={config.brandLogoUrl || ''}
                  onChange={handleTextChange}
                  helpText="Optional. This image replaces the initials badge in the sidebar."
                />
              </div>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
            <div className="space-y-2 lg:col-span-1">
              <h2 className="text-lg font-medium text-[var(--dt-text)]">View &amp; Action Controls</h2>
              <p className="text-sm text-[var(--dt-text-muted)]">Enable or hide operational views and bulk actions for firm users.</p>
            </div>
            <Card className="lg:col-span-2 lg:max-w-4xl">
              <div className="space-y-5">
                <Select
                  label="Performance View"
                  name="enablePerformanceView"
                  value={String(Boolean(config.enablePerformanceView))}
                  onChange={handleToggleChange}
                  options={enabledDisabledOptions}
                />
                <Select
                  label="Escalation View"
                  name="enableEscalationView"
                  value={String(Boolean(config.enableEscalationView))}
                  onChange={handleToggleChange}
                  options={enabledDisabledOptions}
                />
                <Select
                  label="Bulk Actions"
                  name="enableBulkActions"
                  value={String(Boolean(config.enableBulkActions))}
                  onChange={handleToggleChange}
                  options={enabledDisabledOptions}
                />
              </div>

              <div className="mt-6">
                <StatusMessageStack messages={primaryStatusMessages} />
              </div>

              <div className="mt-6 pt-5 border-t border-[var(--dt-border-whisper)] flex flex-wrap justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate(`/app/firm/${firmSlug}/admin`)}>
                  Back to Admin
                </Button>
                <Button type="button" variant="primary" onClick={handleSave} disabled={loadingConfig}>
                  {loadingConfig ? 'Loading…' : (hasUnsavedChanges ? 'Save Changes' : 'Saved')}
                </Button>
              </div>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
            <div className="space-y-2 lg:col-span-1">
              <h2 className="text-lg font-medium text-[var(--dt-text)]">SLA Rules</h2>
              <p className="text-sm text-[var(--dt-text-muted)]">Create simple default, category, subcategory, or workbasket SLA rules. The most specific rule wins.</p>
            </div>
            <Card className="lg:col-span-2 lg:max-w-4xl">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label="Category"
                  name="category"
                  value={slaForm.category}
                  onChange={handleSlaFormChange}
                  options={categoryOptions}
                />
                <Select
                  label="Subcategory"
                  name="subcategory"
                  value={slaForm.subcategory}
                  onChange={handleSlaFormChange}
                  options={subcategoryOptions}
                />
                <Select
                  label="Workbasket"
                  name="workbasketId"
                  value={slaForm.workbasketId}
                  onChange={handleSlaFormChange}
                  options={workbasketOptions}
                />
                <Input
                  label="SLA hours"
                  name="slaHours"
                  type="number"
                  min="1"
                  value={slaForm.slaHours}
                  onChange={handleSlaFormChange}
                />
                <Select
                  label="Status"
                  name="isActive"
                  value={String(Boolean(slaForm.isActive))}
                  onChange={handleSlaFormChange}
                  options={enabledDisabledOptions}
                />
              </div>

              <StatusMessageStack messages={slaStatusMessages} />

              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" variant="primary" onClick={handleSaveRule} disabled={savingSlaRule || loadingSlaData}>
                  {savingSlaRule ? 'Saving…' : (slaForm.id ? 'Update Rule' : 'Add Rule')}
                </Button>
                <Button type="button" variant="outline" onClick={resetSlaForm} disabled={savingSlaRule}>
                  Reset
                </Button>
              </div>

              <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--dt-border-whisper)]">
                {loadingSlaData ? (
                  <div className="px-4 py-6 text-sm text-[var(--dt-text-muted)]">Loading SLA rules…</div>
                ) : slaRules.length ? (
                  <table className="min-w-full divide-y divide-[var(--dt-border-whisper)] text-sm">
                    <thead className="bg-[var(--dt-bg-warm)] text-left text-xs uppercase tracking-wider text-[var(--dt-text-muted)]">
                      <tr>
                        <th className="px-4 py-3">Category / Workbasket</th>
                        <th className="px-4 py-3">SLA hours</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--dt-border-whisper)] bg-[var(--dt-surface)] text-[var(--dt-text-secondary)]">
                      {slaRules.map((rule) => (
                        <tr key={rule._id || rule.id}>
                          <td className="px-4 py-3 font-medium text-[var(--dt-text)]">{getRuleScopeLabel(rule)}</td>
                          <td className="px-4 py-3">{rule.slaHours}</td>
                          <td className="px-4 py-3">{rule.isActive === false ? 'Disabled' : 'Active'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" size="small" onClick={() => handleEditRule(rule)}>
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                size="small"
                                onClick={() => handleDeleteRule(rule._id || rule.id)}
                                disabled={deletingRuleId === (rule._id || rule.id)}
                              >
                                {deletingRuleId === (rule._id || rule.id) ? 'Deleting…' : 'Delete'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-4 py-6">
                    <EmptyState
                      title="No SLA rules configured"
                      description="Add a default rule first, then layer category, subcategory, or workbasket overrides."
                    />
                  </div>
                )}
              </div>
            </Card>
          </section>

          <Card className="max-w-4xl">
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-medium text-[var(--dt-text)] mb-4">Admin Settings Change Log</h2>
                <p className="text-sm text-[var(--dt-text-muted)]">Last 10 admin configuration changes from firm-scoped audit logs (xID + timestamp).</p>
              </div>
              {loadingActivity ? (
                <div className="rounded-lg border border-[var(--dt-border-whisper)] bg-[var(--dt-bg-warm)] px-4 py-3 text-sm text-[var(--dt-text-secondary)]">
                  Loading recent activity…
                </div>
              ) : activityError ? (
                <div className="rounded-lg border border-[var(--dt-warning)] bg-[var(--dt-warning-subtle)] px-4 py-3 text-sm text-[var(--dt-warning)]">
                  <p>{activityError}</p>
                  <Button type="button" variant="outline" onClick={loadActivity} className="mt-3">
                    Retry Activity Feed
                  </Button>
                </div>
              ) : activity.length ? (
                <ul className="space-y-3">
                  {activity.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-[var(--dt-border-whisper)] bg-[var(--dt-surface)] px-4 py-3 text-sm text-[var(--dt-text-secondary)]">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-[var(--dt-text)]">{entry.actor}</span>
                        <span className="text-[var(--dt-text-disabled)]">•</span>
                        <span>{formatDateTime(entry.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">{entry.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No admin audit activity available"
                  description="Admin configuration actions (users, categories, settings, storage, bulk uploads) will appear here."
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </PlatformShell>
  );
};
