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
  StatRow,
  StatusMessageStack,
  formatDateLabel,
  formatDocketLabel,
  getDocketRouteId,
  toArray,
} from './PlatformShared';
import { AccessDeniedState } from '../../components/feedback/AccessDeniedState';
import { getRecoveryPayload } from '../../utils/errorRecovery';
import { usePlatformMyWorklistQuery, usePlatformWorkloadIntelligenceQuery } from '../../hooks/usePlatformDataQueries';
import {
  AssigneeIntelligencePanel,
  enrichAssignableUsersWithIntelligence,
  getAssigneeOptionLabel,
} from '../../components/docket/AssigneeIntelligence';

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
  const searchParams = useMemo(() => new URLSearchParams(location.search || ''), [location.search]);

  const scopedWorkbasketId = searchParams.get('workbasketId') || '';
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
        const response = await adminApi.getUsers({ limit: 1000 });
        if (response.success && Array.isArray(response.data)) {
          const role = String(user?.role || '').trim().toUpperCase();
          let filtered = response.data.filter(u => u.isActive);
          
          if (scopedWorkbasketId) {
            filtered = filtered.filter(u => 
              String(u.teamId || '') === String(scopedWorkbasketId) ||
              (Array.isArray(u.teamIds) && u.teamIds.map(id => String(id)).includes(String(scopedWorkbasketId)))
            );
          }
          
          if (role === 'MANAGER') {
            filtered = filtered.filter(u => 
              String(u.managerId) === String(user.id || user._id) || 
              String(u.reportsToUserId) === String(user.id || user._id) || 
              u.xID === user.xID
            );
          }
          setAssignableUsers(filtered);
        }
      } catch (err) {
        console.error('Failed to load assignable users', err);
      } finally {
        setUsersLoading(false);
      }
    };
    void fetchUsers();
  }, [isSupervisor, user, scopedWorkbasketId]);

  const [sortState, setSortState] = useState({ key: '', direction: 'asc' });

  useEffect(() => {
    setSelectedIds([]);
    setSuccess('');
    setBulkAssigneeXid('');
    setError('');
    setSortState({ key: '', direction: 'asc' });
  }, [scopedWorkbasketId]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(sortedRows.map(r => getDocketRouteId(r)).filter(Boolean));
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

  const queryStatus = useMemo(() => {
    if (activeOnly) {
      return 'ASSIGNED,IN_PROGRESS,OPEN';
    }
    return 'ASSIGNED,IN_PROGRESS,OPEN,PENDING';
  }, [activeOnly]);

  const {
    data: rows = [],
    isLoading,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = usePlatformMyWorklistQuery({
    workbasketId: scopedWorkbasketId || undefined,
    status: queryStatus,
  });

  useEffect(() => {
    const refreshToken = searchParams.get('refresh');
    if (!refreshToken) return;

    void refetch();

    const nextParams = new URLSearchParams(location.search || '');
    nextParams.delete('refresh');
    const nextSearch = nextParams.toString();
    navigate(
      `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
      { replace: true }
    );
  }, [searchParams, refetch, navigate, location.pathname, location.search]);

  const {
    data: workloadData = {},
    isLoading: workloadLoading,
    isError: workloadError,
  } = usePlatformWorkloadIntelligenceQuery({ workbasketId: scopedWorkbasketId || undefined }, { enabled: isSupervisor });

  const recovery = getRecoveryPayload(queryError, 'platform_queue');
  const isAccessDenied = isError && recovery.reasonCode === 'CASE_ACCESS_DENIED';
  const worklistLoadMessage = 'We couldn’t load your assigned dockets. Refresh the page or contact your admin if this continues.';
  const worklistSupportCode = recovery.supportContext?.requestId || recovery.reasonCode || '';

  const normalizedRows = useMemo(() => {
    const safeRows = toArray(rows);
    if (!scopedWorkbasketId) return safeRows;
    const pickId = (item) => String(item?.workbasketId || item?.workbasket?._id || item?.workbasket?.id || item?.workbasket?.workbasketId || item?.workBasketId || item?.queueId || item?.assignedWorkbasketId || item?.assignment?.workbasketId || item?.meta?.workbasketId || '');
    return safeRows.filter((item) => pickId(item) === scopedWorkbasketId);
  }, [rows, scopedWorkbasketId]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return normalizedRows.filter((item) => {
      const status = String(item.status || '').toUpperCase();

      // Hide PENDING, FILED, and RESOLVED if activeOnly is enabled
      const isPendingOrTerminal = ['PENDING', 'FILED', 'RESOLVED', 'FILED_LEGACY'].includes(status);
      const activeStatus = (activeOnly && isPendingOrTerminal) ? false : true;

      const matchesCategory = categoryFilter === 'ALL' || String(item.category || '') === categoryFilter;
      const matchesQuery = !needle || [
        formatDocketLabel(item),
        item.clientName,
        item.clientId,
        item.category,
        item.subcategory,
        item.assigneeName,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
      return activeStatus && matchesCategory && matchesQuery;
    });
  }, [normalizedRows, search, categoryFilter, activeOnly]);

  const sortedRows = useMemo(() => {
    if (!sortState.key) return filteredRows;

    const getSortValue = (row, key) => {
      switch (key) {
        case 'docketId':
          return formatDocketLabel(row);
        case 'clientId':
          return row.clientId || '';
        case 'clientName':
          return row.clientName || '';
        case 'category':
          return row.category || '';
        case 'slaDue':
        case 'slaDays':
          return row.slaDueAt ? new Date(row.slaDueAt).getTime() : 0;
        case 'updated':
          return new Date(row.updatedAt || row.createdAt || 0).getTime();
        default:
          return '';
      }
    };

    const sorted = [...filteredRows].sort((a, b) => {
      const valA = getSortValue(a, sortState.key);
      const valB = getSortValue(b, sortState.key);

      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      }
      return (valA || 0) - (valB || 0);
    });

    return sortState.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredRows, sortState]);

  const categories = useMemo(() => [...new Set(normalizedRows.map((item) => String(item.category || '').trim()).filter(Boolean))], [normalizedRows]);

  const intelligenceAssignees = useMemo(
    () => enrichAssignableUsersWithIntelligence(assignableUsers, workloadData),
    [assignableUsers, workloadData]
  );
  
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
      state: buildQueueContext({ rows: sortedRows, rowId, location, origin: 'my-worklist' }),
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
      moduleLabel="Queues"
      title={scopedWorkbasket ? `Worklist — ${scopedWorkbasket.name}` : 'My Worklist'}
      subtitle="Active queue."
      actions={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 active:bg-gray-100 text-sm font-semibold text-gray-700 transition-all shadow-sm disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 text-gray-500 ${isFetching ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
            </svg>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link to={ROUTES.CREATE_CASE(firmSlug)} className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200 rounded-lg shadow-sm hover:shadow">
            New docket
          </Link>
        </div>
      }
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: error || (isError ? `${worklistLoadMessage}${worklistSupportCode ? ` (Ref: ${worklistSupportCode})` : ''}` : '') },
          { tone: 'success', message: success },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing worklist without interrupting your current view…' : '' },
        ]}
      />

      <PageSection>
        <SectionToolbar>
          <div className="w-full bg-gray-50/50 border border-gray-100/80 rounded-2xl p-4 mb-6 shadow-inner">
            <FilterBar onClear={clearFilters} clearDisabled={!search && statusFilter === 'ALL' && categoryFilter === 'ALL' && activeOnly}>
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 w-full">
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
                    placeholder="Search docket number, client, assignee..."
                    className="block w-full pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    style={{ paddingLeft: '40px' }}
                    aria-label="Search worklist"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
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
                    Show active dockets only
                  </label>
                </div>
              </div>
            </FilterBar>
          </div>
        </SectionToolbar>

        {isSupervisor && selectedIds.length > 0 && (
          <div className="wb-bulk-bar">
            <span className="wb-bulk-bar__count">
              {selectedIds.length} docket{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="wb-bulk-bar__actions">
              <select
                value={bulkAssigneeXid}
                onChange={(e) => setBulkAssigneeXid(e.target.value)}
                className="filter-bar__select"
              >
                <option value="">Select Assignee...</option>
                {intelligenceAssignees.map((u) => (
                  <option key={u.xID} value={u.xID}>{getAssigneeOptionLabel(u)}</option>
                ))}
              </select>
              <AssigneeIntelligencePanel
                assignees={intelligenceAssignees}
                selectedXid={bulkAssigneeXid}
                loading={usersLoading || workloadLoading}
                error={workloadError}
              />
              <button
                type="button"
                onClick={handleBulkMove}
                disabled={!bulkAssigneeXid || bulkMoving}
                className="action-primary wb-bulk-bar__btn"
              >
                {bulkMoving ? 'Moving…' : 'Move to Worklist'}
              </button>
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
            columns={isSupervisor ? [
              {
                key: 'select',
                label: (
                  <input
                    type="checkbox"
                    checked={selectedIds.length === sortedRows.length && sortedRows.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500/20 cursor-pointer"
                  />
                ),
                widthClass: 'platform-table-select-col',
                width: '40px'
              },
              { key: 'docketId', label: 'Docket ID', sortable: true, width: '150px' },
              { key: 'clientId', label: 'Client ID', sortable: true, width: '100px' },
              { key: 'clientName', label: 'Client Name', sortable: true, width: '160px' },
              { key: 'category', label: 'Category / Subcategory', sortable: true, width: '260px' },
              { key: 'slaDue', label: 'SLA Due', sortable: true, width: '130px' },
              { key: 'slaDays', label: 'SLA Days', sortable: true, width: '110px' },
              { key: 'updated', label: 'Updated', sortable: true, width: '120px' }
            ] : [
              { key: 'docketId', label: 'Docket ID', sortable: true, width: '150px' },
              { key: 'clientId', label: 'Client ID', sortable: true, width: '100px' },
              { key: 'clientName', label: 'Client Name', sortable: true, width: '160px' },
              { key: 'category', label: 'Category / Subcategory', sortable: true, width: '260px' },
              { key: 'slaDue', label: 'SLA Due', sortable: true, width: '130px' },
              { key: 'slaDays', label: 'SLA Days', sortable: true, width: '110px' },
              { key: 'updated', label: 'Updated', sortable: true, width: '120px' }
            ]}
            compact
            tableClassName="w-full text-left border-collapse"
            sortState={sortState}
            onSortChange={setSortState}
            rows={sortedRows.map((r) => {
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


