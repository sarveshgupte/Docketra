import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Button } from '../components/common/Button';
import { TableSkeleton } from '../components/common/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/layout/SectionCard';
import { DataTable } from '../components/layout/DataTable';
import { StatusBadge } from '../components/layout/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditTimelineDrawer } from '../components/common/AuditTimelineDrawer';
import { PriorityPill } from '../components/common/PriorityPill';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { SmartViewIndicator } from '../components/common/SmartViewIndicator';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { useCaseView, CASE_VIEWS, isEscalatedCase } from '../hooks/useCaseView';
import { useSavedViews } from '../hooks/useSavedViews';
import { caseApi } from '../api/case.api';
import { worklistApi } from '../api/worklist.api';
import { categoryService } from '../services/categoryService';
import { CASE_STATUS, USER_ROLES } from '../utils/constants';
import { getCaseListRecords } from '../utils/caseResponse';
import { getFirmConfig } from '../utils/firmConfig';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { formatDateTime, getISODateInTimezone } from '../utils/formatDateTime';
import { formatCaseName } from '../utils/formatters';
import { buildCsv } from '../utils/csv';
import { UX_COPY } from '../constants/uxCopy';
import { useQueryState } from '../hooks/useQueryState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { AuditMetadata } from '../components/ui/AuditMetadata';
import { useFirm } from '../hooks/useFirm';
import { ROUTES } from '../constants/routes';
import { RouteErrorFallback } from '../components/routing/RouteErrorFallback';
import { useActiveDocket } from '../hooks/useActiveDocket';
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
  const { firmSlug, isValidFirm } = useFirm();
  const isPartner = user?.role === USER_ROLES.PARTNER;

  const firmConfig = getFirmConfig();
  const enableBulkActions = useFeatureFlag('BULK_ACTIONS');
  const enablePerformanceView = useFeatureFlag('PERFORMANCE_VIEW');
  const enableEscalationView = useFeatureFlag('ESCALATION_VIEW');
  const { query, setQuery } = useQueryState({
    status: 'ALL',
    sort: 'updatedAt',
    order: 'desc',
    q: '',
  });

  const { activeView, setActiveView, applyView, availableViews, hasStoredView, applySmartDefault } = useCaseView(
    isAdmin,
    user,
    { enableEscalationView }
  );

  const { showSuccess } = useToast();
  const { openDocket } = useActiveDocket();
  // Use a stable, unique identifier per user for saved-views storage.
  // _id is the MongoDB ObjectId; id is an alias used in some API responses.
  const savedViewsUserId = user?._id || user?.id || user?.email || null;
  const { savedViews, saveView, removeView, applySavedView } = useSavedViews(savedViewsUserId);

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState(query.status || 'ALL');
  const [sortState, setSortState] = useState({ key: query.sort || 'updatedAt', direction: query.order || 'desc' });
  const [timelineCaseId, setTimelineCaseId] = useState(null);
  const [error, setError] = useState(null);
  const [assigningCaseId, setAssigningCaseId] = useState(null);
  // Task 6: Search & Quick Jump
  const [searchInput, setSearchInput] = useState(query.q || '');
  const [searchQuery, setSearchQuery] = useState((query.q || '').trim().toLowerCase());
  const searchDebounceRef = useRef(null);
  // Task 7: Performance Insight toggle (hidden for Partner role)
  const [showPerformance, setShowPerformance] = useState(false);
  // Task 6: Bulk selection state
  const [selectedCaseIds, setSelectedCaseIds] = useState(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  const [categoryCount, setCategoryCount] = useState(0);
  const onboardingStorageKey = `docketra_onboarding_dismissed_${firmSlug || 'firm'}`;
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem(onboardingStorageKey) === 'true'
  );
  // Confirm modal state (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState(null); // { title, description, onConfirm, danger }
  // Saved views UI state
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');

  // Cleanup debounce timer on unmount (Task 6)
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const normalizeCases = useCallback((records = []) =>
    records.map((record) => ({
      ...record,
      caseId: record.caseId || record._id,
    })), []);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let casesData = [];
      if (isAdmin) {
        const response = await caseApi.getCases();
        if (response.success) {
          casesData = getCaseListRecords(response);
        }
      } else {
        const response = await worklistApi.getEmployeeWorklist();
        if (response.success) {
          casesData = response.data || [];
        }
      }
      let resolvedCategoryCount = 0;
      if (isAdmin) {
        const categoriesResponse = await categoryService.getCategories(false);
        resolvedCategoryCount = categoriesResponse?.data?.length || 0;
      }
      const normalized = normalizeCases(casesData);
      setCases(normalized);
      setCategoryCount(resolvedCategoryCount);
      // Task 5: apply smart default view if no manual selection stored
      applySmartDefault(normalized);
    } catch (err) {
      console.error('Failed to load cases:', err);
      setError(err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, normalizeCases, applySmartDefault]);

  useEffect(() => {
    if (user) {
      loadCases();
    }
  }, [user, loadCases]);

  useEffect(() => {
    if (query.status && query.status !== statusFilter) {
      setStatusFilter(query.status);
    }
    if ((query.q || '') !== searchInput) {
      setSearchInput(query.q || '');
      setSearchQuery((query.q || '').trim().toLowerCase());
    }
    if (query.sort && query.order) {
      const nextSort = { key: query.sort, direction: query.order };
      if (nextSort.key !== sortState.key || nextSort.direction !== sortState.direction) {
        setSortState(nextSort);
      }
    }
  }, [query.status, query.q, query.sort, query.order]);

  // When the preset view changes, apply its default sort.
  useEffect(() => {
    if (query.sort && query.order) return;
    const viewDef = CASE_VIEWS[activeView];
    if (viewDef?.defaultSort) {
      setSortState(viewDef.defaultSort);
    }
  }, [activeView, query.sort, query.order]);

  useEffect(() => {
    setQuery({
      status: statusFilter !== 'ALL' ? statusFilter : null,
      q: searchInput || null,
      sort: sortState?.key || null,
      order: sortState?.direction || null,
    });
  }, [statusFilter, searchInput, sortState, setQuery]);


  const dismissOnboarding = () => {
    localStorage.setItem(onboardingStorageKey, 'true');
    setOnboardingDismissed(true);
  };

  const handleExportCsv = () => {
    const headers = [
      'Docket ID',
      'Docket Name',
      'Client',
      'Status',
      'SLA Due',
      'Assigned To',
      'Updated At',
      'Escalated',
    ];
    const rows = sortedCases.map((row) => [
      row.caseId || '',
      row.caseName || '',
      row.clientName || row.client?.name || '',
      row.status || '',
      row.slaDueDate ? formatDateTime(row.slaDueDate) : '',
      row.assignedToName || row.assignedToXID || row.assignedTo || '',
      row.updatedAt ? formatDateTime(row.updatedAt) : '',
      isEscalatedCase(row, firmConfig.escalationInactivityThresholdHours) ? 'Yes' : 'No',
    ]);
    const csv = buildCsv([headers, ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = getISODateInTimezone(new Date()).replaceAll('-', '');
    link.href = url;
    link.download = `cases_export_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCaseClick = useCallback((caseRecord) => {
    const index = sortedCases.findIndex((c) => c.caseId === caseRecord.caseId);
    openDocket({
      caseId: caseRecord.caseId,
      navigate,
      to: ROUTES.CASE_DETAIL(firmSlug, caseRecord.caseId),
      state: { sourceList: sortedCases.map((c) => c.caseId), index },
    });
  }, [sortedCases, navigate, firmSlug]);

  const handleCreateCase = useCallback(() => {
    navigate(ROUTES.CREATE_CASE(firmSlug));
  }, [navigate, firmSlug]);

  const handleAssignToMe = useCallback(async (caseRecord, event) => {
    event.stopPropagation();
    // Task 3: Block reassignment if case is locked
    if (caseRecord.lockStatus?.isLocked) {
      setConfirmModal({
        title: 'Docket Locked',
        description: 'This docket is locked and cannot be reassigned right now.',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
      return;
    }
    // Task 3: Confirm before reassigning if already assigned to someone else
    if ((caseRecord.assignedToXID || caseRecord.assignedTo) && caseRecord.status !== CASE_STATUS.UNASSIGNED) {
      setConfirmModal({
        title: 'Reassign Docket',
        description: `This docket is currently assigned to ${caseRecord.assignedToName || caseRecord.assignedToXID || caseRecord.assignedTo}. Reassign to yourself?`,
        onConfirm: async () => {
          setConfirmModal(null);
          setAssigningCaseId(caseRecord.caseId);
          try {
            const response = await caseApi.pullCase(caseRecord.caseId);
            if (response.success) {
              showSuccess(`Docket assigned to you`);
              await loadCases();
            }
          } catch (err) {
            console.error('Failed to assign case:', err);
          } finally {
            setAssigningCaseId(null);
          }
        },
      });
      return;
    }
    setAssigningCaseId(caseRecord.caseId);
    try {
      const response = await caseApi.pullCase(caseRecord.caseId);
      if (response.success) {
        showSuccess(`Docket assigned to you`);
        await loadCases();
      }
    } catch (err) {
      console.error('Failed to assign case:', err);
    } finally {
      setAssigningCaseId(null);
    }
  }, [showSuccess, loadCases]);

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
    const doAssign = async () => {
      setBulkActionInProgress(true);
      try {
        await Promise.all(selectedList.map((c) => caseApi.pullCase(c.caseId)));
        setSelectedCaseIds(new Set());
        showSuccess(`${selectedList.length} docket${selectedList.length !== 1 ? 's' : ''} assigned to you`);
        await loadCases();
      } catch (err) {
        console.error('Bulk assign failed:', err);
      } finally {
        setBulkActionInProgress(false);
      }
    };
    if (mixedStates) {
      setConfirmModal({
        title: 'Assign Dockets',
        description: `Selected dockets have mixed lifecycle states. Assign all ${selectedList.length} docket(s) to yourself?`,
        onConfirm: async () => { setConfirmModal(null); await doAssign(); },
      });
      return;
    }
    doAssign();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseIds, cases]);

  const handleBulkMoveToWorkbasket = useCallback(async () => {
    if (!isAdmin) return;
    const selectedList = cases.filter((c) => selectedCaseIds.has(c.caseId));
    if (!selectedList.length) return;
    setConfirmModal({
      title: 'Move to Workbasket',
      description: `Move ${selectedList.length} docket(s) to Workbasket?`,
      onConfirm: async () => {
        setConfirmModal(null);
        setBulkActionInProgress(true);
        try {
          await Promise.all(selectedList.map((c) => caseApi.moveCaseToGlobal(c.caseId)));
          setSelectedCaseIds(new Set());
          showSuccess(`${selectedList.length} docket${selectedList.length !== 1 ? 's' : ''} moved to Workbasket`);
          await loadCases();
        } catch (err) {
          console.error('Bulk move failed:', err);
        } finally {
          setBulkActionInProgress(false);
        }
      },
    });
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

  // Handler: load a saved preset by name and apply its filters
  const handleLoadSavedView = useCallback(
    (name) => {
      const filters = applySavedView(name);
      if (!filters) return;
      if (filters.viewId) setActiveView(filters.viewId);
      if (filters.statusFilter) setStatusFilter(filters.statusFilter);
      if (filters.searchQuery != null) {
        setSearchInput(filters.searchQuery);
        setSearchQuery(filters.searchQuery.trim().toLowerCase());
      }
      setSavedViewsOpen(false);
    },
    [applySavedView, setActiveView]
  );

  // Handler: save the current filter state as a preset
  const handleSaveCurrentView = useCallback(() => {
    const name = saveViewName.trim();
    if (!name) return;
    saveView(name, { viewId: activeView, statusFilter, searchQuery });
    setSaveViewName('');
    setSavedViewsOpen(false);
  }, [saveViewName, saveView, activeView, statusFilter, searchQuery]);

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
    if (!sortState?.key || !sortState?.direction) return list;
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
      totalOpen: cases.filter((c) => c.status === CASE_STATUS.OPEN || c.status === CASE_STATUS.PENDING).length,
      dueToday: cases.filter(isDueToday).length,
      overdue: cases.filter(isSlaBreached).length,
      escalated: cases.filter((row) => isEscalatedCase(row, firmConfig.escalationInactivityThresholdHours)).length,
      filedLast7: cases.filter(
        (c) => c.status === CASE_STATUS.FILED && c.updatedAt && new Date(c.updatedAt) >= sevenDaysAgo
      ).length,
    };
  }, [cases, firmConfig.escalationInactivityThresholdHours]);

  // Task 4: Assignment load indicator
  const openAssignedCount = useMemo(
    () =>
      cases.filter(
        (c) =>
          c.status === CASE_STATUS.OPEN &&
          (c.assignedToXID === user?.xID ||
            c.assignedTo === user?._id ||
            c.assignedTo === user?.id ||
            c.assignedToEmail === user?.email)
      ).length,
    [cases, user]
  );
  const isHighWorkload = openAssignedCount > Number(firmConfig.workloadThreshold || 15);

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

  const activeFilters = useMemo(
    () => (statusFilter === 'ALL' ? [] : [{ key: 'status', label: 'Status', value: statusFilter }]),
    [statusFilter],
  );

  const handleRemoveFilter = useCallback((key) => {
    if (key === 'status') {
      setStatusFilter('ALL');
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    setStatusFilter('ALL');
  }, []);

  const toolbarLeft = useMemo(
    () => <span className="cases-page__toolbar-copy">{sortedCases.length} records</span>,
    [sortedCases.length],
  );

  // Memoize select-all state to avoid repeated inline filtering (Task 6)
  const allVisibleSelected = useMemo(() => {
    if (!enableBulkActions) return false;
    const selectable = sortedCases.filter((c) => !c.lockStatus?.isLocked);
    return selectable.length > 0 && selectable.every((c) => selectedCaseIds.has(c.caseId));
  }, [sortedCases, selectedCaseIds, enableBulkActions]);

  useKeyboardShortcuts({
    onOpen: () => {
      const first = sortedCases[0];
      if (first) handleCaseClick(first);
    },
    onEdit: () => {
      const first = sortedCases[0];
      if (first?.caseId) openDocket({
        caseId: first.caseId,
        navigate,
        to: `${ROUTES.CASE_DETAIL(firmSlug, first.caseId)}?mode=edit`,
      });
    },
  });

  const columns = useMemo(() => [
    ...(enableBulkActions ? [{
      key: '__select',
      header: (
        <input
          type="checkbox"
          aria-label="Select all"
          checked={allVisibleSelected}
          onChange={() => handleSelectAll(sortedCases)}
        />
      ),
      render: (row) => {
        const isLocked = Boolean(row.lockStatus?.isLocked);
        return (
          <input
            type="checkbox"
            aria-label={`Select ${formatCaseName(row.caseName)}`}
            checked={selectedCaseIds.has(row.caseId)}
            disabled={isLocked}
            onChange={() => handleToggleSelectCase(row.caseId, isLocked)}
            onClick={(e) => e.stopPropagation()}
          />
        );
      },
      align: 'center',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
    }] : []),
    {
      key: 'caseName',
      header: 'Docket Name',
      sortable: true,
      headerClassName: 'w-full max-w-lg',
      cellClassName: 'w-full max-w-lg',
      render: (row) => {
        const breached = isSlaBreached(row);
        const recency = getRecencyLabel(row.updatedAt);
        return (
          <div className={`cases-page__name-cell${breached ? ' cases-page__name-cell--sla-breach' : ''}`}>
            <span className="cases-page__case-title">{formatCaseName(row.caseName)}</span>
            <AuditMetadata
              className="cases-page__case-meta"
              actor={row.updatedByName || row.updatedByXID || row.assignedToName || 'System'}
              timestamp={row.updatedAt}
            />
            {recency && (
              <span className="cases-page__recency" aria-label={recency}>{recency}</span>
            )}
            <PriorityPill caseRecord={row} inactivityThresholdHours={firmConfig.escalationInactivityThresholdHours} />
          </div>
        );
      },
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'assignedToName',
      header: 'Assigned To',
      sortable: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (row) => row.assignedToName || row.assignedToXID || row.assignedTo || 'Unassigned',
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      align: 'right',
      tabular: true,
      sortable: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (row) => formatDateTime(row.updatedAt),
    },
    {
      key: 'rowActions',
      header: '',
      align: 'right',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (row) => {
        const isLocked = Boolean(row.lockStatus?.isLocked);
        // Non-admin users can assign to themselves for any unlocked case.
        // If already assigned, handleAssignToMe will prompt confirmation before proceeding.
        const canAssign = !isAdmin && !isLocked;
        return (
          <details className="cases-page__row-menu" onClick={(event) => event.stopPropagation()}>
            <summary aria-label={`Row actions for ${formatCaseName(row.caseName)}`}>⋯</summary>
            <div className="cases-page__row-menu-panel">
              {(row.assignedToName || row.assignedToXID || row.assignedTo) && (
                <div className="cases-page__row-menu-info">
                  Assigned: {row.assignedToName || row.assignedToXID || row.assignedTo}
                </div>
              )}
              {isLocked && (
                <div className="cases-page__row-menu-info cases-page__row-menu-info--locked">
                  🔒 Docket Locked
                </div>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  const index = sortedCases.findIndex((c) => c.caseId === row.caseId);
                  navigate(ROUTES.CASE_DETAIL(firmSlug, row.caseId), {
                    state: { sourceList: sortedCases.map((c) => c.caseId), index },
                  });
                }}
              >
                View Docket
              </button>
              {canAssign && (
                <button
                  type="button"
                  disabled={assigningCaseId === row.caseId}
                  onClick={(event) => handleAssignToMe(row, event)}
                >
                  {assigningCaseId === row.caseId ? 'Assigning…' : UX_COPY.actions.ASSIGN_TO_ME}
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
  ], [
    enableBulkActions,
    allVisibleSelected,
    handleSelectAll,
    sortedCases,
    selectedCaseIds,
    handleToggleSelectCase,
    firmConfig.escalationInactivityThresholdHours,
    isAdmin,
    assigningCaseId,
    navigate,
    firmSlug,
    handleAssignToMe,
  ]);

  if (!isValidFirm) {
    return <RouteErrorFallback title="Invalid firm" message="Unable to load dockets without a valid firm context." backTo={ROUTES.SUPERADMIN_LOGIN} />;
  }

  if (loading) {
    return (
      <Layout>
        <TableSkeleton rows={8} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="cases-page">
        <PageHeader
          title="Dockets"
          subtitle="Manage lifecycle, assignments, and status transitions."
          actions={
            <div className="cases-page__header-actions">
              {/* Task 4: High workload indicator */}
              {isHighWorkload && (
                <span className="cases-page__workload-warning" role="status" aria-live="polite">
                  ⚠ High workload ({openAssignedCount} open)
                </span>
              )}
              <Button variant="outline" onClick={handleExportCsv}>{UX_COPY.actions.EXPORT_CASES}</Button>
              {!isPartner && enablePerformanceView && (
                <Button variant="outline" onClick={() => setShowPerformance((v) => !v)}>
                  {showPerformance ? 'Hide Performance View' : 'Show Performance View'}
                </Button>
              )}
              {isAdmin && <Button variant="primary" onClick={handleCreateCase}>Create Docket</Button>}
            </div>
          }
        />

        {/* Task 1: SLA Summary Bar — hidden for Partner (Task 8) */}
        {!isPartner && (
          <div className="cases-page__sla-bar cases-page__control-section" role="region" aria-label="SLA Summary">
            <button
              type="button"
              className="cases-page__sla-tile"
              onClick={() => { setStatusFilter('ALL'); setActiveView('MY_OPEN'); }}
              aria-label={`Total open dockets: ${slaSummary.totalOpen}`}
            >
              <span className="cases-page__sla-tile-value">{slaSummary.totalOpen}</span>
              <span className="cases-page__sla-tile-label">Open Dockets</span>
            </button>
            <button
              type="button"
              className="cases-page__sla-tile cases-page__sla-tile--warning"
              onClick={() => { setStatusFilter('ALL'); setActiveView('DUE_TODAY'); }}
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
            {enableEscalationView && (
              <button
                type="button"
                className={`cases-page__sla-tile${slaSummary.escalated > 0 ? ' cases-page__sla-tile--escalated' : ''}`}
                onClick={() => { setStatusFilter('ALL'); setActiveView('ESCALATED'); }}
                aria-label={`Escalated: ${slaSummary.escalated}`}
              >
                <span className="cases-page__sla-tile-value">{slaSummary.escalated}</span>
                <span className="cases-page__sla-tile-label">Escalated</span>
              </button>
            )}
            <button
              type="button"
              className="cases-page__sla-tile"
              onClick={() => { setStatusFilter('ALL'); setActiveView('FILED'); }}
              aria-label={`Filed last 7 days: ${slaSummary.filedLast7}`}
            >
              <span className="cases-page__sla-tile-value">{slaSummary.filedLast7}</span>
              <span className="cases-page__sla-tile-label">Filed (7d)</span>
            </button>
          </div>
        )}

        {/* Task 6: Search & Quick Jump */}
        <div className="cases-page__search-bar cases-page__control-section">
          <input
            type="search"
            className="cases-page__search-input"
            placeholder="Search by docket ID, title, or client…"
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Search dockets"
          />
        </div>

        {/* Saved Views (user presets) */}
        <div className="cases-page__saved-views cases-page__control-section">
          <div className="cases-page__saved-views-row">
            <button
              type="button"
              className="cases-page__saved-views-toggle"
              onClick={() => setSavedViewsOpen((v) => !v)}
              aria-expanded={savedViewsOpen}
            >
              ⭐ Saved Views {savedViews.length > 0 && `(${savedViews.length})`}
            </button>
            {savedViews.map((sv) => (
              <span key={sv.name} className="cases-page__saved-view-chip">
                <button
                  type="button"
                  className="cases-page__saved-view-load"
                  onClick={() => handleLoadSavedView(sv.name)}
                  title={`Load: ${sv.name}`}
                >
                  {sv.name}
                </button>
                <button
                  type="button"
                  className="cases-page__saved-view-remove"
                  onClick={() => removeView(sv.name)}
                  aria-label={`Remove saved view: ${sv.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {savedViewsOpen && (
            <div className="cases-page__saved-views-form">
              <input
                type="text"
                className="cases-page__saved-views-input"
                placeholder="Preset name (e.g. My Overdue Dockets)"
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveCurrentView()}
                maxLength={60}
                aria-label="Saved view name"
              />
              <Button
                variant="outline"
                onClick={handleSaveCurrentView}
                disabled={!saveViewName.trim()}
              >
                Save current filters
              </Button>
            </div>
          )}
        </div>

        {/* Preset operational view tabs */}
        <div className="cases-page__views cases-page__control-section" role="tablist" aria-label="Docket views">
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

        {/* Smart default view indicator */}
        <SmartViewIndicator
          hasStoredView={hasStoredView}
          activeView={activeView}
          caseCount={viewFilteredCases.length}
        />

        {/* Task 6: Bulk action bar */}
        {enableBulkActions && selectedCaseIds.size > 0 && (
          <div className="cases-page__bulk-bar cases-page__control-section" role="toolbar" aria-label="Bulk actions">
            <span className="cases-page__bulk-count">{selectedCaseIds.size} selected</span>
            <Button
              variant="outline"
              onClick={handleBulkAssignToMe}
              disabled={bulkActionInProgress}
            >
              {UX_COPY.actions.ASSIGN_TO_ME}
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={handleBulkMoveToWorkbasket}
                disabled={bulkActionInProgress}
              >
                {UX_COPY.actions.MOVE_TO_WORKBASKET}
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

        <SectionCard className="cases-page__filters cases-page__control-section" title="Filters" subtitle="Narrow down the docket list by workflow status.">
          <label className="cases-page__filter-label" htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            className="cases-page__filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value={CASE_STATUS.OPEN}>{UX_COPY.statusLabels.OPEN}</option>
            <option value={CASE_STATUS.PENDING}>{UX_COPY.statusLabels.PENDING}</option>
            <option value={CASE_STATUS.RESOLVED}>{UX_COPY.statusLabels.RESOLVED}</option>
            <option value={CASE_STATUS.FILED}>{UX_COPY.statusLabels.FILED}</option>
          </select>
        </SectionCard>

        {/* Task 7: Performance Insight — hidden for Partner (Task 8) */}
        {!isPartner && enablePerformanceView && (
          <>
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
                        <span className="cases-page__perf-metric-label">Dockets Breaching SLA</span>
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
                  <p className="cases-page__perf-empty">No resolved dockets to compute metrics.</p>
                )}
              </div>
            )}
          </>
        )}

        {error ? (
          <div className="cases-page__error" role="alert">
            Failed to load dockets. Refresh the page or try again in a moment.
          </div>
        ) : null}

        {isAdmin && !onboardingDismissed && cases.length === 0 && categoryCount === 0 && (
          <SectionCard title="Welcome to Docketra" subtitle="Start with these three steps to set up your firm operations.">
            <ol className="cases-page__onboarding-list">
              <li>Configure your SLA and operational thresholds.</li>
              <li>Create categories for your firm workflow.</li>
              <li>Create your first docket and assign ownership.</li>
            </ol>
            <div className="cases-page__onboarding-actions">
              <Button variant="outline" onClick={() => navigate(ROUTES.FIRM_SETTINGS(firmSlug))}>Configure SLA Policy</Button>
              <Button variant="outline" onClick={dismissOnboarding}>Dismiss</Button>
            </div>
          </SectionCard>
        )}

        <SectionCard title="Docket Registry" subtitle={`${searchedCases.length} records`}>
          <DataTable
            columns={columns}
            data={sortedCases}
            rowKey="caseId"
            onRowClick={handleCaseClick}
            sortState={sortState}
            onSortChange={setSortState}
            activeFilters={activeFilters}
            onRemoveFilter={handleRemoveFilter}
            onResetFilters={handleResetFilters}
            toolbarLeft={toolbarLeft}
            dense
            emptyContent={
              <EmptyState
                title={
                  activeView === CASE_VIEWS.OVERDUE.id
                    ? UX_COPY.emptyStates.NO_OVERDUE
                    : activeView === CASE_VIEWS.ESCALATED.id
                      ? UX_COPY.emptyStates.NO_ESCALATED
                      : activeView === CASE_VIEWS.MY_OPEN.id
                        ? UX_COPY.emptyStates.NO_MY_OPEN
                        : isAdmin ? 'No dockets yet' : 'No assigned dockets'
                }
                description={isAdmin ? 'Use Create Docket to start managing firm workflows.' : 'You do not have assigned dockets right now.'}
                actionLabel={isAdmin ? UX_COPY.actions.CREATE_CASE : undefined}
                onAction={isAdmin ? () => navigate(ROUTES.CREATE_CASE(firmSlug)) : undefined}
              />
            }
          />
        </SectionCard>
      </div>
      <AuditTimelineDrawer isOpen={Boolean(timelineCaseId)} caseId={timelineCaseId} onClose={() => setTimelineCaseId(null)} />
      {confirmModal && (
        <ActionConfirmModal
          isOpen={true}
          title={confirmModal.title}
          description={confirmModal.description}
          confirmText={confirmModal.confirmText || 'Confirm'}
          cancelText="Cancel"
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </Layout>
  );
};
