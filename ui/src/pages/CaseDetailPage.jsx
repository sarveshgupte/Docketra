/**
 * Case Detail Page
 * PR #45: Added view-only mode indicator and audit log display
 * PR: Comprehensive CaseHistory & Audit Trail - Added view tracking and history display
 */

import { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Textarea } from '../components/common/Textarea';
import { Select } from '../components/common/Select';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { caseApi } from '../api/case.api';
import { clientApi } from '../api/client.api';
import { extractErrorMessage } from '../services/apiResponse';
import { getRecoveryPayload } from '../utils/errorRecovery';
import { formatDateTime, getISODateInTimezone } from '../utils/formatDateTime';
import { formatDocketId } from '../utils/formatters';
import { CASE_DETAIL_TABS, VALID_CASE_DETAIL_TAB_NAMES } from '../utils/constants';
import { DocketSidebar } from '../components/docket/DocketSidebar';
import { DocketComments } from '../components/docket/DocketComments';
import { StickyTabs } from '../components/common/StickyTabs';
import './CaseDetailPage.css';
import { ROUTES } from '../constants/routes';
import { RouteErrorFallback } from '../components/routing/RouteErrorFallback';
import { useActiveDocket } from '../hooks/useActiveDocket';
import { AccessDeniedState } from '../components/feedback/AccessDeniedState';
import { useCaseQuery } from '../hooks/useCaseQuery';
import { useDocketQueueNavigation } from '../hooks/useDocketQueueNavigation';
import { invalidateCaseCache } from '../utils/caseCache';
import { getDocketSlaBadgeStatus } from '../utils/docketSla';
import { isFirmManagerOrAbove } from '../utils/roleHierarchy';
import api from '../services/api';
import { DocketDetails } from '../../components/DocketDetails';
import { CaseWorkflowModals } from './caseDetail/CaseWorkflowModals';
import {
  enrichAssignableUsersWithIntelligence,
  getAssigneeOptionLabel,
} from '../components/docket/AssigneeIntelligence';
import { usePlatformWorkloadIntelligenceQuery } from '../hooks/usePlatformDataQueries';
import { CaseDetailPanelSkeleton } from './caseDetail/CaseDetailPanelSkeleton';
import { CaseDetailAlerts } from './caseDetail/CaseDetailAlerts';
import { CaseDetailSummaryHeader } from './caseDetail/CaseDetailSummaryHeader';
import { CaseDetailOverviewPanel } from './caseDetail/CaseDetailOverviewPanel';
import { useCaseDetailTimeline } from './caseDetail/useCaseDetailTimeline';
import { useDocketLifecycleActions } from './caseDetail/useDocketLifecycleActions';
import { useDocketAttachments } from './caseDetail/useDocketAttachments';
import { useDocketClone } from './caseDetail/useDocketClone';
import { useDocketRetryQueue } from './caseDetail/useDocketRetryQueue';
import { LinkedKnowledgeSection } from './caseDetail/LinkedKnowledgeSection';
import {
  canAdminMoveAssignedDocketForUser,
  canCloneDocketByPolicy,
  canRouteDocketByPolicy,
  isRoutedTeamCannotResolve,
  isTerminalDocketLifecycle,
} from './caseDetail/caseDetailAccess';
const CaseDetailAttachmentsPanel = lazy(() => import('./caseDetail/CaseDetailAttachmentsPanel').then((module) => ({ default: module.CaseDetailAttachmentsPanel })));
const CaseDetailActivityPanel = lazy(() => import('./caseDetail/CaseDetailActivityPanel').then((module) => ({ default: module.CaseDetailActivityPanel })));
const CaseDetailHistoryPanel = lazy(() => import('./caseDetail/CaseDetailHistoryPanel').then((module) => ({ default: module.CaseDetailHistoryPanel })));
const CaseDetailDocumentPacksPanel = lazy(() => import('./caseDetail/CaseDetailDocumentPacksPanel').then((module) => ({ default: module.CaseDetailDocumentPacksPanel })));
const CaseDetailExceptionsPanel = lazy(() => import('./caseDetail/CaseDetailExceptionsPanel').then((module) => ({ default: module.CaseDetailExceptionsPanel })));
const CaseDetailEffortPanel = lazy(() => import('./caseDetail/CaseDetailEffortPanel').then((module) => ({ default: module.CaseDetailEffortPanel })));
const CaseDetailEmailsPanel = lazy(() => import('./caseDetail/CaseDetailEmailsPanel').then((module) => ({ default: module.CaseDetailEmailsPanel })));
import { useClientDocketHistory } from './caseDetail/useClientDocketHistory';
// showFileAction={!routedTeamCannotResolve && !isQcContext && !isUnassignedWorkbasket && !isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus)}
import {
  ACTION_RETRY_KEY,
  INITIAL_VIRTUAL_WINDOW,
  normalizeCase,
  normalizeLifecycleForUi,
  REALTIME_POLL_MS,
  toLifecycleStage,
} from './caseDetail/caseDetailUtils';

