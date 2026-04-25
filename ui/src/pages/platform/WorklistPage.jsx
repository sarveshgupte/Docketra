import React, { useMemo, useState } from 'react';
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
import { AccessDeniedState } from '../../components/feedback/AccessDeniedState';
import { getRecoveryPayload } from '../../utils/errorRecovery';
import { usePlatformMyWorklistQuery } from '../../hooks/usePlatformDataQueries';

export const PlatformWorklistPage = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openDocket } = useActiveDocket();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingActionId, setPendingActionId] = useState('');

  const {
    data: rows = [],
    isLoading,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = usePlatformMyWorklistQuery();


  const recovery = getRecoveryPayload(queryError, 'platform_queue');
  const isAccessDenied = isError && recovery.reasonCode === 'CASE_ACCESS_DENIED';

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((item) => {
      const status = String(item.status || '').toUpperCase();
      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || String(item.category || '') === categoryFilter;
      const matchesQuery = !needle || [
        formatDocketLabel(item),
        item.clientName,
        item.clientId,
        item.category,
        item.subcategory,
        item.assigneeName,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [rows, search, statusFilter, categoryFilter]);

  const categories = useMemo(() => [...new Set(rows.map((item) => String(item.category || '').trim()).filter(Boolean))], [rows]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
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
      <PlatformShell title="Access restricted" subtitle="Your session is active, but this module is currently not available for your role.">
        <AccessDeniedState supportContext={recovery.supportContext} />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      title="My Worklist"
      subtitle="Your personal docket workload for active execution and pended follow-up."
      actions={<Link to={ROUTES.CREATE_CASE(firmSlug)}>Create Docket</Link>}
    >
      <InlineNotice tone="error" message={error || (isError ? 'Unable to load your worklist right now.' : '')} />
      <InlineNotice tone="success" message={success} />
      <RefreshNotice refreshing={isFetching && !isLoading} message="Refreshing worklist without interrupting your current view…" />
      <PageSection
        title="What this queue is for"
        description="My Worklist is your personal execution queue. Dockets appear after assignment from Workbench or direct assignment at creation."
      >
        <p className="muted">If this is empty, check Workbench for unassigned intake or ask an admin/manager to assign dockets to you.</p>
      </PageSection>
      <PageSection title="My active workload" description={`${filteredRows.length} dockets in your current worklist view.`}>
        <FilterBar onClear={clearFilters} clearDisabled={!search && statusFilter === 'ALL' && categoryFilter === 'ALL'}>
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
            <option value="IN_QC">In QC</option>
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
            <option value="ALL">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button type="button" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </FilterBar>

        <DataTable
          columns={['Docket ID', 'Client', 'Category / Subcategory', 'Status', 'Assignee', 'Updated', 'Actions']}
          rows={filteredRows.map((r) => (
            <tr key={r.caseInternalId || r._id}>
              <td>
                <button className="action-primary" type="button" onClick={() => openFromQueue(r)}>
                  {formatDocketLabel(r)}
                </button>
              </td>
              <td>{r.clientName || r.clientId || '-'}</td>
              <td>{[r.category || '-', r.subcategory || '-'].join(' / ')}</td>
              <td>{formatStatusLabel(r.status || 'IN_PROGRESS')}</td>
              <td>{r.assigneeName || r.assignedTo || '-'}</td>
              <td>{formatDateLabel(r.updatedAt || r.createdAt)}</td>
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
          loading={isLoading}
          error={isError ? 'Unable to load your worklist right now.' : ''}
          onRetry={() => void refetch()}
          hasActiveFilters={Boolean(search.trim()) || statusFilter !== 'ALL' || categoryFilter !== 'ALL'}
          emptyLabel="No dockets are assigned to you yet. Pull from Workbench or request assignment from your manager/admin."
          emptyLabelFiltered="No worklist dockets match your current search or filters."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformWorklistPage;
