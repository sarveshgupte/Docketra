import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/layout/SectionCard';
import { DataTable } from '../components/layout/DataTable';
import { StatusBadge } from '../components/layout/StatusBadge';
import { EmptyState } from '../components/layout/EmptyState';
import { AuditTimelineDrawer } from '../components/common/AuditTimelineDrawer';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useCaseView, CASE_VIEWS, isEscalatedCase } from '../hooks/useCaseView';
import { caseService } from '../services/caseService';
import { worklistService } from '../services/worklistService';
import { CASE_STATUS, USER_ROLES, WORKLOAD_THRESHOLD } from '../utils/constants';
import { formatDateTime, formatAuditStamp } from '../utils/formatDateTime';
import './CasesPage.css';

// Keep date-sort keys explicit so additional date columns can be added safely.
const DATE_SORT_KEYS = new Set(['updatedAt', 'slaDueDate']);

/** Returns true when a case's SLA due date has passed and it is not yet resolved/filed. */
const isSlaBreached = (row) => {
  if (!row.slaDueDate) return false;
  if (row.status === CASE_STATUS.RESOLVED || row.status === CASE_STATUS.FILED) return false;
  return new Date(row.slaDueDate) < new Date();
};

/** Returns true when the SLA due date is today (any time). */
const isDueToday = (row) => {
  if (!row.slaDueDate) return false;
  const due = new Date(row.slaDueDate);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
};

/** Returns a recency label if the case was updated within 2 hours. */
const getRecencyLabel = (updatedAt) => {
  if (!updatedAt) return null;
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffMins = diffMs / 60000;
  if (diffMins < 30) return 'Just updated';
  if (diffMins < 120) return 'Recently updated';
  return null;
};

