import React, { useMemo, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { caseApi } from '../../api/case.api';
import { adminApi } from '../../api/admin.api';
import { worklistApi } from '../../api/worklist.api';
import { ROUTES } from '../../constants/routes';
import { useActiveDocket } from '../../hooks/useActiveDocket';
import {
  buildQueueContext,
  DataTable,
  FilterBar,
  PageSection,
  SectionToolbar,
  StatRow,
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

const formatSlaDays = (slaDueAt) => {
  if (!slaDueAt) return '—';
  const due = new Date(slaDueAt);
  const now = new Date();
  
  // Set times to midnight to calculate purely calendar days
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return <span className="text-rose-600 font-semibold">{Math.abs(diffDays)} day(s) overdue</span>;
  }
  if (diffDays === 0) {
    return <span className="text-orange-500 font-semibold">Due today</span>;
  }
  return <span className="text-gray-700">{diffDays} day(s) left</span>;
};

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
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [bulkAssigneeXid, setBulkAssigneeXid] = useState('');
  const [bulkMoving, setBulkMoving] = useState(false);

  const isSupervisor = useMemo(() => {
    const role = String(user?.role || '').trim().toUpperCase();
    return ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER'].includes(role) || user?.isPrimaryAdmin;
  }, [user]);

  useEffect(() => {
    if (!isSupervisor) return;
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await adminApi.getUsers();
        if (response.success && Array.isArray(response.data)) {
          const role = String(user?.role || '').trim().toUpperCase();
          if (role === 'MANAGER') {
            // Filter users who report to this manager
            setAssignableUsers(response.data.filter(u => u.isActive && (String(u.managerId) === String(user.id || user._id) || String(u.reportsToUserId) === String(user.id || user._id) || u.xID === user.xID)));
          } else {
            // Admin / Primary Admin can assign to any active user
            setAssignableUsers(response.data.filter(u => u.isActive));
          }
        }
      } catch (error) {
        console.error('Failed to load assignable users', error);
      } finally {
        setUsersLoading(false);
      }
    };
    void fetchUsers();
  }, [isSupervisor, user]);

  useEffect(() => {
    setSelectedIds([]);
    setSuccess('');
    setBulkAssigneeXid('');
  }, [workbasketId]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredRows.map(r => getDocketRouteId(r)).filter(Boolean));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkMove = async () => {
    const targetXid = isSupervisor ? bulkAssigneeXid : user?.xID;
    if (!targetXid || selectedIds.length === 0 || bulkMoving) return;
    setBulkMoving(true);
    setSuccess('');
    try {
      await Promise.all(
        selectedIds.map(caseId =>
          worklistApi.moveDocket(caseId, {
            destinationType: 'USER_WORKLIST',
            assigneeXID: targetXid,
          })
        )
      );
      setSuccess(isSupervisor ? `Successfully moved ${selectedIds.length} docket(s) to assignee's worklist.` : `Successfully pulled ${selectedIds.length} docket(s) to your worklist.`);
      setSelectedIds([]);
      setBulkAssigneeXid('');
      await refetch();
    } catch (err) {
      // keep message on screen
    } finally {
      setBulkMoving(false);
    }
  };

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

  if (isAccessDenied) {
    return (
      <PlatformShell title="Access restricted" subtitle="Your session is active, but this module is currently not available for your role.">
        <AccessDeniedState supportContext={recovery.supportContext} />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      title={selectedWorkbasket ? `📥 Workbaskets — ${selectedWorkbasket.name}` : '📥 Workbaskets'}
      subtitle="Shared docket queue — pull work into your personal execution list."
      actions={
        <Link to={ROUTES.CREATE_CASE(firmSlug)} className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200 rounded-lg shadow-sm hover:shadow">
          ✚ Create Docket
        </Link>
      }
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? 'Unable to load workbaskets right now.' : '' },
          { tone: 'success', message: success },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing the workbaskets queue in the background…' : '' },
        ]}
      />

      {/* Flat stat row — Notion/HubSpot style KPI strip */}
      <StatRow
        items={[
          { label: '📥 Available', value: isLoading ? '…' : metrics[0]?.value, note: 'dockets in queue' },
          { label: '👤 Assigned',  value: isLoading ? '…' : metrics[1]?.value, note: 'to team members' },
          { label: '⏳ Pending',   value: isLoading ? '…' : metrics[2]?.value, note: 'awaiting review' },
          { label: '⚠️ Escalated', value: isLoading ? '…' : metrics[3]?.value, note: 'need attention' },
        ]}
      />

      <PageSection
        title="🗂️ Shared Intake Queue"
        description={`${filteredRows.length} dockets waiting to be picked up`}
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
            {isFetching ? '⟳ Refreshing…' : '↺ Refresh'}
          </button>
        }
      >
        <SectionToolbar>
          <div className="w-full bg-gray-50/50 border border-gray-100/80 rounded-2xl p-4 mb-6 shadow-inner">
            <FilterBar onClear={clearFilters} clearDisabled={!search && statusFilter === 'ALL' && categoryFilter === 'ALL'}>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
                <div className="relative flex-1">
                  <div 
                    className="absolute inset-y-0 left-0 flex items-center pointer-events-none text-gray-400"
                    style={{ paddingLeft: '14px' }}
                  >
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search docket number, client, category..."
                    className="block w-full pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    style={{ paddingLeft: '40px' }}
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
        {selectedIds.length > 0 && (
          <div className="wb-bulk-bar">
            <span className="wb-bulk-bar__count">
              {selectedIds.length} docket{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="wb-bulk-bar__actions">
              {isSupervisor ? (
                <>
                  <select
                    value={bulkAssigneeXid}
                    onChange={(e) => setBulkAssigneeXid(e.target.value)}
                    className="filter-bar__select"
                  >
                    <option value="">Select Assignee...</option>
                    {assignableUsers.map((u) => (
                      <option key={u.xID} value={u.xID}>{u.name || u.xID} ({u.xID})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleBulkMove}
                    disabled={!bulkAssigneeXid || bulkMoving}
                    className="action-primary wb-bulk-bar__btn"
                  >
                    {bulkMoving ? 'Moving…' : 'Move to Worklist'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleBulkMove}
                  disabled={bulkMoving}
                  className="action-primary wb-bulk-bar__btn"
                >
                  {bulkMoving ? 'Pulling…' : 'Pull to My Worklist'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="wb-bulk-bar__cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <DataTable
            columns={[
              {
                key: 'select',
                label: (
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredRows.length && filteredRows.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500/20 cursor-pointer"
                  />
                ),
                widthClass: 'platform-table-select-col'
              },
              'Docket ID', 'Client ID', 'Client Name', 'Category / Subcategory', 'SLA Due', 'SLA Days', 'Updated'
            ]}
            compact
            tableClassName="w-full text-left border-collapse"
            rows={filteredRows.map((r) => {
              const rId = getDocketRouteId(r);
              return (
                <tr key={r.caseInternalId || r._id} className="hover:bg-gray-50/70 border-b border-gray-50 last:border-b-0 transition-colors duration-150">
                  <td className="platform-table-select-col">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(rId)}
                      onChange={() => handleSelectRow(rId)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500/20 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    <button
                      className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors duration-150"
                      type="button"
                      onClick={() => openFromQueue(r)}
                    >
                      {formatDocketLabel(r)}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-semibold text-sm">{r.clientId || '—'}</td>
                  <td className="px-6 py-4 text-gray-900 font-semibold text-sm">{r.clientName || '—'}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    <span className="text-gray-900 font-medium">{r.category || '—'}</span>
                    {r.subcategory && r.subcategory !== '-' && (
                      <span className="text-gray-400 text-xs ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded">
                        {r.subcategory}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm font-medium">{r.slaDueAt ? formatDateLabel(r.slaDueAt) : '—'}</td>
                  <td className="px-6 py-4 text-sm font-medium">{formatSlaDays(r.slaDueAt)}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm tabular-nums">{formatDateLabel(r.updatedAt || r.createdAt)}</td>
                </tr>
              );
            })}
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
