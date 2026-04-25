import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Select } from '../components/common/Select';
import { Button } from '../components/common/Button';
import { PlatformShell } from '../components/platform/PlatformShell';
import { adminApi } from '../api/admin.api';
import { useToast } from '../hooks/useToast';

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'HIERARCHY_UPDATED', label: 'Hierarchy Updated' },
  { value: 'USER_INVITED', label: 'User Invited' },
  { value: 'USER_CREATED', label: 'User Created' },
  { value: 'USER_ACTIVATED', label: 'User Activated' },
  { value: 'USER_DEACTIVATED', label: 'User Deactivated' },
  { value: 'ROLE_UPDATED', label: 'Role Updated' },
  { value: 'USER_UNLOCKED', label: 'User Unlocked' },
  { value: 'USER_PASSWORD_RESET', label: 'User Password Reset' },
  { value: 'WORKBENCH_CONFIG_UPDATED', label: 'Workbasket Config Updated' },
  { value: 'CATEGORY_CONFIG_UPDATED', label: 'Category Config Updated' },
];

const MODULE_OPTIONS = [
  { value: '', label: 'All modules' },
  { value: 'admin', label: 'Admin' },
  { value: 'users', label: 'Users' },
  { value: 'categories', label: 'Categories' },
  { value: 'workbench', label: 'Workbench' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'All severities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const getActorLabel = (entry) => {
  const actor = entry?.actorId;
  if (!actor) return 'Unknown actor';
  return actor.name || actor.email || actor.xID || String(actor._id || 'Unknown actor');
};

const getTargetLabel = (entry) => {
  const target = entry?.targetId;
  if (!target) return entry?.targetEntity || '—';
  return target.name || target.email || target.xID || String(target._id || '—');
};

const emptyFilters = {
  actor: '',
  actionType: '',
  module: '',
  startDate: '',
  endDate: '',
  targetEntity: '',
  severity: '',
};

export const AuditLogsPage = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0, hasNextPage: false });
  const [filters, setFilters] = useState(emptyFilters);

  const loadLogs = useCallback(async (nextPage = 1) => {
    setLoading(true);
    try {
      const response = await adminApi.getAuditLogs({
        actor: filters.actor || undefined,
        actionType: filters.actionType || undefined,
        module: filters.module || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        targetEntity: filters.targetEntity || undefined,
        severity: filters.severity || undefined,
        page: nextPage,
        limit: pagination.limit,
      });

      setRows(Array.isArray(response?.data) ? response.data : []);
      setPagination((prev) => ({
        ...prev,
        ...(response?.pagination || {}),
      }));
    } catch (error) {
      setRows([]);
      showToast(error?.response?.data?.message || 'Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, showToast]);

  useEffect(() => {
    loadLogs(1);
  }, [loadLogs]);

  const canGoBack = useMemo(() => pagination.page > 1, [pagination.page]);

  return (
    <PlatformShell
      moduleLabel="Firm settings"
      title="Audit Log"
      subtitle="Firm-scoped admin activity for governance and compliance oversight."
    >
      <div className="space-y-4">
        <Card>
          <div className="grid gap-3 p-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Actor (User ID)
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={filters.actor}
                onChange={(event) => setFilters((prev) => ({ ...prev, actor: event.target.value.trim() }))}
                placeholder="ObjectId"
              />
            </label>
            <Select
              label="Action type"
              value={filters.actionType}
              options={ACTION_OPTIONS}
              onChange={(event) => setFilters((prev) => ({ ...prev, actionType: event.target.value }))}
            />
            <Select
              label="Module"
              value={filters.module}
              options={MODULE_OPTIONS}
              onChange={(event) => setFilters((prev) => ({ ...prev, module: event.target.value }))}
            />
            <Select
              label="Severity"
              value={filters.severity}
              options={SEVERITY_OPTIONS}
              onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value }))}
            />
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Target entity
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={filters.targetEntity}
                onChange={(event) => setFilters((prev) => ({ ...prev, targetEntity: event.target.value.toUpperCase() }))}
                placeholder="USER, FIRM"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              From date
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              To date
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={filters.endDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </label>
            <div className="flex items-end gap-2">
              <Button onClick={() => loadLogs(1)}>Apply filters</Button>
              <Button variant="outline" onClick={() => { setFilters(emptyFilters); }}>Reset</Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <Loading message="Loading audit logs" />
        ) : (
          <Card>
            <div className="overflow-x-auto p-2">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Summary</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Module</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={7}>No audit logs found.</td>
                    </tr>
                  ) : rows.map((entry) => (
                    <tr key={entry._id}>
                      <td className="px-3 py-2 text-slate-700">{entry.summary || '—'}</td>
                      <td className="px-3 py-2">{getActorLabel(entry)}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{entry.action}</td>
                      <td className="px-3 py-2">{entry.module || '—'}</td>
                      <td className="px-3 py-2">{getTargetLabel(entry)}</td>
                      <td className="px-3 py-2">{entry.severity || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Page {pagination.page} of {Math.max(pagination.totalPages || 1, 1)} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={!canGoBack} onClick={() => loadLogs(pagination.page - 1)}>Previous</Button>
                <Button variant="outline" disabled={!pagination.hasNextPage} onClick={() => loadLogs(pagination.page + 1)}>Next</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </PlatformShell>
  );
};

export default AuditLogsPage;
