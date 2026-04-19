import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { PageHeader } from '../components/layout/PageHeader';
import { adminApi } from '../api/admin.api';
import { ROUTES } from '../constants/routes';

export const WorkSettingsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const [workbaskets, setWorkbaskets] = useState([]);
  const [workbasketName, setWorkbasketName] = useState('');
  const [workbasketSaving, setWorkbasketSaving] = useState(false);
  const [loadingWorkbaskets, setLoadingWorkbaskets] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

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
  }, []);

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
      <PageHeader
        title="Work Settings"
        subtitle="Configure work taxonomy and docket structuring rules for your firm."
      />

      <Card className="neo-card">
        <div className="p-6">
          {loadError ? (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{loadError}</p>
              <Button type="button" variant="outline" onClick={loadWorkbaskets} disabled={loadingWorkbaskets}>
                Retry loading
              </Button>
            </div>
          ) : null}
          {statusMessage.text ? (
            <p className={`mb-4 rounded border px-3 py-2 text-sm ${
              statusMessage.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : statusMessage.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}
            >
              {statusMessage.text}
            </p>
          ) : null}
          <h2 className="text-lg font-semibold text-gray-900">Workbasket Management</h2>
          <p className="mt-1 text-sm text-gray-600">Add, rename, and activate/deactivate workbaskets for docket routing.</p>
          <div className="mt-4 flex gap-3">
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
          <div className="mt-4 space-y-2">
            {loadingWorkbaskets ? <p className="text-sm text-gray-500">Loading workbaskets…</p> : null}
            {!loadingWorkbaskets && workbaskets.length === 0 ? (
              <p className="text-sm text-gray-500">No workbaskets are configured yet. Create one to start docket routing.</p>
            ) : null}
            {workbaskets.map((workbasket) => (
              <div key={workbasket._id} className="flex items-center justify-between rounded border px-3 py-2">
                <div className="text-sm font-medium text-gray-900">{workbasket.name} <span className="text-xs text-gray-500">({workbasket.isActive ? 'Active' : 'Inactive'})</span></div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => handleRenameWorkbasket(workbasket)}>Rename</Button>
                  <Button type="button" variant={workbasket.isActive ? 'danger' : 'success'} onClick={() => handleToggleWorkbasket(workbasket)}>
                    {workbasket.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="neo-card">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Automation & Workflow Controls</h2>
          <p className="mt-1 text-sm text-gray-600">
            Assignment strategy and workflow automation settings are currently not wired to active execution paths.
            To avoid misleading controls, these options have been temporarily hidden from this page.
          </p>
          <p className="mt-3 text-sm text-gray-600">
            Today, your enforceable work configuration in this section is:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Workbasket lifecycle management (add, rename, activate/deactivate).</li>
            <li>Category and subcategory management.</li>
          </ul>
        </div>
      </Card>

      <Card className="neo-card">
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Category Management</h2>
            <p className="mt-1 text-sm text-gray-600">
              Create categories and subcategories that define where dockets are created.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate(ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug))}
          >
            Open Category Management
          </Button>
        </div>
      </Card>
    </PlatformShell>
  );
};
