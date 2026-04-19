import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { caseApi } from '../../api/case.api';
import { ROUTES } from '../../constants/routes';
import { useActiveDocket } from '../../hooks/useActiveDocket';
import {
  buildQueueContext,
  DataTable,
  FilterBar,
  InlineNotice,
  PageSection,
  RefreshNotice,
  formatDateLabel,
  formatDocketLabel,
  formatStatusLabel,
  getDocketRouteId,
  toArray,
} from './PlatformShared';

export const PlatformQcQueuePage = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openDocket } = useActiveDocket();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingQcId, setPendingQcId] = useState('');

  const loadRows = async ({ background = false } = {}) => {
    if (background && rows.length > 0) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await caseApi.getCases({ state: 'IN_QC', limit: 50 });
      setRows(toArray(res?.data?.data || res?.data?.items));
    } catch {
      setRows([]);
      setError('Unable to load QC queue.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((item) => {
      const assignee = String(item.assigneeName || item.assignedTo || 'Unassigned');
      const matchesAssignee = assigneeFilter === 'ALL' || assignee === assigneeFilter;
      const matchesSearch = !needle || [formatDocketLabel(item), item.assigneeName, item.assignedTo, item.clientName, item.category]
        .some((value) => String(value || '').toLowerCase().includes(needle));
      return matchesAssignee && matchesSearch;
    });
  }, [rows, search, assigneeFilter]);

  const assignees = useMemo(
    () => [...new Set(rows.map((item) => String(item.assigneeName || item.assignedTo || 'Unassigned')).filter(Boolean))],
    [rows]
  );

  const clearFilters = () => {
    setSearch('');
    setAssigneeFilter('ALL');
  };

  const openFromQueue = (row) => {
    const rowId = getDocketRouteId(row);
    if (!rowId) return;
    openDocket({
      caseId: rowId,
      navigate,
      to: `${ROUTES.CASE_DETAIL(firmSlug, rowId)}?returnTo=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`,
      state: buildQueueContext({ rows: filteredRows, rowId, location, origin: 'qc-workbasket' }),
    });
  };

  const executeQcAction = async (caseInternalId, action, note) => {
    setSuccess('');
    setPendingQcId(caseInternalId);
    try {
      await caseApi.qcAction(caseInternalId, action, note);
      setSuccess(`QC action ${action.toLowerCase()} completed.`);
      await loadRows({ background: true });
    } catch {
      setError('QC action failed. Please retry.');
    } finally {
      setPendingQcId('');
    }
  };

  return (
    <PlatformShell
      title="QC Workbasket"
      subtitle="Quality-control queue for pass, return-for-correction, and fail review decisions."
      actions={<Link to={ROUTES.ADMIN_REPORTS(firmSlug)}>QC Reports</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <InlineNotice tone="success" message={success} />
      <RefreshNotice refreshing={refreshing} message="Refreshing QC queue in the background…" />
      <PageSection title="QC review queue" description={`${filteredRows.length} dockets waiting for QC decisions.`}>
        <FilterBar onClear={clearFilters} clearDisabled={!search && assigneeFilter === 'ALL'}>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search docket or assignee"
            aria-label="Search QC queue"
          />
          <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} aria-label="Filter by assignee">
            <option value="ALL">All assignees</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
          <button type="button" onClick={() => void loadRows({ background: rows.length > 0 })} disabled={loading || refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </FilterBar>
        <DataTable
          columns={['Docket ID', 'Client', 'Category', 'QC Status', 'Assignee', 'Updated', 'Actions']}
          rows={filteredRows.map((r) => (
            <tr key={r.caseInternalId || r._id}>
              <td>
                <button className="action-primary" type="button" onClick={() => openFromQueue(r)}>
                  {formatDocketLabel(r)}
                </button>
              </td>
              <td>{r.clientName || r.clientId || '-'}</td>
              <td>{[r.category || '-', r.subcategory || '-'].join(' / ')}</td>
              <td>{formatStatusLabel(r.qcStatus || r.status || 'IN_QC')}</td>
              <td>{r.assigneeName || r.assignedTo || '-'}</td>
              <td>{formatDateLabel(r.updatedAt || r.createdAt)}</td>
              <td>
                <div className="action-group-secondary" role="group" aria-label="QC actions">
                  <button type="button" onClick={() => void executeQcAction(r.caseInternalId, 'PASS', 'Passed from queue')} disabled={pendingQcId === r.caseInternalId}>
                    {pendingQcId === r.caseInternalId ? 'Updating…' : 'Pass'}
                  </button>
                  <button type="button" onClick={() => void executeQcAction(r.caseInternalId, 'CORRECT', 'Needs correction')} disabled={pendingQcId === r.caseInternalId}>Return for correction</button>
                  <button type="button" className="action-danger" onClick={() => void executeQcAction(r.caseInternalId, 'FAIL', 'Failed from queue')} disabled={pendingQcId === r.caseInternalId}>Fail</button>
                </div>
              </td>
            </tr>
          ))}
          loading={loading}
          error={error}
          onRetry={() => void loadRows()}
          hasActiveFilters={Boolean(search.trim()) || assigneeFilter !== 'ALL'}
          emptyLabel="No dockets are currently waiting in the QC Workbasket."
          emptyLabelFiltered="No QC Workbasket dockets match your current search or filters."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformQcQueuePage;
