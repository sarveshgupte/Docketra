import React, { useEffect, useState } from 'react';
import { reportsService } from '../../services/reports.service';

export const AuditLogView = () => {
  const [filters, setFilters] = useState({ xID: '', action: '', timestamp: '' });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.xID) params.xID = filters.xID;
      if (filters.action) params.action = filters.action;
      if (filters.timestamp) params.timestamp = filters.timestamp;
      const response = await reportsService.getAuditLogs(params);
      if (response.data?.success) {
        setLogs(response.data.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

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
          <tbody>
            {logs.map((item, idx) => (
              <tr key={`${item.source}-${item.timestamp}-${idx}`}>
                <td>{item.xID}</td>
                <td>{item.action}</td>
                <td>{new Date(item.timestamp).toLocaleString()}</td>
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
    </div>
  );
};
