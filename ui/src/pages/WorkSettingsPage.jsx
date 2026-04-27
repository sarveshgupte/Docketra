import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { PageHeader } from '../components/layout/PageHeader';
import { adminApi } from '../api/admin.api';
import { ROUTES } from '../constants/routes';
import { spacingClasses } from '../theme/tokens';
import { StatusMessageStack } from './platform/PlatformShared';

export const WorkSettingsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const [workbaskets, setWorkbaskets] = useState([]);
  const [workbasketName, setWorkbasketName] = useState('');
  const [workbasketSaving, setWorkbasketSaving] = useState(false);
  const [loadingWorkbaskets, setLoadingWorkbaskets] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [intakeLoading, setIntakeLoading] = useState(true);
  const [intakeSaving, setIntakeSaving] = useState(false);
  const [intakeRegenerating, setIntakeRegenerating] = useState(false);
  const [intakeState, setIntakeState] = useState({
    autoCreateClient: true,
    autoCreateDocket: true,
    defaultCategoryId: '',
    defaultSubcategoryId: '',
    defaultWorkbasketId: '',
    defaultPriority: '',
    defaultAssignee: '',
    intakeApiEnabled: false,
  });
  const [intakeMeta, setIntakeMeta] = useState({ options: { categories: [], workbaskets: [], priorities: [], assignees: [] }, intakeApiKeyMasked: null });
  const [intakeKey, setIntakeKey] = useState('');

  const statusMessages = useMemo(() => ([
    loadError ? { tone: 'error', message: loadError } : null,
    statusMessage.text
      ? {
        tone: statusMessage.type === 'error' ? 'error' : statusMessage.type === 'success' ? 'success' : 'info',
        message: statusMessage.text,
      }
      : null,
  ].filter(Boolean)), [loadError, statusMessage]);

  const loadWorkbaskets = async () => {
    setLoadingWorkbaskets(true);
    setLoadError('');
    try {
      const response = await adminApi.listWorkbaskets({ includeInactive: true });
      setWorkbaskets(response?.success ? (response.data || []) : []);
    } catch {
      setWorkbaskets([]);
      setLoadError('Unable to load workbaskets. Retry to continue configuring work settings.');
    } finally {
      setLoadingWorkbaskets(false);
    }
  };

  useEffect(() => {
    loadWorkbaskets();
    const loadIntakeSettings = async () => {
      setIntakeLoading(true);
      try {
        const response = await adminApi.getCmsIntakeSettings();
        const intake = response?.data?.intake || {};
        const options = response?.data?.options || {};
        setIntakeMeta({ options, intakeApiKeyMasked: intake.intakeApiKeyMasked || null });
        setIntakeState({
          autoCreateClient: Boolean(intake.autoCreateClient),
          autoCreateDocket: Boolean(intake.autoCreateDocket),
          defaultCategoryId: intake.defaultCategoryId || '',
          defaultSubcategoryId: intake.defaultSubcategoryId || '',
          defaultWorkbasketId: intake.defaultWorkbasketId || '',
          defaultPriority: intake.defaultPriority || '',
          defaultAssignee: intake.defaultAssignee || '',
          intakeApiEnabled: Boolean(intake.intakeApiEnabled),
        });
      } catch {
        setStatusMessage({ type: 'error', text: 'Unable to load CMS intake settings.' });
      } finally {
        setIntakeLoading(false);
      }
    };
    void loadIntakeSettings();
  }, []);

  const selectedCategory = (intakeMeta.options?.categories || []).find((item) => item.id === intakeState.defaultCategoryId);
  const subcategoryOptions = selectedCategory?.subcategories || [];

  const handleSaveIntakeSettings = async () => {
    setIntakeSaving(true);
    setStatusMessage({ type: 'info', text: 'Saving CMS intake settings…' });
    try {
      await adminApi.updateCmsIntakeSettings({
        autoCreateClient: intakeState.autoCreateClient,
        autoCreateDocket: intakeState.autoCreateDocket,
        defaultCategoryId: intakeState.defaultCategoryId || null,
        defaultSubcategoryId: intakeState.defaultSubcategoryId || null,
        defaultWorkbasketId: intakeState.defaultWorkbasketId || null,
        defaultPriority: intakeState.defaultPriority || null,
        defaultAssignee: intakeState.defaultAssignee || null,
        intakeApiEnabled: intakeState.intakeApiEnabled,
      });
      setStatusMessage({ type: 'success', text: 'CMS intake settings updated.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: error?.message || 'Could not update CMS intake settings.' });
    } finally {
      setIntakeSaving(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    setIntakeRegenerating(true);
    setStatusMessage({ type: 'info', text: 'Regenerating intake API key…' });
    try {
      const response = await adminApi.regenerateCmsIntakeApiKey();
      const regenerated = response?.data?.intake?.intakeApiKey || '';
      setIntakeKey(regenerated);
      setIntakeMeta((prev) => ({ ...prev, intakeApiKeyMasked: regenerated ? '••••••••••••••••' : null }));
      setStatusMessage({ type: 'success', text: 'New intake API key generated. Copy it now; it will not be shown again.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to regenerate intake API key.' });
    } finally {
      setIntakeRegenerating(false);
    }
  };

  const handleCreateWorkbasket = async () => {
    if (!workbasketName.trim()) return;
    setWorkbasketSaving(true);
    setStatusMessage({ type: 'info', text: 'Creating workbasket…' });
    try {
      await adminApi.createWorkbasket(workbasketName.trim());
      setWorkbasketName('');
      await loadWorkbaskets();
      setStatusMessage({ type: 'success', text: 'Workbasket created.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Could not create the workbasket. Retry and confirm the name is unique.' });
    } finally {
      setWorkbasketSaving(false);
    }
  };

  const handleRenameWorkbasket = async (workbasket) => {
    const nextName = window.prompt('Rename workbasket', workbasket.name || '');
    if (!nextName || !nextName.trim() || nextName.trim() === workbasket.name) return;
    setStatusMessage({ type: 'info', text: 'Updating workbasket name…' });
    try {
      await adminApi.renameWorkbasket(workbasket._id, nextName.trim());
      await loadWorkbaskets();
      setStatusMessage({ type: 'success', text: 'Workbasket renamed.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Could not rename this workbasket.' });
    }
  };

  const handleToggleWorkbasket = async (workbasket) => {
    setStatusMessage({ type: 'info', text: 'Updating workbasket status…' });
    try {
      await adminApi.toggleWorkbasketStatus(workbasket._id, !workbasket.isActive);
      await loadWorkbaskets();
      setStatusMessage({ type: 'success', text: 'Workbasket status updated.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Could not update workbasket status.' });
    }
  };

  return (
    <PlatformShell moduleLabel="Settings" title="Work settings" subtitle="Configure work taxonomy and docket structuring rules for your firm.">
      <div className="min-h-screen w-full flex-1 bg-[var(--dt-bg-warm)]">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 space-y-6">
          <PageHeader
            title="Work Settings"
            subtitle="Configure work taxonomy and docket structuring rules for your firm."
          />

          <StatusMessageStack messages={statusMessages} />

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <div>
                <h2 className="text-lg font-semibold text-[var(--dt-text)]">Workbasket Management</h2>
                <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">Add, rename, and activate or deactivate workbaskets for docket routing.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Input
                  label="New workbasket"
                  value={workbasketName}
                  onChange={(event) => setWorkbasketName(event.target.value)}
                  placeholder="e.g. Compliance WB"
                />
                <Button type="button" variant="primary" onClick={handleCreateWorkbasket} disabled={workbasketSaving || !workbasketName.trim()}>
                  Add Workbasket
                </Button>
              </div>

              <div className="space-y-2">
                {loadingWorkbaskets ? <p className="text-sm text-[var(--dt-text-muted)]">Loading workbaskets…</p> : null}
                {!loadingWorkbaskets && workbaskets.length === 0 ? (
                  <p className="text-sm text-[var(--dt-text-muted)]">No workbaskets are configured yet. Create one to start docket routing.</p>
                ) : null}
                {workbaskets.map((workbasket) => (
                  <div key={workbasket._id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--dt-border-whisper)] px-3 py-2">
                    <div className="text-sm font-medium text-[var(--dt-text)]">{workbasket.name} <span className="text-xs text-[var(--dt-text-muted)]">({workbasket.isActive ? 'Active' : 'Inactive'})</span></div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => handleRenameWorkbasket(workbasket)}>Rename</Button>
                      <Button type="button" variant={workbasket.isActive ? 'danger' : 'primary'} onClick={() => handleToggleWorkbasket(workbasket)}>
                        {workbasket.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card id="cms-intake-settings">
            <div className={spacingClasses.sectionMargin}>
              <div>
                <h2 className="text-lg font-semibold text-[var(--dt-text)]">CMS Intake Settings</h2>
                <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">Set predictable intake defaults and API access without changing backend behavior.</p>
              </div>
              {intakeLoading ? <p className="text-sm text-[var(--dt-text-muted)]">Loading CMS intake settings…</p> : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[{ key: 'autoCreateClient', label: 'Auto create client' }, { key: 'autoCreateDocket', label: 'Auto create docket' }, { key: 'intakeApiEnabled', label: 'Intake API enabled' }].map((item) => (
                      <label key={item.key} className="inline-flex items-center gap-2 rounded border border-[var(--dt-border-whisper)] bg-[var(--dt-bg-warm)] px-3 py-2 text-sm text-[var(--dt-text-secondary)]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--dt-border)] text-[var(--dt-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-focus-ring)]"
                          checked={Boolean(intakeState[item.key])}
                          onChange={(event) => setIntakeState((prev) => ({ ...prev, [item.key]: event.target.checked }))}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Select label="Default category" value={intakeState.defaultCategoryId} onChange={(event) => setIntakeState((prev) => ({ ...prev, defaultCategoryId: event.target.value, defaultSubcategoryId: '' }))}>
                      <option value="">None</option>
                      {(intakeMeta.options?.categories || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </Select>
                    <Select label="Default subcategory" value={intakeState.defaultSubcategoryId} onChange={(event) => setIntakeState((prev) => ({ ...prev, defaultSubcategoryId: event.target.value }))} disabled={!intakeState.defaultCategoryId}>
                      <option value="">None</option>
                      {subcategoryOptions.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                    </Select>
                    <Select label="Default workbasket" value={intakeState.defaultWorkbasketId} onChange={(event) => setIntakeState((prev) => ({ ...prev, defaultWorkbasketId: event.target.value }))}>
                      <option value="">None</option>
                      {(intakeMeta.options?.workbaskets || []).map((workbasket) => <option key={workbasket.id} value={workbasket.id}>{workbasket.name}</option>)}
                    </Select>
                    <Select label="Default priority" value={intakeState.defaultPriority} onChange={(event) => setIntakeState((prev) => ({ ...prev, defaultPriority: event.target.value }))}>
                      <option value="">None</option>
                      {(intakeMeta.options?.priorities || []).map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </Select>
                    <Select label="Default assignee" value={intakeState.defaultAssignee} onChange={(event) => setIntakeState((prev) => ({ ...prev, defaultAssignee: event.target.value }))} className="md:col-span-2">
                      <option value="">None</option>
                      {(intakeMeta.options?.assignees || []).map((assignee) => <option key={assignee.xid} value={assignee.xid}>{assignee.name} ({assignee.xid})</option>)}
                    </Select>
                  </div>

                  <div className="rounded border border-[var(--dt-border-whisper)] bg-[var(--dt-bg-warm)] p-3">
                    <p className="text-sm text-[var(--dt-text-secondary)]"><strong>Intake API key:</strong> {intakeKey || intakeMeta.intakeApiKeyMasked || 'Not generated yet'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(intakeKey)} disabled={!intakeKey}>Copy new key</Button>
                      <Button type="button" variant="outline" onClick={handleRegenerateApiKey} disabled={intakeRegenerating}>{intakeRegenerating ? 'Regenerating…' : 'Regenerate key'}</Button>
                    </div>
                  </div>

                  <div className={`${spacingClasses.formActions} ${spacingClasses.formActionsGap} flex-wrap`}>
                    <Button type="button" variant="primary" onClick={handleSaveIntakeSettings} disabled={intakeSaving}>{intakeSaving ? 'Saving…' : 'Save Intake Settings'}</Button>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--dt-text)]">Category Management</h2>
                <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">Create categories and subcategories that define where dockets are created.</p>
              </div>
              <Button
                variant="primary"
                onClick={() => navigate(ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug))}
              >
                Open Category Management
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </PlatformShell>
  );
};