export const CaseDetailPage = () => {
  const { caseId, firmSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const permissions = usePermissions();
  const { showSuccess, showError, showWarning } = useToast();
  const { activeDocketId, activeDocketData, isDocketLoading, beginDocketOpen, setActiveDocketData } = useActiveDocket();
  const canUseAssignmentIntelligence = useMemo(
    () => isFirmManagerOrAbove(user) || Boolean(user?.isPrimaryAdmin) || Boolean(permissions.isAdmin),
    [user, permissions.isAdmin]
  );
  const {
    data: workloadData = {},
    isLoading: workloadLoading,
    isError: workloadError,
  } = usePlatformWorkloadIntelligenceQuery({}, { enabled: canUseAssignmentIntelligence });

  const {
    sourceList,
    sourceIndex,
    returnTo,
    hasPrev,
    hasNext,
    getNavigationState,
  } = useDocketQueueNavigation({ location, firmSlug });

  const activeTab = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const tab = params.get('tab');
    if (tab === CASE_DETAIL_TABS.COMMENTS_LEGACY) return CASE_DETAIL_TABS.ACTIVITY;
    return VALID_CASE_DETAIL_TAB_NAMES.includes(tab) ? tab : CASE_DETAIL_TABS.OVERVIEW;
  }, [location.search]);

  const handlePrevCase = () => {
    if (!hasPrev) return;
    const prevId = sourceList[sourceIndex - 1];
    beginDocketOpen(prevId);
    navigate(ROUTES.CASE_DETAIL(firmSlug, prevId), {
      state: getNavigationState(sourceIndex - 1),
    });
  };

  const handleNextCase = () => {
    if (!hasNext) return;
    const nextId = sourceList[sourceIndex + 1];
    beginDocketOpen(nextId);
    navigate(ROUTES.CASE_DETAIL(firmSlug, nextId), {
      state: getNavigationState(sourceIndex + 1),
    });
  };

  const handleBackToQueue = () => {
    navigate(returnTo, { replace: true });
  };

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sectionLoading, setSectionLoading] = useState({ comments: false, history: false, attachments: false });
  const [caseData, setCaseData] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionConfirmation, setActionConfirmation] = useState('');
  const [actionError, setActionError] = useState(null);
  const pageContainerRef = useRef(null);
  const commentsListRef = useRef(null);
  const commentComposerId = `case-comment-composer-${caseId}`;
  // Confirm modal state (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState(null);

  // State for Pend action modal
  const [showPendModal, setShowPendModal] = useState(false);
  const [pendComment, setPendComment] = useState('');
  const [pendingUntil, setPendingUntil] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [pendingCase, setPendingCase] = useState(false);

  // State for Resolve action modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveComment, setResolveComment] = useState('');
  const [submittingRouted, setSubmittingRouted] = useState(false);
  const [resolvingCase, setResolvingCase] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [fileComment, setFileComment] = useState('');
  const [filingCase, setFilingCase] = useState(false);
  const [forceQcReview, setForceQcReview] = useState(false);
  const [showQcModal, setShowQcModal] = useState(false);
  const [qcDecisionType, setQcDecisionType] = useState('');
  const [qcComment, setQcComment] = useState('');
  const [qcSubmitting, setQcSubmitting] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignComment, setAssignComment] = useState('');
  const [assignUser, setAssignUser] = useState('');
  const [assigningCase, setAssigningCase] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarType, setSidebarType] = useState(null);
  const [clientFactSheet, setClientFactSheet] = useState(null);
  const [loadingClientFactSheet, setLoadingClientFactSheet] = useState(false);
  const [clientFactSheetError, setClientFactSheetError] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('live');
  const [commentWindowSize, setCommentWindowSize] = useState(INITIAL_VIRTUAL_WINDOW);

  // State for Unpend action modal
  const [showUnpendModal, setShowUnpendModal] = useState(false);
  const [unpendComment, setUnpendComment] = useState('');
  const [unpendingCase, setUnpendingCase] = useState(false);
  const [routingTeams, setRoutingTeams] = useState([]);
  const [routeTeamId, setRouteTeamId] = useState('');
  const [routingNote, setRoutingNote] = useState('');
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeSubmitting, setRouteSubmitting] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('ALL');
  const [timelinePage, setTimelinePage] = useState(1);

  // Track case view session
  // PR: Comprehensive CaseHistory & Audit Trail
  const [viewTracked, setViewTracked] = useState(false);
  const loadSequenceRef = useRef(0);
  const previousRealtimeRef = useRef(null);
  const notificationPermissionRequestedRef = useRef(false);
  const ensureNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    if (notificationPermissionRequestedRef.current) return false;
    notificationPermissionRequestedRef.current = true;
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (_error) {
      return false;
    }
  }, []);
  const sendBrowserNotification = useCallback(async (title, body) => {
    const canNotify = await ensureNotificationPermission();
    if (!canNotify) return;
    try {
      new Notification(title, { body });
    } catch (_error) {
      // best-effort browser notifications
    }
  }, [ensureNotificationPermission]);
  const {
    data: caseQueryResponse,
    error: caseQueryError,
    refetch: refetchCaseQuery,
  } = useCaseQuery(caseId, {
    refetchInterval: () => {
      if (typeof document !== 'undefined' && document.hidden) return false;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
      return REALTIME_POLL_MS;
    },
  });
  
  // Configuration for view tracking
  const VIEW_TRACKING_DEBOUNCE_MS = 2000; // 2 seconds

  const caseInfo = useMemo(
    () => (caseData ? normalizeCase(caseData) : null),
    [caseData]
  );

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const response = await api.get('/teams');
        const teams = Array.isArray(response?.data?.data) ? response.data.data : [];
        const filtered = teams.filter((team) => team?.isActive !== false && String(team?.type || '').toUpperCase() === 'PRIMARY' && String(team?.isQC || '').toLowerCase() !== 'true');
        setRoutingTeams(filtered);
      } catch (_error) {
      }
    };
    loadTeams();
  }, []);

  const routedTeamCannotResolve = isRoutedTeamCannotResolve({ caseInfo, user });
  const isRouted = Boolean(caseInfo?.routedToTeamId);
  const comments = Array.isArray(caseData?.comments) ? caseData.comments.filter(Boolean) : [];
  const attachments = Array.isArray(caseData?.attachments) ? caseData.attachments.filter(Boolean) : [];
  const auditLog = Array.isArray(caseData?.auditLog) ? caseData.auditLog.filter(Boolean) : [];
  const history = Array.isArray(caseData?.history) ? caseData.history.filter(Boolean) : [];
  const timelineEvents = useMemo(() => {
    const merged = [...auditLog, ...history];
    const seen = new Set();

    return merged.filter((event) => {
      if (!event) return false;
      const stableKey = event._id
        || event.id
        || `${event.actionType || event.action || ''}:${event.timestamp || event.createdAt || ''}:${event.performedByXID || event.actorXID || ''}:${event.description || event.actionLabel || ''}`;
      if (seen.has(stableKey)) return false;
      seen.add(stableKey);
      return true;
    });
  }, [auditLog, history]);
  const sortedTimelineEvents = useMemo(
    () => [...timelineEvents].sort((left, right) => {
      const leftTs = new Date(left?.timestamp || left?.createdAt || left?.updatedAt || 0).getTime();
      const rightTs = new Date(right?.timestamp || right?.createdAt || right?.updatedAt || 0).getTime();
      return rightTs - leftTs;
    }),
    [timelineEvents]
  );
  const {
    timelineLoading,
    timelineHasNextPage,
    mergedTimelineEvents,
  } = useCaseDetailTimeline({
    activeTab,
    caseId,
    timelineFilter,
    timelinePage,
    sortedTimelineEvents,
  });
  const docketTabs = useMemo(() => ([
    { name: CASE_DETAIL_TABS.OVERVIEW, label: '📋 Overview' },
    { name: CASE_DETAIL_TABS.KNOWLEDGE, label: '🧠 Linked Knowledge' },
    { name: CASE_DETAIL_TABS.DOCUMENT_PACKS, label: '📦 Document Packs' },
    { name: CASE_DETAIL_TABS.EXCEPTIONS, label: '⚠️ Blockers' },
    { name: CASE_DETAIL_TABS.EFFORT, label: '⏱️ Effort & Budget' },
    { name: CASE_DETAIL_TABS.EMAIL_LOGS, label: '✉️ Email Logs' },
  ]), [attachments.length, mergedTimelineEvents.length]);

  const visibleComments = useMemo(() => {
    const list = comments.slice(-commentWindowSize);
    return [...list].reverse();
  }, [comments, commentWindowSize]);
  const commentDraftKey = `docketra_case_comment_draft_${firmSlug || 'firm'}_${caseId}`;
  const availableAssignees = useMemo(() => {
    const fromCase = caseData?.assignableUsers || caseData?.users || [];
    const mapped = fromCase
      .map((entry) => ({
        value: entry.xID || entry.userId || entry.email,
        xID: entry.xID || entry.userId || entry.email,
        name: entry.name || entry.fullName || entry.xID || entry.email,
        label: entry.name || entry.fullName || entry.xID || entry.email,
        email: entry.email,
      }))
      .filter((entry) => entry.value);
    const candidates = mapped.length ? mapped : (user?.xID ? [{ value: user.xID, xID: user.xID, name: user.name || user.xID, label: user.name || user.xID, email: user.email }] : []);
    const enriched = enrichAssignableUsersWithIntelligence(candidates, workloadData);
    return enriched.map((entry) => ({
      ...entry,
      displayLabel: entry.name || entry.xID || entry.value,
      label: getAssigneeOptionLabel(entry),
    }));
  }, [caseData?.assignableUsers, caseData?.users, user?.xID, user?.name, user?.email, workloadData]);

  const clientName = caseData?.client?.businessName || caseInfo?.clientName || caseInfo?.businessName || '—';
  const clientIdLabel = caseData?.client?.clientId || caseInfo?.clientId || caseData?.clientId || '—';
  const linkedClientId = caseData?.client?.clientId || caseInfo?.clientId || caseData?.clientId || '';
  const clientMongoId = caseData?.client?._id || caseData?.client?.id || caseData?.clientMongoId || caseInfo?.clientMongoId || '';
  const linkedClientEmail = caseInfo?.clientEmail
    || caseInfo?.client?.email
    || caseInfo?.client?.businessEmail
    || caseData?.client?.email
    || caseData?.client?.businessEmail
    || '—';
  const linkedClientContact = caseData?.client?.contactPersonName
    || caseData?.client?.primaryContactNumber
    || caseData?.client?.contactPersonPhoneNumber
    || caseInfo?.client?.contactPersonName
    || caseInfo?.client?.primaryContactNumber
    || '—';
  const linkedClientRoute = linkedClientId ? ROUTES.CLIENT_WORKSPACE(firmSlug, linkedClientId) : '';
  const isInternalWork = Boolean(caseInfo?.isInternal || caseInfo?.workType === 'internal');
  const fromClientRoute = location.state?.fromClientRoute || '';
  const {
    loadingClientDockets,
    clientDockets,
    clientDocketsError,
  } = useClientDocketHistory({
    activeTab,
    clientId: clientMongoId || linkedClientId || caseInfo?.clientId || caseData?.clientId,
    caseId,
  });
  const docketStatusLabel = caseInfo?.status || caseInfo?.lifecycle || '—';
  const assigneeLabel = caseInfo?.assignedToName
    || caseInfo?.assignedTo
    || caseInfo?.assignedToXID
    || caseInfo?.ownerName
    || caseInfo?.ownerXID
    || 'Unassigned';
  const queueLabel = caseInfo?.workbasketName
    || caseInfo?.queueName
    || caseInfo?.ownerTeamName
    || caseInfo?.ownerTeamId
    || caseInfo?.workbasket
    || '—';
  const dueDateLabel = caseInfo?.dueDate || caseInfo?.slaDueAt || caseInfo?.deadlineAt || caseInfo?.pendingUntil || caseInfo?.reopenDate || null;

  const categoryLabel = caseInfo?.category
    || caseInfo?.caseCategory
    || caseInfo?.workType
    || caseInfo?.workTypeName
    || caseData?.category
    || '—';
  const subcategoryLabel = (() => {
    const candidateValues = [
      caseInfo?.subcategory,
      caseInfo?.caseSubCategory,
      caseInfo?.subCategory,
      caseInfo?.subCategoryName,
      caseInfo?.subcategoryName,
      caseInfo?.subWorkType,
      caseInfo?.subWorkTypeName,
      caseInfo?.subCategorySnapshot,
      caseInfo?.subCategoryConfig?.name,
      caseInfo?.categorySnapshot?.subcategory,
      caseData?.subcategory,
      caseData?.subCategory,
      caseData?.caseSubCategory,
      caseData?.case?.caseSubCategory,
      caseData?.case?.subCategory,
      caseData?.case?.subCategoryName,
    ];
    const firstValid = candidateValues.find((value) => {
      if (value == null) return false;
      if (typeof value === 'object') {
        const label = value?.name || value?.label || value?.title || value?.value;
        return Boolean(String(label || '').trim());
      }
      return Boolean(String(value).trim());
    });
    if (!firstValid) return '—';
    if (typeof firstValid === 'object') {
      return String(firstValid?.name || firstValid?.label || firstValid?.title || firstValid?.value || '—');
    }
    return String(firstValid);
  })();
  const slaDaysLabel = (() => {
    const candidateValues = [
      caseInfo?.slaConfigSnapshot?.tatDurationMinutes != null ? Math.ceil(Number(caseInfo.slaConfigSnapshot.tatDurationMinutes) / 480) : null,
      caseData?.slaConfigSnapshot?.tatDurationMinutes != null ? Math.ceil(Number(caseData.slaConfigSnapshot.tatDurationMinutes) / 480) : null,
      caseInfo?.slaDays,
      caseInfo?.tatDaysSnapshot,
      caseInfo?.slaConfigSnapshot?.slaDays,
      caseInfo?.slaConfigSnapshot?.tatDays,
      caseInfo?.sla?.days,
      caseInfo?.sla?.tatDays,
      caseInfo?.slaSnapshot?.days,
      caseInfo?.categorySnapshot?.slaDays,
      caseInfo?.tatDays,
      caseData?.slaDays,
    ];
    const validNumbers = candidateValues
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0);

    const positiveValue = validNumbers.find((value) => value > 0);
    if (positiveValue != null) return String(positiveValue);

    const zeroValue = validNumbers.find((value) => value === 0);
    if (zeroValue != null) return '0';

    return '-';
  })();
  const lifecycleStatus = normalizeLifecycleForUi(caseInfo?.lifecycle);
  const normalizedUserXid = String(user?.xID || '').trim().toUpperCase();
  const normalizedAssignedXid = String(caseInfo?.assignedToXID || '').trim().toUpperCase();
  const locationBadges = useMemo(() => {
    const badges = [];
    const queueHint = String(caseInfo?.queueContext || caseInfo?.queueName || caseInfo?.workbasketName || '').toUpperCase();
    if (routedTeamCannotResolve) badges.push('Routed');
    if (String(caseInfo?.returnedFromRoute || caseInfo?.routeReturnStatus || '').toLowerCase() === 'true') badges.push('Returned from route');
    
    const isPended = lifecycleStatus === 'WAITING' || String(caseInfo?.status || '').toUpperCase() === 'PENDING' || String(caseInfo?.state || '').toUpperCase() === 'PENDED';
    
    if (isPended) {
      badges.push('Pending');
    } else {
      if (queueHint.includes('QC')) badges.push('QC Workbasket');
      else if (caseInfo?.assignedToXID && normalizedAssignedXid === normalizedUserXid) badges.push('My Worklist');
      else if (caseInfo?.assignedToXID) badges.push('Assigned Worklist');
      else if (caseInfo?.workbasketName || caseInfo?.ownerTeamId || caseInfo?.queueName) badges.push('Workbasket');
    }
    
    if (isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus)) {
      badges.push(String(caseInfo?.lifecycle || lifecycleStatus || 'Terminal'));
    }
    return badges;
  }, [caseInfo, lifecycleStatus, routedTeamCannotResolve, normalizedAssignedXid, normalizedUserXid]);
  const isMoveLockedByAnotherUser = Boolean(caseInfo?.lockStatus?.isLocked)
    && String(caseInfo?.lockStatus?.activeUserXID || '').trim().toUpperCase() !== String(user?.xID || '').trim().toUpperCase();
  const lockOwnerLabel = [caseInfo?.lockStatus?.activeUserDisplayName, caseInfo?.lockStatus?.activeUserXID]
    .filter((value) => value != null && String(value).trim() !== '')
    .join(' · ') || caseInfo?.lockStatus?.activeUserXID || caseInfo?.lockStatus?.activeUserEmail || 'another user';
  const canAdminMoveAssignedDocket = canAdminMoveAssignedDocketForUser({ caseInfo, user });

  const mergeUniqueComments = useCallback((inputComments = []) => {
    const map = new Map();
    inputComments.forEach((comment) => {
      if (!comment) return;
      const stableKey = comment._id || comment.id || comment.tempId || `${comment.createdAt || ''}:${comment.text || ''}:${comment.createdByXID || comment.createdBy || ''}`;
      if (!map.has(stableKey)) {
        map.set(stableKey, comment);
      }
    });
    return Array.from(map.values());
  }, []);

  const mergeCaseData = useCallback((prev, incoming, { source = 'unknown' } = {}) => {
    if (!prev) return incoming;
    if (!incoming) return prev;

    const prevComments = prev.comments || [];
    const incomingComments = incoming.comments || [];
    const commentsMatch = (left, right) => {
      if (!left || !right) return false;
      const leftId = left._id || left.id || left.tempId;
      const rightId = right._id || right.id || right.tempId;
      if (leftId && rightId && leftId === rightId) return true;
      if (left.tempId && rightId && left.tempId === rightId) return true;

      const leftText = String(left.text || '').trim();
      const rightText = String(right.text || '').trim();
      if (!leftText || !rightText || leftText !== rightText) return false;

      const leftTs = new Date(left.createdAt || left.timestamp || 0).getTime();
      const rightTs = new Date(right.createdAt || right.timestamp || 0).getTime();
      if (!leftTs || !rightTs) return false;
      return Math.abs(leftTs - rightTs) <= 60_000;
    };

    const reconciledPrevComments = prevComments.filter((comment) => {
      if (!comment?.optimistic) return true;
      const matched = incomingComments.some((incomingComment) => commentsMatch(comment, incomingComment));
      return !matched;
    });

    const mergedComments = mergeUniqueComments([...reconciledPrevComments, ...incomingComments]).sort((left, right) => {
      const leftTs = new Date(left?.createdAt || left?.timestamp || 0).getTime();
      const rightTs = new Date(right?.createdAt || right?.timestamp || 0).getTime();
      return leftTs - rightTs;
    });

    const prevHistory = prev.history || [];
    const incomingHistory = incoming.history || [];
    const mergedHistory = mergeUniqueComments([...prevHistory, ...incomingHistory]).sort((left, right) => {
      const leftTs = new Date(left?.timestamp || left?.createdAt || left?.updatedAt || 0).getTime();
      const rightTs = new Date(right?.timestamp || right?.createdAt || right?.updatedAt || 0).getTime();
      return rightTs - leftTs;
    });

    const prevAudit = prev.auditLog || [];
    const incomingAudit = incoming.auditLog || [];
    const mergedAudit = mergeUniqueComments([...prevAudit, ...incomingAudit]).sort((left, right) => {
      const leftTs = new Date(left?.timestamp || left?.createdAt || left?.updatedAt || 0).getTime();
      const rightTs = new Date(right?.timestamp || right?.createdAt || right?.updatedAt || 0).getTime();
      return rightTs - leftTs;
    });


    return {
      ...prev,
      ...incoming,
      case: {
        ...(prev.case || {}),
        ...(incoming.case || {}),
      },
      comments: mergedComments,
      history: mergedHistory,
      auditLog: mergedAudit,
    };
  }, [mergeUniqueComments]);

  const appendTimelineEvent = useCallback((event) => {
    setCaseData((prev) => ({
      ...prev,
      auditLog: mergeUniqueComments([...(prev?.auditLog || []), event]),
      history: mergeUniqueComments([...(prev?.history || []), event]),
    }));
  }, [mergeUniqueComments]);


  const loadCase = useCallback(async ({ background = false } = {}) => {
    const requestId = loadSequenceRef.current + 1;
    loadSequenceRef.current = requestId;
    if (!background) {
      setLoading(true);
    } else {
      setSectionLoading({ comments: true, history: true, attachments: true });
    }
    try {
      if (!background) {
        setLoadError(null);
      }
      if (!background) invalidateCaseCache(caseId);
      const { data: response } = await refetchCaseQuery();
      
      if (response.success && requestId === loadSequenceRef.current) {
        const normalized = response.data?.case || response.data;
        setCaseData((prev) => mergeCaseData(prev, normalized, { source: 'loadCase' }));
        setActiveDocketData(normalized);
      }
    } catch (error) {
      if (!background) {
        setLoadError(extractErrorMessage(error, 'Unable to load docket details. Please try again.'));
      }
      showError(extractErrorMessage(error, 'Unable to load docket details. Please try again.'));
    } finally {
      if (!background) {
        setLoading(false);
      } else {
        setSectionLoading({ comments: false, history: false, attachments: false });
      }
    }
  }, [caseId, refetchCaseQuery, showError]);


  useEffect(() => {
    beginDocketOpen(caseId);
    void caseApi.trackCaseOpen(caseId);
    return () => {
      void caseApi.trackCaseExit(caseId);
    };
  }, [beginDocketOpen, caseId]);

  useEffect(() => {
    if (!caseQueryResponse?.success) return;
    const normalized = caseQueryResponse.data?.case || caseQueryResponse.data;
    setCaseData((prev) => mergeCaseData(prev, normalized, { source: 'case-query' }));
    setActiveDocketData(normalized);
    setLoading(false);
    setLoadError(null);
  }, [caseQueryResponse, mergeCaseData, setActiveDocketData]);

  useEffect(() => {
    if (!caseQueryError) return;
    setLoading(false);
    setLoadError(extractErrorMessage(caseQueryError, 'Unable to load docket details. Please try again.'));
  }, [caseQueryError]);

  useEffect(() => {
    if (activeDocketId === caseId && activeDocketData?.caseId === caseId) {
      setCaseData((prev) => mergeCaseData(prev, activeDocketData, { source: 'active-context' }));
      setLoading(false);
    }
  }, [activeDocketData, activeDocketId, caseId, mergeCaseData]);

  useEffect(() => {
    if (!caseData) return;
    previousRealtimeRef.current = {
      lifecycle: lifecycleStatus,
      assignee: caseInfo?.assignedToXID || caseInfo?.assignedToName || null,
      commentsCount: comments.length,
    };
  }, [caseData, lifecycleStatus, caseInfo?.assignedToXID, caseInfo?.assignedToName, comments.length]);

  useEffect(() => {
    if (!caseQueryResponse?.success || !caseData) return;
    try {
      const updated = caseQueryResponse.data?.case || caseQueryResponse.data;
      const previous = previousRealtimeRef.current;
      const nextInfo = normalizeCase(updated);
      const nextCommentsCount = updated?.comments?.length || 0;
      const nextAssignee = nextInfo?.assignedToXID || nextInfo?.assignedToName || user?.xID || null;
      if (previous) {
        if (nextCommentsCount > previous.commentsCount) {
          showSuccess('New comment update received.');
          sendBrowserNotification('Docketra update', 'A new comment was added to this docket.');
        }
        if (nextAssignee && previous.assignee && nextAssignee !== previous.assignee) {
          showWarning(`Assignment updated: ${previous.assignee} → ${nextAssignee}`);
        }
      }
      setRealtimeStatus('live');
    } catch (error) {
      setRealtimeStatus('reconnecting');
    }
  }, [caseData, caseQueryResponse, sendBrowserNotification, showSuccess, showWarning, user?.xID]);


  useEffect(() => {
    const existingDraft = localStorage.getItem(commentDraftKey);
    if (existingDraft) {
      setNewComment(existingDraft);
    }
  }, [commentDraftKey]);

  useEffect(() => {
    if (!newComment) return undefined;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(commentDraftKey, newComment);
      } catch (error) {
        // best-effort local draft persistence
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [newComment, commentDraftKey]);

  useEffect(() => {
    if (!assignUser && availableAssignees.length > 0) {
      setAssignUser(availableAssignees[0].value);
    }
  }, [assignUser, availableAssignees]);

  useEffect(() => {
    setForceQcReview(Boolean(caseInfo?.forceQc));
  }, [caseInfo?.forceQc]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!newComment) return;
      try {
        localStorage.setItem(commentDraftKey, newComment);
      } catch (error) {
        // best-effort local draft persistence
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [newComment, commentDraftKey]);

  // Track case viewed after successful load (debounced, once per session)
  useEffect(() => {
    if (caseData && !viewTracked) {
      // Delay slightly to ensure page is fully rendered
      const timer = setTimeout(() => {
        caseApi.trackCaseView(caseId);
        setViewTracked(true);
      }, VIEW_TRACKING_DEBOUNCE_MS);
      
      return () => clearTimeout(timer);
    }
  }, [caseData, viewTracked, caseId]);


  useEffect(() => {
    if (!actionError && !actionConfirmation) return;
    const timer = setTimeout(() => {
      setActionError(null);
      setActionConfirmation('');
    }, 5000);
    return () => clearTimeout(timer);
  }, [actionError, actionConfirmation]);

  // Track exit on beforeunload (best-effort for tab close)
  // Note: sendBeacon doesn't support custom headers, so we rely on cookie-based auth
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use sendBeacon for better reliability on page unload
      // Note: This is best-effort and may not work in all browsers/scenarios
      if (navigator.sendBeacon) {
        const apiBaseUrl = window.location.origin;
        const url = `${apiBaseUrl}/api/cases/${caseId}/track-exit`;
        
        // Send beacon - note that sendBeacon doesn't support custom headers
        // The backend must handle authentication via cookies or accept the request
        const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [caseId]);


  const handleAddComment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newComment.trim() || submitting) return;
    
    const commentText = newComment.trim();
    const tempId = `tmp-comment-${Date.now()}`;
    const optimisticComment = {
      tempId,
      _id: tempId,
      text: commentText,
      createdBy: user?.email || 'System',
      createdByName: user?.name || null,
      createdByXID: user?.xID || null,
      createdAt: new Date().toISOString(),
      optimistic: true,
    };
    const previousComments = comments;
    setCaseData((prev) => ({
      ...prev,
      comments: mergeUniqueComments([...(prev?.comments || []), optimisticComment]),
    }));
    setNewComment('');
    setSubmitting(true);
    try {
      const response = await caseApi.addComment(caseId, commentText);
      const serverCommentPayload = response?.data;
      const serverComment = serverCommentPayload?.comment || (serverCommentPayload?.text ? serverCommentPayload : null);
      setCaseData((prev) => ({
        ...prev,
        comments: mergeUniqueComments(
          (prev?.comments || [])
            .filter((comment) => (comment?._id || comment?.id || comment?.tempId) !== tempId)
            .concat(serverComment || [{ ...optimisticComment, optimistic: false }])
        ),
      }));
      localStorage.removeItem(commentDraftKey);
      const message = `Comment added to docket ${caseId} • ${formatDateTime()}`;
      showSuccess(message);
      setActionConfirmation(message);
      setActionError(null);
      appendTimelineEvent({
        id: `comment-event-${Date.now()}`,
        action: 'COMMENTED',
        description: commentText,
        createdAt: new Date().toISOString(),
        createdBy: user?.name || user?.xID || user?.email || 'System',
      });
      window.setTimeout(handleAddCommentSuccess, 80);
      const mentioned = (commentText.match(/@([a-zA-Z0-9._-]+)/g) || []).map((token) => token.slice(1));
      if (mentioned.length > 0) {
        showSuccess(`Mention alert sent: ${mentioned.map((id) => `@${id}`).join(', ')}`);
      }
      loadCase({ background: true });
    } catch (error) {
      setCaseData((prev) => ({ ...prev, comments: previousComments }));
      setNewComment(commentText);
      const message = extractErrorMessage(error, 'Failed to add comment. Please retry.');
      showError(message);
      if (!navigator.onLine) {
        queueFailedAction({ type: 'ADD_COMMENT', payload: { commentText } });
        showWarning('You are offline. Comment queued and will retry automatically.');
      }
      setActionError({ message, retry: handleAddComment });
    } finally {
      setSubmitting(false);
    }
  };

  const { retryQueue, queueFailedAction } = useDocketRetryQueue({ caseId, showSuccess, showWarning, onQueueSynced: () => loadCase({ background: true }) });

  const accessMode = caseData?.accessMode || {};
  const isViewOnlyMode = accessMode.isViewOnlyMode;
  const canCloneDocket = canCloneDocketByPolicy({ permissions, caseData });

  const {
    selectedFile, setSelectedFile, fileDescription, setFileDescription, uploadingFile, uploadProgress,
    uploadLinkGenerating, uploadLinkResult, handleUploadFile, handleGenerateUploadLink,
  } = useDocketAttachments({ caseId, user, showSuccess, showError, showWarning, setCaseData, setActionConfirmation, setActionError });

  const {
    cloneModalOpen, setCloneModalOpen, cloneCategoryId, setCloneCategoryId, cloneSubcategoryId, setCloneSubcategoryId,
    cloningCase, loadingCloneCatalog, categoryCatalog, selectedCloneCategory, cloneSubcategories, handleCloneDocket,
  } = useDocketClone({ caseId, firmSlug, returnTo, canCloneDocket, navigate, showSuccess, showError, showWarning, setActionConfirmation, setActionError });

  const { handlePendCase, handleResolveCase, handleUnpendCase, handleRouteToTeam, handleSubmitRouted, handleFileCase } = useDocketLifecycleActions({
    caseId, lifecycleStatus, pendComment, pendingUntil, resolveComment, forceQcReview, unpendComment, fileComment,
    routeTeamId, routingNote, routeSubmitting, submittingRouted, setConfirmModal, setPendingCase, setResolvingCase, setUnpendingCase,
    setFilingCase, setRouteSubmitting, setSubmittingRouted, setShowPendModal, setPendComment, setPendingUntil, setShowResolveModal,
    setResolveComment, setShowUnpendModal, setUnpendComment, setShowRouteModal, setRouteTeamId, setRoutingNote, setShowFileModal,
    setFileComment, setActionConfirmation, setActionError, showSuccess, showWarning, showError, loadCase, setCaseData, caseData,
    appendTimelineEvent, user, queueFailedAction, firmSlug, navigate, returnTo,
  });

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDropFiles = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };





  const looksEncryptedPayload = (value) => {
    if (typeof value !== 'string') return false;
    const parts = value.split(':');
    const payloadParts = parts[0] === 'v1' ? parts.slice(1) : parts;
    if (payloadParts.length !== 3) return false;
    return payloadParts.every((segment) => segment.length > 0 && /^[A-Za-z0-9+/=]+$/.test(segment));
  };

  const descriptionContent = useMemo(() => {
    const value = String(
      caseInfo?.description
      || caseInfo?.caseDescription
      || caseInfo?.details
      || caseInfo?.summary
      || caseInfo?.notes
      || caseInfo?.intake?.description
      || caseData?.case?.description
      || caseData?.description
      || caseData?.details
      || ''
    ).trim();
    if (!value) return '-';
    if (looksEncryptedPayload(value)) return '—';
    return value;
  }, [
    caseInfo?.description,
    caseInfo?.caseDescription,
    caseInfo?.details,
    caseInfo?.summary,
    caseInfo?.notes,
    caseInfo?.intake?.description,
    caseData?.case?.description,
    caseData?.description,
    caseData?.details,
  ]);
  const docketState = lifecycleStatus;
  const statusVersion = Number.isFinite(Number(caseInfo?.version)) ? Number(caseInfo.version) : 0;
  const performedBy = user?.email || user?.xID || 'system';

  const loadClientFactSheet = useCallback(async () => {
    if (!caseId) return;
    setLoadingClientFactSheet(true);
    setClientFactSheetError('');
    try {
      const response = await clientApi.getClientFactSheetForCase(caseId);
      setClientFactSheet(response?.data || null);
    } catch (error) {
      setClientFactSheet(null);
      const nestedCode = error?.response?.data?.code;
      const rootCode = error?.code;
      const rawMessage = String(error?.response?.data?.message || error?.message || '');
      const isTenantKeyMissing = rootCode === 'TENANT_KEY_MISSING'
        || nestedCode === 'TENANT_KEY_MISSING'
        || rawMessage.includes('TENANT_KEY_MISSING');
      const message = isTenantKeyMissing
        ? 'Client encryption setup needs repair before the fact sheet can be loaded.'
        : 'Client fact sheet could not be loaded.';
      setClientFactSheetError(message);
      showError(message);
    } finally {
      setLoadingClientFactSheet(false);
    }
  }, [caseId, showError]);

  const openSidebar = (type) => {
    try {
      setSidebarType((previousType) => {
        if (sidebarOpen && previousType === type) {
          setSidebarOpen(false);
          return null;
        }
        setSidebarOpen(true);
        if (type === 'cfs') {
          void loadClientFactSheet();
        }
        return type;
      });
    } catch (_error) {
      showError('Unable to open panel right now. Please retry.');
    }
  };

  const runGuardedAction = useCallback((action, fallbackMessage = 'Unable to complete this action right now.') => {
    try {
      action?.();
    } catch (_error) {
      showError(fallbackMessage);
    }
  }, [showError]);

  useEffect(() => {
    setSidebarOpen(false);
    setSidebarType(null);
    setClientFactSheet(null);
    setClientFactSheetError('');
  }, [caseId]);

  const handleAssignDocket = async () => {
    if (!assignUser) {
      showWarning('Please select a user to move this docket.');
      return;
    }
    if (assigningCase) return;
    setAssigningCase(true);
    const selectedAssignee = availableAssignees.find((option) => option.value === assignUser);
    const selectedAssigneeLabel = selectedAssignee?.displayLabel || selectedAssignee?.name || selectedAssignee?.label || assignUser;

    try {
      await caseApi.reassignDocket(caseId, assignUser);
      setShowAssignModal(false);
      setAssignComment('');
      setActionError(null);
      setActionConfirmation(`Docket moved to ${selectedAssigneeLabel}.`);
      showSuccess(`Docket owner updated to ${selectedAssigneeLabel}`);
      loadCase({ background: true });
    } catch (error) {
      const message = extractErrorMessage(error, 'Failed to move docket. Please try again.');
      showError(message);
      setActionError({ message, retry: handleAssignDocket });
    } finally {
      setAssigningCase(false);
    }
  };

  const handleMoveToWorkbasket = async () => {
    if (!canAdminMoveAssignedDocket || actionInFlight) return;
    if (isMoveLockedByAnotherUser) {
      showWarning(`Docket is locked by ${lockOwnerLabel}. Ask them to exit/close before moving.`);
      return;
    }

    setConfirmModal({
      title: 'Move docket to Workbasket',
      description: 'This removes the current assignee and returns the docket to Global Workbasket.',
      confirmText: 'Move to Workbasket',
      danger: true,
      onConfirm: async () => {
        try {
          setConfirmModal(null);
          await caseApi.unassignDocket(caseId);
          showSuccess('Docket moved to Workbasket.');
          await loadCase({ background: true });
        } catch (error) {
          const message = extractErrorMessage(error, 'Failed to move docket to Workbasket.');
          showError(message);
          setActionError({ message, retry: handleMoveToWorkbasket });
        }
      },
    });
  };

  const handleViewUserWorklist = useCallback((targetXID) => {
    const normalized = String(targetXID || '').trim().toUpperCase();
    if (!normalized) return;
    navigate(`${ROUTES.WORKLIST(firmSlug)}?assigneeXID=${encodeURIComponent(normalized)}`);
  }, [firmSlug, navigate]);

  // Task 2: Inactivity warning — OPEN case not updated in 3+ days (not pended)
  const isInactiveWarning = useMemo(() => {
    if (!caseInfo) return false;
    if (lifecycleStatus !== 'OPEN') return false;
    if (!caseInfo.updatedAt) return false;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return new Date(caseInfo.updatedAt) < threeDaysAgo;
  }, [caseInfo, lifecycleStatus]);

  // Task 3: Smart lifecycle warnings for File/Resolve modals
  const lifecycleWarnings = useMemo(() => {
    if (!caseInfo) return [];
    const warnings = [];
    const unresolvedComments = comments.filter((c) => !c.resolved).length;
    if (unresolvedComments > 0) {
      warnings.push(`${unresolvedComments} unresolved comment(s) on this docket.`);
    }
    if (caseInfo.approvalStatus === 'PENDING') {
      warnings.push('Pending approval is outstanding.');
    }
    const dueAt = caseInfo.slaDueAt || caseInfo.slaDueDate;
    const isSlaBreach =
      dueAt &&
      new Date(dueAt) < new Date() &&
      lifecycleStatus !== 'RESOLVED' &&
      lifecycleStatus !== 'CLOSED';
    if (isSlaBreach) {
      warnings.push('SLA has been breached for this docket.');
    }
    return warnings;
  }, [caseInfo, comments, lifecycleStatus]);

  const docketSlaStatus = useMemo(
    () => getDocketSlaBadgeStatus({ ...caseInfo, slaDueDate: caseInfo?.slaDueAt || caseInfo?.slaDueDate }),
    [caseInfo]
  );

  const slaBadgeClass = useMemo(() => {
    if (docketSlaStatus === 'RED') return 'error';
    if (docketSlaStatus === 'YELLOW') return 'warning';
    if (docketSlaStatus === 'GREEN') return 'success';
    return 'neutral';
  }, [docketSlaStatus]);

  const slaBadgeLabel = useMemo(() => {
    if (docketSlaStatus === 'RED') return 'Overdue';
    if (docketSlaStatus === 'YELLOW') return 'Due Soon';
    if (docketSlaStatus === 'GREEN') return 'On Track';
    return 'Not Configured';
  }, [docketSlaStatus]);

  const actionInFlight = assigningCase || pendingCase || resolvingCase || unpendingCase;
  const openActionModal = (type) => {
    if (type === 'pend') {
      setPendComment('');
      setShowPendModal(true);
      return;
    }
    if (type === 'resolve') {
      setResolveComment('');
      setShowResolveModal(true);
    }
  };

  const shouldShowActions = useMemo(() => !isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus), [caseInfo?.lifecycle, lifecycleStatus]);

  const lifecycleActionMap = useMemo(() => ({
    WL: [
      { key: 'pend', label: 'Pend', variant: 'secondary', onClick: () => openActionModal('pend') },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    CREATED: [
      { key: 'pend', label: 'Pend', variant: 'secondary', onClick: () => openActionModal('pend') },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    IN_WORKLIST: [
      { key: 'pend', label: 'Pend', variant: 'secondary', onClick: () => openActionModal('pend') },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    OPEN: [
      { key: 'pend', label: 'Pend', variant: 'secondary', onClick: () => openActionModal('pend') },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    ACTIVE: [
      { key: 'pend', label: 'Pend', variant: 'secondary', onClick: () => openActionModal('pend') },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    IN_PROGRESS: [
      { key: 'unpend', label: 'Resume', variant: 'primary', onClick: () => setShowUnpendModal(true) },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    WAITING: [
      { key: 'unpend', label: 'Resume', variant: 'primary', onClick: () => setShowUnpendModal(true) },
    ],
    PENDING: [
      { key: 'unpend', label: 'Resume', variant: 'primary', onClick: () => setShowUnpendModal(true) },
    ],
    DONE: [],
  }), [openActionModal]);

  const isQcContext = String(caseInfo?.qc?.status || caseInfo?.qcStatus || '').trim() !== '' || String(caseInfo?.state || '').toUpperCase() === 'IN_QC';
  const isUnassignedWorkbasket = !caseInfo?.assignedToXID && Boolean(caseInfo?.workbasketName || caseInfo?.ownerTeamId || caseInfo?.queueName);
  const lifecycleQuickActions = useMemo(() => {
    if (isViewOnlyMode) return [];
    if (isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus)) return [];
    if (isQcContext) return [];
    if (isUnassignedWorkbasket && !routedTeamCannotResolve) return [];
    const actions = lifecycleActionMap[lifecycleStatus] || [];
    if (isRouted) {
      if (routedTeamCannotResolve) {
        return actions.map((action) => action.key === 'resolve' ? { ...action, key: 'submit', label: 'Submit', onClick: () => openActionModal('resolve') } : action);
      } else {
        return actions.filter((action) => action.key !== 'resolve' && action.key !== 'pend');
      }
    }
    return actions;
  }, [isViewOnlyMode, caseInfo?.lifecycle, lifecycleActionMap, lifecycleStatus, routedTeamCannotResolve, isQcContext, isUnassignedWorkbasket]);

  const canPerformLifecycleActions = lifecycleQuickActions.length > 0;
  const canRouteDocket = canRouteDocketByPolicy({ caseInfo, isViewOnlyMode, routingTeams });
  const showQcActions = false;
  const isAnyModalOpen = Boolean(
    showPendModal
    || showResolveModal
    || showAssignModal
    || showUnpendModal
    || showFileModal
    || confirmModal
  );



  const handleSubmitQcAction = async () => {
    if (!qcComment.trim()) {
      showWarning('Comment is mandatory for QC action');
      return;
    }
    if (qcSubmitting) return;
    setQcSubmitting(true);
    try {
      const response = await caseApi.qcAction(caseId, qcDecisionType, qcComment.trim());
      if (response.success) {
        showSuccess(`QC action ${qcDecisionType} recorded.`);
        setShowQcModal(false);
        setQcComment('');
        loadCase({ background: true });
      }
    } catch (error) {
      showError(extractErrorMessage(error, 'Failed to apply QC action.'));
    } finally {
      setQcSubmitting(false);
    }
  };






  const handleAddCommentSuccess = () => {
    commentsListRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  useEffect(() => {
    const handleKeyboardShortcuts = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing || isAnyModalOpen) return;

      const key = event.key.toLowerCase();

      if (key === 'c') {
        event.preventDefault();
        document.getElementById(commentComposerId)?.focus?.();
      }
      if (key === 'r' && canPerformLifecycleActions) {
        event.preventDefault();
        openActionModal('resolve');
      }
    };
    const container = pageContainerRef.current;
    if (!container) return undefined;
    container.addEventListener('keydown', handleKeyboardShortcuts);
    return () => container.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [canPerformLifecycleActions, commentComposerId, isAnyModalOpen, openActionModal]);

  if (!firmSlug) {
    return <RouteErrorFallback title="Invalid firm" message="Unable to open this docket because firm context is missing." backTo={ROUTES.SUPERADMIN_LOGIN} />;
  }

  if (loading || (activeDocketId === caseId && isDocketLoading && !caseData)) {
    return (
      <PlatformShell moduleLabel="Operations" title="Docket details" subtitle="Loading docket context and workflow actions.">
        <Loading message="Loading docket..." />
      </PlatformShell>
    );
  }

  const recovery = getRecoveryPayload(caseQueryError, 'platform_queue');
  const isAccessDenied = caseQueryError && recovery.reasonCode === 'CASE_ACCESS_DENIED';

  if (isAccessDenied) {
    return (
      <PlatformShell moduleLabel="Operations" title="Access restricted" subtitle="You do not have permission to view this docket.">
        <div className="container p-6">
          <AccessDeniedState supportContext={recovery.supportContext} />
        </div>
      </PlatformShell>
    );
  }

  if (!caseData) {
    return (
      <PlatformShell moduleLabel="Operations" title="Docket details" subtitle="Loading docket context and workflow actions.">
        <div className="container">
          <Card>
            {loadError ? <p>{loadError}</p> : null}
            <p>Docket not found</p>
            <Button variant="outline" onClick={() => loadCase()}>
              Retry
            </Button>
          </Card>
        </div>
      </PlatformShell>
    );
  }

  if (!caseInfo) return null;

  return (
    <PlatformShell moduleLabel="Operations" title={formatDocketId(caseInfo?.caseId || caseId)} subtitle={caseInfo?.title || caseInfo?.caseName || 'Docket detail and execution controls.'}>
      <div className="case-detail" ref={pageContainerRef} tabIndex={-1}>
        <div className="case-detail__return">
          <Button type="button" variant="outline" onClick={handleBackToQueue}>
            ← Back to queue
          </Button>
        </div>

        {actionConfirmation ? <div className="case-detail__confirmation">{actionConfirmation}</div> : null}
        <CaseDetailAlerts
          actionError={actionError}
          caseInfo={caseInfo}
          caseId={caseId}
          user={user}
          isViewOnlyMode={isViewOnlyMode}
          canAdminMoveAssignedDocket={canAdminMoveAssignedDocket}
          isMoveLockedByAnotherUser={isMoveLockedByAnotherUser}
          lockOwnerLabel={lockOwnerLabel}
          assigningCase={assigningCase}
          onOpenAssignModal={() => setShowAssignModal(true)}
          onMoveToWorkbasket={handleMoveToWorkbasket}
          onViewUserWorklist={handleViewUserWorklist}
          isInactiveWarning={isInactiveWarning}
          docketSlaStatus={docketSlaStatus}
        />

        {/* Tab Selection Navigation */}
        <StickyTabs tabs={docketTabs} defaultTab={CASE_DETAIL_TABS.OVERVIEW} />

        {/* Clean Dashboard Layout Container */}
        <div className="case-detail-layout-grid flex w-full flex-col gap-6" style={{ padding: '0 24px 24px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
            <div className={activeTab !== CASE_DETAIL_TABS.ACTIVITY ? "lg:col-span-8 flex flex-col gap-6 w-full" : "lg:col-span-12 flex flex-col gap-6 w-full"}>
              {/* Conditional Active Tab Panel Rendering */}
              <Suspense fallback={<CaseDetailPanelSkeleton />}>
                {activeTab === CASE_DETAIL_TABS.OVERVIEW && (
                  <CaseDetailOverviewPanel
                    caseInfo={caseInfo}
                    firmSlug={firmSlug}
                    linkedClientRoute={linkedClientRoute}
                    isInternalWork={isInternalWork}
                    clientName={clientName}
                    clientIdLabel={clientIdLabel}
                    slaDaysLabel={slaDaysLabel}
                    dueDateLabel={dueDateLabel}
                    linkedClientEmail={linkedClientEmail}
                    linkedClientContact={linkedClientContact}
                    linkedClientId={linkedClientId}
                    fromClientRoute={fromClientRoute}
                    loadingClientDockets={loadingClientDockets}
                    clientDockets={clientDockets}
                    returnTo={returnTo}
                    navigate={navigate}
                    descriptionContent={caseInfo?.description}
                    lifecycleStatus={lifecycleStatus}
                    shouldShowActions={shouldShowActions}
                    canPerformLifecycleActions={canPerformLifecycleActions}
                    lifecycleQuickActions={lifecycleQuickActions}
                    actionInFlight={actionInFlight}
                    isViewOnlyMode={isViewOnlyMode}
                    onOpenFileModal={() => { setFileComment(''); setShowFileModal(true); }}
                    showFileAction={!isRouted && !isQcContext && !isUnassignedWorkbasket && !isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus)}
                    canRouteDocket={canRouteDocket}
                    onOpenRouteModal={() => setShowRouteModal(true)}
                    forceQcReview={forceQcReview}
                    onForceQcReviewChange={setForceQcReview}
                    isQcContext={isQcContext}
                    isUnassignedWorkbasket={isUnassignedWorkbasket}
                    isTerminal={isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus)}
                    openSidebar={openSidebar}
                    runGuardedAction={runGuardedAction}
                    setCloneModalOpen={setCloneModalOpen}
                    canCloneDocket={canCloneDocket}
                    slaBadgeClass={slaBadgeClass}
                    slaBadgeLabel={slaBadgeLabel}
                    categoryLabel={categoryLabel}
                    subcategoryLabel={subcategoryLabel}
                    locationBadges={locationBadges}
                  />
                )}
                {activeTab === CASE_DETAIL_TABS.ATTACHMENTS && (
                  <CaseDetailAttachmentsPanel
                    caseId={caseId}
                    attachments={attachments}
                    accessMode={accessMode}
                    permissions={permissions}
                    caseData={caseData}
                    lifecycleStatus={lifecycleStatus}
                    actionInFlight={actionInFlight}
                    isViewOnlyMode={isViewOnlyMode}
                    routedTeamCannotResolve={routedTeamCannotResolve}
                    isQcContext={isQcContext}
                    isUnassignedWorkbasket={isUnassignedWorkbasket}
                    onOpenFileModal={() => { setFileComment(''); setShowFileModal(true); }}
                    onRefreshCase={loadCase}
                    sectionLoading={sectionLoading.attachments}
                    selectedFile={selectedFile}
                    uploadingFile={uploadingFile}
                    uploadProgress={uploadProgress}
                    fileDescription={fileDescription}
                    onUploadFile={handleUploadFile}
                    onFileSelect={handleFileSelect}
                    onFileDescriptionChange={setFileDescription}
                  />
                )}
                {activeTab === CASE_DETAIL_TABS.ACTIVITY && (
                  <CaseDetailActivityPanel
                    timelineFilter={timelineFilter}
                    onTimelineFilterChange={setTimelineFilter}
                    timelineLoading={timelineLoading}
                    mergedTimelineEvents={mergedTimelineEvents}
                    timelinePage={timelinePage}
                    timelineHasNextPage={timelineHasNextPage}
                    onPrevTimelinePage={() => setTimelinePage((p) => Math.max(1, p - 1))}
                    onNextTimelinePage={() => setTimelinePage((p) => p + 1)}
                    sectionLoading={sectionLoading.comments}
                    commentsListRef={commentsListRef}
                    visibleComments={visibleComments}
                    comments={comments}
                    onLoadOlderComments={() => setCommentWindowSize((size) => size + INITIAL_VIRTUAL_WINDOW)}
                    initialVirtualWindow={INITIAL_VIRTUAL_WINDOW}
                    accessMode={accessMode}
                    permissions={permissions}
                    caseData={caseData}
                    commentComposerId={commentComposerId}
                    newComment={newComment}
                    onNewCommentChange={setNewComment}
                    onAddComment={handleAddComment}
                    submitting={submitting}
                  />
                )}
                {activeTab === CASE_DETAIL_TABS.KNOWLEDGE && (
                  <LinkedKnowledgeSection
                    caseId={caseId}
                    categoryLabel={categoryLabel}
                    clientMongoId={clientMongoId}
                    firmSlug={firmSlug}
                    isAdmin={user?.role === 'admin' || user?.role === 'owner' || permissions.isAdmin}
                  />
                )}
                {activeTab === CASE_DETAIL_TABS.DOCUMENT_PACKS && (
                  <CaseDetailDocumentPacksPanel
                    caseId={caseId}
                    caseInternalId={caseInfo?.caseInternalId || caseData?.case?.caseInternalId || caseData?.caseInternalId || ''}
                    attachments={attachments}
                    onRefreshCase={loadCase}
                  />
                )}
                {activeTab === CASE_DETAIL_TABS.EXCEPTIONS && (
                  <CaseDetailExceptionsPanel
                    caseInternalId={caseInfo?.caseInternalId || caseData?.case?.caseInternalId || caseData?.caseInternalId || ''}
                    onRefreshCase={loadCase}
                  />
                )}
                {activeTab === CASE_DETAIL_TABS.EFFORT && (
                  <CaseDetailEffortPanel
                    caseId={caseId}
                    caseInternalId={caseInfo?.caseInternalId || caseData?.case?.caseInternalId || caseData?.caseInternalId || ''}
                    caseInfo={caseInfo}
                    user={user}
                    onRefreshCase={loadCase}
                  />
                )}
                {activeTab === CASE_DETAIL_TABS.EMAIL_LOGS && (
                  <CaseDetailEmailsPanel
                    caseId={caseId}
                  />
                )}
              </Suspense>
            </div>

            {/* Right Column: Workflow Actions & Comments Sidebar */}
            {activeTab !== CASE_DETAIL_TABS.ACTIVITY && (
              <div className="lg:col-span-4 flex flex-col gap-6 w-full">
                {/* Comments Card */}
                <section className="case-card border border-gray-100 bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    💬 Docket Comments
                  </h2>

                  {(accessMode.canComment || permissions.canAddComment(caseData)) && (
                    <div className="case-detail__add-comment flex flex-col gap-3 mb-2 pb-2">
                      <Textarea
                        label="Add Comment"
                        id={commentComposerId}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Type a comment..."
                        rows={3}
                        className="case-detail__comment-input"
                        enableMentions={true}
                      />
                      <div className="case-detail__composer-actions flex justify-end">
                        <Button variant="primary" onClick={handleAddComment} disabled={!newComment.trim() || submitting}>
                          {submitting ? 'Adding…' : 'Add Comment'}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="case-detail__comments overflow-y-auto max-h-[400px] pr-2" ref={commentsListRef}>
                    {sectionLoading.comments ? (
                      <div className="case-detail__section-skeleton" aria-hidden="true">
                        {Array.from({ length: 3 }).map((_, idx) => <div key={`comment-skeleton-${idx}`} className="case-detail__skeleton-row" />)}
                      </div>
                    ) : visibleComments.length === 0 ? (
                      <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-xl text-center">No comments added yet.</p>
                    ) : (
                      <DocketComments comments={visibleComments} />
                    )}
                  </div>

                  {comments.length > visibleComments.length ? (
                    <div className="case-detail__virtual-actions">
                      <Button variant="outline" size="small" onClick={() => setCommentWindowSize((size) => size + INITIAL_VIRTUAL_WINDOW)}>
                        Load older comments ({comments.length - visibleComments.length} remaining)
                      </Button>
                    </div>
                  ) : null}
                </section>

                {/* Workflow Actions Card */}
                {shouldShowActions ? (
                  <section className="case-card border border-gray-100 bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      ⚡ Workflow Actions
                    </h2>
                    <div className="flex flex-col gap-3">
                      {/* Primary Actions (Resolve / Submit, Resume / Unpend) */}
                      <div className="flex flex-col gap-2">
                        {canPerformLifecycleActions && lifecycleQuickActions.some((action) => ['resolve', 'submit'].includes(action.key)) && (
                          <Button
                            variant="primary"
                            onClick={() => openActionModal('resolve')}
                            disabled={actionInFlight}
                            className="w-full justify-center shadow-sm hover:shadow"
                          >
                            {routedTeamCannotResolve ? 'Submit Routed Docket' : 'Resolve Docket'}
                          </Button>
                        )}
                        {canPerformLifecycleActions && lifecycleQuickActions.some((action) => action.key === 'unpend') && (
                          <Button
                            variant="primary"
                            onClick={() => setShowUnpendModal(true)}
                            disabled={actionInFlight}
                            className="w-full justify-center shadow-sm hover:shadow"
                          >
                            Resume Docket
                          </Button>
                        )}
                      </div>

                      {/* Secondary Actions (Pend, Route, File) */}
                      <div className="grid grid-cols-2 gap-2">
                        {canPerformLifecycleActions && lifecycleQuickActions.some((action) => action.key === 'pend') && (
                          <Button
                            variant="secondary"
                            onClick={() => openActionModal('pend')}
                            disabled={actionInFlight}
                            className="w-full justify-center shadow-sm hover:shadow"
                          >
                            Pend
                          </Button>
                        )}
                        {canRouteDocket && (
                          <Button
                            variant="outline"
                            onClick={() => setShowRouteModal(true)}
                            disabled={actionInFlight}
                            className="w-full justify-center shadow-sm hover:shadow"
                          >
                            Route
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {!isViewOnlyMode && !isRouted && !isQcContext && !isUnassignedWorkbasket && !isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus) && (
                          <Button
                            variant="secondary"
                            onClick={() => { setFileComment(''); setShowFileModal(true); }}
                            disabled={actionInFlight}
                            className="w-full justify-center shadow-sm hover:shadow"
                          >
                            File
                          </Button>
                        )}
                      </div>

                      {/* Admin Worklist Movement (if permitted) */}
                      {canAdminMoveAssignedDocket && (
                        <div className="border-t pt-3 mt-1 flex flex-col gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Admin Controls</span>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="small" onClick={() => setShowAssignModal(true)} disabled={isMoveLockedByAnotherUser || assigningCase} className="w-full justify-center text-xs">
                              Move WL
                            </Button>
                            <Button variant="outline" size="small" onClick={handleMoveToWorkbasket} disabled={isMoveLockedByAnotherUser || assigningCase} className="w-full justify-center text-xs">
                              Move WB
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Force QC Review Checkbox */}
                      {canPerformLifecycleActions && (
                        <div className="border-t pt-3 mt-1">
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={forceQcReview}
                              onChange={(e) => setForceQcReview(e.target.checked)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            Force QC Review
                          </label>
                        </div>
                      )}

                      {/* Warnings for QC/Unassigned Workbasket */}
                      {isUnassignedWorkbasket && (
                        <div className="mt-2 text-xs text-amber-600 bg-amber-50/50 border border-amber-200/60 rounded-xl p-3">
                          This docket is currently unassigned in a workbasket. Pull/Assign it from Workbasket flow before personal worklist actions.
                        </div>
                      )}
                      {isQcContext && (
                        <div className="mt-2 text-xs text-blue-600 bg-blue-50/50 border border-blue-200/60 rounded-xl p-3">
                          QC context active. Use QC workbasket actions where appropriate.
                        </div>
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="case-card border border-gray-100 bg-white rounded-2xl p-6 shadow-sm">
                    <p className="text-xs text-gray-500 italic text-center">This docket is in a terminal state ({lifecycleStatus}). Actions are locked.</p>
                  </section>
                )}
              </div>
            )}
          </div>

          {/* Bottom Section: Client history */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full mt-6">
            <div className="lg:col-span-12 flex flex-col gap-6 w-full">
              <Suspense fallback={<CaseDetailPanelSkeleton />}>
                <CaseDetailHistoryPanel
                  loadingClientDockets={loadingClientDockets}
                  clientDockets={clientDockets}
                  clientDocketsError={clientDocketsError}
                  firmSlug={firmSlug}
                  linkedClientRoute={linkedClientRoute}
                  returnTo={returnTo}
                  fromClientRoute={fromClientRoute}
                  navigate={navigate}
                />
              </Suspense>
            </div>
          </div>
        </div>

        <DocketSidebar
          isOpen={sidebarOpen && Boolean(sidebarType)}
          type={sidebarType}
          onClose={() => {
            setSidebarOpen(false);
            setSidebarType(null);
          }}
          caseInfo={caseInfo}
          attachments={attachments}
          timelineEvents={sortedTimelineEvents}
          cfsData={clientFactSheet}
          cfsLoading={loadingClientFactSheet}
          cfsError={clientFactSheetError}
          selectedAttachmentFile={selectedFile}
          attachmentComment={fileDescription}
          uploadingAttachment={uploadingFile}
          uploadProgress={uploadProgress}
          onAttachmentFileChange={setSelectedFile}
          onAttachmentCommentChange={setFileDescription}
          onUploadAttachment={handleUploadFile}
          onGenerateUploadLink={handleGenerateUploadLink}
          uploadLinkGenerating={uploadLinkGenerating}
          uploadLinkResult={uploadLinkResult}
          clientEmail={
            caseInfo?.clientEmail
            || caseInfo?.client?.email
            || caseInfo?.client?.businessEmail
            || caseInfo?.clientData?.email
            || caseInfo?.clientData?.businessEmail
            || caseData?.client?.email
            || caseData?.client?.businessEmail
            || ''
          }
        />

        {/* ─── Modals (positioned outside split pane) ─────────────── */}
        <Modal
          isOpen={cloneModalOpen}
          onClose={() => {
            setCloneModalOpen(false);
            setCloneCategoryId('');
            setCloneSubcategoryId('');
          }}
          title="Clone Docket"
          actions={(
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setCloneModalOpen(false);
                  setCloneCategoryId('');
                  setCloneSubcategoryId('');
                }}
                disabled={cloningCase}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCloneDocket} disabled={!cloneCategoryId || !cloneSubcategoryId || cloningCase}>
                {cloningCase ? 'Cloning…' : 'Clone Docket'}
              </Button>
            </>
          )}
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Create a new docket from this one. This copies core docket context, comments, and attachments, and starts a new execution record; activity timeline and assignments are not copied.
            </p>
            <Select
              label="Category"
              value={cloneCategoryId}
              onChange={(event) => {
                setCloneCategoryId(event.target.value);
                setCloneSubcategoryId('');
              }}
              disabled={loadingCloneCatalog || cloningCase}
            >
              <option value="">Select category</option>
              {categoryCatalog.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <Select
                label="Subcategory"
                value={cloneSubcategoryId}
                onChange={(event) => setCloneSubcategoryId(event.target.value)}
                disabled={!cloneCategoryId || cloningCase}
              >
                <option value="">Select subcategory</option>
                {cloneSubcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Modal>

        <CaseWorkflowModals
          showPendModal={showPendModal}
          setShowPendModal={setShowPendModal}
          pendComment={pendComment}
          setPendComment={setPendComment}
          pendingUntil={pendingUntil}
          setPendingUntil={setPendingUntil}
          pendingMinDate={getISODateInTimezone(new Date())}
          pendingCase={pendingCase}
          handlePendCase={handlePendCase}
          lifecycleWarnings={lifecycleWarnings}
          showResolveModal={showResolveModal}
          setShowResolveModal={setShowResolveModal}
          resolveComment={resolveComment}
          setResolveComment={setResolveComment}
          resolvingCase={routedTeamCannotResolve ? submittingRouted : resolvingCase}
          handleResolveCase={routedTeamCannotResolve ? handleSubmitRouted : handleResolveCase}
          routedTeamCannotResolve={routedTeamCannotResolve}
          showQcModal={showQcModal}
          setShowQcModal={setShowQcModal}
          qcDecisionType={qcDecisionType}
          qcComment={qcComment}
          setQcComment={setQcComment}
          qcSubmitting={qcSubmitting}
          handleSubmitQcAction={handleSubmitQcAction}
          showAssignModal={showAssignModal}
          setShowAssignModal={setShowAssignModal}
          assignComment={assignComment}
          setAssignComment={setAssignComment}
          assigningCase={assigningCase}
          handleAssignDocket={handleAssignDocket}
          assignUser={assignUser}
          setAssignUser={setAssignUser}
          availableAssignees={availableAssignees}
          assigneeIntelligenceLoading={workloadLoading && canUseAssignmentIntelligence}
          assigneeIntelligenceError={workloadError && canUseAssignmentIntelligence}
          showRouteModal={showRouteModal}
          setShowRouteModal={setShowRouteModal}
          routeTeamId={routeTeamId}
          setRouteTeamId={setRouteTeamId}
          routingNote={routingNote}
          setRoutingNote={setRoutingNote}
          routingTeams={routingTeams.filter((team) => String(team._id) !== String(caseInfo?.workbasketId || caseInfo?.ownerTeamId || ''))}
          handleRouteToTeam={handleRouteToTeam}
          routeSubmitting={routeSubmitting}
          showFileModal={showFileModal}
          setShowFileModal={setShowFileModal}
          fileComment={fileComment}
          setFileComment={setFileComment}
          filingCase={filingCase}
          handleFileCase={handleFileCase}
          showUnpendModal={showUnpendModal}
          setShowUnpendModal={setShowUnpendModal}
          unpendComment={unpendComment}
          setUnpendComment={setUnpendComment}
          unpendingCase={unpendingCase}
          handleUnpendCase={handleUnpendCase}
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
      </div>
    </PlatformShell>
  );
};
