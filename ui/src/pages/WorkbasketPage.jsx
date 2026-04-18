/**
 * Workbasket Page (formerly Global Worklist)
 * Displays unassigned dockets that can be pulled by users
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { formClasses } from '../theme/tokens';
import { useQueryState } from '../hooks/useQueryState';
import { useActiveDocket } from '../hooks/useActiveDocket';
import { ROUTES } from '../constants/routes';
import { getISODateInTimezone } from '../utils/formatDateTime';
import './WorkbasketPage.css';

const WORKBASKET_FILTER_DEFAULTS = {
  category: '',
  status: '',
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
  
  const [loading, setLoading] = useState(true);
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
  const isAdmin = ['ADMIN', 'Admin'].includes(user?.role);
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
    setLoading(true);
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
    } finally {
      setLoading(false);
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
      showError('Authenticated userXID is required to pull cases. Please log in again.');
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
            {pullingCase === caseItem.caseId ? 'Assigning...' : 'Assign'}
          </Button>
        </div>
      ),
    },
  ]), [allSelected, partiallySelected, cases.length, selectedCases, pullingCase, firmSlug, navigate]);

  const handleSortChange = useCallback((nextSort) => {
    handleSort(nextSort.key, nextSort.direction);
  }, []);

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
        <div className="workbasket-tabs">
          {accessibleWorkbaskets.length > 1 && accessibleWorkbaskets.map((workbasket) => (
            <Button
              key={workbasket.id}
              variant={activeWorkbasketId === workbasket.id ? 'primary' : 'secondary'}
              onClick={() => setActiveWorkbasketId(workbasket.id)}
            >
              {workbasket.name}
            </Button>
          ))}
          <Button variant={activeTab === 'own' ? 'primary' : 'secondary'} onClick={() => setActiveTab('own')}>
            My Team WB
          </Button>
          <Button variant={activeTab === 'routed' ? 'primary' : 'secondary'} onClick={() => setActiveTab('routed')}>
            Routed to My Team
          </Button>
        </div>
        <Card>
          <form className="global-worklist__filters" role="search" aria-label="Workbasket filters">
            <div className="filter-group">
              <label htmlFor={filterIds.category}>Category</label>
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
            <div className="filter-group">
              <label htmlFor={filterIds.status}>Status</label>
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
            <div className="filter-group">
              <label htmlFor={filterIds.slaStatus}>SLA Status</label>
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
            <div className="filter-group">
              <label htmlFor={filterIds.recency}>Created</label>
              <select id={filterIds.recency} value={filters.recency} onChange={(e) => handleRecencyChange(e.target.value)} className={formClasses.inputBase}>
                <option value="">All time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
            <div className="filter-group">
              <Button
                variant="outline"
                type="button"
                onClick={handleResetFilters}
              >
                Clear Filters
              </Button>
            </div>
          </form>

          <div className="sr-only" role="status" aria-live="polite">
            {resultSummary}
          </div>

          {/* Bulk Actions Toolbar — only shown when rows are selected */}
          {selectedCases.length > 0 && (
            <div className="global-worklist__bulk-bar">
              <Button
                variant="outline"
                onClick={handleBulkPull}
                disabled={bulkPulling}
              >
                {bulkPulling ? 'Assigning...' : `Assign ${selectedCases.length} docket${selectedCases.length === 1 ? '' : 's'}`}
              </Button>
              <span className="text-secondary">
                {selectedCases.length} of {cases.length} selected
              </span>
              {isAdmin && (
                <>
                  <label htmlFor={filterIds.assignTo}>Assign to:</label>
                  <select id={filterIds.assignTo} value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className={formClasses.inputBase}>
                    <option value="">My Worklist</option>
                    {assignableUsers.map((member) => (
                      <option key={member._id} value={member._id}>{member.name || member.xID}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}

          <DataTable
            columns={columns}
            rows={cases}
            rowKey="caseId"
            sortState={{ key: filters.sortBy, direction: filters.sortOrder }}
            onSortChange={handleSortChange}
            activeFilters={activeFilters}
            onRemoveFilter={handleRemoveFilter}
            onResetFilters={handleResetFilters}
            loading={loading}
            loadingMessage="Loading workbasket..."
            emptyMessage={(
              <EmptyState
                title="No dockets in backlog"
                description="New unassigned dockets will appear here as soon as they enter the shared queue."
                actionLabel={isAdmin ? 'Create Docket' : undefined}
                onAction={isAdmin ? () => navigate(ROUTES.CREATE_CASE(firmSlug)) : undefined}
              />
            )}
          />

          {pagination && pagination.pages > 1 && (
            <div className="global-worklist__pagination">
              <Button
                variant="outline"
                disabled={pagination.page === 1}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, page: pagination.page - 1 }));
                  setQuery({ page: String(pagination.page - 1) });
                }}
              >
                Previous
              </Button>
              <span>
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <Button
                variant="outline"
                disabled={pagination.page === pagination.pages}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, page: pagination.page + 1 }));
                  setQuery({ page: String(pagination.page + 1) });
                }}
              >
                Next
              </Button>
            </div>
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
