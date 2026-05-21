import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { usePlatformMyWorklistQuery } from '../../hooks/usePlatformDataQueries';

export const PlatformWorklistPage = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openDocket } = useActiveDocket();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeOnly, setActiveOnly] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingActionId, setPendingActionId] = useState('');
  const workbasketId = useMemo(() => new URLSearchParams(location.search || "").get('workbasketId') || '', [location.search]);
  const scopedWorkbasket = useMemo(() => (Array.isArray(user?.workbaskets) ? user.workbaskets : []).find((wb) => String(wb?._id || wb?.id || wb?.workbasketId || "").trim() === workbasketId), [user?.workbaskets, workbasketId]);
  const scopedLabel = scopedWorkbasket?.name || "";

  const {
    data: rows = [],
    isLoading,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = usePlatformMyWorklistQuery({ workbasketId });


  const recovery = getRecoveryPayload(queryError, 'platform_queue');
  const isAccessDenied = isError && recovery.reasonCode === 'CASE_ACCESS_DENIED';
  const worklistLoadMessage = 'We couldn’t load your assigned dockets. Refresh the page or contact your admin if this continues.';
  const worklistSupportCode = recovery.supportContext?.requestId || recovery.reasonCode || '';

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((item) => {
      const status = String(item.status || '').toUpperCase();
      const activeStatus = activeOnly && status === 'PENDING' ? false : true;
      const matchesStatus = (statusFilter === 'ALL' || status === statusFilter) && activeStatus;
      const matchesCategory = categoryFilter === 'ALL' || String(item.category || '') === categoryFilter;
      const itemWorkbasketId = String(item.workbasketId || item.workbasket?._id || item.workbasket?.id || item.workbasket?.workbasketId || item.workBasketId || item.queueId || item.assignedWorkbasketId || item.assignment?.workbasketId || item.meta?.workbasketId || "").trim();
      const matchesWorkbasket = !workbasketId || itemWorkbasketId === workbasketId;
      const matchesQuery = !needle || [
        formatDocketLabel(item),
        item.clientName,
        item.clientId,
        item.category,
        item.subcategory,
        item.assigneeName,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
      return matchesStatus && matchesCategory && matchesWorkbasket && matchesQuery;
    });
  }, [rows, search, statusFilter, categoryFilter, activeOnly]);

  const categories = useMemo(() => [...new Set(rows.map((item) => String(item.category || '').trim()).filter(Boolean))], [rows]);
  const metrics = useMemo(() => {
    const active = rows.filter((item) => String(item.status || '').toUpperCase() !== 'PENDING').length;
    const pended = rows.filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length;
    return [
      { label: 'Active', value: isLoading ? '…' : active },
      { label: 'Pended', value: isLoading ? '…' : pended },
      { label: 'Visible now', value: isLoading ? '…' : filteredRows.length },
    ];
  }, [rows, filteredRows.length, isLoading]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setActiveOnly(true);
  };

  const openFromQueue = (row) => {
    const rowId = getDocketRouteId(row);
    if (!rowId) return;
    openDocket({
      caseId: rowId,
      navigate,
      to: `${ROUTES.CASE_DETAIL(firmSlug, rowId)}?returnTo=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`,
      state: buildQueueContext({ rows: filteredRows, rowId, location, origin: 'my-worklist' }),
    });
  };

  const transition = async (caseInternalId, action) => {
    setSuccess('');
    setError('');
    setPendingActionId(caseInternalId);
    try {
      if (action === 'SEND_TO_QC') await caseApi.transitionDocket(caseInternalId, { action: 'SEND_TO_QC' });
      if (action === 'PEND') await caseApi.pendCase(caseInternalId, 'Pending via worklist action');
      if (action === 'RESOLVE') await caseApi.resolveCase(caseInternalId, 'Resolved via worklist action');
      setSuccess('Docket updated successfully.');
      await refetch();
    } catch {
      setError('Action failed. Refresh and retry.');
    } finally {
      setPendingActionId('');
    }
  };

  if (isAccessDenied) {
    return (
      <PlatformShell title="Access restricted" subtitle="You do not have permission to view this worklist.">
        <AccessDeniedState supportContext={recovery.supportContext} />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      title={scopedLabel ? `Worklist — ${scopedLabel}` : "My Worklist"}
      subtitle={scopedLabel ? `Your personal docket workload for ${scopedLabel}.` : "Your personal docket workload for active execution and pended follow-up."}
      actions={<Link to={ROUTES.CREATE_CASE(firmSlug)}>Create Docket</Link>}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: error || (isError ? `${worklistLoadMessage}${worklistSupportCode ? ` (Ref: ${worklistSupportCode})` : ''}` : '') },
          { tone: 'success', message: success },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing worklist without interrupting your current view…' : '' },
        ]}
      />
      <StatGrid items={metrics} compact columns={4} />
      <PageSection
        title="Personal execution queue"
        description={`${filteredRows.length} dockets in your current worklist view.`}
        actions={<button type="button" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? 'Refreshing…' : 'Refresh'}</button>}
      >
        <SectionToolbar>
          <FilterBar onClear={clearFilters} clearDisabled={!search && statusFilter === 'ALL' && categoryFilter === 'ALL' && activeOnly}>
            
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search docket, client, assignee"
              aria-label="Search worklist"
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter worklist by status">
              <option value="ALL">All statuses</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="PENDING">Pending</option>
              
            </select>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <label className="filter-bar__checkbox">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
              />
              Show active dockets only
            </label>
          </FilterBar>
        </SectionToolbar>

        <DataTable
          columns={['Docket ID', 'Client', 'Category / Subcategory', 'Status', 'Assignee', 'Updated', 'Actions']}
          compact
          tableClassName="queue-table"
          rows={filteredRows.map((r) => (
            <tr key={r.caseInternalId || r._id || formatDocketLabel(r)}>
              <td>
                <button className="action-primary" type="button" onClick={() => openFromQueue(r)}>
                  {formatDocketLabel(r)}
                </button>
              </td>
              <td>{r.clientName || r.clientId || '-'}</td>
              <td className="queue-cell-wrap">{[r.category || '-', r.subcategory || '-'].join(' / ')}</td>
              <td><StatusBadge status={r.status || 'IN_PROGRESS'} label={formatStatusLabel(r.status || 'IN_PROGRESS')} /></td>
              <td>{r.assigneeName || r.assignedTo || '-'}</td>
              <td>{formatDateLabel(r.updatedAt || r.createdAt)}</td>
              <td>
                <div className="action-group-secondary queue-action-group" role="group" aria-label="Docket actions">
                  {!r.caseInternalId ? <span className="muted">Action unavailable: missing docket ID</span> : null}
                  <button type="button" onClick={() => void transition(r.caseInternalId, 'SEND_TO_QC')} disabled={!r.caseInternalId || pendingActionId === r.caseInternalId}>Send to QC</button>
                  <button type="button" onClick={() => void transition(r.caseInternalId, 'PEND')} disabled={!r.caseInternalId || pendingActionId === r.caseInternalId}>Pend</button>
                  <button type="button" onClick={() => void transition(r.caseInternalId, 'RESOLVE')} disabled={!r.caseInternalId || pendingActionId === r.caseInternalId}>
                    {pendingActionId === r.caseInternalId ? 'Updating…' : 'Resolve'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          loading={isLoading}
          error=""
          onRetry={() => void refetch()}
          hasActiveFilters={Boolean(search.trim()) || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || activeOnly}
          emptyLabel={scopedLabel ? `No dockets in your ${scopedLabel} worklist.` : "No dockets are assigned to you yet. Pull from Workbaskets or request assignment from your manager/admin."}
          emptyLabelFiltered="No worklist dockets match your current search or filters."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformWorklistPage;
