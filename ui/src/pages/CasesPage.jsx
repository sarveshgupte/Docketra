import React, { useState, useEffect, useMemo } from 'react';
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
import { useCaseView, CASE_VIEWS } from '../hooks/useCaseView';
import { caseService } from '../services/caseService';
import { worklistService } from '../services/worklistService';
import { CASE_STATUS } from '../utils/constants';
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

export const CasesPage = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const { firmSlug } = useParams();

  const { activeView, setActiveView, applyView, availableViews } = useCaseView(isAdmin, user);

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortState, setSortState] = useState({ key: 'updatedAt', direction: 'desc' });
  const [timelineCaseId, setTimelineCaseId] = useState(null);
  const [error, setError] = useState(null);
  const [assigningCaseId, setAssigningCaseId] = useState(null);

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
      setCases(normalizeCases(casesData));
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

  // Step 1: apply status filter (manual), then step 2: apply preset view predicate.
  const manuallyFilteredCases = useMemo(() => {
    if (statusFilter === 'ALL') return cases;
    return cases.filter((item) => item.status === statusFilter);
  }, [statusFilter, cases]);

  const viewFilteredCases = useMemo(
    () => applyView(manuallyFilteredCases, activeView),
    [manuallyFilteredCases, activeView, applyView]
  );

  const sortedCases = useMemo(() => {
    const list = [...viewFilteredCases];
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
  }, [viewFilteredCases, sortState]);

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
      key: 'caseName',
      header: 'Case Name',
      sortable: true,
      render: (row) => {
        const breached = isSlaBreached(row);
        const dueToday = !breached && isDueToday(row);
        return (
          <div className={`cases-page__name-cell${breached ? ' cases-page__name-cell--sla-breach' : ''}`}>
            <span className="cases-page__case-title">{row.caseName}</span>
            <span className="cases-page__case-meta">
              {formatAuditStamp({
                actor: row.updatedByName || row.updatedByXID || row.assignedToName || 'System',
                timestamp: row.updatedAt,
              })}
            </span>
            {breached && (
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
        const canAssign =
          !isAdmin &&
          (!row.assignedTo || row.status === CASE_STATUS.UNASSIGNED);
        return (
          <details className="cases-page__row-menu" onClick={(event) => event.stopPropagation()}>
            <summary aria-label={`Row actions for ${row.caseName}`}>⋯</summary>
            <div className="cases-page__row-menu-panel">
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
          actions={isAdmin ? <Button variant="primary" onClick={handleCreateCase}>New Case</Button> : null}
        />

        {/* Preset operational view tabs (TASK 1 / TASK 5) */}
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

        {error ? (
          <div className="cases-page__error" role="alert">
            Failed to load cases. Refresh the page or try again in a moment.
          </div>
        ) : null}

        <SectionCard title="Case Registry" subtitle={`${viewFilteredCases.length} records`}>
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
