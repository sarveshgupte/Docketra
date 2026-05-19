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
import { usePlatformWorkbenchQuery } from '../../hooks/usePlatformDataQueries';

export const PlatformWorkbasketsPage = () => {
  const { firmSlug, workbasketId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openDocket } = useActiveDocket();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [success, setSuccess] = useState('');
  const [pendingPullId, setPendingPullId] = useState('');

  const {
    data: rows = [],
    isLoading,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = usePlatformWorkbenchQuery();


  const recovery = getRecoveryPayload(queryError, 'platform_queue');
  const isAccessDenied = isError && recovery.reasonCode === 'CASE_ACCESS_DENIED';

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || String(item.status || '').toUpperCase() === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || String(item.category || '') === categoryFilter;
      const matchesWorkbasket = !workbasketId || String(item.workbasketId || item.queueId || item.teamId || '').trim() === String(workbasketId).trim();
      const matchesSearch = !needle || [
        formatDocketLabel(item),
        item.clientName,
        item.clientId,
        item.category,
        item.subcategory,
        item.assigneeName,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
      return matchesStatus && matchesCategory && matchesWorkbasket && matchesSearch;
    });
  }, [rows, search, statusFilter, categoryFilter, workbasketId]);

  const categories = useMemo(() => [...new Set(rows.map((item) => String(item.category || '').trim()).filter(Boolean))], [rows]);
  const metrics = useMemo(() => {
    const available = rows.length;
    const assigned = rows.filter((item) => Boolean(item.assigneeName || item.assignedTo)).length;
    const pending = rows.filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length;
    const escalated = rows.filter((item) => String(item.status || '').toUpperCase() === 'ESCALATED').length;
    return [
      { label: 'Available', value: isLoading ? '…' : available },
      { label: 'Assigned', value: isLoading ? '…' : assigned },
      { label: 'Pending', value: isLoading ? '…' : pending },
      { label: 'Escalated', value: isLoading ? '…' : escalated },
    ];
  }, [rows, isLoading]);

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
      state: buildQueueContext({ rows: filteredRows, rowId, location, origin: 'workbasket' }),
    });
  };

  const pullToWorklist = async (caseInternalId) => {
    setSuccess('');
    setPendingPullId(caseInternalId);
    try {
      await caseApi.pullCase(caseInternalId);
      setSuccess('Docket pulled to worklist.');
      await refetch();
    } catch {
      // keep existing behavior with visible table data
    } finally {
      setPendingPullId('');
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
      title="Workbaskets"
      subtitle="Shared docket queue for work that can be pulled into individual execution."
      actions={<Link to={ROUTES.DOCKETS(firmSlug)}>All Dockets</Link>}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? 'Unable to load workbaskets right now.' : '' },
          { tone: 'success', message: success },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing the workbaskets queue in the background…' : '' },
        ]}
      />
      <StatGrid items={metrics} compact columns={4} />
      <PageSection
        title="Shared intake queue"
        description={`${filteredRows.length} dockets available in team intake workbaskets.`}
        actions={<button type="button" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? 'Refreshing…' : 'Refresh'}</button>}
      >
        <SectionToolbar>
          <FilterBar onClear={clearFilters} clearDisabled={!search && statusFilter === 'ALL' && categoryFilter === 'ALL'}>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search docket, client, category"
            aria-label="Search workbaskets queue"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="OPEN">Open</option>
            <option value="ROUTED">Routed</option>
            <option value="IN_PROGRESS">In Progress</option>
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
            <option value="ALL">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          </FilterBar>
        </SectionToolbar>

        <DataTable
          columns={['Docket ID', 'Client', 'Category / Subcategory', 'Status', 'Queue', 'Updated', 'Actions']}
          compact
          tableClassName="queue-table"
          rows={filteredRows.map((r) => (
            <tr key={r.caseInternalId || r._id}>
              <td>
                <button className="action-primary" type="button" onClick={() => openFromQueue(r)}>
                  {formatDocketLabel(r)}
                </button>
              </td>
              <td>{r.clientName || r.clientId || '-'}</td>
              <td className="queue-cell-wrap">{[r.category || '-', r.subcategory || '-'].join(' / ')}</td>
              <td><StatusBadge status={r.status} label={formatStatusLabel(r.status)} /></td>
              <td>{r.workbasketName || r.queueName || 'Workbasket'}</td>
              <td>{formatDateLabel(r.updatedAt || r.createdAt)}</td>
              <td>
                <div className="action-group-secondary queue-action-group" role="group" aria-label="Workbasket actions">
                  <button onClick={() => void pullToWorklist(r.caseInternalId)} type="button" disabled={pendingPullId === r.caseInternalId}>
                    {pendingPullId === r.caseInternalId ? 'Pulling…' : 'Pull to Worklist'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          loading={isLoading}
          error=""
          onRetry={() => void refetch()}
          hasActiveFilters={Boolean(search.trim()) || statusFilter !== 'ALL' || categoryFilter !== 'ALL'}
          emptyLabel="No dockets are waiting in your workbaskets."
          emptyLabelFiltered="No dockets match your workbasket filters."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformWorkbasketsPage;
