import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
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
  const { user } = useAuth();
  const { openDocket } = useActiveDocket();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeOnly, setActiveOnly] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [bulkAssigneeXid, setBulkAssigneeXid] = useState('');
  const [bulkMoving, setBulkMoving] = useState(false);

  const scopedWorkbasketId = new URLSearchParams(location.search || '').get('workbasketId') || '';
  const assignedWorkbaskets = Array.isArray(user?.workbaskets) ? user.workbaskets : [];
  const scopedWorkbasket = assignedWorkbaskets.find((wb) => String(wb?._id || wb?.id || wb?.workbasketId || '') === scopedWorkbasketId);

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
      } catch (err) {
        console.error('Failed to load assignable users', err);
      } finally {
        setUsersLoading(false);
      }
    };
    void fetchUsers();
  }, [isSupervisor, user]);

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
    if (!bulkAssigneeXid || selectedIds.length === 0 || bulkMoving) return;
    setBulkMoving(true);
    setSuccess('');
    setError('');
    try {
      await Promise.all(
        selectedIds.map(caseId =>
          worklistApi.moveDocket(caseId, {
            destinationType: 'USER_WORKLIST',
            assigneeXID: bulkAssigneeXid,
          })
        )
      );
      setSuccess(`Successfully reassigned ${selectedIds.length} docket(s).`);
      setSelectedIds([]);
      setBulkAssigneeXid('');
      await refetch();
    } catch (err) {
      setError('Failed to reassign some or all selected dockets. Please try again.');
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
  } = usePlatformMyWorklistQuery({ workbasketId: scopedWorkbasketId || undefined });

  const recovery = getRecoveryPayload(queryError, 'platform_queue');
  const isAccessDenied = isError && recovery.reasonCode === 'CASE_ACCESS_DENIED';
  const worklistLoadMessage = 'We couldn’t load your assigned dockets. Refresh the page or contact your admin if this continues.';
  const worklistSupportCode = recovery.supportContext?.requestId || recovery.reasonCode || '';

  const normalizedRows = useMemo(() => {
    if (!scopedWorkbasketId) return rows;
    const pickId = (item) => String(item?.workbasketId || item?.workbasket?._id || item?.workbasket?.id || item?.workbasket?.workbasketId || item?.workBasketId || item?.queueId || item?.assignedWorkbasketId || item?.assignment?.workbasketId || item?.meta?.workbasketId || '');
    return rows.filter((item) => pickId(item) === scopedWorkbasketId);
  }, [rows, scopedWorkbasketId]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return normalizedRows.filter((item) => {
      const status = String(item.status || '').toUpperCase();
      const activeStatus = activeOnly && status === 'PENDING' ? false : true;
      const matchesStatus = (statusFilter === 'ALL' || status === statusFilter) && activeStatus;
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
  }, [normalizedRows, search, statusFilter, categoryFilter, activeOnly]);

  const categories = useMemo(() => [...new Set(normalizedRows.map((item) => String(item.category || '').trim()).filter(Boolean))], [normalizedRows]);
  
  const metrics = useMemo(() => {
    const active = normalizedRows.filter((item) => String(item.status || '').toUpperCase() !== 'PENDING').length;
    const pended = normalizedRows.filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length;
    return [
      { label: 'Active Workload', value: isLoading ? '…' : active, color: 'from-blue-500 to-indigo-600', icon: '⚡' },
      { label: 'Pended / Snoozed', value: isLoading ? '…' : pended, color: 'from-amber-500 to-orange-600', icon: '⏳' },
      { label: 'Visible Dockets', value: isLoading ? '…' : filteredRows.length, color: 'from-emerald-500 to-teal-600', icon: '👁️' },
    ];
  }, [normalizedRows, filteredRows.length, isLoading]);

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


  if (isAccessDenied) {
    return (
      <PlatformShell title="Access restricted" subtitle="You do not have permission to view this worklist.">
        <AccessDeniedState supportContext={recovery.supportContext} />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      title={scopedWorkbasket ? `Worklist — ${scopedWorkbasket.name}` : 'My Worklist'}
      subtitle="Your personal docket workload for active execution and pended follow-up."
      actions={
        <Link to={ROUTES.CREATE_CASE(firmSlug)} className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200 rounded-lg shadow-sm hover:shadow">
          Create Docket
        </Link>
      }
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: error || (isError ? `${worklistLoadMessage}${worklistSupportCode ? ` (Ref: ${worklistSupportCode})` : ''}` : '') },
          { tone: 'success', message: success },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing worklist without interrupting your current view…' : '' },
        ]}
      />

      {/* Premium KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
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
        title="Personal Execution Queue"
        description={`${filteredRows.length} dockets in your current worklist view.`}
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
            <FilterBar onClear={clearFilters} clearDisabled={!search && statusFilter === 'ALL' && categoryFilter === 'ALL' && activeOnly}>
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 w-full">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    🔍
                  </div>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search docket number, client, assignee..."
                    className="block w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    aria-label="Search worklist"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    aria-label="Filter worklist by status"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="PENDING">Pending</option>
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
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 shadow-sm select-none cursor-pointer hover:bg-gray-50/80 active:bg-gray-100 transition-all">
                    <input
                      type="checkbox"
                      checked={activeOnly}
                      onChange={(event) => setActiveOnly(event.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500/20 cursor-pointer"
                    />
                    Active only
                  </label>
                </div>
              </div>
            </FilterBar>
          </div>
        </SectionToolbar>

        {isSupervisor && selectedIds.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl mb-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-indigo-700">
                Selected {selectedIds.length} docket{selectedIds.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-1 justify-start sm:justify-end">
              <select
                value={bulkAssigneeXid}
                onChange={(e) => setBulkAssigneeXid(e.target.value)}
                className="px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors duration-200 rounded-xl shadow disabled:opacity-50"
              >
                {bulkMoving ? 'Moving...' : 'Move to Worklist'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors ml-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Clean, professional data table wrapper */}
        <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
          <DataTable
            columns={isSupervisor ? [
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
              'Docket ID', 'Client', 'Category / Subcategory', 'Updated'
            ] : ['Docket ID', 'Client', 'Category / Subcategory', 'Updated']}
            compact
            tableClassName="w-full text-left border-collapse"
            rows={filteredRows.map((r) => {
              const rId = getDocketRouteId(r);
              return (
                <tr key={r.caseInternalId || r._id || r.id || formatDocketLabel(r)} className="hover:bg-gray-50/70 border-b border-gray-50 last:border-b-0 transition-colors duration-150">
                  {isSupervisor && (
                    <td className="platform-table-select-col">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(rId)}
                        onChange={() => handleSelectRow(rId)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500/20 cursor-pointer"
                      />
                    </td>
                  )}
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
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    <span className="text-gray-900 font-medium">{r.category || '—'}</span>
                    {r.subcategory && r.subcategory !== '-' && (
                      <span className="text-gray-400 text-xs ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded">
                        {r.subcategory}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm tabular-nums">{formatDateLabel(r.updatedAt || r.createdAt)}</td>
                </tr>
              );
            })}
            loading={isLoading}
            error=""
            onRetry={() => void refetch()}
            hasActiveFilters={Boolean(search.trim()) || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || activeOnly}
            emptyLabel={scopedWorkbasket ? `No dockets in your ${scopedWorkbasket.name} worklist.` : 'No dockets are assigned to you yet. Pull from Workbaskets or request assignment from your manager/admin.'}
            emptyLabelFiltered="No worklist dockets match your current search or filters."
          />
        </div>
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformWorklistPage;


