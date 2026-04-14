import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Select } from '../components/common/Select';
import { Button } from '../components/common/Button';
import { adminApi } from '../api/admin.api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'HIERARCHY_UPDATED', label: 'HIERARCHY_UPDATED' },
  { value: 'USER_INVITED', label: 'USER_INVITED' },
  { value: 'USER_ACTIVATED', label: 'USER_ACTIVATED' },
  { value: 'USER_DEACTIVATED', label: 'USER_DEACTIVATED' },
  { value: 'ROLE_UPDATED', label: 'ROLE_UPDATED' },
];

const getActorLabel = (entry) => {
  const actor = entry?.actorId;
  if (!actor) return 'Unknown actor';
  return actor.name || actor.email || actor.xID || String(actor._id || 'Unknown actor');
};

const getTargetLabel = (entry) => {
  const target = entry?.targetId;
  if (!target) return '—';
  return target.name || target.email || target.xID || String(target._id || '—');
};

export const AuditLogsPage = () => {
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ action: '', startDate: '', endDate: '' });

  const isPrimaryAdmin = useMemo(() => {
    const role = String(user?.role || '').toUpperCase();
    return role === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);
  }, [user]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAuditLogs({
        action: filters.action || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setRows(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      setRows([]);
      showToast(error?.response?.data?.message || 'Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters.action, filters.endDate, filters.startDate, showToast]);

  useEffect(() => {
    if (isPrimaryAdmin) {
      loadLogs();
    } else {
      setLoading(false);
      setRows([]);
    }
  }, [isPrimaryAdmin, loadLogs]);

  return (
    <Layout>
      <div className="space-y-4">
        <Card>
          <div className="space-y-2 p-2">
            <h1 className="text-xl font-semibold text-slate-900">Audit Logs</h1>
            <p className="text-sm text-slate-600">Firm-level immutable admin actions for hierarchy and user lifecycle changes.</p>
            {!isPrimaryAdmin ? (
              <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">Only PRIMARY_ADMIN can view audit logs.</p>
            ) : null}
          </div>
        </Card>

        {isPrimaryAdmin ? (
          <Card>
            <div className="grid gap-3 p-3 md:grid-cols-4">
              <Select
                label="Action"
                value={filters.action}
                options={ACTION_OPTIONS}
                onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
              />
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
              <div className="flex items-end">
                <Button onClick={loadLogs}>Apply Filters</Button>
              </div>
            </div>
          </Card>
        ) : null}

        {loading ? (
          <Loading message="Loading audit logs" />
        ) : (
          <Card>
            <div className="overflow-x-auto p-2">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={4}>No audit logs found.</td>
                    </tr>
                  ) : rows.map((entry) => (
                    <tr key={entry._id}>
                      <td className="px-3 py-2">{getActorLabel(entry)}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{entry.action}</td>
                      <td className="px-3 py-2">{getTargetLabel(entry)}</td>
                      <td className="px-3 py-2 text-slate-600">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default AuditLogsPage;
