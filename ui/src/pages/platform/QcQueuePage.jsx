import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { caseApi } from '../../api/case.api';
import { ROUTES } from '../../constants/routes';
import { useActiveDocket } from '../../hooks/useActiveDocket';
import {
  buildQueueContext,
  DataTable,
  FilterBar,
  PageSection,
  SectionToolbar,
  StatGrid,
  StatusBadge,
  StatusMessageStack,
  formatDateLabel,
  formatDocketLabel,
  formatStatusLabel,
  getDocketRouteId,
} from './PlatformShared';
import { AccessDeniedState } from '../../components/feedback/AccessDeniedState';
import { getRecoveryPayload } from '../../utils/errorRecovery';
import { usePlatformQcQueueQuery } from '../../hooks/usePlatformDataQueries';
import { CASE_QUERY_PARAMS } from '../../hooks/useCaseQuery';
import { ActionConfirmModal } from '../../components/common/ActionConfirmModal';

export const PlatformQcQueuePage = () => {
  const { firmSlug, workbasketId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
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
    error: queryError,
    refetch,
  } = usePlatformQcQueueQuery();


  const recovery = getRecoveryPayload(queryError, 'platform_queue');
  const isAccessDenied = isError && recovery.reasonCode === 'CASE_ACCESS_DENIED';
  const assignedQcWorkbaskets = Array.isArray(user?.qcWorkbaskets) ? user.qcWorkbaskets : [];
  const selectedQcWorkbasket = assignedQcWorkbaskets.find((wb) => String(wb?._id || wb?.id || wb?.workbasketId || '').trim() === String(workbasketId || '').trim());

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((item) => {
      const assignee = String(item.assigneeName || item.assignedTo || 'Unassigned');
      const matchesAssignee = assigneeFilter === 'ALL' || assignee === assigneeFilter;
      const matchesWorkbasket = !workbasketId || String(item.workbasketId || item.qcWorkbasketId || item.queueId || '').trim() === String(workbasketId).trim();
      const matchesSearch = !needle || [formatDocketLabel(item), item.assigneeName, item.assignedTo, item.clientName, item.category]
        .some((value) => String(value || '').toLowerCase().includes(needle));
      return matchesAssignee && matchesWorkbasket && matchesSearch;
    });
  }, [rows, search, assigneeFilter, workbasketId]);

  const assignees = useMemo(
    () => [...new Set(rows.map((item) => String(item.assigneeName || item.assignedTo || 'Unassigned')).filter(Boolean))],
    [rows]
  );
  const metrics = useMemo(() => {
    const awaiting = rows.length;
    const passed = rows.filter((item) => String(item.qcStatus || '').toUpperCase() === 'PASS').length;
    const corrections = rows.filter((item) => String(item.qcStatus || '').toUpperCase() === 'CORRECT').length;
    const failed = rows.filter((item) => String(item.qcStatus || '').toUpperCase() === 'FAIL').length;
    return [
      { label: 'Awaiting QC', value: isLoading ? '…' : awaiting },
      { label: 'Passed', value: isLoading ? '…' : passed },
      { label: 'Corrections', value: isLoading ? '…' : corrections },
      { label: 'Failed', value: isLoading ? '…' : failed },
    ];
  }, [rows, isLoading]);

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

  if (isAccessDenied) {
    return (
      <PlatformShell title="Access restricted" subtitle="Your session is active, but this module is currently not available for your role.">
        <AccessDeniedState supportContext={recovery.supportContext} />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      title={selectedQcWorkbasket ? `QC Workbaskets — ${selectedQcWorkbasket.name}` : 'QC Workbaskets'}
      subtitle="Quality-control queue for pass, return-for-correction, and fail review decisions."
      actions={<Link to={ROUTES.ADMIN_REPORTS(firmSlug)}>QC Reports</Link>}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: error || (isError ? 'Unable to load QC workbaskets right now.' : '') },
          { tone: 'success', message: success },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing QC queue in the background…' : '' },
        ]}
      />
      <StatGrid items={metrics} compact columns={4} />
      <PageSection
        title="Quality review queue"
        description={`${filteredRows.length} dockets waiting for QC decisions.`}
        actions={<button type="button" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? 'Refreshing…' : 'Refresh'}</button>}
      >
        <SectionToolbar>
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
          </FilterBar>
        </SectionToolbar>
        {activeFilters.length > 0 ? (
          <div className="table-filter-chip-group" role="list" aria-label="Active QC filters">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => removeFilter(filter.key)}
                className="table-filter-chip"
                aria-label={`Remove filter: ${filter.label} ${filter.value}`}
              >
                <span className="table-filter-chip__label">{filter.label}:</span> {filter.value}
                <span aria-hidden className="table-filter-chip__close">&times;</span>
              </button>
            ))}
          </div>
        ) : null}
        <DataTable
          columns={['Docket ID', 'Client', 'Category', 'QC Status', 'Assignee', 'Updated', 'Actions']}
          compact
          tableClassName="queue-table"
          rows={filteredRows.map((r) => (
            <tr key={r.caseInternalId || r._id || formatDocketLabel(r)}>
              <td>
                <button className="action-primary" type="button" onMouseEnter={() => prefetchCaseDetail(r)} onFocus={() => prefetchCaseDetail(r)} onClick={() => openFromQueue(r)}>
                  {formatDocketLabel(r)}
                </button>
              </td>
              <td>{r.clientName || r.clientId || '-'}</td>
              <td className="queue-cell-wrap">{[r.category || '-', r.subcategory || '-'].join(' / ')}</td>
              <td><StatusBadge status={r.qcStatus || r.status || 'IN_QC'} label={formatStatusLabel(r.qcStatus || r.status || 'IN_QC')} /></td>
              <td>{r.assigneeName || r.assignedTo || '-'}</td>
              <td>{formatDateLabel(r.updatedAt || r.createdAt)}</td>
              <td>
                <div className="action-group-secondary queue-action-group" role="group" aria-label="QC actions">
                  {!r.caseInternalId ? <span className="muted">Action unavailable: missing docket ID</span> : null}
                  <button type="button" onClick={() => setConfirmAction({ caseInternalId: r.caseInternalId, action: 'PASS', note: 'Passed from queue', title: `Pass ${formatDocketLabel(r)}?`, description: 'This marks the docket as QC passed and advances it to completion.', confirmText: 'Confirm pass', danger: false })} disabled={!r.caseInternalId || pendingQcId === r.caseInternalId}>
                    {pendingQcId === r.caseInternalId ? 'Updating…' : 'Pass'}
                  </button>
                  <button type="button" onClick={() => setConfirmAction({ caseInternalId: r.caseInternalId, action: 'CORRECT', note: 'Needs correction', title: `Return ${formatDocketLabel(r)} for correction?`, description: 'This sends the docket back to execution with a correction request.', confirmText: 'Return for correction', danger: false })} disabled={!r.caseInternalId || pendingQcId === r.caseInternalId}>Send back</button>
                  <button type="button" className="action-danger" onClick={() => setConfirmAction({ caseInternalId: r.caseInternalId, action: 'FAIL', note: 'Failed from queue', title: `Fail ${formatDocketLabel(r)}?`, description: 'This records the docket as failed in QC. Continue only if this decision is final.', confirmText: 'Fail docket', danger: true })} disabled={!r.caseInternalId || pendingQcId === r.caseInternalId}>Fail</button>
                </div>
              </td>
            </tr>
          ))}
          loading={isLoading}
          error=""
          onRetry={() => void refetch()}
          hasActiveFilters={Boolean(search.trim()) || assigneeFilter !== 'ALL'}
          emptyLabel="No dockets are waiting for QC review."
          emptyLabelFiltered="No QC dockets match your current filters."
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
