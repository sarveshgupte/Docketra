import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Button } from '../components/common/Button';
import { TableSkeleton } from '../components/common/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/layout/SectionCard';
import { DataTable } from '../components/common/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditTimelineDrawer } from '../components/common/AuditTimelineDrawer';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { SmartViewIndicator } from '../components/common/SmartViewIndicator';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { useCaseView, CASE_VIEWS, isEscalatedCase } from '../hooks/useCaseView';
import { useSavedViews } from '../hooks/useSavedViews';
import { caseApi } from '../api/case.api';
import { useCasesListQuery, useCategoryCountQuery } from '../hooks/useCasesListQuery';
import { CASE_STATUS, USER_ROLES } from '../utils/constants';
import { getFirmConfig } from '../utils/firmConfig';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { formatDateTime, getISODateInTimezone } from '../utils/formatDateTime';
import { formatCaseName } from '../utils/formatters';
import { buildCsv } from '../utils/csv';
import { UX_COPY } from '../constants/uxCopy';
import { useQueryState } from '../hooks/useQueryState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useFirm } from '../hooks/useFirm';
import { ROUTES } from '../constants/routes';
import { WORK_TYPE, getWorkTypeLabel, normalizeWorkTypeFilter } from '../utils/workType';
import { RouteErrorFallback } from '../components/routing/RouteErrorFallback';
import { useActiveDocket } from '../hooks/useActiveDocket';
import { DocketBulkUploadModal } from '../components/bulk/DocketBulkUploadModal';
import {
  CasesFiltersCard,
  CasesHeaderActions,
  CasesPerformancePanel,
  CasesSavedViews,
  CasesSlaSummaryBar,
} from '../components/cases/CasesPageSections';
import { useCasesTableColumns } from '../components/cases/useCasesTableColumns';
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
const getSlaBadgeStatus = (row) => {
  if (row?.slaStatus) return String(row.slaStatus).toUpperCase();
  if (isSlaBreached(row)) return 'RED';
  if (row?.slaDueDate) {
    const due = new Date(row.slaDueDate).getTime();
    if (Number.isFinite(due) && (due - Date.now()) < (24 * 60 * 60 * 1000)) {
      return 'YELLOW';
    }
  }
  return 'GREEN';
};

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
  const location = useLocation();
  const { firmSlug, isValidFirm } = useFirm();
  const isPartner = user?.role === USER_ROLES.PARTNER;

  const firmConfig = getFirmConfig();
  const enableBulkActions = useFeatureFlag('BULK_ACTIONS');
  const enablePerformanceView = useFeatureFlag('PERFORMANCE_VIEW');
  const enableEscalationView = useFeatureFlag('ESCALATION_VIEW');
  const { query, setQuery } = useQueryState({
    status: 'ALL',
    workType: 'ALL',
    sort: 'updatedAt',
    order: 'desc',
    q: '',
  });

  const { activeView, setActiveView, applyView, availableViews, hasStoredView, applySmartDefault } = useCaseView(
    isAdmin,
    user,
    { enableEscalationView }
  );

  const { showSuccess, showToast } = useToast();
  const { openDocket } = useActiveDocket();
  // Use a stable, unique identifier per user for saved-views storage.
  // _id is the MongoDB ObjectId; id is an alias used in some API responses.
  const savedViewsUserId = user?._id || user?.id || user?.email || null;
  const { savedViews, saveView, removeView, applySavedView } = useSavedViews(savedViewsUserId);

  const [statusFilter, setStatusFilter] = useState(query.status || 'ALL');
  const [workTypeFilter, setWorkTypeFilter] = useState(normalizeWorkTypeFilter(query.workType || WORK_TYPE.ALL));
  const [sortState, setSortState] = useState({ key: query.sort || 'updatedAt', direction: query.order || 'desc' });
  const [timelineCaseId, setTimelineCaseId] = useState(null);
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
  const [showDocketBulkUpload, setShowDocketBulkUpload] = useState(false);
  const onboardingStorageKey = `docketra_onboarding_dismissed_${firmSlug || 'firm'}`;
  const getOnboardingDismissed = useCallback(() => {
    try {
      return localStorage.getItem(onboardingStorageKey) === 'true';
    } catch (error) {
      console.warn('[CasesPage] Unable to read onboarding dismissal state', { message: error?.message });
      return false;
    }
  }, [onboardingStorageKey]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => getOnboardingDismissed()
  );
  // Confirm modal state (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState(null); // { title, description, onConfirm, danger }
  // Saved views UI state
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [activeWorkbasketId, setActiveWorkbasketId] = useState('');
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

  // QC workbaskets for the QC Queue — distinct from primary workbaskets
  const qcWorkbaskets = useMemo(() => {
    const explicit = Array.isArray(user?.qcWorkbaskets) ? user.qcWorkbaskets : [];
    return explicit
      .map((item) => ({
        id: String(item?.id || item?._id || '').trim(),
        name: String(item?.name || '').trim(),
      }))
      .filter((item) => item.id && item.name);
  }, [user?.qcWorkbaskets]);

  // React Query: fetch cases list and category count
  const hasQcAccess = qcWorkbaskets.length > 0;
  const {
    data: casesQueryData,
    isLoading: loading,
    error,
    refetch: refetchCases,
  } = useCasesListQuery({
    isAdmin,
    userRole: user?.role,
    hasQcAccess,
    statusFilter,
    workTypeFilter,
    activeWorkbasketId,
    enabled: Boolean(user),
  });
  const { data: categoryCountData = 0 } = useCategoryCountQuery({ isAdmin, enabled: Boolean(user) });

  const cases = casesQueryData?.cases ?? [];
  const categoryCount = categoryCountData;

  // Task 5: apply smart default view after initial data load
  useEffect(() => {
    if (cases.length > 0) {
      applySmartDefault(cases);
    }
  }, [cases, applySmartDefault]);

  // Cleanup debounce timer on unmount (Task 6)
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const refreshCases = useCallback(async () => {
    await refetchCases();
  }, [refetchCases]);

  useEffect(() => {
    if (query.status && query.status !== statusFilter) {
      setStatusFilter(query.status);
    }
    if ((query.workType || 'ALL') !== workTypeFilter) {
      setWorkTypeFilter(normalizeWorkTypeFilter(query.workType || WORK_TYPE.ALL));
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
  }, [query.status, query.workType, query.q, query.sort, query.order]);

  useEffect(() => {
    const requestedWorkbasketId = String(query.workbasketId || '').trim();
    if (!requestedWorkbasketId) {
      if (qcWorkbaskets.length > 0 && statusFilter === CASE_STATUS.QC_PENDING) {
        setActiveWorkbasketId(qcWorkbaskets[0].id);
      } else {
        setActiveWorkbasketId('');
      }
      return;
    }
    setActiveWorkbasketId(requestedWorkbasketId);
  }, [query.workbasketId, qcWorkbaskets, statusFilter]);

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
      workType: workTypeFilter !== 'ALL' ? workTypeFilter : null,
      q: searchInput || null,
      sort: sortState?.key || null,
      order: sortState?.direction || null,
      workbasketId: statusFilter === CASE_STATUS.QC_PENDING && activeWorkbasketId ? activeWorkbasketId : null,
    });
  }, [statusFilter, workTypeFilter, searchInput, sortState, activeWorkbasketId, setQuery]);


  const dismissOnboarding = () => {
    try {
      localStorage.setItem(onboardingStorageKey, 'true');
    } catch (error) {
      console.warn('[CasesPage] Unable to persist onboarding dismissal state', { message: error?.message });
    }
    setOnboardingDismissed(true);
  };

  useEffect(() => {
    setOnboardingDismissed(getOnboardingDismissed());
  }, [getOnboardingDismissed]);

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
    const returnTo = `${location.pathname}${location.search || ''}`;
    openDocket({
      caseId: caseRecord.caseId,
      navigate,
      to: `${ROUTES.CASE_DETAIL(firmSlug, caseRecord.caseId)}?returnTo=${encodeURIComponent(returnTo)}`,
      state: { sourceList: sortedCases.map((c) => c.caseId), index, returnTo },
    });
  }, [sortedCases, navigate, firmSlug, location.pathname, location.search]);

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
              await refreshCases();
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
        await refreshCases();
      }
    } catch (err) {
      console.error('Failed to assign case:', err);
    } finally {
      setAssigningCaseId(null);
    }
  }, [showSuccess, refreshCases]);

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
        await refreshCases();
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

  // Step 1: apply status filter (manual), then step 2: apply preset view predicate.
  const manuallyFilteredCases = useMemo(() => {
    const byStatus = statusFilter === 'ALL'
      ? cases
      : cases.filter((item) => item.status === statusFilter);
    const byWorkType = workTypeFilter === 'ALL'
      ? byStatus
      : byStatus.filter((item) => (workTypeFilter === 'internal' ? Boolean(item.isInternal) : !item.isInternal));
    if (statusFilter !== CASE_STATUS.QC_PENDING || !activeWorkbasketId) {
      return byWorkType;
    }
    return byWorkType.filter((item) => {
      const ownerTeamId = String(item?.ownerTeamId || '').trim();
      const routedToTeamId = String(item?.routedToTeamId || '').trim();
      return ownerTeamId === activeWorkbasketId || routedToTeamId === activeWorkbasketId;
    });
  }, [statusFilter, workTypeFilter, cases, activeWorkbasketId]);

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
      if (filters.workTypeFilter != null) setWorkTypeFilter(normalizeWorkTypeFilter(filters.workTypeFilter));
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
    saveView(name, { viewId: activeView, statusFilter, workTypeFilter, searchQuery });
    setSaveViewName('');
    setSavedViewsOpen(false);
  }, [saveViewName, saveView, activeView, statusFilter, workTypeFilter, searchQuery]);

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

  const activeFilters = useMemo(() => {
    const items = statusFilter === 'ALL'
      ? []
      : [{ key: 'status', label: 'Status', value: statusFilter }];
    if (workTypeFilter !== 'ALL') {
      items.push({ key: 'workType', label: 'Work Type', value: getWorkTypeLabel(workTypeFilter) });
    }
    if (statusFilter === CASE_STATUS.QC_PENDING && activeWorkbasketId) {
      const selectedWorkbasket = qcWorkbaskets.find((item) => item.id === activeWorkbasketId);
      if (selectedWorkbasket) {
        items.push({ key: 'workbasketId', label: 'QC Workbasket', value: selectedWorkbasket.name });
      }
    }
    return items;
  }, [statusFilter, workTypeFilter, activeWorkbasketId, qcWorkbaskets]);

  const handleRemoveFilter = useCallback((key) => {
    if (key === 'status') {
      setStatusFilter('ALL');
    }
    if (key === 'workbasketId') {
      setActiveWorkbasketId(qcWorkbaskets[0]?.id || '');
    }
    if (key === 'workType') {
      setWorkTypeFilter('ALL');
    }
  }, [qcWorkbaskets]);

  const handleResetFilters = useCallback(() => {
    setStatusFilter('ALL');
    setWorkTypeFilter('ALL');
    setActiveWorkbasketId('');
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
        to: `${ROUTES.CASE_DETAIL(firmSlug, first.caseId)}?mode=edit&returnTo=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`,
      });
    },
  });

  const columns = useCasesTableColumns({
    enableBulkActions,
    allVisibleSelected,
    handleSelectAll,
    sortedCases,
    selectedCaseIds,
    handleToggleSelectCase,
    getSlaBadgeStatus,
    getRecencyLabel,
    inactivityThresholdHours: firmConfig.escalationInactivityThresholdHours,
    isAdmin,
    assigningCaseId,
    navigate,
    firmSlug,
    handleAssignToMe,
    location,
    setTimelineCaseId,
  });

  if (!isValidFirm) {
    return <RouteErrorFallback title="Invalid firm" message="Unable to load dockets without a valid firm context." backTo={ROUTES.SUPERADMIN_LOGIN} />;
  }

  if (loading) {
    return (
      <PlatformShell moduleLabel="Task Manager" title="Dockets" subtitle="Master oversight queue for search, tracking, routing, and lifecycle execution.">
        <TableSkeleton rows={8} />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell moduleLabel="Task Manager" title="Dockets" subtitle="Master oversight queue for search, tracking, routing, and lifecycle execution.">
      <div className="cases-page">
        <PageHeader
          title="All Dockets"
          subtitle="Master oversight view across all visible dockets, workflow states, and queue ownership."
          meta="Task Manager / All Dockets"
          actions={(
            <CasesHeaderActions
              isHighWorkload={isHighWorkload}
              openAssignedCount={openAssignedCount}
              onExportCsv={handleExportCsv}
              isPartner={isPartner}
              enablePerformanceView={enablePerformanceView}
              showPerformance={showPerformance}
              onTogglePerformance={() => setShowPerformance((v) => !v)}
              isAdmin={isAdmin}
              onOpenBulkUpload={() => setShowDocketBulkUpload(true)}
              onCreateDocket={handleCreateCase}
              exportLabel="Export Dockets"
            />
          )}
        />

        <CasesSlaSummaryBar
          isPartner={isPartner}
          slaSummary={slaSummary}
          setStatusFilter={setStatusFilter}
          setActiveView={setActiveView}
          enableEscalationView={enableEscalationView}
        />

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
        <CasesSavedViews
          savedViews={savedViews}
          savedViewsOpen={savedViewsOpen}
          setSavedViewsOpen={setSavedViewsOpen}
          handleLoadSavedView={handleLoadSavedView}
          removeView={removeView}
          saveViewName={saveViewName}
          setSaveViewName={setSaveViewName}
          handleSaveCurrentView={handleSaveCurrentView}
        />

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
            <button
              type="button"
              className="cases-page__bulk-clear"
              onClick={() => setSelectedCaseIds(new Set())}
            >
              Clear
            </button>
          </div>
        )}

        <CasesFiltersCard
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          workTypeFilter={workTypeFilter}
          setWorkTypeFilter={setWorkTypeFilter}
          qcWorkbaskets={qcWorkbaskets}
          activeWorkbasketId={activeWorkbasketId}
          setActiveWorkbasketId={setActiveWorkbasketId}
        />

        {/* Task 7: Performance Insight — hidden for Partner (Task 8) */}
        <CasesPerformancePanel
          isPartner={isPartner}
          enablePerformanceView={enablePerformanceView}
          showPerformance={showPerformance}
          performanceMetrics={performanceMetrics}
        />

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
            rows={sortedCases}
            rowKey="caseId"
            onRowClick={handleCaseClick}
            sortState={sortState}
            onSortChange={setSortState}
            activeFilters={activeFilters}
            onRemoveFilter={handleRemoveFilter}
            onResetFilters={handleResetFilters}
            toolbarLeft={toolbarLeft}
            dense
            emptyMessage={
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
                actionLabel={isAdmin ? 'Create Docket' : undefined}
                onAction={isAdmin ? () => navigate(ROUTES.CREATE_CASE(firmSlug)) : undefined}
              />
            }
          />
        </SectionCard>
      </div>
      <AuditTimelineDrawer isOpen={Boolean(timelineCaseId)} caseId={timelineCaseId} onClose={() => setTimelineCaseId(null)} />
      <DocketBulkUploadModal
        isOpen={showDocketBulkUpload}
        onClose={() => setShowDocketBulkUpload(false)}
        showToast={showToast}
        onUploaded={refreshCases}
      />
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
    </PlatformShell>
  );
};
