import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
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
    </Layout>
  );
};
