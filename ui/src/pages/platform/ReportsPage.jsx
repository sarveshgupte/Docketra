import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { EmptyState } from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import { reportsService } from '../../services/reports.service';
import { useToast } from '../../hooks/useToast';
import { DataTable, toArray } from './PlatformShared';

export const PlatformReportsPage = () => {
  const { showError } = useToast();
  const [filters, setFilters] = useState({ clientType: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const today = new Date();
      const fromDate = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
      const toDate = today.toISOString().slice(0, 10);
      const response = await reportsService.getCasesByDate({
        fromDate,
        toDate,
        limit: 25,
        ...(filters.clientType ? { clientType: filters.clientType } : {}),
      });
      setRows(toArray(response?.data?.cases));
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || 'Failed to load report data');
      showError(loadError?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [filters.clientType, showError]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const summary = useMemo(() => ({
    total: rows.length,
    internal: rows.filter((item) => item.clientType === 'INTERNAL').length,
    external: rows.filter((item) => item.clientType === 'EXTERNAL').length,
  }), [rows]);

  return (
    <PlatformShell title="Reports" subtitle="Productivity, QC, and workload visibility">
      <section className="panel">
        <div className="action-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Client type filter</h3>
            <p className="muted">Filter report output by INTERNAL vs EXTERNAL work.</p>
          </div>
          <select value={filters.clientType} onChange={(event) => setFilters({ clientType: event.target.value })}>
            <option value="">All</option>
            <option value="INTERNAL">Internal</option>
            <option value="EXTERNAL">External</option>
          </select>
        </div>
      </section>
      <section className="grid-cards">
        <article className="panel"><h3>Total dockets</h3><p className="kpi">{summary.total}</p></article>
        <article className="panel"><h3>Internal</h3><p className="kpi">{summary.internal}</p></article>
        <article className="panel"><h3>External</h3><p className="kpi">{summary.external}</p></article>
      </section>
      {loading ? <TableSkeleton rows={5} showToolbar={false} /> : null}
      {!loading && error ? (
        <EmptyState
          title="Couldn’t load reports"
          description={error}
          actionLabel="Retry"
          onAction={() => { void loadRows(); }}
          icon
        />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="No report data found"
          description="Try a different client type filter or create new dockets first."
          actionLabel="Clear filter"
          onAction={() => setFilters({ clientType: '' })}
          icon
        />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <DataTable columns={['Docket', 'Client', 'Client Type', 'Category', 'Status', 'Created']} rows={rows.map((row) => (
          <tr key={row.caseId}><td>{row.caseId}</td><td>{row.clientName}</td><td>{row.clientType || 'EXTERNAL'}</td><td>{row.category || '-'}</td><td>{row.status || '-'}</td><td>{new Date(row.createdAt || Date.now()).toLocaleDateString()}</td></tr>
        ))} />
      ) : null}
    </PlatformShell>
  );
};

export default PlatformReportsPage;