export const CasesPage = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const isPartner = user?.role === USER_ROLES.PARTNER;

  const { activeView, setActiveView, applyView, availableViews, applySmartDefault } = useCaseView(isAdmin, user);

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortState, setSortState] = useState({ key: 'updatedAt', direction: 'desc' });
  const [timelineCaseId, setTimelineCaseId] = useState(null);
  const [error, setError] = useState(null);
  const [assigningCaseId, setAssigningCaseId] = useState(null);
  // Task 6: Search & Quick Jump
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchDebounceRef = useRef(null);
  // Task 7: Performance Insight toggle (hidden for Partner role)
  const [showPerformance, setShowPerformance] = useState(false);
  // Task 6: Bulk selection state
  const [selectedCaseIds, setSelectedCaseIds] = useState(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);

  // Cleanup debounce timer on unmount (Task 6)
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const normalizeCases = (records = []) =>
    records.map((record) => ({
      ...record,
      caseId: record.caseId || record._id,
    }));

  useEffect(() => {
    if (user) {
      loadCases();
    }
  }, [user, isAdmin]);

  // When the preset view changes, apply its default sort.
  useEffect(() => {
    const viewDef = CASE_VIEWS[activeView];
    if (viewDef?.defaultSort) {
      setSortState(viewDef.defaultSort);
    }
  }, [activeView]);

  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      let casesData = [];
      if (isAdmin) {
        const response = await caseService.getCases();
        if (response.success) {
          casesData = response.data || [];
        }
      } else {
        const response = await worklistService.getEmployeeWorklist();
        if (response.success) {
          casesData = response.data || [];
        }
      }
      const normalized = normalizeCases(casesData);
      setCases(normalized);
      // Task 5: apply smart default view if no manual selection stored
      applySmartDefault(normalized);
    } catch (err) {
      console.error('Failed to load cases:', err);
      setError(err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseRecord) => {
    navigate(`/app/firm/${firmSlug}/cases/${caseRecord.caseId}`);
  };

  const handleCreateCase = () => {
    navigate(`/app/firm/${firmSlug}/cases/create`);
  };

  const handleAssignToMe = async (caseRecord, event) => {
    event.stopPropagation();
    // Task 3: Block reassignment if case is locked
    if (caseRecord.lockStatus?.isLocked) {
      window.alert('This case is locked and cannot be reassigned right now.');
      return;
    }
    // Task 3: Confirm before reassigning if already assigned to someone else
    if (caseRecord.assignedTo && caseRecord.status !== CASE_STATUS.UNASSIGNED) {
      const confirmed = window.confirm(
        `This case is currently assigned to ${caseRecord.assignedToName || caseRecord.assignedTo}. Reassign to yourself?`
      );
      if (!confirmed) return;
    }
    setAssigningCaseId(caseRecord.caseId);
    try {
      const response = await caseService.pullCase(caseRecord.caseId);
      if (response.success) {
        await loadCases();
      }
    } catch (err) {
      console.error('Failed to assign case:', err);
    } finally {
      setAssigningCaseId(null);
    }
  };

  // Task 6: Bulk action handlers
  const handleToggleSelectCase = useCallback((caseId, isLocked) => {
    if (isLocked) return;
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((visibleCases) => {
    setSelectedCaseIds((prev) => {
      const selectableCases = visibleCases.filter((c) => !c.lockStatus?.isLocked);
      if (selectableCases.every((c) => prev.has(c.caseId))) {
        return new Set(); // deselect all
      }
      return new Set(selectableCases.map((c) => c.caseId));
    });
  }, []);

  const handleBulkAssignToMe = useCallback(async () => {
    const selectedList = cases.filter((c) => selectedCaseIds.has(c.caseId));
    if (!selectedList.length) return;
    const mixedStates = new Set(selectedList.map((c) => c.status)).size > 1;
    if (mixedStates) {
      const ok = window.confirm(
        `Selected cases have mixed lifecycle states. Assign all ${selectedList.length} case(s) to yourself?`
      );
      if (!ok) return;
    }
    setBulkActionInProgress(true);
    try {
      await Promise.all(selectedList.map((c) => caseService.pullCase(c.caseId)));
      setSelectedCaseIds(new Set());
      await loadCases();
    } catch (err) {
      console.error('Bulk assign failed:', err);
    } finally {
      setBulkActionInProgress(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseIds, cases]);

  const handleBulkMoveToWorkbasket = useCallback(async () => {
    if (!isAdmin) return;
    const selectedList = cases.filter((c) => selectedCaseIds.has(c.caseId));
    if (!selectedList.length) return;
    const ok = window.confirm(
      `Move ${selectedList.length} case(s) to Workbasket?`
    );
    if (!ok) return;
    setBulkActionInProgress(true);
    try {
      await Promise.all(selectedList.map((c) => caseService.moveCaseToGlobal(c.caseId)));
      setSelectedCaseIds(new Set());
      await loadCases();
    } catch (err) {
      console.error('Bulk move failed:', err);
    } finally {
      setBulkActionInProgress(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseIds, cases, isAdmin]);

  // Step 1: apply status filter (manual), then step 2: apply preset view predicate.
  const manuallyFilteredCases = useMemo(() => {
    if (statusFilter === 'ALL') return cases;
    return cases.filter((item) => item.status === statusFilter);
  }, [statusFilter, cases]);

  const viewFilteredCases = useMemo(
    () => applyView(manuallyFilteredCases, activeView),
    [manuallyFilteredCases, activeView, applyView]
  );

  // Task 6: debounced search filter (250ms, no external library)
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQuery(value.trim().toLowerCase()), 250);
  };

  const searchedCases = useMemo(() => {
    if (!searchQuery) return viewFilteredCases;
    return viewFilteredCases.filter((item) => {
      const q = searchQuery;
      return (
        (item.caseId || '').toLowerCase().includes(q) ||
        (item.caseName || '').toLowerCase().includes(q) ||
        (item.clientName || item.client?.name || '').toLowerCase().includes(q)
      );
    });
  }, [viewFilteredCases, searchQuery]);

  const sortedCases = useMemo(() => {
    const list = [...searchedCases];
    list.sort((a, b) => {
      const current = a?.[sortState.key];
      const next = b?.[sortState.key];
      if (current == null && next == null) return 0;
      if (current == null) return 1;
      if (next == null) return -1;

      if (DATE_SORT_KEYS.has(sortState.key)) {
        const aTime = new Date(current).getTime();
        const bTime = new Date(next).getTime();
        return sortState.direction === 'asc' ? aTime - bTime : bTime - aTime;
      }

      const comparison = String(current).localeCompare(String(next));
      return sortState.direction === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [searchedCases, sortState]);

  // Task 1: SLA Summary Bar metrics (computed from all cases, not filtered)
  const slaSummary = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return {
      totalOpen: cases.filter((c) => c.status === CASE_STATUS.OPEN || c.status === CASE_STATUS.PENDED).length,
      dueToday: cases.filter(isDueToday).length,
      overdue: cases.filter(isSlaBreached).length,
      escalated: cases.filter(isEscalatedCase).length,
      filedLast7: cases.filter(
        (c) => c.status === CASE_STATUS.FILED && c.updatedAt && new Date(c.updatedAt) >= sevenDaysAgo
      ).length,
    };
  }, [cases]);

  // Task 4: Assignment load indicator
  const openAssignedCount = useMemo(
    () =>
      cases.filter(
        (c) =>
          c.status === CASE_STATUS.OPEN &&
          (c.assignedTo === user?._id ||
            c.assignedTo === user?.id ||
            c.assignedToEmail === user?.email)
      ).length,
    [cases, user]
  );
  const isHighWorkload = openAssignedCount > WORKLOAD_THRESHOLD;

  // Task 7: Performance metrics (computed from all cases)
  const performanceMetrics = useMemo(() => {
    const resolved = cases.filter(
      (c) => c.status === CASE_STATUS.RESOLVED || c.status === CASE_STATUS.FILED
    );
    if (!resolved.length) return null;

    let totalMs = 0;
    let countWithDuration = 0;
    resolved.forEach((c) => {
      if (c.createdAt && c.updatedAt) {
        const ms = new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime();
        if (ms > 0) { totalMs += ms; countWithDuration++; }
      }
    });
    const avgDays = countWithDuration ? (totalMs / countWithDuration / (1000 * 60 * 60 * 24)).toFixed(1) : null;

    const withSla = cases.filter((c) => c.slaDueDate);
    const breachedCount = withSla.filter(isSlaBreached).length;
    const resolvedWithinSla = resolved.filter(
      (c) => c.slaDueDate && new Date(c.updatedAt) <= new Date(c.slaDueDate)
    ).length;
    const pctBreach = withSla.length ? Math.round((breachedCount / withSla.length) * 100) : null;
    const pctWithinSla = resolved.length
      ? Math.round((resolvedWithinSla / resolved.length) * 100)
      : null;

    return { avgDays, pctBreach, pctWithinSla, resolvedCount: resolved.length };
  }, [cases]);

  const activeFilters = statusFilter === 'ALL' ? [] : [{ key: 'status', label: 'Status', value: statusFilter }];

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading cases…" />
      </Layout>
    );
  }

  const columns = [
    {
      key: '__select',
      header: (
        <input
          type="checkbox"
          aria-label="Select all"
          checked={sortedCases.length > 0 && sortedCases.filter((c) => !c.lockStatus?.isLocked).every((c) => selectedCaseIds.has(c.caseId))}
          onChange={() => handleSelectAll(sortedCases)}
        />
      ),
      render: (row) => {
        const isLocked = Boolean(row.lockStatus?.isLocked);
        return (
          <input
            type="checkbox"
            aria-label={`Select ${row.caseName}`}
            checked={selectedCaseIds.has(row.caseId)}
            disabled={isLocked}
            onChange={() => handleToggleSelectCase(row.caseId, isLocked)}
            onClick={(e) => e.stopPropagation()}
          />
        );
      },
    },
    {
      key: 'caseName',
      header: 'Case Name',
      sortable: true,
      render: (row) => {
        const breached = isSlaBreached(row);
        const escalated = isEscalatedCase(row);
        const dueToday = !breached && isDueToday(row);
        const recency = getRecencyLabel(row.updatedAt);
        return (
          <div className={`cases-page__name-cell${breached ? ' cases-page__name-cell--sla-breach' : ''}`}>
            <span className="cases-page__case-title">{row.caseName}</span>
            <span className="cases-page__case-meta">
              {formatAuditStamp({
                actor: row.updatedByName || row.updatedByXID || row.assignedToName || 'System',
                timestamp: row.updatedAt,
              })}
            </span>
            {recency && (
              <span className="cases-page__recency" aria-label={recency}>{recency}</span>
            )}
            {escalated && (
              <span className="cases-page__sla-badge cases-page__sla-badge--escalated" aria-label="Escalated">
                🔺 Escalated
              </span>
            )}
            {breached && !escalated && (
              <span className="cases-page__sla-badge cases-page__sla-badge--breach" aria-label="SLA breached">
                ⚠ SLA Overdue
              </span>
            )}
            {dueToday && (
              <span className="cases-page__sla-badge cases-page__sla-badge--today" aria-label="Due today">
                🕐 Due Today
              </span>
            )}
          </div>
        );
      },
    },
    { key: 'category', header: 'Category', sortable: true },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'assignedToName',
      header: 'Assigned To',
      sortable: true,
      render: (row) => row.assignedToName || row.assignedTo || 'Unassigned',
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      align: 'right',
      tabular: true,
      sortable: true,
      render: (row) => formatDateTime(row.updatedAt),
    },
    {
      key: 'rowActions',
      header: '',
      align: 'right',
      render: (row) => {
        const isLocked = Boolean(row.lockStatus?.isLocked);
        // Non-admin users can assign to themselves for any unlocked case.
        // If already assigned, handleAssignToMe will prompt confirmation before proceeding.
        const canAssign = !isAdmin && !isLocked;
        return (
          <details className="cases-page__row-menu" onClick={(event) => event.stopPropagation()}>
            <summary aria-label={`Row actions for ${row.caseName}`}>⋯</summary>
            <div className="cases-page__row-menu-panel">
              {(row.assignedToName || row.assignedTo) && (
                <div className="cases-page__row-menu-info">
                  Assigned: {row.assignedToName || row.assignedTo}
                </div>
              )}
              {isLocked && (
                <div className="cases-page__row-menu-info cases-page__row-menu-info--locked">
                  🔒 Case Locked
                </div>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/app/firm/${firmSlug}/cases/${row.caseId}`);
                }}
              >
                View Case
              </button>
              {canAssign && (
                <button
                  type="button"
                  disabled={assigningCaseId === row.caseId}
                  onClick={(event) => handleAssignToMe(row, event)}
                >
                  {assigningCaseId === row.caseId ? 'Assigning…' : 'Assign to Me'}
                </button>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setTimelineCaseId(row.caseId);
                }}
              >
                View Timeline
              </button>
            </div>
          </details>
        );
      },
    },
  ];

  return (
    <Layout>
      <div className="cases-page">
        <PageHeader
          title="Cases"
          description="Manage lifecycle, assignments, and status transitions."
          actions={
            <div className="cases-page__header-actions">
              {/* Task 4: High workload indicator */}
              {isHighWorkload && (
                <span className="cases-page__workload-warning" role="status" aria-live="polite">
                  ⚠ High workload ({openAssignedCount} open)
                </span>
              )}
              {isAdmin && <Button variant="primary" onClick={handleCreateCase}>New Case</Button>}
            </div>
          }
        />

        {/* Task 1: SLA Summary Bar — hidden for Partner (Task 8) */}
        {!isPartner && (
          <div className="cases-page__sla-bar" role="region" aria-label="SLA Summary">
            <button
              type="button"
              className="cases-page__sla-tile"
              onClick={() => { setStatusFilter(CASE_STATUS.OPEN); setActiveView('MY_OPEN'); }}
              aria-label={`Total open cases: ${slaSummary.totalOpen}`}
            >
              <span className="cases-page__sla-tile-value">{slaSummary.totalOpen}</span>
              <span className="cases-page__sla-tile-label">Open Cases</span>
            </button>
            <button
              type="button"
              className="cases-page__sla-tile cases-page__sla-tile--warning"
              onClick={() => setActiveView('DUE_TODAY')}
              aria-label={`Due today: ${slaSummary.dueToday}`}
            >
              <span className="cases-page__sla-tile-value">{slaSummary.dueToday}</span>
              <span className="cases-page__sla-tile-label">Due Today</span>
            </button>
            <button
              type="button"
              className={`cases-page__sla-tile${slaSummary.overdue > 0 ? ' cases-page__sla-tile--danger' : ''}`}
              onClick={() => { setStatusFilter('ALL'); setActiveView('OVERDUE'); }}
              aria-label={`Overdue: ${slaSummary.overdue}`}
            >
              <span className="cases-page__sla-tile-value">{slaSummary.overdue}</span>
              <span className="cases-page__sla-tile-label">Overdue</span>
            </button>
            {/* Task 1: Escalated metric */}
            <button
              type="button"
              className={`cases-page__sla-tile${slaSummary.escalated > 0 ? ' cases-page__sla-tile--escalated' : ''}`}
              onClick={() => { setStatusFilter('ALL'); setActiveView('ESCALATED'); }}
              aria-label={`Escalated: ${slaSummary.escalated}`}
            >
              <span className="cases-page__sla-tile-value">{slaSummary.escalated}</span>
              <span className="cases-page__sla-tile-label">Escalated</span>
            </button>
            <button
              type="button"
              className="cases-page__sla-tile"
              onClick={() => { setStatusFilter(CASE_STATUS.FILED); setActiveView('FILED'); }}
              aria-label={`Filed last 7 days: ${slaSummary.filedLast7}`}
            >
              <span className="cases-page__sla-tile-value">{slaSummary.filedLast7}</span>
              <span className="cases-page__sla-tile-label">Filed (7d)</span>
            </button>
          </div>
        )}

        {/* Task 6: Search & Quick Jump */}
        <div className="cases-page__search-bar">
          <input
            type="search"
            className="cases-page__search-input"
            placeholder="Search by case ID, title, or client…"
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Search cases"
          />
        </div>

        {/* Preset operational view tabs */}
        <div className="cases-page__views" role="tablist" aria-label="Case views">
          {availableViews.map((view) => (
            <button
              key={view.id}
              role="tab"
              aria-selected={activeView === view.id}
              className={`cases-page__view-tab${activeView === view.id ? ' cases-page__view-tab--active' : ''}`}
              onClick={() => setActiveView(view.id)}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </div>

        {/* Task 6: Bulk action bar */}
        {selectedCaseIds.size > 0 && (
          <div className="cases-page__bulk-bar" role="toolbar" aria-label="Bulk actions">
            <span className="cases-page__bulk-count">{selectedCaseIds.size} selected</span>
            <Button
              variant="outline"
              onClick={handleBulkAssignToMe}
              disabled={bulkActionInProgress}
            >
              Assign to Me
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={handleBulkMoveToWorkbasket}
                disabled={bulkActionInProgress}
              >
                Move to Workbasket
              </Button>
            )}
            <button
              type="button"
              className="cases-page__bulk-clear"
              onClick={() => setSelectedCaseIds(new Set())}
            >
              Clear
            </button>
          </div>
        )}

        <SectionCard className="cases-page__filters" title="Filters" subtitle="Narrow down the case list by workflow status.">
          <label className="cases-page__filter-label" htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            className="cases-page__filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value={CASE_STATUS.OPEN}>Open</option>
            <option value={CASE_STATUS.PENDED}>In Review</option>
            <option value={CASE_STATUS.RESOLVED}>Resolved</option>
            <option value={CASE_STATUS.FILED}>Filed</option>
          </select>
        </SectionCard>

        {/* Task 7: Performance Insight — hidden for Partner (Task 8) */}
        {!isPartner && (
          <>
            <div className="cases-page__perf-toggle">
              <button
                type="button"
                className="cases-page__perf-toggle-btn"
                onClick={() => setShowPerformance((v) => !v)}
                aria-expanded={showPerformance}
              >
                {showPerformance ? '▲' : '▼'} Performance View
              </button>
            </div>
            {showPerformance && (
              <div className="cases-page__perf-panel" role="region" aria-label="Performance metrics">
                {performanceMetrics ? (
                  <>
                    {performanceMetrics.avgDays !== null && (
                      <div className="cases-page__perf-metric">
                        <span className="cases-page__perf-metric-label">Avg. Time to Resolve</span>
                        <span className="cases-page__perf-metric-value">{performanceMetrics.avgDays} days</span>
                      </div>
                    )}
                    {performanceMetrics.pctBreach !== null && (
                      <div className="cases-page__perf-metric">
                        <span className="cases-page__perf-metric-label">Cases Breaching SLA</span>
                        <span className={`cases-page__perf-metric-value${performanceMetrics.pctBreach > 20 ? ' cases-page__perf-metric-value--danger' : ''}`}>
                          {performanceMetrics.pctBreach}%
                        </span>
                      </div>
                    )}
                    {performanceMetrics.pctWithinSla !== null && (
                      <div className="cases-page__perf-metric">
                        <span className="cases-page__perf-metric-label">Resolved Within SLA</span>
                        <span className="cases-page__perf-metric-value cases-page__perf-metric-value--good">
                          {performanceMetrics.pctWithinSla}%
                        </span>
                      </div>
                    )}
                    <div className="cases-page__perf-metric">
                      <span className="cases-page__perf-metric-label">Total Resolved/Filed</span>
                      <span className="cases-page__perf-metric-value">{performanceMetrics.resolvedCount}</span>
                    </div>
                  </>
                ) : (
                  <p className="cases-page__perf-empty">No resolved cases to compute metrics.</p>
                )}
              </div>
            )}
          </>
        )}

        {error ? (
          <div className="cases-page__error" role="alert">
            Failed to load cases. Refresh the page or try again in a moment.
          </div>
        ) : null}

        <SectionCard title="Case Registry" subtitle={`${searchedCases.length} records`}>
          <DataTable
            columns={columns}
            data={sortedCases}
            rowKey="caseId"
            onRowClick={handleCaseClick}
            sortState={sortState}
            onSortChange={setSortState}
            activeFilters={activeFilters}
            onRemoveFilter={(key) => {
              if (key === 'status') {
                setStatusFilter('ALL');
              }
            }}
            onResetFilters={() => setStatusFilter('ALL')}
            toolbarLeft={<span className="cases-page__toolbar-copy">{sortedCases.length} records</span>}
            dense
            emptyContent={
              <EmptyState
                title={isAdmin ? 'No cases yet' : 'No assigned cases'}
                description={isAdmin ? 'Create your first case to start managing firm workflows.' : 'You do not have assigned cases right now.'}
                actionLabel={isAdmin ? 'Create Case' : undefined}
                onAction={isAdmin ? handleCreateCase : undefined}
              />
            }
          />
        </SectionCard>
      </div>
      <AuditTimelineDrawer isOpen={Boolean(timelineCaseId)} caseId={timelineCaseId} onClose={() => setTimelineCaseId(null)} />
    </Layout>
  );
};
