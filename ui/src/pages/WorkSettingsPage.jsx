import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
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
    void loadWorkbaskets();
  }, []);

  const primaryWorkbaskets = useMemo(() => workbaskets.filter((entry) => String(entry?.type || 'PRIMARY').toUpperCase() === 'PRIMARY'), [workbaskets]);
  const qcByPrimaryId = useMemo(() => new Map(
    workbaskets
      .filter((entry) => String(entry?.type || '').toUpperCase() === 'QC' && entry?.parentWorkbasketId)
      .map((entry) => [String(entry.parentWorkbasketId), entry]),
  ), [workbaskets]);

  const createWorkbasketByName = async (name) => {
    const nextName = String(name || '').trim();
    if (!nextName) return;
    setWorkbasketSaving(true);
    setStatusMessage({ type: 'info', text: 'Creating workbasket…' });
    try {
      await adminApi.createWorkbasket(nextName);
      setWorkbasketName('');
      await loadWorkbaskets();
      setStatusMessage({ type: 'success', text: 'Workbasket created.' });
    } catch (error) {
      if (error?.status === 409) {
        setStatusMessage({ type: 'error', text: 'A workbasket with this name already exists for this firm.' });
      } else if (error?.status === 400) {
        setStatusMessage({ type: 'error', text: 'Workbasket name is required and must be valid.' });
      } else if (error?.status === 403) {
        setStatusMessage({ type: 'error', text: 'You do not have permission to manage work settings for this firm.' });
      } else {
        setStatusMessage({ type: 'error', text: 'Could not create the workbasket due to a server or network error. Please retry.' });
      }
    } finally {
      setWorkbasketSaving(false);
    }
  };

  const handleCreateWorkbasket = async () => createWorkbasketByName(workbasketName);

  const handleCreateDefaultRouting = async () => {
    setWorkbasketSaving(true);
    setStatusMessage({ type: 'info', text: 'Configuring default routing…' });
    try {
      await adminApi.createDefaultRouting();
      await loadWorkbaskets();
      setStatusMessage({ type: 'success', text: 'Default routing configured.' });
    } catch (error) {
      if (error?.status === 403) {
        setStatusMessage({ type: 'error', text: 'You do not have permission to configure default routing for this firm.' });
      } else {
        setStatusMessage({ type: 'error', text: 'Could not configure default routing. Please retry.' });
      }
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
    <PlatformShell moduleLabel="Settings" title="Work settings" subtitle="Use Work Settings to control how new dockets enter team queues.">
      <div className="min-h-screen w-full flex-1 bg-[var(--dt-bg-warm)]">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 space-y-6">
          <PageHeader title="Work Settings" subtitle="Use Work Settings to control how new dockets enter team queues." />
          <StatusMessageStack messages={statusMessages} />
          <Card className="settings-status-card">
            <div className={`${spacingClasses.sectionMargin} settings-form-split`}>
              <div className="settings-form-split__meta">
                <h2 className="text-lg font-semibold text-[var(--dt-text)]">Workbasket linkage & routing</h2>
                <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">Use primary workbaskets to control queue destinations for incoming dockets. Linked QC workbaskets are maintained automatically.</p>
              </div>
              <div className="settings-form-split__controls space-y-2">
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Input label="New workbasket" value={workbasketName} onChange={(event) => setWorkbasketName(event.target.value)} placeholder="e.g. Compliance WB" />
                <Button type="button" variant="primary" onClick={handleCreateWorkbasket} disabled={workbasketSaving || !workbasketName.trim()}>Add Primary Workbasket</Button>
              </div>
              
                {loadingWorkbaskets ? <p className="text-sm text-[var(--dt-text-muted)]">Loading workbaskets…</p> : null}
                {!loadingWorkbaskets && primaryWorkbaskets.length === 0 ? (<div className="rounded border border-[var(--dt-border-whisper)] bg-[var(--dt-bg)] p-3"><p className="text-sm text-[var(--dt-text-muted)]">No active workbasket is configured yet. Create one to start docket routing.</p><Button type="button" variant="primary" className="mt-2" onClick={() => void handleCreateDefaultRouting()} disabled={workbasketSaving}>Create default routing</Button></div>) : null}
                {primaryWorkbaskets.map((workbasket) => (
                  <div key={workbasket._id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--dt-border-whisper)] px-3 py-2">
                    <div className="text-sm font-medium text-[var(--dt-text)]">{workbasket.name} <span className="text-xs text-[var(--dt-text-muted)]">({workbasket.isActive ? 'Active' : 'Inactive'})</span>{String(workbasket.type || 'PRIMARY').toUpperCase()==='PRIMARY' && workbasket._id ? <span className="ml-2 text-xs text-[var(--dt-text-muted)]">Linked QC: {qcByPrimaryId.get(String(workbasket._id))?.name || 'Missing'}</span> : null}</div>
                    <div className="flex flex-wrap gap-2 danger-action-row">
                      <Button type="button" variant="outline" onClick={() => handleRenameWorkbasket(workbasket)}>Rename</Button>
                      <Button type="button" variant={workbasket.isActive ? 'danger' : 'primary'} onClick={() => handleToggleWorkbasket(workbasket)}>{workbasket.isActive ? 'Deactivate' : 'Activate'}</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card className="settings-status-card">
            <div className="settings-form-split">
              <div className="settings-form-split__meta">
                <h2 className="text-lg font-semibold text-[var(--dt-text)]">Category Management</h2>
                <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">Create categories and subcategories that define where dockets are created.</p>
              </div>
              <div className="settings-form-split__controls settings-action-bar">
                <Button variant="primary" onClick={() => navigate(ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug))}>Open category and subcategory routing</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PlatformShell>
  );
};
