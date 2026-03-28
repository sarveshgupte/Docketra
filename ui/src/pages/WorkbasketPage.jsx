/**
 * Workbasket Page (formerly Global Worklist)
 * Displays unassigned dockets that can be pulled by users
 */

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/layout/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { worklistService } from '../services/worklistService';
import { formatDate } from '../utils/formatters';
import { useToast } from '../hooks/useToast';
import { ROUTES } from '../constants/routes';
import './WorkbasketPage.css';

export const WorkbasketPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [filters, setFilters] = useState({
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
  });
  const [pagination, setPagination] = useState(null);
  const [pullingCase, setPullingCase] = useState(null);
  const [selectedCases, setSelectedCases] = useState([]);
  const [bulkPulling, setBulkPulling] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const isAdmin = ['ADMIN', 'Admin'].includes(user?.role);

  useEffect(() => {
    loadGlobalWorklist();
  }, [filters]);

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
      const response = await worklistService.getGlobalWorklist(filters);
      
      if (response.success) {
        setCases(response.data || []);
        setPagination(response.pagination);
        setSelectedCases([]); // Clear selection when reloading
      }
    } catch (error) {
      console.error('Failed to load workbasket:', error);
    } finally {
      setLoading(false);
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
      showError('Authenticated userXID is required to pull cases. Please log in again.');
      return;
    }

    if (selectedCases.length === 0) {
      showInfo('Please select at least one docket.');
      return;
    }

    if (!confirm(`Pull ${selectedCases.length} selected docket(s)? This will assign them to you.`)) {
      return;
    }

    setBulkPulling(true);
    try {
      // Use unified pullCases endpoint for bulk operations
      const response = await worklistService.pullCases(selectedCases, assignTo || null);
      
      if (response.success) {
        const message = response.pulled < response.requested
          ? `${response.pulled} of ${response.requested} dockets pulled. Some were already assigned.`
          : `All ${response.pulled} dockets pulled successfully!`;
        showInfo(message);
        // Refresh the worklist
        loadGlobalWorklist();
      }
    } catch (error) {
      showError(error.response?.data?.message || error.message || 'Failed to pull cases');
    } finally {
      setBulkPulling(false);
    }
  };

  const handlePullCase = async (caseId) => {
    if (!user?.xID) {
      showError('Authenticated userXID is required to pull cases. Please log in again.');
      return;
    }

    if (!confirm(`Pull docket ${caseId}? This will assign it to you.`)) {
      return;
    }

    setPullingCase(caseId);
    try {
      // Use unified pullCases endpoint for single case (pass as array)
      const response = await worklistService.pullCases([caseId], assignTo || null);
      
      if (response.success) {
        showSuccess(assignTo ? 'Docket assigned successfully.' : 'Docket pulled successfully.');
        // Refresh the worklist
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
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  const handleSort = (field) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSLAStatusClass = (daysRemaining) => {
    if (daysRemaining === null || daysRemaining === undefined) return '';
    const normalizedDays = Number(daysRemaining);
    if (Number.isNaN(normalizedDays)) return '';
    if (normalizedDays < 0) return 'sla-overdue';
    if (normalizedDays <= 2) return 'sla-due-soon';
    return 'sla-on-track';
  };

  const getSortIcon = (field) => {
    if (filters.sortBy !== field) return '⇅';
    return filters.sortOrder === 'asc' ? '↑' : '↓';
  };

  if (loading && cases.length === 0) {
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
          description="Unassigned dockets ready to be moved into a worklist."
        />
        <div className="worklist-view-tabs" role="tablist" aria-label="Docket queues">
          <Button variant="primary">Workbasket</Button>
          <Button variant="outline" onClick={() => navigate(ROUTES.MY_WORKLIST(firmSlug))}>My Worklist</Button>
        </div>

        <Card>
          <div className="global-worklist__filters">
            <div className="filter-group">
              <label>Client ID</label>
              <input
                type="text"
                placeholder="Filter by client ID"
                value={filters.clientId}
                onChange={(e) => handleFilterChange('clientId', e.target.value)}
                className="neo-input"
              />
            </div>

            <div className="filter-group">
              <label>Category</label>
              <input
                type="text"
                placeholder="Filter by category"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="neo-input"
              />
            </div>

            <div className="filter-group">
              <label>Created From</label>
              <input
                type="date"
                value={filters.createdAtFrom}
                onChange={(e) => handleFilterChange('createdAtFrom', e.target.value)}
                className="neo-input"
              />
            </div>

            <div className="filter-group">
              <label>Created To</label>
              <input
                type="date"
                value={filters.createdAtTo}
                onChange={(e) => handleFilterChange('createdAtTo', e.target.value)}
                className="neo-input"
              />
            </div>


            <div className="filter-group">
              <label>Assigned User</label>
              <input type="text" placeholder="Assigned user" value={filters.assignedUser} onChange={(e) => handleFilterChange('assignedUser', e.target.value)} className="neo-input" />
            </div>
            <div className="filter-group">
              <label>Due Date</label>
              <input type="date" value={filters.dueDate} onChange={(e) => handleFilterChange('dueDate', e.target.value)} className="neo-input" />
            </div>
            <div className="filter-group">
              <label>Status</label>
              <input type="text" placeholder="Status" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="neo-input" />
            </div>
            <div className="filter-group">
              <label>SLA Status</label>
              <select
                value={filters.slaStatus}
                onChange={(e) => handleFilterChange('slaStatus', e.target.value)}
                className="neo-input"
              >
                <option value="">All</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due Soon (2 days)</option>
                <option value="on_track">On Track</option>
              </select>
            </div>

            <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
              <Button variant="default" onClick={() => handleFilterChange('slaStatus', 'overdue')}>Overdue</Button>
              <Button variant="default" onClick={() => handleFilterChange('dueDate', new Date().toISOString().slice(0,10))}>Today</Button>
              <Button variant="default" onClick={() => handleFilterChange('createdAtFrom', new Date(Date.now()-6*24*3600*1000).toISOString().slice(0,10))}>This Week</Button>
            </div>
            <div className="filter-group">
              <Button
                variant="default"
                onClick={() => setFilters({
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
                })}
              >
                Clear Filters
              </Button>
            </div>
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
              variant="primary"
              onClick={handleBulkPull}
              disabled={selectedCases.length === 0 || bulkPulling}
            >
              {bulkPulling ? 'Pulling...' : `Pull Dockets (${selectedCases.length})`}
            </Button>
            <span className="text-secondary">
              {selectedCases.length} of {cases.length} selected
            </span>
            {isAdmin && (
              <>
                <label htmlFor="assign-to">Assign to:</label>
                <select id="assign-to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                  <option value="">My Worklist</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>{emp.name || emp.xID}</option>
                  ))}
                </select>
              </>
            )}

          </div>

          {loading && <Loading message="Loading..." />}

          {cases.length === 0 && !loading ? (
            <div className="p-6">
              <EmptyState
                title="No unassigned dockets"
                description="New unassigned dockets will appear here as soon as they enter the shared queue."
              />
            </div>
          ) : null}

          <div className="global-worklist__table-container">
            <table className="global-worklist__table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>
                    <input
                      type="checkbox"
                      checked={selectedCases.length === cases.length && cases.length > 0}
                      onChange={handleSelectAll}
                      disabled={cases.length === 0}
                    />
                  </th>
                  <th className="global-worklist__col-fit" onClick={() => handleSort('caseId')} style={{ cursor: 'pointer' }}>
                    Docket ID {getSortIcon('caseId')}
                  </th>
                  <th className="global-worklist__col-fit global-worklist__th-center" onClick={() => handleSort('clientId')} style={{ cursor: 'pointer' }}>
                    Client ID {getSortIcon('clientId')}
                  </th>
                  <th className="global-worklist__col-name" onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>
                    Category {getSortIcon('category')}
                  </th>
                  <th className="global-worklist__col-fit global-worklist__th-center">Status</th>
                  <th className="global-worklist__col-fit global-worklist__th-center">Assigned To</th>
                  <th className="global-worklist__col-fit global-worklist__th-right" onClick={() => handleSort('slaDueDate')} style={{ cursor: 'pointer' }}>
                    SLA Due Date {getSortIcon('slaDueDate')}
                  </th>
                  <th className="global-worklist__col-fit global-worklist__th-right">SLA Days Remaining</th>
                  <th className="global-worklist__col-fit global-worklist__th-right" onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer' }}>
                    Created Date {getSortIcon('createdAt')}
                  </th>
                  <th className="global-worklist__col-fit global-worklist__th-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.length > 0 ? (
                  cases.map((caseItem) => {
                    const slaDate = caseItem.slaDueDate || caseItem.slaState?.slaDueAt;

                    return (
                    <tr key={caseItem.caseId}>
                      <td className="global-worklist__col-fit">
                        <input
                          type="checkbox"
                          checked={selectedCases.includes(caseItem.caseId)}
                          onChange={() => handleSelectCase(caseItem.caseId)}
                        />
                      </td>
                      <td className="global-worklist__col-fit">
                        <button
                          type="button"
                          className="docket-link"
                          onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, caseItem.caseId))}
                        >
                          {caseItem.caseId}
                        </button>
                      </td>
                      <td className="global-worklist__col-fit global-worklist__td-center">{caseItem.clientId}</td>
                      <td className="global-worklist__col-name">
                        <span className="global-worklist__truncate" title={caseItem.category}>{caseItem.category}</span>
                      </td>
                      <td className="global-worklist__col-fit global-worklist__td-center"><StatusBadge status={caseItem.status} /></td>
                      <td className="global-worklist__col-fit global-worklist__td-center">{caseItem.assignedToName || caseItem.assignedToXID || 'Unassigned'}</td>
                      <td className="global-worklist__col-fit global-worklist__td-right">{formatDate(slaDate)}</td>
                      <td className={`global-worklist__col-fit global-worklist__td-right ${getSLAStatusClass(caseItem.slaDaysRemaining)}`}>
                        {caseItem.slaDaysRemaining !== null 
                          ? `${caseItem.slaDaysRemaining} days`
                          : 'N/A'}
                      </td>
                      <td className="global-worklist__col-fit global-worklist__td-right">{formatDate(caseItem.createdAt)}</td>
                      <td className="global-worklist__col-fit">
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Button
                            variant="default"
                            size="small"
                            onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, caseItem.caseId))}
                          >
                            View
                          </Button>
                          <Button
                            variant="primary"
                            size="small"
                            onClick={() => handlePullCase(caseItem.caseId)}
                            disabled={pullingCase === caseItem.caseId}
                          >
                            {pullingCase === caseItem.caseId ? 'Pulling...' : 'Pull'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                ) : null}
              </tbody>
            </table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="global-worklist__pagination">
              <Button
                variant="default"
                disabled={pagination.page === 1}
                onClick={() => handleFilterChange('page', pagination.page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <Button
                variant="default"
                disabled={pagination.page === pagination.pages}
                onClick={() => handleFilterChange('page', pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};
