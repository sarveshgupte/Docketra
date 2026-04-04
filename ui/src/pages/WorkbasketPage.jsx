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
import { Loading } from '../components/common/Loading';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/layout/StatusBadge';
import { DataTable } from '../components/layout/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { useAuth } from '../hooks/useAuth';
import { worklistApi } from '../api/worklist.api';
import { formatDate } from '../utils/formatters';
import { useToast } from '../hooks/useToast';
import { formClasses } from '../theme/tokens';
import { useQueryState } from '../hooks/useQueryState';
import { ROUTES } from '../constants/routes';
import './WorkbasketPage.css';

const WORKBASKET_FILTER_DEFAULTS = {
  clientId: '',
  category: '',
  createdAtFrom: '',
  createdAtTo: '',
  slaStatus: '',
  assignedUser: '',
  dueDate: '',
  status: '',
  sortBy: 'slaDueDate',
  sortOrder: 'asc',
  page: 1,
  limit: 20,
};

const FILTER_KEY_BY_LABEL = {
  'Client ID': 'clientId',
  Category: 'category',
  'Created From': 'createdAtFrom',
  'Created To': 'createdAtTo',
  'Assigned User': 'assignedUser',
  'Due Date': 'dueDate',
  Status: 'status',
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
  const { showSuccess, showError, showInfo } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [cases, setCases] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...WORKBASKET_FILTER_DEFAULTS }));
  const [pagination, setPagination] = useState(null);
  const [pullingCase, setPullingCase] = useState(null);
  const [selectedCases, setSelectedCases] = useState([]);
  const [bulkPulling, setBulkPulling] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const isAdmin = ['ADMIN', 'Admin'].includes(user?.role);
  const allSelected = cases.length > 0 && selectedCases.length === cases.length;
  const partiallySelected = selectedCases.length > 0 && !allSelected;
  const { query, setQuery } = useQueryState({
    clientId: '',
    category: '',
    createdAtFrom: '',
    createdAtTo: '',
    slaStatus: '',
    assignedUser: '',
    dueDate: '',
    status: '',
    sortBy: WORKBASKET_FILTER_DEFAULTS.sortBy,
    sortOrder: WORKBASKET_FILTER_DEFAULTS.sortOrder,
    page: String(WORKBASKET_FILTER_DEFAULTS.page),
  });

  useEffect(() => {
    loadGlobalWorklist();
  }, [filters]);

  useEffect(() => {
    setFilters({
      ...WORKBASKET_FILTER_DEFAULTS,
      clientId: query.clientId || '',
      category: query.category || '',
      createdAtFrom: query.createdAtFrom || '',
      createdAtTo: query.createdAtTo || '',
      slaStatus: query.slaStatus || '',
      assignedUser: query.assignedUser || '',
      dueDate: query.dueDate || '',
      status: query.status || '',
      sortBy: query.sortBy || WORKBASKET_FILTER_DEFAULTS.sortBy,
      sortOrder: query.sortOrder || WORKBASKET_FILTER_DEFAULTS.sortOrder,
      page: Number.parseInt(query.page, 10) > 0 ? Number.parseInt(query.page, 10) : WORKBASKET_FILTER_DEFAULTS.page,
    });
  }, [query]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!isAdmin) return;
      try {
        const res = await api.get('/auth/admin/users');
        setEmployees((res.data?.data || []).filter((u) => u.role === 'Employee'));
      } catch (e) {
        console.warn('Failed to load employees for assignment', e);
      }
    };
    loadUsers();
  }, [isAdmin]);

  const loadGlobalWorklist = async () => {
    setLoading(true);
    try {
      const response = await worklistApi.getGlobalWorklist(filters);
      
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
        showInfo(message);
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

  const activeFilters = useMemo(() => [
    ['Client ID', filters.clientId],
    ['Category', filters.category],
    ['Created From', filters.createdAtFrom],
    ['Created To', filters.createdAtTo],
    ['Assigned User', filters.assignedUser],
    ['Due Date', filters.dueDate],
    ['Status', filters.status],
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
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
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
      header: 'Docket ID',
      sortable: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => (
        <button
          type="button"
          className="docket-link"
          onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, caseItem.caseId))}
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
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => caseItem.clientId || '—',
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      headerClassName: 'w-full max-w-lg',
      cellClassName: 'w-full max-w-lg',
      contentClassName: 'truncate',
      render: (caseItem) => caseItem.category || '—',
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => <StatusBadge status={caseItem.status} />,
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      align: 'center',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => caseItem.assignedToName || caseItem.assignedToXID || 'Unassigned',
    },
    {
      key: 'slaDueDate',
      header: 'SLA Due Date',
      sortable: true,
      align: 'right',
      tabular: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => formatDate(caseItem.slaDueDate || caseItem.slaState?.slaDueAt),
    },
    {
      key: 'slaDaysRemaining',
      header: 'SLA Days Remaining',
      align: 'right',
      tabular: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
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
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => formatDate(caseItem.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button
            variant="outline"
            size="small"
            onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, caseItem.caseId))}
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
      clientId: null,
      category: null,
      createdAtFrom: null,
      createdAtTo: null,
      slaStatus: null,
      assignedUser: null,
      dueDate: null,
      status: null,
      sortBy: WORKBASKET_FILTER_DEFAULTS.sortBy,
      sortOrder: WORKBASKET_FILTER_DEFAULTS.sortOrder,
      page: '1',
    });
  }, [setQuery]);

  const filterIds = {
    clientId: 'workbasket-filter-client-id',
    category: 'workbasket-filter-category',
    createdAtFrom: 'workbasket-filter-created-from',
    createdAtTo: 'workbasket-filter-created-to',
    assignedUser: 'workbasket-filter-assigned-user',
    dueDate: 'workbasket-filter-due-date',
    status: 'workbasket-filter-status',
    slaStatus: 'workbasket-filter-sla-status',
    assignTo: 'workbasket-assign-to',
  };

  const resultSummary = pagination
    ? `${pagination.total} dockets found. Page ${pagination.page} of ${pagination.pages}.`
    : `${cases.length} dockets loaded.`;

  if (!initialLoadComplete && loading && cases.length === 0) {
    return (
      <Layout>
        <Loading message="Loading workbasket..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="global-worklist">
        <PageHeader
          title="Workbasket"
          subtitle="Unassigned dockets ready to be moved into a worklist."
          actions={(
            <Button variant="primary" onClick={() => navigate(ROUTES.CREATE_CASE(firmSlug))}>
              Create Docket
            </Button>
          )}
        />
        <div className="worklist-view-tabs" role="tablist" aria-label="Docket queues">
          <Button variant="outline">Workbasket</Button>
          <Button variant="outline" onClick={() => navigate(ROUTES.MY_WORKLIST(firmSlug))}>My Worklist</Button>
        </div>

        <Card>
          <form className="global-worklist__filters" role="search" aria-label="Workbasket filters">
            <div className="filter-group">
              <label htmlFor={filterIds.clientId}>Client ID</label>
              <input
                id={filterIds.clientId}
                type="text"
                placeholder="Filter by client ID"
                value={filters.clientId}
                onChange={(e) => handleFilterChange('clientId', e.target.value)}
                className={formClasses.inputBase}
              />
            </div>

            <div className="filter-group">
              <label htmlFor={filterIds.category}>Category</label>
              <input
                id={filterIds.category}
                type="text"
                placeholder="Filter by category"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className={formClasses.inputBase}
              />
            </div>

            <div className="filter-group">
              <label htmlFor={filterIds.createdAtFrom}>Created From</label>
              <input
                id={filterIds.createdAtFrom}
                type="date"
                value={filters.createdAtFrom}
                onChange={(e) => handleFilterChange('createdAtFrom', e.target.value)}
                className={formClasses.inputBase}
              />
            </div>

            <div className="filter-group">
              <label htmlFor={filterIds.createdAtTo}>Created To</label>
              <input
                id={filterIds.createdAtTo}
                type="date"
                value={filters.createdAtTo}
                onChange={(e) => handleFilterChange('createdAtTo', e.target.value)}
                className={formClasses.inputBase}
              />
            </div>


            <div className="filter-group">
              <label htmlFor={filterIds.assignedUser}>Assigned User</label>
              <input id={filterIds.assignedUser} type="text" placeholder="Assigned user" value={filters.assignedUser} onChange={(e) => handleFilterChange('assignedUser', e.target.value)} className={formClasses.inputBase} />
            </div>
            <div className="filter-group">
              <label htmlFor={filterIds.dueDate}>Due Date</label>
              <input id={filterIds.dueDate} type="date" value={filters.dueDate} onChange={(e) => handleFilterChange('dueDate', e.target.value)} className={formClasses.inputBase} />
            </div>
            <div className="filter-group">
              <label htmlFor={filterIds.status}>Status</label>
              <input id={filterIds.status} type="text" placeholder="Status" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className={formClasses.inputBase} />
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

            <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
              <Button variant="outline" onClick={() => handleFilterChange('slaStatus', 'overdue')}>Overdue</Button>
              <Button variant="outline" onClick={() => handleFilterChange('dueDate', new Date().toISOString().slice(0,10))}>Today</Button>
              <Button variant="outline" onClick={() => handleFilterChange('createdAtFrom', new Date(Date.now()-6*24*3600*1000).toISOString().slice(0,10))}>This Week</Button>
            </div>
            <div className="filter-group">
              <Button
                variant="outline"
                onClick={handleResetFilters}
              >
                Clear Filters
              </Button>
            </div>
          </form>

          <div className="sr-only" role="status" aria-live="polite">
            {resultSummary}
          </div>

          {/* Bulk Actions Toolbar */}
          <div className="global-worklist__bulk-actions" style={{ 
            display: 'flex', 
            gap: '1rem', 
            alignItems: 'center',
            padding: '1rem',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <Button
              variant="outline"
              onClick={handleBulkPull}
              disabled={selectedCases.length === 0 || bulkPulling}
            >
              {bulkPulling ? 'Assigning...' : `Assign Dockets (${selectedCases.length})`}
            </Button>
            <span className="text-secondary">
              {selectedCases.length} of {cases.length} selected
            </span>
            {isAdmin && (
              <>
                <label htmlFor={filterIds.assignTo}>Assign to:</label>
                <select id={filterIds.assignTo} value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className={formClasses.inputBase}>
                  <option value="">My Worklist</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>{emp.name || emp.xID}</option>
                  ))}
                </select>
              </>
            )}

          </div>

          <DataTable
            columns={columns}
            data={cases}
            rowKey="caseId"
            sortState={{ key: filters.sortBy, direction: filters.sortOrder }}
            onSortChange={handleSortChange}
            activeFilters={activeFilters}
            onRemoveFilter={(key) => handleFilterChange(key, '')}
            onResetFilters={handleResetFilters}
            loading={loading}
            loadingMessage="Loading workbasket..."
            emptyContent={(
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
