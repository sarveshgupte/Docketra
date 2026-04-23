import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
} from './PlatformShared';
import { usePlatformQcQueueQuery } from '../../hooks/usePlatformDataQueries';
import { CASE_QUERY_PARAMS } from '../../hooks/useCaseQuery';
import { ActionConfirmModal } from '../../components/common/ActionConfirmModal';

export const PlatformQcQueuePage = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openDocket } = useActiveDocket();
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingQcId, setPendingQcId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const queryClient = useQueryClient();

  const {
    data: rows = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = usePlatformQcQueueQuery();

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

  const activeFilters = useMemo(() => {
    const items = [];
    if (search.trim()) items.push({ key: 'search', label: 'Search', value: search.trim() });
    if (assigneeFilter !== 'ALL') items.push({ key: 'assignee', label: 'Assignee', value: assigneeFilter });
    return items;
  }, [search, assigneeFilter]);

  const removeFilter = (key) => {
    if (key === 'search') setSearch('');
    if (key === 'assignee') setAssigneeFilter('ALL');
  };


  const prefetchCaseDetail = (row) => {
    const caseId = getDocketRouteId(row);
    if (!caseId || !window.matchMedia?.('(pointer:fine)').matches) return;
    queryClient.prefetchQuery({
      queryKey: ['case', caseId, CASE_QUERY_PARAMS],
      queryFn: () => caseApi.getCaseById(caseId, CASE_QUERY_PARAMS),
      staleTime: 30 * 1000,
    });
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
    setError('');
    setPendingQcId(caseInternalId);
    try {
      await caseApi.qcAction(caseInternalId, action, note);
      setSuccess(`QC action ${action.toLowerCase()} completed.`);
      await refetch();
    } catch {
      setError('QC action failed. Please retry.');
    } finally {
      setPendingQcId('');
    }
  };

  return (
    <PlatformShell
      title="QC Workbench"
      subtitle="Quality-control queue for pass, return-for-correction, and fail review decisions."
      actions={<Link to={ROUTES.ADMIN_REPORTS(firmSlug)}>QC Reports</Link>}
    >
      <InlineNotice tone="error" message={error || (isError ? 'Unable to load the QC workbench queue.' : '')} />
      <InlineNotice tone="success" message={success} />
      <RefreshNotice refreshing={isFetching && !isLoading} message="Refreshing QC queue in the background…" />
      <PageSection
        title="What this queue is for"
        description="QC Workbench is where completed execution dockets are reviewed for pass, return-for-correction, or fail decisions."
      >
        <p className="muted">If this is empty, your team may still be executing in My Worklist or has not sent dockets to QC yet.</p>
      </PageSection>
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
          <button type="button" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </FilterBar>
        {activeFilters.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="list" aria-label="Active QC filters">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => removeFilter(filter.key)}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
              >
                <span className="font-medium">{filter.label}:</span> {filter.value}
                <span aria-hidden>&times;</span>
              </button>
            ))}
          </div>
        ) : null}
        <DataTable
          columns={['Docket ID', 'Client', 'Category', 'QC Status', 'Assignee', 'Updated', 'Actions']}
          rows={filteredRows.map((r) => (
            <tr key={r.caseInternalId || r._id}>
              <td>
                <button className="action-primary" type="button" onMouseEnter={() => prefetchCaseDetail(r)} onFocus={() => prefetchCaseDetail(r)} onClick={() => openFromQueue(r)}>
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
                  <button type="button" onClick={() => setConfirmAction({ caseInternalId: r.caseInternalId, action: 'PASS', note: 'Passed from queue', title: `Pass ${formatDocketLabel(r)}?`, description: 'This marks the docket as QC passed and advances it to completion.', confirmText: 'Confirm pass', danger: false })} disabled={pendingQcId === r.caseInternalId}>
                    {pendingQcId === r.caseInternalId ? 'Updating…' : 'Pass'}
                  </button>
                  <button type="button" onClick={() => setConfirmAction({ caseInternalId: r.caseInternalId, action: 'CORRECT', note: 'Needs correction', title: `Return ${formatDocketLabel(r)} for correction?`, description: 'This sends the docket back to execution with a correction request.', confirmText: 'Return for correction', danger: false })} disabled={pendingQcId === r.caseInternalId}>Return for correction</button>
                  <button type="button" className="action-danger" onClick={() => setConfirmAction({ caseInternalId: r.caseInternalId, action: 'FAIL', note: 'Failed from queue', title: `Fail ${formatDocketLabel(r)}?`, description: 'This records the docket as failed in QC. Continue only if this decision is final.', confirmText: 'Fail docket', danger: true })} disabled={pendingQcId === r.caseInternalId}>Fail</button>
                </div>
              </td>
            </tr>
          ))}
          loading={isLoading}
          error={isError ? 'Unable to load the QC workbench queue.' : ''}
          onRetry={() => void refetch()}
          hasActiveFilters={Boolean(search.trim()) || assigneeFilter !== 'ALL'}
          emptyLabel="No dockets are waiting for QC right now. Items will appear after users send completed execution work to QC."
          emptyLabelFiltered="No QC Workbench dockets match your current search or filters."
        />
      </PageSection>
      <ActionConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title || 'Confirm QC action'}
        description={confirmAction?.description}
        confirmText={confirmAction?.confirmText || 'Confirm'}
        cancelText="Cancel"
        danger={Boolean(confirmAction?.danger)}
        loading={Boolean(confirmAction?.caseInternalId && pendingQcId === confirmAction.caseInternalId)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (!confirmAction) return;
          const current = confirmAction;
          setConfirmAction(null);
          await executeQcAction(current.caseInternalId, current.action, current.note);
        }}
      />
    </PlatformShell>
  );
};

export default PlatformQcQueuePage;
