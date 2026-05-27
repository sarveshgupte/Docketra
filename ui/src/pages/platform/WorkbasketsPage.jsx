import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  const { user } = useAuth();
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
  } = usePlatformWorkbenchQuery({ workbasketId: workbasketId || undefined });

  const recovery = getRecoveryPayload(queryError, 'platform_queue');
  const isAccessDenied = isError && recovery.reasonCode === 'CASE_ACCESS_DENIED';
  const assignedWorkbaskets = Array.isArray(user?.workbaskets) ? user.workbaskets : [];
  const selectedWorkbasket = assignedWorkbaskets.find((wb) => String(wb?._id || wb?.id || wb?.workbasketId || '').trim() === String(workbasketId || '').trim());

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || String(item.status || '').toUpperCase() === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || String(item.category || '') === categoryFilter;
      const rowWorkbasketIds = [
        item.workbasketId,
        item.queueId,
        item.teamId,
        item.ownerTeamId,
        item.routedToTeamId,
      ].map((value) => String(value || '').trim()).filter(Boolean);
      const matchesWorkbasket = !workbasketId || rowWorkbasketIds.includes(String(workbasketId).trim());
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
      { label: 'Available Dockets', value: isLoading ? '…' : available, color: 'from-blue-500 to-indigo-600', icon: '📥' },
      { label: 'Assigned to Team', value: isLoading ? '…' : assigned, color: 'from-emerald-500 to-teal-600', icon: '👤' },
      { label: 'Pending Review', value: isLoading ? '…' : pending, color: 'from-amber-500 to-orange-600', icon: '⏳' },
      { label: 'Escalated Cases', value: isLoading ? '…' : escalated, color: 'from-rose-500 to-red-600', icon: '⚠️' },
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
      setSuccess('Docket successfully pulled to your worklist.');
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
      title={selectedWorkbasket ? `Workbaskets — ${selectedWorkbasket.name}` : 'Workbaskets'}
      subtitle="Shared docket queue for work that can be pulled into individual execution."
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? 'Unable to load workbaskets right now.' : '' },
          { tone: 'success', message: success },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing the workbaskets queue in the background…' : '' },
        ]}
      />

      {/* Premium KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((item) => (
          <div
            key={item.label}
            className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{item.label}</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-2 tracking-tight group-hover:scale-105 transition-transform duration-200 origin-left">
                  {item.value}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl shadow-inner group-hover:bg-indigo-50 transition-colors duration-300">
                {item.icon}
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />
          </div>
        ))}
      </div>

      <PageSection
        title="Shared Intake Queue"
        description={`${filteredRows.length} dockets currently waiting in team intake workbaskets.`}
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 active:bg-gray-100 text-sm font-medium text-gray-700 transition-all shadow-sm disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 text-gray-500 ${isFetching ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
            </svg>
            {isFetching ? 'Refreshing…' : 'Refresh Queue'}
          </button>
        }
      >
        <SectionToolbar>
          <div className="w-full bg-gray-50/50 border border-gray-100/80 rounded-2xl p-4 mb-6 shadow-inner">
            <FilterBar onClear={clearFilters} clearDisabled={!search && statusFilter === 'ALL' && categoryFilter === 'ALL'}>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    🔍
                  </div>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search docket number, client, category..."
                    className="block w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    aria-label="Search workbaskets queue"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    aria-label="Filter by status"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="UNASSIGNED">Unassigned</option>
                    <option value="OPEN">Open</option>
                    <option value="ROUTED">Routed</option>
                    <option value="IN_PROGRESS">In Progress</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    aria-label="Filter by category"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FilterBar>
          </div>
        </SectionToolbar>

        {/* Clean, professional data table wrapper */}
        <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
          <DataTable
            columns={['Docket ID', 'Client', 'Category / Subcategory', 'Status', 'Queue', 'Updated', 'Actions']}
            compact
            tableClassName="w-full text-left border-collapse"
            rows={filteredRows.map((r) => (
              <tr key={r.caseInternalId || r._id} className="hover:bg-gray-50/70 border-b border-gray-50 last:border-b-0 transition-colors duration-150">
                <td className="px-6 py-4 font-semibold text-gray-900">
                  <button
                    className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors duration-150"
                    type="button"
                    onClick={() => openFromQueue(r)}
                  >
                    {formatDocketLabel(r)}
                  </button>
                </td>
                <td className="px-6 py-4 text-gray-600 font-medium">{r.clientName || r.clientId || '-'}</td>
                <td className="px-6 py-4 text-gray-500 text-sm">{[r.category || '-', r.subcategory || '-'].join(' / ')}</td>
                <td className="px-6 py-4"><StatusBadge status={r.status} label={formatStatusLabel(r.status)} /></td>
                <td className="px-6 py-4 text-gray-500 font-medium text-sm">{r.workbasketName || r.queueName || 'Workbasket'}</td>
                <td className="px-6 py-4 text-gray-400 text-sm tabular-nums">{formatDateLabel(r.updatedAt || r.createdAt)}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => void pullToWorklist(r.caseInternalId)}
                    type="button"
                    disabled={pendingPullId === r.caseInternalId}
                    className="inline-flex items-center justify-center px-4 py-1.5 border border-indigo-100 rounded-lg bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-xs font-semibold text-indigo-700 transition-all disabled:opacity-50"
                  >
                    {pendingPullId === r.caseInternalId ? 'Pulling…' : 'Pull to Worklist'}
                  </button>
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
        </div>
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformWorkbasketsPage;
