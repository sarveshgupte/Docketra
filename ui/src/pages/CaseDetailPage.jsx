/**
 * Case Detail Page
 * PR #45: Added view-only mode indicator and audit log display
 * PR: Comprehensive CaseHistory & Audit Trail - Added view tracking and history display
 */

import { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
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
import { CASE_DETAIL_TABS, VALID_CASE_DETAIL_TAB_NAMES, API_BASE_URL } from '../utils/constants';
import { DocketSidebar } from '../components/docket/DocketSidebar';
import { DocketComments } from '../components/docket/DocketComments';
import { McaPreFilingValidationGrid } from '../components/docket/McaPreFilingValidationGrid';
import { mcaComplianceApi } from '../api/mcaCompliance.api';
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
import { DocketCommentsSection } from './caseDetail/DocketCommentsSection';
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
const CaseDetailEmailsPanel = lazy(() => import('./caseDetail/CaseDetailEmailsPanel').then((module) => ({ default: module.CaseDetailEmailsPanel })));
import { useClientDocketHistory } from './caseDetail/useClientDocketHistory';
import {
  ACTION_RETRY_KEY,
  getBusinessLifecycleLabel,
  getDocketAssignedToLabel,
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
  const forceViewOnlyMode = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return params.get('mode') === 'view' || location.state?.viewOnly === true;
  }, [location.search, location.state?.viewOnly]);

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
  const isRouted = Boolean(caseInfo?.routedToTeamId) && Boolean(caseInfo?.routeOriginatorTeamId) && String(caseInfo?.routedToTeamId) !== String(caseInfo?.routeOriginatorTeamId);
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

  const clientName = caseData?.client?.businessName
    || caseData?.client?.name
    || caseData?.client?.legalName
    || caseData?.client?.clientFactSheet?.basicInfo?.clientName
    || caseInfo?.clientName
    || caseInfo?.businessName
    || caseInfo?.clientSnapshot?.businessName
    || caseData?.clientSnapshot?.businessName
    || caseData?.docketDetail?.client?.name
    || '—';
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
  const linkedClientPhone = caseData?.client?.primaryContactNumber
    || caseData?.client?.contactPersonPhoneNumber
    || caseData?.client?.clientFactSheet?.basicInfo?.phone
    || caseInfo?.client?.primaryContactNumber
    || caseInfo?.client?.phone
    || caseInfo?.clientPhone
    || '';
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
  const hasRealMcaDraft = Boolean(caseData?.mcaFilingDraft);
  const docketTabs = useMemo(() => {
    const tabs = [
      { name: CASE_DETAIL_TABS.OVERVIEW, label: 'Overview' },
      { name: CASE_DETAIL_TABS.ATTACHMENTS, label: 'Attachments', badge: attachments.length > 0 ? String(attachments.length) : null },
      { name: CASE_DETAIL_TABS.ACTIVITY, label: 'Activity' },
      { name: CASE_DETAIL_TABS.EMAIL_LOGS, label: 'Emails' },
      { name: CASE_DETAIL_TABS.KNOWLEDGE, label: 'Linked Knowledge' },
      ...(!isInternalWork ? [{ name: CASE_DETAIL_TABS.HISTORY, label: 'History', badge: clientDockets.length > 0 ? String(clientDockets.length) : null }] : []),
    ];
    if (hasRealMcaDraft) {
      tabs.push({ name: CASE_DETAIL_TABS.MCA_FILING, label: 'MCA V3 Pre-Filing' });
    }
    return tabs;
  }, [attachments.length, clientDockets.length, hasRealMcaDraft, isInternalWork]);
  const isHexObjectId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());
  const rawQueueCandidate = caseInfo?.workbasketName
    || caseInfo?.queueName
    || caseInfo?.ownerTeamName
    || caseInfo?.routedToTeamName
    || caseData?.docketDetail?.workbasket?.name
    || (typeof caseInfo?.workbasket === 'object' ? caseInfo.workbasket?.name : null)
    || (typeof caseInfo?.workbasket === 'string' && !isHexObjectId(caseInfo.workbasket) ? caseInfo.workbasket : null);
  const queueLabel = rawQueueCandidate || (caseInfo?.ownerTeamId || caseInfo?.workbasketId ? 'General Workbasket' : '—');

  const relatedEmployeeUser = caseInfo?.relatedEmployeeUser || caseData?.relatedEmployeeUser || null;
  const relatedEmployeeName = (() => {
    if (!relatedEmployeeUser || typeof relatedEmployeeUser !== 'object') return null;
    if (relatedEmployeeUser.status === 'not_applicable' || relatedEmployeeUser.status === 'none') return null;
    const n = relatedEmployeeUser.name || (relatedEmployeeUser.email ? relatedEmployeeUser.email.split('@')[0] : null) || relatedEmployeeUser.xID;
    if (!n || String(n).trim().toLowerCase() === 'user') return null;
    return String(n).trim();
  })();
  const dueDateLabel = caseInfo?.dueDate || caseInfo?.slaDueAt || caseInfo?.deadlineAt || caseInfo?.pendingUntil || caseInfo?.reopenDate || null;

  // Compute SLA remaining days: positive = days left, negative = overdue
  const slaRemainingDays = (() => {
    const dueTs = dueDateLabel ? new Date(dueDateLabel).getTime() : null;
    if (!dueTs || !Number.isFinite(dueTs)) return null;
    const nowTs = Date.now();
    const diffMs = dueTs - nowTs;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  })();

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
      // Direct SLA day fields — highest priority
      caseInfo?.slaDays,
      caseInfo?.tatDaysSnapshot,
      caseInfo?.tatDays,
      caseInfo?.slaConfigSnapshot?.slaDays,
      caseInfo?.slaConfigSnapshot?.tatDays,
      caseInfo?.sla?.days,
      caseInfo?.sla?.tatDays,
      caseInfo?.slaSnapshot?.days,
      caseInfo?.categorySnapshot?.slaDays,
      caseData?.slaDays,
      // tatDurationMinutes fallback — last resort (can produce misleadingly small numbers)
      caseInfo?.slaConfigSnapshot?.tatDurationMinutes != null ? Math.ceil(Number(caseInfo.slaConfigSnapshot.tatDurationMinutes) / 480) : null,
      caseData?.slaConfigSnapshot?.tatDurationMinutes != null ? Math.ceil(Number(caseData.slaConfigSnapshot.tatDurationMinutes) / 480) : null,
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
  const displayLifecycleLabel = getBusinessLifecycleLabel(caseInfo);
  const displayAssigneeLabel = getDocketAssignedToLabel(caseInfo);
  const normalizedUserXid = String(user?.xID || '').trim().toUpperCase();
  const normalizedAssignedXid = String(caseInfo?.assignedToXID || '').trim().toUpperCase();
  const locationBadges = useMemo(() => {
    const badges = [];
    const queueHint = String(caseInfo?.queueContext || caseInfo?.queueName || caseInfo?.workbasketName || '').toUpperCase();
    if (isRouted) badges.push('Routed');
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
  }, [caseInfo, lifecycleStatus, isRouted, normalizedAssignedXid, normalizedUserXid]);
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
          sendBrowserNotification('DocketsHQ update', 'A new comment was added to this docket.');
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
    const shouldKeepLonger = actionConfirmation.includes('will reopen on') && actionConfirmation.includes('in your WL');
    const timer = setTimeout(() => {
      setActionError(null);
      setActionConfirmation('');
    }, shouldKeepLonger ? 10000 : 5000);
    return () => clearTimeout(timer);
  }, [actionError, actionConfirmation]);

  // Track exit on beforeunload (best-effort for tab close)
  // Note: sendBeacon doesn't support custom headers, so we rely on cookie-based auth
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use sendBeacon for better reliability on page unload
      // Note: This is best-effort and may not work in all browsers/scenarios
      if (navigator.sendBeacon) {
        // Use API_BASE_URL from constants instead of window.location.origin which fails under cross-origin hosting
        const url = `${API_BASE_URL}/cases/${caseId}/track-exit`;
        
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
  const isViewOnlyMode = Boolean(accessMode.isViewOnlyMode || forceViewOnlyMode);
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
    if (!value) return '';
    if (looksEncryptedPayload(value)) return '';
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

  const loadCaseHistory = useCallback(async () => {
    if (!caseId) return;
    try {
      const response = await caseApi.getCaseHistory(caseId);
      const rawEvents = response?.data?.history || response?.data?.events || response?.data || [];
      const historyList = Array.isArray(rawEvents) ? rawEvents : [];
      if (historyList.length > 0) {
        setCaseData((prev) => mergeCaseData(prev, { history: historyList }, { source: 'history-fetch' }));
      }
    } catch (_err) {
      // Best-effort history refresh
    }
  }, [caseId, mergeCaseData]);

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
        } else if (type === 'history') {
          void loadCaseHistory();
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

  const actionInFlight = assigningCase || pendingCase || resolvingCase || unpendingCase || filingCase || routeSubmitting || submittingRouted;
  const openActionModal = useCallback((type) => {
    if (type === 'pend') {
      setPendComment('');
      setShowPendModal(true);
      return;
    }
    if (type === 'resolve') {
      setResolveComment('');
      setShowResolveModal(true);
    }
  }, []);

  const shouldShowActions = useMemo(
    () => !isViewOnlyMode && !isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus),
    [caseInfo?.lifecycle, isViewOnlyMode, lifecycleStatus],
  );

  const lifecycleActionMap = useMemo(() => ({
    WL: [
      { key: 'pend', label: 'Pend', variant: 'outline', onClick: () => openActionModal('pend') },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    CREATED: [
      { key: 'pend', label: 'Pend', variant: 'outline', onClick: () => openActionModal('pend') },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    IN_WORKLIST: [
      { key: 'pend', label: 'Pend', variant: 'outline', onClick: () => openActionModal('pend') },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    OPEN: [
      { key: 'pend', label: 'Pend', variant: 'outline', onClick: () => openActionModal('pend') },
      { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => openActionModal('resolve') },
    ],
    ACTIVE: [
      { key: 'pend', label: 'Pend', variant: 'outline', onClick: () => openActionModal('pend') },
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
  const showFileAction = !routedTeamCannotResolve && !isQcContext && !isUnassignedWorkbasket && !isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus);
  const lifecycleQuickActions = useMemo(() => {
    if (isViewOnlyMode) return [];
    if (isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus)) return [];
    if (isQcContext) return [];
    if (isUnassignedWorkbasket && !routedTeamCannotResolve) return [];
    const actions = lifecycleActionMap[lifecycleStatus] || [];
    if (isRouted) {
      if (routedTeamCannotResolve) {
        return actions.map((action) => (action.key === 'resolve' ? { ...action, key: 'submit', label: 'Submit', onClick: () => openActionModal('resolve') } : action));
      }
      return actions.filter((action) => action.key !== 'resolve' && action.key !== 'pend');
    }
    return actions;
  }, [isViewOnlyMode, caseInfo?.lifecycle, lifecycleActionMap, lifecycleStatus, isRouted, routedTeamCannotResolve, isQcContext, isUnassignedWorkbasket, openActionModal]);

  const canPerformLifecycleActions = lifecycleQuickActions.length > 0;
  const canRouteDocket = canRouteDocketByPolicy({ caseInfo, isViewOnlyMode, routingTeams });
  const isAnyModalOpen = Boolean(
    showPendModal
    || showResolveModal
    || showAssignModal
    || showUnpendModal
    || showFileModal
    || showRouteModal
    || showQcModal
    || cloneModalOpen
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
    commentsListRef.current?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  useEffect(() => {
    const handleKeyboardShortcuts = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (typing || isAnyModalOpen) return;

      const key = event.key.toLowerCase();
      const hasModifier = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
      const hasSelection = Boolean(window.getSelection?.()?.toString?.());
      if (hasModifier || hasSelection) return;

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
      <PlatformShell title={null}>
        <Loading message="Loading docket..." />
      </PlatformShell>
    );
  }

  const recovery = getRecoveryPayload(caseQueryError, 'platform_queue');
  const isAccessDenied = caseQueryError && recovery.reasonCode === 'CASE_ACCESS_DENIED';

  if (isAccessDenied) {
    return (
      <PlatformShell title="Access restricted">
        <div className="w-full max-w-7xl mx-auto py-6">
          <AccessDeniedState supportContext={recovery.supportContext} />
        </div>
      </PlatformShell>
    );
  }

  if (!caseData) {
    return (
      <PlatformShell title={null}>
        <div className="w-full max-w-7xl mx-auto py-6">
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

  const canComment = Boolean(accessMode.canComment || permissions.canAddComment(caseData));
  const showWideWorkspace = activeTab === CASE_DETAIL_TABS.ACTIVITY || activeTab === CASE_DETAIL_TABS.MCA_FILING || !shouldShowActions;
  const slaCountdownToneClass = slaRemainingDays == null
    ? ''
    : Number(slaRemainingDays) < 0
      ? 'bg-rose-50 text-rose-700 border border-rose-200'
      : Number(slaRemainingDays) <= 3
        ? 'bg-amber-50 text-amber-800 border border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

  return (
    <PlatformShell
      title={null}
      actions={(
        <Button type="button" variant="primary" onClick={() => navigate(ROUTES.CREATE_CASE(firmSlug))}>
          + New Docket
        </Button>
      )}
    >
      <div className="case-detail docket-detail-redesign" ref={pageContainerRef} tabIndex={-1}>
        <section className="docket-detail-hero">
          <div className="docket-detail-hero__topline">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleBackToQueue}>
                ← Back to queue
              </Button>
              {(hasPrev || hasNext) ? (
                <div className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={!hasPrev}
                    onClick={handlePrevCase}
                    aria-label="Previous docket in queue"
                  >
                    Prev
                  </Button>
                  <span className="px-1.5 font-mono text-[11px] tabular-nums text-slate-500">
                    {sourceIndex + 1} / {sourceList.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={!hasNext}
                    onClick={handleNextCase}
                    aria-label="Next docket in queue"
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="docket-detail-hero__badges">
              {isViewOnlyMode ? <span className="docket-soft-chip">View only</span> : null}
              {slaBadgeLabel ? <span className={`status-badge status-badge--${slaBadgeClass}`}>{slaBadgeLabel}</span> : null}
            </div>
          </div>

          <div className="docket-detail-hero__main">
            <div className="docket-detail-hero__identity">
              <p className="docket-detail-hero__eyebrow">Active docket</p>
              <h1>{formatDocketId(caseInfo?.caseId || caseId)}</h1>
              {caseInfo?.title ? (
                <p className="mt-0.5 text-xs font-normal text-slate-600">{caseInfo.title}</p>
              ) : null}
              <div className="docket-detail-hero__tags">
                <span className="docket-tag docket-tag--category">
                  {categoryLabel || 'Uncategorised'}
                </span>
                {subcategoryLabel ? (
                  <>
                    <span className="docket-tag-separator">/</span>
                    <span className="docket-tag docket-tag--subcategory">
                      {subcategoryLabel}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="docket-detail-hero__metrics" aria-label="Docket summary">
              <div>
                <span>Client Name</span>
                <strong>
                  {isInternalWork ? (
                    <span className="font-normal text-slate-500">Internal Work</span>
                  ) : linkedClientRoute && clientName && clientName !== '—' ? (
                    <Link to={linkedClientRoute} className="case-detail-table__link font-semibold hover:underline">
                      {clientName}
                    </Link>
                  ) : (
                    clientName || '—'
                  )}
                </strong>
              </div>
              <div>
                <span>Client ID</span>
                <strong className="font-mono tabular-nums">{clientIdLabel || '—'}</strong>
              </div>
              <div>
                <span>Lifecycle</span>
                <strong>{displayLifecycleLabel || 'Active'}</strong>
              </div>
              <div>
                <span>Assigned To</span>
                <strong>{displayAssigneeLabel || 'Unassigned'}</strong>
              </div>
              <div>
                <span>Workbasket</span>
                <strong title={queueLabel}>{queueLabel || '—'}</strong>
              </div>
              {relatedEmployeeName ? (
                <div>
                  <span>Related Employee</span>
                  <strong className="font-medium text-blue-700">
                    {relatedEmployeeName}
                  </strong>
                </div>
              ) : null}
              <div>
                <span>Due</span>
                <strong className="tabular-nums">{dueDateLabel ? formatDateTime(dueDateLabel) : 'No date'}</strong>
                {slaRemainingDays != null ? (
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${slaCountdownToneClass}`}>
                    {Number(slaRemainingDays) < 0 ? `${Math.abs(Number(slaRemainingDays))} days overdue` : `+${slaRemainingDays} days`}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="docket-detail-tabs-wrap">
          <StickyTabs tabs={docketTabs} defaultTab={CASE_DETAIL_TABS.OVERVIEW} />
        </div>

        <div className="case-detail-layout-grid docket-detail-layout grid w-full grid-cols-1 items-start gap-5 xl:grid-cols-12">
          {/* Column 1: Left Column (Properties & Quick Access) */}
          <div className="order-1 flex w-full flex-col gap-4 lg:col-span-4 xl:col-span-3">
            <CaseDetailSummaryHeader
              caseInfo={caseInfo}
              docketStatusLabel={displayLifecycleLabel || 'Active'}
              locationBadges={locationBadges}
              slaDaysLabel={slaDaysLabel}
            />

            <div className="case-card flex flex-col gap-2.5 rounded-[var(--dt-radius-card,6px)] border border-slate-200 bg-white p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick Access</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => runGuardedAction(() => openSidebar('cfs'), 'Unable to open CFS panel right now.')}
                  aria-label="Open client fact sheet"
                  title="Open Client Fact Sheet"
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  Client Fact Sheet
                </button>
                {canCloneDocket ? (
                  <button
                    type="button"
                    onClick={() => runGuardedAction(() => setCloneModalOpen(true), 'Unable to open clone docket right now.')}
                    aria-label="Clone docket"
                    title="Clone Docket"
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    Clone Docket
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Column 2: Center Workspace */}
          <div className={showWideWorkspace
            ? 'order-2 flex w-full flex-col gap-4 lg:col-span-8 xl:col-span-9'
            : 'order-2 flex w-full flex-col gap-4 lg:col-span-8 xl:col-span-6'}
          >
            {actionConfirmation ? (
              <div className="case-detail__confirmation" role="status">{actionConfirmation}</div>
            ) : null}
            <CaseDetailAlerts
              actionError={actionError}
              caseInfo={caseInfo}
              caseId={caseId}
              user={user}
              isViewOnlyMode={isViewOnlyMode}
              retryQueueCount={retryQueue.length}
            />

            <Suspense fallback={<CaseDetailPanelSkeleton />}>
              {activeTab === CASE_DETAIL_TABS.OVERVIEW ? (
                <>
                  <CaseDetailOverviewPanel
                    caseInfo={caseInfo}
                    firmSlug={firmSlug}
                    isInternalWork={isInternalWork}
                    linkedClientEmail={linkedClientEmail}
                    linkedClientContact={linkedClientContact}
                    linkedClientId={linkedClientId}
                    loadingClientDockets={loadingClientDockets}
                    clientDockets={clientDockets}
                    navigate={navigate}
                    descriptionContent={descriptionContent}
                    lifecycleStatus={lifecycleStatus}
                    isQcContext={isQcContext}
                    isUnassignedWorkbasket={isUnassignedWorkbasket}
                    isTerminal={isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus)}
                  />
                  <DocketCommentsSection
                    sectionLoading={sectionLoading.comments}
                    commentsListRef={commentsListRef}
                    visibleComments={visibleComments}
                    comments={comments}
                    onLoadOlderComments={() => setCommentWindowSize((size) => size + INITIAL_VIRTUAL_WINDOW)}
                    canComment={canComment}
                    commentComposerId={commentComposerId}
                    newComment={newComment}
                    onNewCommentChange={setNewComment}
                    onAddComment={handleAddComment}
                    submitting={submitting}
                  />
                </>
              ) : null}

              {activeTab === CASE_DETAIL_TABS.ATTACHMENTS ? (
                <CaseDetailAttachmentsPanel
                  caseId={caseId}
                  attachments={attachments}
                  sectionLoading={sectionLoading.attachments}
                  selectedFile={selectedFile}
                  uploadingFile={uploadingFile}
                  uploadProgress={uploadProgress}
                  fileDescription={fileDescription}
                  onUploadFile={handleUploadFile}
                  onFileSelect={handleFileSelect}
                  onFileDescriptionChange={setFileDescription}
                  onOpenRequestTab={() => {
                    const params = new URLSearchParams(location.search || '');
                    params.set('tab', CASE_DETAIL_TABS.EMAIL_LOGS);
                    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
                  }}
                />
              ) : null}

              {activeTab === CASE_DETAIL_TABS.ACTIVITY ? (
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
                  accessMode={accessMode}
                  permissions={permissions}
                  caseData={caseData}
                  commentComposerId={commentComposerId}
                  newComment={newComment}
                  onNewCommentChange={setNewComment}
                  onAddComment={handleAddComment}
                  submitting={submitting}
                />
              ) : null}

              {activeTab === CASE_DETAIL_TABS.EMAIL_LOGS ? (
                <CaseDetailEmailsPanel
                  caseId={caseId}
                  caseInfo={caseInfo}
                  clientEmail={linkedClientEmail}
                  clientPhone={linkedClientPhone}
                  clientName={clientName}
                  onRefreshCase={loadCase}
                />
              ) : null}

              {activeTab === CASE_DETAIL_TABS.KNOWLEDGE ? (
                <LinkedKnowledgeSection
                  categoryId={caseData?.categoryId || caseData?.docketDetail?.category?.id || caseInfo?.category?.id || ''}
                  subcategoryId={caseData?.subcategoryId || caseData?.docketDetail?.subcategory?.id || caseInfo?.subcategory?.id || ''}
                  categoryLabel={categoryLabel}
                  subcategoryLabel={subcategoryLabel}
                  caseSop={caseInfo?.sop}
                  caseChecklist={caseInfo?.checklist}
                  firmSlug={firmSlug}
                  canManageSettings={Boolean(permissions.isAdmin) || Boolean(user?.isPrimaryAdmin)}
                />
              ) : null}

              {activeTab === CASE_DETAIL_TABS.HISTORY ? (
                <CaseDetailHistoryPanel
                  loadingClientDockets={loadingClientDockets}
                  clientDockets={clientDockets}
                  clientDocketsError={clientDocketsError}
                  firmSlug={firmSlug}
                  linkedClientRoute={linkedClientRoute}
                  returnTo={returnTo}
                  fromClientRoute={fromClientRoute}
                  navigate={navigate}
                  caseInfo={caseInfo}
                />
              ) : null}

              {activeTab === CASE_DETAIL_TABS.MCA_FILING ? (
                hasRealMcaDraft ? (
                  <McaPreFilingValidationGrid
                    filingDraft={caseData.mcaFilingDraft}
                    corporateRecord={{
                      companyName: caseData?.clientName || clientName || 'Corporate Entity',
                      cinOrLlpin: caseData?.cin || caseData?.cinOrLlpin || caseData.mcaFilingDraft?.cinOrLlpin || '—',
                    }}
                    onExportPackage={async () => {
                      showSuccess('MCA V3 upload package validated and ready for submission');
                    }}
                  />
                ) : (
                  <section className="case-card rounded-[var(--dt-radius-card,6px)] border border-slate-200 bg-white p-6 text-center" role="tabpanel">
                    <h2 className="text-sm font-semibold text-slate-900">No MCA V3 filing draft attached</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      MCA Pre-Filing validation appears automatically once structured AOC-4 or MGT-7 financial figures are attached to this docket.
                    </p>
                  </section>
                )
              ) : null}
            </Suspense>
          </div>

          {/* Column 3: Right Workflow Rail */}
          {!showWideWorkspace ? (
            <div className="docket-side-rail order-3 flex w-full flex-col gap-4 lg:col-span-12 xl:col-span-3">
              <section className="case-card docket-action-panel" aria-label="Docket workflow actions">
                <div className="docket-section-heading">
                  <div>
                    <p className="docket-section-kicker">Next step</p>
                    <h2>Workflow</h2>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    {canPerformLifecycleActions && lifecycleQuickActions.some((action) => ['resolve', 'submit'].includes(action.key)) ? (
                      <Button
                        variant="primary"
                        fullWidth
                        onClick={() => openActionModal('resolve')}
                        disabled={actionInFlight}
                      >
                        {routedTeamCannotResolve ? 'Submit Routed Docket' : 'Resolve Docket'}
                      </Button>
                    ) : null}
                    {canPerformLifecycleActions && lifecycleQuickActions.some((action) => action.key === 'unpend') ? (
                      <Button
                        variant="primary"
                        fullWidth
                        onClick={() => setShowUnpendModal(true)}
                        disabled={actionInFlight}
                      >
                        Unpend Docket
                      </Button>
                    ) : null}
                  </div>

                  {(canPerformLifecycleActions && lifecycleQuickActions.some((action) => action.key === 'pend')) || canRouteDocket ? (
                    <div className="grid grid-cols-2 gap-2">
                      {canPerformLifecycleActions && lifecycleQuickActions.some((action) => action.key === 'pend') ? (
                        <Button
                          variant="outline"
                          fullWidth
                          onClick={() => openActionModal('pend')}
                          disabled={actionInFlight}
                        >
                          Pend
                        </Button>
                      ) : null}
                      {canRouteDocket ? (
                        <Button
                          variant="outline"
                          fullWidth
                          onClick={() => setShowRouteModal(true)}
                          disabled={actionInFlight}
                        >
                          Route
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {showFileAction ? (
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => { setFileComment(''); setShowFileModal(true); }}
                      disabled={actionInFlight}
                    >
                      File
                    </Button>
                  ) : null}

                  {canPerformLifecycleActions ? (
                    <div className="mt-1 border-t border-slate-100 pt-3">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={forceQcReview}
                          onChange={(e) => setForceQcReview(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        Force QC Review
                      </label>
                    </div>
                  ) : null}

                  {canAdminMoveAssignedDocket ? (
                    <div className="mt-1 flex flex-col gap-2 border-t border-slate-100 pt-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Admin Worklist Controls
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          fullWidth
                          onClick={() => setShowAssignModal(true)}
                          disabled={isMoveLockedByAnotherUser || assigningCase}
                        >
                          Move WL
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          fullWidth
                          onClick={handleMoveToWorkbasket}
                          disabled={isMoveLockedByAnotherUser || assigningCase}
                        >
                          Move WB
                        </Button>
                      </div>
                      {caseInfo?.assignedToXID ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          fullWidth
                          onClick={() => handleViewUserWorklist(caseInfo.assignedToXID)}
                        >
                          View {caseInfo.assignedToXID} Worklist
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}
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
          clientPhone={linkedClientPhone}
          clientName={clientName}
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
