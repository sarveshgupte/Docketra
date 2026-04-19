import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { worklistApi } from '../../api/worklist.api';
import { caseApi } from '../../api/case.api';
import { ROUTES } from '../../constants/routes';
import {
  DataTable,
  FilterBar,
  InlineNotice,
  PageSection,
  RefreshNotice,
  formatDocketLabel,
  toArray,
} from './PlatformShared';

export const PlatformWorklistPage = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingActionId, setPendingActionId] = useState('');

  const loadRows = async ({ background = false } = {}) => {
    if (background && rows.length > 0) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await worklistApi.getEmployeeWorklist({ limit: 50 });
      setRows(toArray(res?.data?.data || res?.data?.items));
    } catch {
      setRows([]);
      setError('Unable to load your worklist right now.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((item) => {
      const status = String(item.status || '').toUpperCase();
      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
      const matchesQuery = !needle || [
        formatDocketLabel(item),
        item.clientName,
        item.category,
        item.assigneeName,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
      return matchesStatus && matchesQuery;
    });
  }, [rows, query, statusFilter]);

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('ALL');
  };

  const transition = async (caseInternalId, action) => {
    setSuccess('');
    setPendingActionId(caseInternalId);
    try {
      if (action === 'SEND_TO_QC') await caseApi.transitionDocket(caseInternalId, { action: 'SEND_TO_QC' });
      if (action === 'PEND') await caseApi.pendCase(caseInternalId, 'Pending via worklist action');
      if (action === 'RESOLVE') await caseApi.resolveCase(caseInternalId, 'Resolved via worklist action');
      setSuccess('Docket updated successfully.');
      await loadRows({ background: true });
    } catch {
      setError('Action failed. Refresh and retry.');
    } finally {
      setPendingActionId('');
    }
  };

  return (
    <PlatformShell
      title="My Worklist"
      subtitle="Assigned dockets prioritized for execution"
      actions={<Link to={ROUTES.CREATE_CASE(firmSlug)}>Create Docket</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <InlineNotice tone="success" message={success} />
      <RefreshNotice refreshing={refreshing} message="Refreshing worklist without interrupting your current view…" />
      <PageSection title="Execution queue" description="Filter quickly and process dockets without leaving the list.">
        <FilterBar onClear={clearFilters} clearDisabled={!query && statusFilter === 'ALL'}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docket, client, assignee"
            aria-label="Search worklist"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter worklist by status">
            <option value="ALL">All statuses</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="PENDING">Pending</option>
            <option value="IN_QC">In QC</option>
          </select>
          <button type="button" onClick={() => void loadRows({ background: rows.length > 0 })} disabled={loading || refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </FilterBar>

        <DataTable
          columns={['Docket', 'Client', 'Status', 'Time Spent', 'Actions']}
          rows={filteredRows.map((r) => (
            <tr key={r.caseInternalId || r._id}>
              <td>
                <Link className="action-primary" to={`${ROUTES.CASE_DETAIL(firmSlug, r.caseInternalId)}?returnTo=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`}>
                  {formatDocketLabel(r)}
                </Link>
              </td>
              <td>{r.clientName || '-'}</td>
              <td>{String(r.status || 'IN_PROGRESS').replace('_', ' ')}</td>
              <td>{r.timeSpent || '0m'}</td>
              <td>
                <div className="action-group-secondary" role="group" aria-label="Docket actions">
                  <button type="button" onClick={() => void transition(r.caseInternalId, 'SEND_TO_QC')} disabled={pendingActionId === r.caseInternalId}>Send to QC</button>
                  <button type="button" onClick={() => void transition(r.caseInternalId, 'PEND')} disabled={pendingActionId === r.caseInternalId}>Pend</button>
                  <button type="button" onClick={() => void transition(r.caseInternalId, 'RESOLVE')} disabled={pendingActionId === r.caseInternalId}>
                    {pendingActionId === r.caseInternalId ? 'Updating…' : 'Resolve'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          loading={loading}
          error={error}
          onRetry={() => void loadRows()}
          hasActiveFilters={Boolean(query.trim()) || statusFilter !== 'ALL'}
          emptyLabel="No dockets are assigned to your worklist yet."
          emptyLabelFiltered="No dockets match your current filters."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformWorklistPage;
