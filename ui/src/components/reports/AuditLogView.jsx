import React, { useCallback, useEffect, useState } from 'react';
import { reportsService } from '../../services/reports.service';
import { formatDateTime } from '../../utils/formatDateTime';

export const AuditLogView = () => {
  const [filters, setFilters] = useState({ xID: '', action: '', timestamp: '' });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      const params = {};
      if (filters.xID) params.xID = filters.xID;
      if (filters.action) params.action = filters.action;
      if (filters.timestamp) params.timestamp = filters.timestamp;
      const response = await reportsService.getAuditLogs(params);
      if (response.data?.success) {
        setLogs(response.data.data || []);
      }
    } catch (err) {
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters.xID, filters.action, filters.timestamp]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="reports-dashboard__card">
      <h3>Audit Logs</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          value={filters.xID}
          onChange={(e) => setFilters((prev) => ({ ...prev, xID: e.target.value }))}
          placeholder="Filter by xID"
        />
        <input
          value={filters.action}
          onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
          placeholder="Filter by action"
        />
        <input
          type="datetime-local"
          value={filters.timestamp}
          onChange={(e) => setFilters((prev) => ({ ...prev, timestamp: e.target.value }))}
        />
        <button className="neo-button" onClick={loadLogs} disabled={loading}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>
      <div style={{ maxHeight: 320, overflow: 'auto' }}>
        <table className="reports-dashboard__table">
          <thead>
            <tr>
              <th>xID</th>
              <th>Action</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((item, idx) => (
              <tr key={`${item.source}-${item.timestamp}-${idx}`}>
                <td>{item.xID}</td>
                <td>{item.action}</td>
                <td>{formatDateTime(item.timestamp)}</td>
              </tr>
            ))}
            {!logs.length && (
              <tr>
                <td colSpan={3} className="text-secondary">No audit logs found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && <p className="text-secondary">{error}</p>}
    </div>
  );
};
