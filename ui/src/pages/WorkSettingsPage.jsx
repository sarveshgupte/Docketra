import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { PageHeader } from '../components/layout/PageHeader';
import { adminApi } from '../api/admin.api';
import { ROUTES } from '../constants/routes';

export const WorkSettingsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const [settings, setSettings] = useState({
    assignmentStrategy: 'manual',
    statusWorkflowMode: 'flexible',
    autoAssignmentEnabled: false,
    highPrioritySlaDays: 1,
    dueSoonWarningDays: 2,
  });
  const [saveState, setSaveState] = useState({ loading: true, message: '', type: '' });
  const [workbaskets, setWorkbaskets] = useState([]);
  const [workbasketName, setWorkbasketName] = useState('');
  const [workbasketSaving, setWorkbasketSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setSaveState({ loading: true, message: '', type: '' });
      try {
        const response = await adminApi.getFirmSettings();
        setSettings((prev) => ({ ...prev, ...(response?.data?.work || {}) }));
      } catch {
        setSaveState({ loading: false, message: 'Could not load work settings. You can still edit defaults locally.', type: 'error' });
        return;
      }
      setSaveState({ loading: false, message: '', type: '' });
    };

    loadSettings();
  }, []);

  const loadWorkbaskets = async () => {
    try {
      const response = await adminApi.listWorkbaskets({ includeInactive: true });
      setWorkbaskets(response?.success ? (response.data || []) : []);
    } catch {
      setWorkbaskets([]);
    }
  };

  useEffect(() => {
    loadWorkbaskets();
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveState((prev) => ({ ...prev, message: '', type: '' }));
  };

  const handleSave = async () => {
    try {
      const response = await adminApi.updateFirmSettings({ work: settings });
      setSettings((prev) => ({ ...prev, ...(response?.data?.work || {}) }));
      setSaveState({ loading: false, message: 'Work settings saved successfully.', type: 'success' });
    } catch {
      setSaveState({ loading: false, message: 'Could not save work settings.', type: 'error' });
    }
  };

  const handleCreateWorkbasket = async () => {
    if (!workbasketName.trim()) return;
    setWorkbasketSaving(true);
    try {
      await adminApi.createWorkbasket(workbasketName.trim());
      setWorkbasketName('');
      await loadWorkbaskets();
    } finally {
      setWorkbasketSaving(false);
    }
  };

  const handleRenameWorkbasket = async (workbasket) => {
    const nextName = window.prompt('Rename workbasket', workbasket.name || '');
    if (!nextName || !nextName.trim() || nextName.trim() === workbasket.name) return;
    await adminApi.renameWorkbasket(workbasket._id, nextName.trim());
    await loadWorkbaskets();
  };

  const handleToggleWorkbasket = async (workbasket) => {
    await adminApi.toggleWorkbasketStatus(workbasket._id, !workbasket.isActive);
    await loadWorkbaskets();
  };

  return (
    <Layout>
      <PageHeader
        title="Work Settings"
        subtitle="Configure work taxonomy and docket structuring rules for your firm."
      />

      <Card className="neo-card">
        <div className="flex flex-wrap items-center gap-3 p-6">
          <Button type="button" variant="outline" onClick={() => navigate(ROUTES.FIRM_SETTINGS(firmSlug))}>Firm</Button>
          <Button type="button" variant="outline" onClick={() => navigate(ROUTES.WORK_SETTINGS(firmSlug))}>Work</Button>
          <Button type="button" variant="outline" onClick={() => navigate(ROUTES.STORAGE_SETTINGS(firmSlug))}>Storage</Button>
          <Button type="button" variant="outline" onClick={() => navigate(`${ROUTES.ADMIN(firmSlug)}?tab=users`)}>Security</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/app/firm/' + firmSlug + '/admin/reports/detailed')}>Audit</Button>
        </div>
      </Card>

      <Card className="neo-card">
        <div className="p-6">
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
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <Select
            label="Assignment Strategy"
            value={settings.assignmentStrategy}
            onChange={(event) => handleChange('assignmentStrategy', event.target.value)}
            options={[
              { value: 'manual', label: 'Manual Assignment' },
              { value: 'balanced', label: 'Balanced Auto Distribution' },
            ]}
          />
          <Select
            label="Status Workflow"
            value={settings.statusWorkflowMode}
            onChange={(event) => handleChange('statusWorkflowMode', event.target.value)}
            options={[
              { value: 'flexible', label: 'Flexible' },
              { value: 'strict', label: 'Strict' },
            ]}
          />
          <Select
            label="Auto-assignment"
            value={String(Boolean(settings.autoAssignmentEnabled))}
            onChange={(event) => handleChange('autoAssignmentEnabled', event.target.value === 'true')}
            options={[
              { value: 'false', label: 'Disabled' },
              { value: 'true', label: 'Enabled' },
            ]}
          />
          <Input
            label="High priority SLA (days)"
            type="number"
            min="1"
            value={settings.highPrioritySlaDays}
            onChange={(event) => handleChange('highPrioritySlaDays', Number(event.target.value))}
          />
          <Input
            label="Due-soon warning (days)"
            type="number"
            min="1"
            value={settings.dueSoonWarningDays}
            onChange={(event) => handleChange('dueSoonWarningDays', Number(event.target.value))}
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          {saveState.message ? (
            <span className={`text-sm ${saveState.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{saveState.message}</span>
          ) : null}
          <Button type="button" variant="primary" onClick={handleSave} disabled={saveState.loading}>
            {saveState.loading ? 'Loading…' : 'Save Work Settings'}
          </Button>
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
    </Layout>
  );
};
