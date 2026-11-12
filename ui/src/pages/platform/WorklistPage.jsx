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
        item.title,
        item.caseName,
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
      title="My Worklist"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-medium text-slate-700 transition-colors shadow-xs disabled:opacity-50"
            title="Refresh worklist"
            aria-label="Refresh worklist"
          >
            <svg
              className={`w-3.5 h-3.5 text-slate-500 ${isFetching ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
            </svg>
            <span>{isFetching ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <Link
            to={ROUTES.CREATE_CASE(firmSlug)}
            data-primary="true"
            className="action-primary inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-xs transition-colors"
          >
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
          <FilterBar onClear={clearFilters} clearDisabled={!search && statusFilter === 'ALL' && categoryFilter === 'ALL' && activeOnly}>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter dockets…"
              aria-label="Filter worklist"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 shadow-xs select-none cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500/20 cursor-pointer"
              />
              Active only
            </label>
          </FilterBar>
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
              { key: 'clientName', label: 'Client Name', sortable: true, width: '170px' },
              { key: 'category', label: 'Category', sortable: true, width: '180px' },
              { key: 'slaDue', label: 'SLA Due', sortable: true, width: '120px' },
              { key: 'slaDays', label: 'SLA Days', sortable: true, width: '110px' },
              { key: 'updated', label: 'Updated', sortable: true, width: '110px' }
            ] : [
              { key: 'docketId', label: 'Docket ID', sortable: true, width: '150px' },
              { key: 'clientId', label: 'Client ID', sortable: true, width: '100px' },
              { key: 'clientName', label: 'Client Name', sortable: true, width: '170px' },
              { key: 'category', label: 'Category', sortable: true, width: '180px' },
              { key: 'slaDue', label: 'SLA Due', sortable: true, width: '120px' },
              { key: 'slaDays', label: 'SLA Days', sortable: true, width: '110px' },
              { key: 'updated', label: 'Updated', sortable: true, width: '110px' }
            ]}
            compact
            tableClassName="w-full text-left border-collapse"
            sortState={sortState}
            onSortChange={setSortState}
            rows={sortedRows.map((r) => {
              const rId = getDocketRouteId(r);
              return (
                <tr key={r.caseInternalId || r._id || r.id || formatDocketLabel(r)} className="hover:bg-slate-50/80 border-b border-slate-100 last:border-b-0 transition-colors">
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
                  <td className="px-3.5 py-2.5 font-medium text-slate-900">
                    <button
                      className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors duration-150 font-mono text-xs"
                      type="button"
                      onClick={() => openFromQueue(r)}
                    >
                      {formatDocketLabel(r)}
                    </button>
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-500 text-xs font-mono">{r.clientId || '—'}</td>
                  <td className="px-3.5 py-2.5 text-slate-900 font-medium text-xs">{r.clientName || '—'}</td>
                  <td className="px-3.5 py-2.5 text-slate-600 text-xs">
                    <span className="text-slate-900 font-medium">{r.category || '—'}</span>
                    {r.subcategory && r.subcategory !== '-' && (
                      <span className="text-slate-500 text-[11px] ml-1.5 px-1.5 py-0.5 bg-slate-100 rounded">
                        {r.subcategory}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-500 text-xs font-medium">{r.slaDueAt ? formatDateLabel(r.slaDueAt) : '—'}</td>
                  <td className="px-3.5 py-2.5 text-xs font-medium">{formatSlaDays(r.slaDueAt)}</td>
                  <td className="px-3.5 py-2.5 text-slate-400 text-xs tabular-nums">{formatDateLabel(r.updatedAt || r.createdAt)}</td>
                </tr>
              );
            })}
            loading={isLoading}
            error=""
            onRetry={() => void refetch()}
            hasActiveFilters={Boolean(search.trim()) || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || activeOnly}
            emptyLabel={scopedWorkbasket ? `No dockets in your ${scopedWorkbasket.name} worklist.` : 'No dockets are assigned to you yet.'}
            emptyBody={scopedWorkbasket ? 'New dockets routed to this workbasket will appear here.' : 'Pull dockets from Workbaskets or create a new docket.'}
            emptyLabelFiltered="No worklist dockets match your filters."
            emptyActionLabel={Boolean(search.trim()) || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || activeOnly ? 'Clear filters' : '+ New docket'}
            onEmptyAction={Boolean(search.trim()) || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || activeOnly ? clearFilters : undefined}
            emptyActionHref={Boolean(search.trim()) || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || activeOnly ? undefined : ROUTES.CREATE_CASE(firmSlug)}
          />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformWorklistPage;


