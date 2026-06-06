/**
 * Workbasket Page (formerly Global Worklist)
 * Displays unassigned dockets that can be pulled by users
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { TableSkeleton } from '../components/common/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/layout/StatusBadge';
import { DataTable } from '../components/common/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { useAuth } from '../hooks/useAuth';
import { worklistApi } from '../api/worklist.api';
import { categoryService } from '../services/categoryService';
import { formatDate } from '../utils/formatters';
import { useToast } from '../hooks/useToast';
import { QueueFilterBar } from '../components/common/QueueFilterBar';
import { formClasses } from '../theme/tokens';
import { useQueryState } from '../hooks/useQueryState';
import { useActiveDocket } from '../hooks/useActiveDocket';
import { ROUTES } from '../constants/routes';
import { getISODateInTimezone } from '../utils/formatDateTime';
import { caseApi } from '../api/case.api';
import { CASE_QUERY_PARAMS } from '../hooks/useCaseQuery';
import './WorkbasketPage.css';

const WORKBASKET_FILTER_DEFAULTS = {
  category: '',
  status: '',
  priority: '',
  assignedToXID: '',
  recency: '',
  createdAtFrom: '',
  createdAtTo: '',
  slaStatus: '',
  sortBy: 'slaDueDate',
  sortOrder: 'asc',
  page: 1,
  limit: 20,
};

const FILTER_KEY_BY_LABEL = {
  Category: 'category',
  Status: 'status',
  Priority: 'priority',
  Assignee: 'assignedToXID',
  Recency: 'recency',
  'Created From': 'createdAtFrom',
  'Created To': 'createdAtTo',
  SLA: 'slaStatus',
};

const SelectAllCheckbox = ({ checked, indeterminate, disabled, onChange }) => {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (!checkboxRef.current) return;
    checkboxRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label="Select all dockets"
    />
  );
};

export const WorkbasketPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { openDocket } = useActiveDocket();
  const { showSuccess, showError, showInfo } = useToast();

  const isManagerOrAdmin = ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER'].includes(String(user?.role || '').trim().toUpperCase());

  const [capacityData, setCapacityData] = useState([]);
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  const [rebalanceDockets, setRebalanceDockets] = useState([]);
  const [loadingRebalanceDockets, setLoadingRebalanceDockets] = useState(false);
  const [reassignToXID, setReassignToXID] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const loadCapacity = async () => {
    if (!activeWorkbasketId) return;
    setLoadingCapacity(true);
    try {
      const res = await api.get(`/admin/workbaskets/${activeWorkbasketId}/capacity`);
      if (res.data?.success) {
        setCapacityData(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load capacity:', e);
      showError('Failed to load teammate capacity details.');
    } finally {
      setLoadingCapacity(false);
    }
  };

  const loadRebalanceDockets = async () => {
    if (!activeWorkbasketId) return;
    setLoadingRebalanceDockets(true);
    try {
      const res = await api.get(`/admin/workbaskets/${activeWorkbasketId}/dockets`, {
        params: {
          category: filters.category,
          priority: filters.priority,
          status: filters.status,
          assignedToXID: filters.assignedToXID,
        }
      });
      if (res.data?.success) {
        setRebalanceDockets(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load rebalance dockets:', e);
      showError('Failed to load dockets for rebalancing.');
    } finally {
      setLoadingRebalanceDockets(false);
    }
  };

  const executeBulkReassign = async () => {
    if (selectedCases.length === 0) {
      showInfo('Please select at least one docket.');
      return;
    }
    if (!reassignToXID) {
      showInfo('Please select a teammate to reassign to.');
      return;
    }

    setReassigning(true);
    try {
      const res = await api.post('/admin/workbaskets/reassign', {
        caseIds: selectedCases,
        assignedToXID: reassignToXID,
      });

      if (res.data?.success) {
        showSuccess(res.data.message || 'Dockets successfully reassigned.');
        setSelectedCases([]);
        setReassignToXID('');
        await Promise.all([loadCapacity(), loadRebalanceDockets()]);
      }
    } catch (e) {
      showError(e.response?.data?.message || 'Failed to reassign dockets.');
    } finally {
      setReassigning(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'capacity') {
      loadCapacity();
    }
  }, [activeTab, activeWorkbasketId]);

  useEffect(() => {
    if (activeTab === 'capacity') {
      loadRebalanceDockets();
    }
  }, [activeTab, activeWorkbasketId, filters.category, filters.priority, filters.status, filters.assignedToXID]);
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [cases, setCases] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...WORKBASKET_FILTER_DEFAULTS }));
  const [pagination, setPagination] = useState(null);
  const [pullingCase, setPullingCase] = useState(null);
  const [selectedCases, setSelectedCases] = useState([]);
  const [bulkPulling, setBulkPulling] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('own');
  const [activeWorkbasketId, setActiveWorkbasketId] = useState('');
  const [loadError, setLoadError] = useState('');
  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = ['PRIMARY_ADMIN', 'ADMIN'].includes(normalizedRole);
  const queryClient = useQueryClient();
  const allSelected = cases.length > 0 && selectedCases.length === cases.length;
  const partiallySelected = selectedCases.length > 0 && !allSelected;
  const queryDefaults = useMemo(() => ({
    category: '',
    status: '',
    recency: '',
    createdAtFrom: '',
    createdAtTo: '',
    slaStatus: '',
    sortBy: WORKBASKET_FILTER_DEFAULTS.sortBy,
    sortOrder: WORKBASKET_FILTER_DEFAULTS.sortOrder,
    page: String(WORKBASKET_FILTER_DEFAULTS.page),
  }), []);

  const { query, setQuery } = useQueryState(queryDefaults);
  const accessibleWorkbaskets = useMemo(() => {
    const explicitWorkbaskets = Array.isArray(user?.workbaskets) ? user.workbaskets : [];
    if (explicitWorkbaskets.length > 0) {
      return explicitWorkbaskets
        .map((item) => ({
          id: String(item?.id || item?._id || '').trim(),
          name: String(item?.name || '').trim(),
        }))
        .filter((item) => item.id && item.name);
    }

    const teamIds = Array.isArray(user?.teamIds) ? user.teamIds : [];
    const teamNames = Array.isArray(user?.teamNames) ? user.teamNames : [];
    return teamIds
      .map((id, index) => ({
        id: String(id || '').trim(),
        name: String(teamNames[index] || '').trim() || `Workbasket ${index + 1}`,
      }))
      .filter((item) => item.id);
  }, [user?.workbaskets, user?.teamIds, user?.teamNames]);

  useEffect(() => {
    if (accessibleWorkbaskets.length === 0) {
      setActiveWorkbasketId('');
      return;
    }
    setActiveWorkbasketId((previous) => {
      if (previous && accessibleWorkbaskets.some((item) => item.id === previous)) return previous;
      return accessibleWorkbaskets[0].id;
    });
  }, [accessibleWorkbaskets]);

  useEffect(() => {
    loadGlobalWorklist();
  }, [filters, activeTab, activeWorkbasketId]);

  useEffect(() => {
    const nextFilters = {
      ...WORKBASKET_FILTER_DEFAULTS,
      category: query.category || '',
      status: query.status || '',
      recency: query.recency || '',
      createdAtFrom: query.createdAtFrom || '',
      createdAtTo: query.createdAtTo || '',
      slaStatus: query.slaStatus || '',
      sortBy: query.sortBy || WORKBASKET_FILTER_DEFAULTS.sortBy,
      sortOrder: query.sortOrder || WORKBASKET_FILTER_DEFAULTS.sortOrder,
      page: Number.parseInt(query.page, 10) > 0 ? Number.parseInt(query.page, 10) : WORKBASKET_FILTER_DEFAULTS.page,
    };

    setFilters((prev) => {
      const unchanged = Object.keys(nextFilters).every((key) => prev[key] === nextFilters[key]);
      return unchanged ? prev : nextFilters;
    });
  }, [query]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!isAdmin) return;
      try {
        const res = await api.get('/auth/admin/users');
        const users = Array.isArray(res.data?.data) ? res.data.data : [];
        const teamMembers = users.filter((u) => {
          const normalizedRole = String(u?.role || '').trim().toUpperCase();
          const isFirmUser = normalizedRole === 'ADMIN' || normalizedRole === 'STAFF' || normalizedRole === 'EMPLOYEE';
          const isActive = u?.isActive !== false && u?.status !== 'inactive' && u?.status !== 'deleted';
          return isFirmUser && isActive;
        });
        setAssignableUsers(teamMembers);
      } catch (e) {
        console.warn('Failed to load employees for assignment', e);
      }
    };
    loadUsers();
  }, [isAdmin]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await categoryService.getCategories(true);
        const rawCategories = response?.data || response?.categories || [];
        const names = rawCategories
          .map((item) => item?.name)
          .filter(Boolean);
        setCategories(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
      } catch (error) {
        console.warn('Failed to load categories for workbasket filters', error);
      }
    };
    loadCategories();
  }, []);

  const loadGlobalWorklist = async () => {
    if (activeTab === 'capacity') return;
    if (initialLoadComplete) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await worklistApi.getGlobalWorklist({
        ...filters,
        tab: activeTab,
        ...(activeWorkbasketId ? { workbasketId: activeWorkbasketId } : {}),
      });
      
      if (response.success) {
        setCases(response.data || []);
        setPagination(response.pagination);
        setSelectedCases([]); // Clear selection when reloading
      }
    } catch (error) {
      console.error('Failed to load workbasket:', error);
      setLoadError(error?.response?.data?.message || 'Unable to load workbasket right now.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setInitialLoadComplete(true);
    }
  };

  const handleSelectCase = (caseId) => {
    setSelectedCases(prev => 
      prev.includes(caseId) 
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCases.length === cases.length) {
      setSelectedCases([]);
    } else {
      setSelectedCases(cases.map(c => c.caseId));
    }
  };

  const handleBulkPull = async () => {
    if (!user?.xID) {
      showError('Authenticated userXID is required to pull dockets. Please log in again.');
      return;
    }

    if (selectedCases.length === 0) {
      showInfo('Please select at least one docket.');
      return;
    }

    setConfirmModal({
      type: 'bulk-pull',
      title: `Assign ${selectedCases.length} dockets?`,
      description: assignTo
        ? `This will assign ${selectedCases.length} selected docket(s) to the selected teammate.`
        : `This will move ${selectedCases.length} selected docket(s) into your worklist.`,
      confirmText: 'Assign selected dockets',
    });
  };

  const executeBulkPull = async () => {
    setConfirmModal(null);
    setBulkPulling(true);
    try {
      const response = await worklistApi.pullCases(selectedCases, assignTo || null);

      if (response.success) {
        const message = response.pulled < response.requested
          ? `${response.pulled} of ${response.requested} dockets pulled. Some were already assigned.`
          : `All ${response.pulled} dockets pulled successfully!`;
        showSuccess(message);
        loadGlobalWorklist();
      }
    } catch (error) {
      showError(error.response?.data?.message || error.message || 'Failed to pull dockets');
    } finally {
      setBulkPulling(false);
    }
  };

  const handlePullCase = async (caseId) => {
    if (!user?.xID) {
      showError('Authenticated userXID is required to pull dockets. Please log in again.');
      return;
    }

    setConfirmModal({
      type: 'single-pull',
      caseId,
      title: `Assign docket ${caseId}?`,
      description: assignTo
        ? 'This docket will be assigned to the selected teammate.'
        : 'This docket will be assigned to your worklist.',
      confirmText: 'Assign docket',
    });
  };

  const executeSinglePull = async (caseId) => {
    setConfirmModal(null);
    setPullingCase(caseId);
    try {
      const response = await worklistApi.pullCases([caseId], assignTo || null);

      if (response.success) {
        showSuccess(assignTo ? 'Docket assigned successfully.' : 'Docket pulled successfully.');
        loadGlobalWorklist();
      }
    } catch (error) {
      if (error.response?.status === 409) {
        showInfo('Docket is no longer available (already assigned).');
        loadGlobalWorklist(); // Refresh to remove it
      } else {
        showError(error.response?.data?.message || error.message || 'Failed to pull docket');
      }
    } finally {
      setPullingCase(null);
    }
  };

  const handleFilterChange = (name, value) => {
    const nextValue = value ?? '';
    setFilters((prev) => ({
      ...prev,
      [name]: nextValue,
      page: 1, // Reset to first page when filters change
    }));
    setQuery({ [name]: nextValue, page: '1' });
  };

  const handleRecencyChange = (value) => {
    const today = new Date();
    let createdAtFrom = '';
    let createdAtTo = '';
    if (value === 'today') {
      createdAtFrom = getISODateInTimezone(today);
      createdAtTo = createdAtFrom;
    }
    if (value === '7d') {
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 6);
      createdAtFrom = getISODateInTimezone(lastWeek);
      createdAtTo = getISODateInTimezone(today);
    }
    if (value === '30d') {
      const lastMonth = new Date(today);
      lastMonth.setDate(today.getDate() - 29);
      createdAtFrom = getISODateInTimezone(lastMonth);
      createdAtTo = getISODateInTimezone(today);
    }

    setFilters((prev) => ({
      ...prev,
      recency: value,
      createdAtFrom,
      createdAtTo,
      page: 1,
    }));
    setQuery({
      recency: value || null,
      createdAtFrom: createdAtFrom || null,
      createdAtTo: createdAtTo || null,
      page: '1',
    });
  };

  const activeFilters = useMemo(() => [
    ['Category', filters.category],
    ['Status', filters.status],
    ['Recency', filters.recency === '7d' ? 'Last 7 Days' : filters.recency === '30d' ? 'Last 30 Days' : filters.recency === 'today' ? 'Today' : ''],
    ['SLA', filters.slaStatus],
  ].filter(([, value]) => Boolean(value)).map(([label, value]) => ({
    key: FILTER_KEY_BY_LABEL[label],
    label,
    value,
  })), [filters]);

  const handleSort = (field, direction) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: direction,
      page: 1,
    }));
    setQuery({ sortBy: field, sortOrder: direction, page: '1' });
  };

  const getSLAStatusClass = (daysRemaining) => {
    if (daysRemaining === null || daysRemaining === undefined) return '';
    const normalizedDays = Number(daysRemaining);
    if (Number.isNaN(normalizedDays)) return '';
    if (normalizedDays < 0) return 'sla-overdue';
    if (normalizedDays <= 2) return 'sla-due-soon';
    return 'sla-on-track';
  };

  const columns = useMemo(() => ([
    {
      key: 'selection',
      header: (
        <SelectAllCheckbox
          checked={allSelected}
          indeterminate={partiallySelected}
          onChange={handleSelectAll}
          disabled={cases.length === 0}
        />
      ),
      headerClassName: 'min-w-[3rem]',
      cellClassName: 'min-w-[3rem]',
      render: (caseItem) => (
        <input
          type="checkbox"
          checked={selectedCases.includes(caseItem.caseId)}
          onChange={() => handleSelectCase(caseItem.caseId)}
          aria-label={`Select docket ${caseItem.caseId}`}
        />
      ),
    },
    {
      key: 'caseId',
      header: 'Docket#',
      sortable: true,
      headerClassName: 'min-w-[14rem] whitespace-nowrap',
      cellClassName: 'min-w-[14rem] whitespace-nowrap',
      render: (caseItem) => (
        <button
          type="button"
          className="docket-link"
          onClick={() => openDocket({ caseId: caseItem.caseId, navigate, to: ROUTES.CASE_DETAIL(firmSlug, caseItem.caseId) })}
        >
          {caseItem.caseId}
        </button>
      ),
    },
    {
      key: 'clientId',
      header: 'Client ID',
      sortable: true,
      align: 'center',
      headerClassName: 'min-w-[8rem] whitespace-nowrap',
      cellClassName: 'min-w-[8rem] whitespace-nowrap',
      render: (caseItem) => caseItem.clientId || '—',
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      headerClassName: 'min-w-[10rem] whitespace-nowrap',
      cellClassName: 'min-w-[10rem] whitespace-nowrap',
      contentClassName: 'truncate',
      render: (caseItem) => caseItem.category || '—',
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      headerClassName: 'min-w-[9rem] whitespace-nowrap',
      cellClassName: 'min-w-[9rem] whitespace-nowrap',
      render: (caseItem) => <StatusBadge status={caseItem.status} />,
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      align: 'center',
      headerClassName: 'min-w-[10rem] whitespace-nowrap',
      cellClassName: 'min-w-[10rem] whitespace-nowrap',
      render: (caseItem) => caseItem.assignedToName || caseItem.assignedToXID || 'Unassigned',
    },
    {
      key: 'slaDueDate',
      header: 'SLA Due Date',
      sortable: true,
      align: 'right',
      tabular: true,
      headerClassName: 'min-w-[10rem] whitespace-nowrap',
      cellClassName: 'min-w-[10rem] whitespace-nowrap',
      render: (caseItem) => formatDate(caseItem.slaDueDate || caseItem.slaState?.slaDueAt),
    },
    {
      key: 'slaDaysRemaining',
      header: 'SLA Days Remaining',
      align: 'right',
      tabular: true,
      headerClassName: 'min-w-[10rem] whitespace-nowrap',
      cellClassName: 'min-w-[10rem] whitespace-nowrap',
      render: (caseItem) => (
        <span className={getSLAStatusClass(caseItem.slaDaysRemaining)}>
          {caseItem.slaDaysRemaining !== null ? `${caseItem.slaDaysRemaining} days` : 'N/A'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created Date',
      sortable: true,
      align: 'right',
      tabular: true,
      headerClassName: 'min-w-[9rem] whitespace-nowrap',
      cellClassName: 'min-w-[9rem] whitespace-nowrap',
      render: (caseItem) => formatDate(caseItem.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      headerClassName: 'min-w-[10rem] whitespace-nowrap',
      cellClassName: 'min-w-[10rem] whitespace-nowrap',
      render: (caseItem) => (
        <div className="global-worklist__actions-cell">
          <Button
            variant="outline"
            size="small"
            onClick={() => openDocket({ caseId: caseItem.caseId, navigate, to: ROUTES.CASE_DETAIL(firmSlug, caseItem.caseId) })}
          >
            View
          </Button>
          <Button
            variant="outline"
            size="small"
            onClick={() => handlePullCase(caseItem.caseId)}
            disabled={pullingCase === caseItem.caseId}
          >
            {pullingCase === caseItem.caseId ? 'Pulling…' : 'Pull to My Worklist'}
          </Button>
        </div>
      ),
    },
  ]), [allSelected, partiallySelected, cases.length, selectedCases, pullingCase, firmSlug, navigate]);

  const handleSortChange = useCallback((nextSort) => {
    handleSort(nextSort.key, nextSort.direction);
  }, []);

  const handleRowHover = useCallback((caseItem) => {
    const caseId = caseItem?.caseId;
    if (!caseId || !window.matchMedia?.('(pointer:fine)').matches) return;
    queryClient.prefetchQuery({
      queryKey: ['case', caseId, CASE_QUERY_PARAMS],
      queryFn: () => caseApi.getCaseById(caseId, CASE_QUERY_PARAMS),
      staleTime: 30 * 1000,
    });
  }, [queryClient]);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...WORKBASKET_FILTER_DEFAULTS });
    setQuery({
      category: null,
      status: null,
      recency: null,
      createdAtFrom: null,
      createdAtTo: null,
      slaStatus: null,
      sortBy: WORKBASKET_FILTER_DEFAULTS.sortBy,
      sortOrder: WORKBASKET_FILTER_DEFAULTS.sortOrder,
      page: '1',
    });
  }, [setQuery]);

  const handleRemoveFilter = (key) => {
    if (key === 'recency') {
      handleRecencyChange('');
      return;
    }
    handleFilterChange(key, '');
  };

  const filterIds = {
    category: 'workbasket-filter-category',
    status: 'workbasket-filter-status',
    slaStatus: 'workbasket-filter-sla-status',
    recency: 'workbasket-filter-recency',
    assignTo: 'workbasket-assign-to',
  };

  const resultSummary = pagination
    ? `${pagination.total} dockets found. Page ${pagination.page} of ${pagination.pages}.`
    : `${cases.length} dockets loaded.`;

  if (!initialLoadComplete && loading && cases.length === 0) {
    return (
      <Layout>
        <div className="global-worklist">
          <TableSkeleton rows={10} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="global-worklist">
        <PageHeader
          title="Workbasket"
          subtitle="Operational queue for client work and internal work owned by your team."
          meta="Tasks / Workbaskets"
          actions={(
            <Button variant="primary" onClick={() => navigate(ROUTES.CREATE_CASE(firmSlug))}>
              Create Docket
            </Button>
          )}
        />
        <div className="mb-6 space-y-4">
          {/* Accessible Workbasket pills picker (if more than 1) */}
          {accessibleWorkbaskets.length === 0 ? (
            <p className="text-sm text-[var(--dt-text-muted)]">You are not linked to any workbasket yet. Ask your admin to assign you to a workbasket.</p>
          ) : null}
          {accessibleWorkbaskets.length === 1 ? (
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
              Workbasket Context: <span className="text-indigo-600 font-bold">{accessibleWorkbaskets[0].name}</span>
            </p>
          ) : null}
          {accessibleWorkbaskets.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Available Workbaskets:</span>
              {accessibleWorkbaskets.map((workbasket) => (
                <button
                  type="button"
                  key={workbasket.id}
                  onClick={() => { setActiveWorkbasketId(workbasket.id); setFilters((prev) => ({ ...prev, page: 1 })); }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold border transition-all ${
                    activeWorkbasketId === workbasket.id
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-black shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {workbasket.name}
                </button>
              ))}
            </div>
          )}

          {/* Sleek Segmented Control Tabs for "My Team WB" vs "Routed to My Team" vs "Capacity & Rebalancing" */}
          {accessibleWorkbaskets.length > 0 && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex bg-slate-100/80 p-1 rounded-xl w-fit border border-slate-200/40">
                <button
                  type="button"
                  onClick={() => setActiveTab('own')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'own'
                      ? 'bg-white text-indigo-600 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  My Team WB
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('routed')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'routed'
                      ? 'bg-white text-indigo-600 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Routed to My Team
                </button>
                {isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => { setActiveTab('capacity'); setSelectedCases([]); }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      activeTab === 'capacity'
                        ? 'bg-white text-indigo-600 shadow-sm font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Capacity & Rebalancing
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {loadError ? (
          <Card className="mb-4 border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{loadError}</p>
          </Card>
        ) : null}
        {activeTab === 'capacity' && (
          <div className="mb-8 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Teammate Active Capacity</h3>
              <span className="text-xs text-slate-500 italic">Scores exclude pended/blocked work.</span>
            </div>
            {loadingCapacity ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-slate-50 border border-slate-200/60 rounded-2xl h-44" />
                ))}
              </div>
            ) : capacityData.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No teammates assigned to this workbasket.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {capacityData.map((member) => {
                  let scoreColor = 'bg-emerald-50 border-emerald-200 text-emerald-700';
                  let scoreLabel = 'Light Load';
                  if (member.loadScore > 30) {
                    scoreColor = 'bg-rose-50 border-rose-200 text-rose-700 font-black animate-pulse';
                    scoreLabel = 'Overloaded';
                  } else if (member.loadScore > 15) {
                    scoreColor = 'bg-amber-50 border-amber-200 text-amber-700 font-bold';
                    scoreLabel = 'Heavy Load';
                  } else if (member.loadScore > 5) {
                    scoreColor = 'bg-blue-50 border-blue-200 text-blue-700';
                    scoreLabel = 'Moderate';
                  }
                  
                  const isFiltered = filters.assignedToXID === member.xID;

                  return (
                    <div 
                      key={member.xID} 
                      className={`rounded-2xl border p-4.5 transition-all shadow-sm flex flex-col justify-between ${
                        isFiltered 
                          ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-300' 
                          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3.5">
                          <div>
                            <h4 className="font-black text-slate-800 text-sm">{member.name}</h4>
                            <p className="text-xs text-slate-500 font-bold flex items-center gap-1">
                              <span className="uppercase">{member.role}</span> · {member.xID}
                            </p>
                          </div>
                          <div className={`rounded-xl px-2.5 py-1 text-2xs font-extrabold border uppercase tracking-wider flex flex-col items-center shrink-0 ${scoreColor}`}>
                            <span className="text-xs font-black tracking-tight">{member.loadScore}</span>
                            <span>{scoreLabel}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/30 text-center mb-4">
                          <div>
                            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Active</p>
                            <p className="text-sm font-black text-slate-700">{member.loadSummary.totalActiveDockets}</p>
                          </div>
                          <div>
                            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Overdue</p>
                            <p className={`text-sm font-black ${member.loadSummary.overdue > 0 ? 'text-rose-600 font-black' : 'text-slate-700'}`}>
                              {member.loadSummary.overdue}
                            </p>
                          </div>
                          <div>
                            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Blocked</p>
                            <p className={`text-sm font-black ${member.loadSummary.blocked > 0 ? 'text-amber-600 font-black' : 'text-slate-700'}`}>
                              {member.loadSummary.blocked}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => {
                            handleFilterChange('assignedToXID', isFiltered ? '' : member.xID);
                          }}
                          className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                            isFiltered
                              ? 'bg-indigo-600 border-indigo-600 text-white font-extrabold shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {isFiltered ? 'Showing Caseload' : 'Filter Caseload'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Card>
          {activeTab === 'capacity' ? (
            <QueueFilterBar className="mb-6" onClear={handleResetFilters} clearDisabled={activeFilters.length === 0}>
              <div className="filter-group w-full sm:w-[200px] shrink-0">
                <label htmlFor="rebalance-category" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                <select
                  id="rebalance-category"
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className={formClasses.inputBase}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group w-full sm:w-[180px] shrink-0">
                <label htmlFor="rebalance-status" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                <select id="rebalance-status" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className={formClasses.inputBase}>
                  <option value="">All statuses</option>
                  <option value="UNASSIGNED">Unassigned</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="PENDING">Pending</option>
                  <option value="QC_PENDING">Ready for Review</option>
                </select>
              </div>
              <div className="filter-group w-full sm:w-[150px] shrink-0">
                <label htmlFor="rebalance-priority" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Urgency</label>
                <select id="rebalance-priority" value={filters.priority} onChange={(e) => handleFilterChange('priority', e.target.value)} className={formClasses.inputBase}>
                  <option value="">All urgencies</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="filter-group w-full sm:w-[200px] shrink-0">
                <label htmlFor="rebalance-assignee" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Owner</label>
                <select id="rebalance-assignee" value={filters.assignedToXID} onChange={(e) => handleFilterChange('assignedToXID', e.target.value)} className={formClasses.inputBase}>
                  <option value="">All owners</option>
                  <option value="unassigned">Unassigned</option>
                  {capacityData.map((member) => (
                    <option key={member.xID} value={member.xID}>{member.name} ({member.xID})</option>
                  ))}
                </select>
              </div>
            </QueueFilterBar>
          ) : (
            <QueueFilterBar className="mb-6" onClear={handleResetFilters} clearDisabled={activeFilters.length === 0}>
              <div className="filter-group w-full sm:w-[200px] shrink-0">
                <label htmlFor={filterIds.category} className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                <select
                  id={filterIds.category}
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className={formClasses.inputBase}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group w-full sm:w-[180px] shrink-0">
                <label htmlFor={filterIds.status} className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                <select id={filterIds.status} value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className={formClasses.inputBase}>
                  <option value="">All statuses</option>
                  <option value="UNASSIGNED">Unassigned</option>
                  <option value="OPEN">Open</option>
                  <option value="ROUTED">Routed</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="PENDING">Pending</option>
                  <option value="RETURNED">Returned</option>
                  <option value="FILED">Filed</option>
                </select>
              </div>
              <div className="filter-group w-full sm:w-[180px] shrink-0">
                <label htmlFor={filterIds.slaStatus} className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SLA Status</label>
                <select
                  id={filterIds.slaStatus}
                  value={filters.slaStatus}
                  onChange={(e) => handleFilterChange('slaStatus', e.target.value)}
                  className={formClasses.inputBase}
                >
                  <option value="">All</option>
                  <option value="overdue">Overdue</option>
                  <option value="due_soon">Due Soon (2 days)</option>
                  <option value="on_track">On Track</option>
                </select>
              </div>
              <div className="filter-group w-full sm:w-[180px] shrink-0">
                <label htmlFor={filterIds.recency} className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Created</label>
                <select id={filterIds.recency} value={filters.recency} onChange={(e) => handleRecencyChange(e.target.value)} className={formClasses.inputBase}>
                  <option value="">All time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </div>
            </QueueFilterBar>
          )}

          <div className="sr-only" role="status" aria-live="polite">
            {resultSummary}
          </div>

          {/* Reassign Actions Bar — only shown in capacity tab when dockets are selected */}
          {selectedCases.length > 0 && activeTab === 'capacity' && (
            <div className="bg-indigo-50/80 backdrop-blur border border-indigo-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 mb-4 shadow-sm transition-all duration-200 animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="small"
                  onClick={executeBulkReassign}
                  disabled={reassigning || !reassignToXID}
                  allowUnsafeClassName={true}
                  className="!min-h-9 text-xs font-bold"
                >
                  {reassigning ? 'Reassigning...' : `Reassign ${selectedCases.length} Selected`}
                </Button>
                <span className="text-xs font-bold text-indigo-900/60">
                  {selectedCases.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="bulk-reassign-target" className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Transfer to Teammate:</label>
                <select 
                  id="bulk-reassign-target" 
                  value={reassignToXID} 
                  onChange={(e) => setReassignToXID(e.target.value)} 
                  className={`${formClasses.inputBase} !py-1 !px-2.5 !min-h-9 text-xs bg-white w-[200px]`}
                >
                  <option value="">Select Teammate</option>
                  {capacityData.map((member) => (
                    <option key={member.xID} value={member.xID}>{member.name} ({member.xID})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Bulk Actions Toolbar — only shown in unassigned view when rows are selected */}
          {selectedCases.length > 0 && activeTab !== 'capacity' && (
            <div className="bg-indigo-50/80 backdrop-blur border border-indigo-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 mb-4 shadow-sm transition-all duration-200 animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="small"
                  onClick={handleBulkPull}
                  disabled={bulkPulling}
                  allowUnsafeClassName={true}
                  className="!min-h-9 text-xs font-bold border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
                >
                  {bulkPulling ? 'Assigning...' : `Assign ${selectedCases.length} docket${selectedCases.length === 1 ? '' : 's'}`}
                </Button>
                <span className="text-xs font-bold text-indigo-900/60">
                  {selectedCases.length} of {cases.length} selected
                </span>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <label htmlFor={filterIds.assignTo} className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Assign to:</label>
                  <select 
                    id={filterIds.assignTo} 
                    value={assignTo} 
                    onChange={(e) => setAssignTo(e.target.value)} 
                    className={`${formClasses.inputBase} !py-1 !px-2.5 !min-h-9 text-xs bg-white`}
                  >
                    <option value="">My Worklist</option>
                    {assignableUsers.map((member) => (
                      <option key={member._id} value={member._id}>{member.name || member.xID}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {activeTab === 'capacity' ? (
            <DataTable
              columns={columns.filter(c => c.key !== 'actions')}
              rows={rebalanceDockets}
              rowKey="caseId"
              onRowHover={handleRowHover}
              sortState={{ key: filters.sortBy, direction: filters.sortOrder }}
              onSortChange={handleSortChange}
              activeFilters={activeFilters}
              onRemoveFilter={handleRemoveFilter}
              onResetFilters={handleResetFilters}
              loading={loadingRebalanceDockets}
              loadingMessage="Loading workbasket caseload details for rebalancing…"
              emptyMessage={(
                <EmptyState
                  title="No dockets found"
                  description="No assigned or active dockets exist in this workbasket queue right now."
                />
              )}
              emptyFilteredMessage={
                <EmptyState
                  title="No dockets matching filters"
                  description="Adjust rebalancing filters or clear all to view workbasket dockets."
                />
              }
            />
          ) : (
            <DataTable
              columns={columns}
              rows={cases}
              rowKey="caseId"
              onRowHover={handleRowHover}
              sortState={{ key: filters.sortBy, direction: filters.sortOrder }}
              onSortChange={handleSortChange}
              activeFilters={activeFilters}
              onRemoveFilter={handleRemoveFilter}
              onResetFilters={handleResetFilters}
              loading={loading}
              loadingMessage={accessibleWorkbaskets.length === 0 ? 'Loading linked workbaskets…' : 'Loading selected workbasket…'}
              refreshing={isRefreshing && !loading}
              refreshingMessage="Refreshing workbasket in the background…"
              emptyMessage={(
                <EmptyState
                  title={accessibleWorkbaskets.length === 0 ? 'No linked workbasket' : 'No dockets in selected workbasket'}
                  description={accessibleWorkbaskets.length === 0 ? 'You are not linked to any workbasket yet. Ask your admin to assign you to a workbasket.' : 'New unassigned dockets will appear here as soon as they enter the selected shared queue.'}
                  actionLabel={isAdmin ? 'Create Docket' : undefined}
                  onAction={isAdmin ? () => navigate(ROUTES.CREATE_CASE(firmSlug)) : undefined}
                />
              )}
              emptyFilteredMessage={
                <EmptyState
                  title="No dockets match these filters"
                  description="Adjust filters or clear all to view available dockets in this workbasket."
                />
              }
              pagination={pagination && pagination.pages > 1 ? {
                page: pagination.page,
                pages: pagination.pages,
                total: pagination.total,
                onPageChange: (nextPage) => {
                  setFilters((prev) => ({ ...prev, page: nextPage }));
                  setQuery({ page: String(nextPage) });
                },
              } : null}
            />
          )}
        </Card>
      </div>
      <ActionConfirmModal
        isOpen={Boolean(confirmModal)}
        title={confirmModal?.title || 'Confirm action'}
        description={confirmModal?.description}
        confirmText={confirmModal?.confirmText || 'Confirm'}
        cancelText="Cancel"
        loading={bulkPulling || Boolean(pullingCase)}
        onCancel={() => setConfirmModal(null)}
        onConfirm={() => {
          if (confirmModal?.type === 'bulk-pull') {
            executeBulkPull();
            return;
          }
          if (confirmModal?.type === 'single-pull' && confirmModal?.caseId) {
            executeSinglePull(confirmModal.caseId);
          }
        }}
      />
    </Layout>
  );
};
