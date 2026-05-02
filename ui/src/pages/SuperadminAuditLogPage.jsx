import React, { useEffect, useMemo, useState } from 'react';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { superadminService } from '../services/superadminService';

const DEFAULT_FILTERS = { actionType: '', actor: '', targetEntityType: '', firmId: '', from: '', to: '', search: '' };

export const SuperadminAuditLogPage = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const query = useMemo(() => ({ ...filters, page, limit: 25 }), [filters, page]);

  const loadLogs = async ({ reset = false } = {}) => {
    try {
      setLoading(true);
      setError('');
      const response = await superadminService.getAuditLogs(query);
      const rows = Array.isArray(response?.data) ? response.data : [];
      setLogs((prev) => (reset ? rows : [...prev, ...rows]));
      setHasMore(Boolean(response?.pagination?.hasMore));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load audit logs right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs({ reset: page === 1 });
  }, [query]);

  const onFilterChange = (key, value) => setDraftFilters((prev) => ({ ...prev, [key]: value }));
  const onApply = () => {
    setPage(1);
    setFilters(draftFilters);
  };
  const onReset = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  return (
    <SuperAdminLayout>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
        <p className="mt-2 text-sm text-amber-700">Audit logs show platform lifecycle/support actions only and must not expose client records, dockets, tasks, attachments, documents, secrets, OTPs, tokens, or private client content.</p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {['actionType','actor','targetEntityType','firmId','from','to','search'].map((key) => (
            <input key={key} value={draftFilters[key]} onChange={(e) => onFilterChange(key, e.target.value)} placeholder={key} className="rounded border border-gray-300 px-3 py-2 text-sm" />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onApply} className="rounded bg-gray-900 px-4 py-2 text-sm text-white">Apply filters</button>
          <button type="button" onClick={onReset} className="rounded border border-gray-300 px-4 py-2 text-sm">Reset filters</button>
        </div>

        {error ? <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" onClick={() => loadLogs({ reset: page === 1 })} className="ml-2 underline">Retry</button></div> : null}
        {loading && page === 1 ? <p className="mt-4 text-sm text-gray-600">Loading audit logs...</p> : null}
        {!loading && !error && !logs.length ? <p className="mt-4 text-sm text-gray-600">No audit logs found for the selected filters.</p> : null}

        {!!logs.length && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="px-2 py-2">Timestamp</th><th className="px-2 py-2">Action Type</th><th className="px-2 py-2">Actor</th><th className="px-2 py-2">Target Entity Type</th><th className="px-2 py-2">Target</th><th className="px-2 py-2">Firm</th><th className="px-2 py-2">Request ID</th><th className="px-2 py-2">Network</th><th className="px-2 py-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row._id} className="border-b border-gray-100 align-top">
                    <td className="px-2 py-2">{row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'}</td>
                    <td className="px-2 py-2">{row.actionType || '-'}</td>
                    <td className="px-2 py-2">{row.performedBy || '-'}</td>
                    <td className="px-2 py-2">{row.targetEntityType || '-'}</td>
                    <td className="px-2 py-2">{row.targetEntityId || '-'}</td>
                    <td className="px-2 py-2">{row.firmName || row.firmId || '-'}</td>
                    <td className="px-2 py-2">{row.requestId || '-'}</td>
                    <td className="px-2 py-2">{row.ipAddress || row.userAgent ? `${row.ipAddress || '-'} / ${row.userAgent || '-'}` : '-'}</td>
                    <td className="px-2 py-2 text-xs text-gray-600">{Object.entries(row.metadata || {}).slice(0, 3).map(([k,v]) => `${k}:${String(v)}`).join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore ? <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={loading} className="mt-4 rounded border border-gray-300 px-3 py-2 text-sm">{loading ? 'Loading...' : 'Load more'}</button> : null}
      </div>
    </SuperAdminLayout>
  );
};
