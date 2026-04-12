/**
 * Case Detail Page
 * PR #45: Added view-only mode indicator and audit log display
 * PR: Comprehensive CaseHistory & Audit Trail - Added view tracking and history display
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Textarea } from '../components/common/Textarea';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Modal } from '../components/common/Modal';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { caseApi } from '../api/case.api';
import { clientApi } from '../api/client.api';
import { categoryService } from '../services/categoryService';
import { extractErrorMessage } from '../services/apiResponse';
import { formatDateTime, getISODateInTimezone } from '../utils/formatDateTime';
import { formatDocketId } from '../utils/formatters';
import { USER_ROLES } from '../utils/constants';
import { LifecycleBadge } from '../../components/LifecycleBadge';
import { DocketSidebar } from '../components/docket/DocketSidebar';
import { DocketComments } from '../components/docket/DocketComments';
import { ActionModal } from '../components/docket/ActionModal';
import { RequestDocumentsModal } from '../../components/RequestDocumentsModal';
import './CaseDetailPage.css';
import { ROUTES } from '../constants/routes';
import { RouteErrorFallback } from '../components/routing/RouteErrorFallback';
import { useActiveDocket } from '../hooks/useActiveDocket';
import { useCaseQuery } from '../hooks/useCaseQuery';
import { normalizeLifecycle } from '../utils/lifecycle';
import { invalidateCaseCache } from '../utils/caseCache';
import { getLifecycleMeta } from '../../utils/lifecycleMap';
import api from '../services/api';
import { DocketDetails } from '../../components/DocketDetails';

/**
 * Helper function to normalize case data structure
 * Handles both old and new API response formats
 * PR #45: Utility to avoid repeated fallback patterns
 */
const normalizeCase = (data) => {
  return data.case || data;
};

const toLifecycleStage = (lifecycle) => {
  if (lifecycle === 'OPEN') return 'Open';
  if (lifecycle === 'IN_PROGRESS') return 'In Progress';
  if (lifecycle === 'RESOLVED') return 'Resolved';
  if (lifecycle === 'CLOSED') return 'Closed';
  return 'Open';
};

const normalizeLifecycleForUi = (lifecycle) => normalizeLifecycle(lifecycle);
const REALTIME_POLL_MS = 15000;
const INITIAL_VIRTUAL_WINDOW = 30;
const ACTION_RETRY_KEY = 'docketra_case_retry_queue';
const ACTION_RETRY_MAX_ATTEMPTS = 3;
const ACTION_RETRY_BASE_DELAY_MS = 1000;


export const CaseDetailPage = () => {
  const { caseId, firmSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const permissions = usePermissions();
  const { showSuccess, showError, showWarning } = useToast();
  const { activeDocketId, activeDocketData, isDocketLoading, beginDocketOpen, setActiveDocketData } = useActiveDocket();

  // Next/Previous navigation: read list context passed from CasesPage
  const sourceList = location.state?.sourceList || null; // array of caseIds
  const sourceIndex = location.state?.index ?? -1;
  const hasPrev = sourceList && sourceIndex > 0;
  const hasNext = sourceList && sourceIndex < sourceList.length - 1;

  const handlePrevCase = () => {
    if (!hasPrev) return;
    const prevId = sourceList[sourceIndex - 1];
    beginDocketOpen(prevId);
    navigate(ROUTES.CASE_DETAIL(firmSlug, prevId), {
      state: { sourceList, index: sourceIndex - 1 },
    });
  };

  const handleNextCase = () => {
    if (!hasNext) return;
    const nextId = sourceList[sourceIndex + 1];
    beginDocketOpen(nextId);
    navigate(ROUTES.CASE_DETAIL(firmSlug, nextId), {
      state: { sourceList, index: sourceIndex + 1 },
    });
  };

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sectionLoading, setSectionLoading] = useState({ comments: false, history: false, attachments: false });
  const [caseData, setCaseData] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingClientDockets, setLoadingClientDockets] = useState(false);
  const [clientDockets, setClientDockets] = useState([]);
  const [actionConfirmation, setActionConfirmation] = useState('');
  const [actionError, setActionError] = useState(null);
  const pageContainerRef = useRef(null);
  const commentsListRef = useRef(null);
  const commentComposerId = `case-comment-composer-${caseId}`;
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneCategoryId, setCloneCategoryId] = useState('');
  const [cloneSubcategoryId, setCloneSubcategoryId] = useState('');
  const [cloningCase, setCloningCase] = useState(false);
  const [categoryCatalog, setCategoryCatalog] = useState([]);
  const [loadingCloneCatalog, setLoadingCloneCatalog] = useState(false);
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
  const [resolvingCase, setResolvingCase] = useState(false);
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
  const [realtimeStatus, setRealtimeStatus] = useState('live');
  const [commentWindowSize, setCommentWindowSize] = useState(INITIAL_VIRTUAL_WINDOW);
  const [retryQueue, setRetryQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ACTION_RETRY_KEY) || '[]');
    } catch (error) {
      return [];
    }
  });

  // State for Unpend action modal
  const [showUnpendModal, setShowUnpendModal] = useState(false);
  const [unpendComment, setUnpendComment] = useState('');
  const [unpendingCase, setUnpendingCase] = useState(false);
  const [routingTeams, setRoutingTeams] = useState([]);
  const [routeTeamId, setRouteTeamId] = useState('');
  const [routingNote, setRoutingNote] = useState('');
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [requestDocumentsOpen, setRequestDocumentsOpen] = useState(false);
  const [uploadLinkGenerating, setUploadLinkGenerating] = useState(false);
  const [uploadLinkResult, setUploadLinkResult] = useState(null);

  // Track case view session
  // PR: Comprehensive CaseHistory & Audit Trail
  const [viewTracked, setViewTracked] = useState(false);
  const loadSequenceRef = useRef(0);
  const previousRealtimeRef = useRef(null);
  const notificationPermissionRequestedRef = useRef(false);
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
        setRoutingTeams(teams);
      } catch (error) {
        console.warn('Failed to load teams', error);
      }
    };
    loadTeams();
  }, []);

  const isRoutedToMyTeam = Boolean(caseInfo?.routedToTeamId) && String(caseInfo?.routedToTeamId) === String(user?.teamId || '');
  const isOwnerTeam = Boolean(caseInfo?.ownerTeamId) && String(caseInfo?.ownerTeamId) === String(user?.teamId || '');
  const routedTeamCannotResolve = isRoutedToMyTeam && !isOwnerTeam;
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
  const visibleComments = useMemo(() => comments.slice(-commentWindowSize), [comments, commentWindowSize]);
  const commentDraftKey = `docketra_case_comment_draft_${firmSlug || 'firm'}_${caseId}`;
  const availableAssignees = useMemo(() => {
    const fromCase = caseData?.assignableUsers || caseData?.users || [];
    const mapped = fromCase
      .map((entry) => ({
        value: entry.xID || entry.userId || entry.email,
        label: entry.name || entry.fullName || entry.xID || entry.email,
      }))
      .filter((entry) => entry.value);
    if (!mapped.length && user?.xID) {
      return [{ value: user.xID, label: user.name || user.xID }];
    }
    return mapped;
  }, [caseData?.assignableUsers, caseData?.users, user?.xID, user?.name]);

  const clientName = caseData?.client?.businessName || caseInfo?.clientName || caseInfo?.businessName || '—';
  const clientIdLabel = caseData?.client?.clientId || caseInfo?.clientId || caseData?.clientId || '—';

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
    const firstValid = candidateValues.find((value) => Number.isFinite(Number(value)) && Number(value) >= 0);
    return firstValid != null ? String(Number(firstValid)) : '-';
  })();
  const lifecycleStatus = normalizeLifecycleForUi(caseInfo?.lifecycle);
  const isAdmin = ['ADMIN', 'Admin'].includes(String(user?.role || ''));
  const isMoveLockedByAnotherUser = Boolean(caseInfo?.lockStatus?.isLocked)
    && String(caseInfo?.lockStatus?.activeUserXID || '').trim().toUpperCase() !== String(user?.xID || '').trim().toUpperCase();
  const lockOwnerLabel = [caseInfo?.lockStatus?.activeUserDisplayName, caseInfo?.lockStatus?.activeUserXID]
    .filter((value) => value != null && String(value).trim() !== '')
    .join(' · ') || caseInfo?.lockStatus?.activeUserXID || caseInfo?.lockStatus?.activeUserEmail || 'another user';
  const canAdminMoveAssignedDocket = isAdmin && Boolean(caseInfo?.assignedToXID);

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
      if (matched && import.meta.env.DEV) {
        console.debug(`[CaseDetail:${source}] optimistic comment reconciled with server payload.`);
      }
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

    if (import.meta.env.DEV) {
      if (incomingComments.length < prevComments.length) {
        console.debug(`[CaseDetail:${source}] incoming comments smaller than local state; merge preserved local items.`);
      }
      const prevOptimistic = prevComments.filter((item) => item?.optimistic).length;
      const mergedOptimistic = mergedComments.filter((item) => item?.optimistic).length;
      if (prevOptimistic > 0 && mergedOptimistic < prevOptimistic) {
        console.debug(`[CaseDetail:${source}] optimistic comments may have been replaced during merge.`);
      }
    }

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
        console.log('API response:', normalized);
        console.log('DOCKET_DEBUG', {
          caseId,
          activeDocketId,
          lifecycle: normalizeLifecycleForUi(normalized?.lifecycle),
          assignedTo: normalized?.assignedToXID || normalized?.assignedTo?.xID || null,
          responseSource: 'loadCase',
          timestamp: new Date().toISOString(),
        });
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

  const queueFailedAction = useCallback((action) => {
    setRetryQueue((prev) => {
      const next = [...prev, {
        ...action,
        id: `${action.type}-${Date.now()}`,
        attempts: 0,
        queuedAt: new Date().toISOString(),
        nextRetryAt: Date.now(),
      }];
      localStorage.setItem(ACTION_RETRY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const ensureNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    if (notificationPermissionRequestedRef.current) return false;

    notificationPermissionRequestedRef.current = true;
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      return false;
    }
  }, []);

  const sendBrowserNotification = useCallback(async (title, body, fallbackMessage = null) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const granted = await ensureNotificationPermission();
    if (granted) {
      // eslint-disable-next-line no-new
      new Notification(title, { body });
      return;
    }
    if (fallbackMessage) {
      showSuccess(fallbackMessage);
    }
  }, [ensureNotificationPermission, showSuccess]);

  const executeQueuedAction = useCallback(async (action) => {
    if (action.type === 'ADD_COMMENT') {
      await caseApi.addComment(caseId, action.payload.commentText);
      return true;
    }
    if (action.type === 'RESOLVE_CASE') {
      await caseApi.resolveCase(caseId, action.payload.comment);
      return true;
    }
    return false;
  }, [caseId]);

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
        const nextLifecycle = normalizeLifecycleForUi(nextInfo?.lifecycle);
        if (nextLifecycle && previous.lifecycle && nextLifecycle !== previous.lifecycle) {
          showSuccess(`Lifecycle updated: ${previous.lifecycle} → ${nextLifecycle}`);
          sendBrowserNotification('Docket lifecycle changed', `${previous.lifecycle} → ${nextLifecycle}`);
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
    localStorage.setItem(ACTION_RETRY_KEY, JSON.stringify(retryQueue));
  }, [retryQueue]);

  useEffect(() => {
    const retryQueued = async () => {
      if (!navigator.onLine || retryQueue.length === 0) return;
      const remaining = [];
      const now = Date.now();
      for (const action of retryQueue) {
        if ((action.attempts || 0) >= ACTION_RETRY_MAX_ATTEMPTS) {
          showWarning(`Dropping queued ${action.type} after ${ACTION_RETRY_MAX_ATTEMPTS} attempts.`);
          continue;
        }
        if (action.nextRetryAt && action.nextRetryAt > now) {
          remaining.push(action);
          continue;
        }
        try {
          const handled = await executeQueuedAction(action);
          if (!handled) {
            remaining.push(action);
          }
        } catch (error) {
          const nextAttempts = (action.attempts || 0) + 1;
          if (nextAttempts >= ACTION_RETRY_MAX_ATTEMPTS) {
            showWarning(`Dropping queued ${action.type} after ${ACTION_RETRY_MAX_ATTEMPTS} attempts.`);
            continue;
          }
          const delay = (2 ** nextAttempts) * ACTION_RETRY_BASE_DELAY_MS;
          remaining.push({ ...action, attempts: nextAttempts, nextRetryAt: Date.now() + delay });
        }
      }
      setRetryQueue(remaining);
      if (remaining.length === 0) {
        showSuccess('Queued offline actions synced successfully.');
        loadCase({ background: true });
      }
    };

    window.addEventListener('online', retryQueued);
    retryQueued();
    return () => window.removeEventListener('online', retryQueued);
  }, [executeQueuedAction, loadCase, retryQueue, showSuccess, showWarning]);

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
    if (!cloneModalOpen) return;
    let ignore = false;
    const loadCategories = async () => {
      setLoadingCloneCatalog(true);
      try {
        const response = await categoryService.getCategories(true);
        if (ignore) return;
        const rows = response?.data || [];
        setCategoryCatalog(rows);
      } catch (error) {
        if (!ignore) {
          setCategoryCatalog([]);
          showError('Unable to load categories for cloning.');
        }
      } finally {
        if (!ignore) {
          setLoadingCloneCatalog(false);
        }
      }
    };
    loadCategories();
    return () => {
      ignore = true;
    };
  }, [cloneModalOpen, showError]);
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

  useEffect(() => {
    if (!caseData?.clientId) return;
    const loadClientDockets = async () => {
      setLoadingClientDockets(true);
      try {
        const response = await caseApi.getClientDockets(caseData.clientId);
        const rows = response.data || response.dockets || [];
        setClientDockets(rows.filter((row) => row.caseId !== caseId));
      } catch (error) {
        setClientDockets([]);
      } finally {
        setLoadingClientDockets(false);
      }
    };
    loadClientDockets();
  }, [caseData?.clientId, caseId]);

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

  const handleUploadFile = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedFile || !fileDescription.trim()) {
      showWarning('Please select a file and provide a description');
      return;
    }

    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const uploadedFile = selectedFile;
      const description = fileDescription.trim();
      await caseApi.addAttachment(caseId, uploadedFile, description, ({ percent }) => {
        setUploadProgress(percent);
      });
      const newFileObj = {
        _id: Date.now().toString(), // Temporary ID
        fileName: uploadedFile.name,
        filename: uploadedFile.name,
        description,
        uploadedBy: user?.email || 'System',
        createdBy: user?.email || 'System',
        createdByName: user?.name || null,
        createdByXID: user?.xID || null,
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setCaseData((prev) => ({
        ...prev,
        attachments: [...(prev?.attachments || []), newFileObj],
      }));
      setSelectedFile(null);
      setFileDescription('');
      const message = `Attachment added to docket ${caseId} • ${formatDateTime()}`;
      showSuccess(message);
      setActionConfirmation(message);
      setActionError(null);
    } catch (error) {
      const safeMessage = error?.response?.data?.message?.toLowerCase?.().includes('malware scanner not configured')
        ? 'File upload temporarily unavailable. Please contact administrator.'
        : 'Failed to upload file. Please try again.';
      showError(safeMessage);
      setActionError({ message: safeMessage, retry: handleUploadFile });
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const handlePendCase = async () => {
    if (!pendComment.trim()) {
      showWarning('Comment is mandatory for pending a case');
      return;
    }

    if (!pendingUntil) {
      showWarning('Reopen date is mandatory for pending a case');
      return;
    }

    // Validate that reopen date is not in the past
    const selectedDate = new Date(pendingUntil);
    const today = new Date();
    // Normalize both dates to midnight for accurate comparison
    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      showWarning('Reopen date must be today or in the future');
      return;
    }

    const confirmationTimestamp = new Date().toISOString();
    setConfirmModal({
      title: 'Pend Case',
      description: `Stage change: ${toLifecycleStage(lifecycleStatus)} → Awaiting Partner Approval\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'Pend Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setPendingCase(true);
        try {
          const [year, month, day] = String(pendingUntil).split('-').map(Number);
          const reopenAt = new Date(Date.UTC(year, month - 1, day, 2, 30, 0)).toISOString(); // 08:00 IST
          const response = await caseApi.transitionDocket(caseId, {
            toState: 'PENDING',
            comment: pendComment.trim(),
            reopenAt,
          });
          if (response.success) {
            const message = `Docket ${caseId} pended • ${formatDateTime()}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            setShowPendModal(false);
            setPendComment('');
            setPendingUntil('');
            loadCase({ background: true });
          }
        } catch (error) {
          const errorMessage = extractErrorMessage(error, 'Failed to pend case. Please try again.');
          showError(errorMessage);
          setActionError({ message: errorMessage, retry: handlePendCase });
        } finally {
          setPendingCase(false);
        }
      },
    });
  };

  const handleResolveCase = async () => {
    if (!resolveComment.trim()) {
      showWarning('Comment is mandatory for resolving a case');
      return;
    }

    const confirmationTimestamp = new Date().toISOString();
    setConfirmModal({
      title: 'Resolve Case',
      description: `Stage change: ${toLifecycleStage(lifecycleStatus)} → Executed\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'Resolve Case',
      onConfirm: async () => {
        setConfirmModal(null);
        const previousState = caseData;
        setResolvingCase(true);
        setCaseData((prev) => ({
          ...prev,
          lifecycle: 'RESOLVED',
          case: prev?.case ? { ...prev.case, lifecycle: 'RESOLVED' } : prev?.case,
        }));
        try {
          const response = await caseApi.transitionDocket(caseId, {
            toState: 'RESOLVED',
            comment: resolveComment.trim(),
            sendToQC: forceQcReview,
            forceQc: forceQcReview,
          });
          if (response.success) {
            const message = forceQcReview
              ? `Docket ${caseId} sent to QC review • ${formatDateTime()}`
              : `Docket ${caseId} resolved • ${formatDateTime()}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            setShowResolveModal(false);
            setResolveComment('');
            appendTimelineEvent({
              id: `resolved-event-${Date.now()}`,
              action: forceQcReview ? 'QC_PENDING' : 'RESOLVED',
              description: resolveComment,
              createdAt: new Date().toISOString(),
              createdBy: user?.name || user?.xID || user?.email || 'System',
            });
            loadCase({ background: true });
          }
        } catch (error) {
          setCaseData(previousState);
          const errorMessage = extractErrorMessage(error, 'Failed to resolve case. Please try again.');
          showError(errorMessage);
          if (!navigator.onLine) {
            queueFailedAction({ type: 'RESOLVE_CASE', payload: { comment: resolveComment } });
            showWarning('You are offline. Resolve action queued and will retry automatically.');
          }
          setActionError({ message: errorMessage, retry: handleResolveCase });
        } finally {
          setResolvingCase(false);
        }
      },
    });
  };

  const handleUnpendCase = async () => {
    if (!unpendComment.trim()) {
      showWarning('Comment is mandatory for unpending a case');
      return;
    }

    const confirmationTimestamp = new Date().toISOString();
    setConfirmModal({
      title: 'Unpend Case',
      description: `Stage change: Awaiting Partner Approval → Under Execution\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'Unpend Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setUnpendingCase(true);
        try {
          const response = await caseApi.unpendCase(caseId, unpendComment);
          if (response.success) {
            const message = `Docket ${caseId} unpended • ${formatDateTime()}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            setShowUnpendModal(false);
            setUnpendComment('');
            loadCase({ background: true });
          }
        } catch (error) {
          const errorMessage = extractErrorMessage(error, 'Failed to unpend case. Please try again.');
          showError(errorMessage);
          setActionError({ message: errorMessage, retry: handleUnpendCase });
        } finally {
          setUnpendingCase(false);
        }
      },
    });
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
    if (/^v\d+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$/.test(value)) {
      return '-';
    }
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
    try {
      const response = await clientApi.getClientFactSheetForCase(caseId);
      setClientFactSheet(response?.data || null);
    } catch (error) {
      setClientFactSheet(null);
      showError(error?.response?.data?.message || error?.message || 'Failed to load client fact sheet');
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
    } catch (error) {
      console.error('[CaseDetail] Failed to open sidebar', { type, error });
      showError('Unable to open panel right now. Please retry.');
    }
  };

  const runGuardedAction = useCallback((action, fallbackMessage = 'Unable to complete this action right now.') => {
    try {
      action?.();
    } catch (error) {
      console.error('[CaseDetail] Action failed', error);
      showError(fallbackMessage);
    }
  }, [showError]);

  useEffect(() => {
    setSidebarOpen(false);
    setSidebarType(null);
    setClientFactSheet(null);
  }, [caseId]);

  const handleAssignDocket = async () => {
    if (!assignUser) {
      showWarning('Please select a user to move this docket.');
      return;
    }
    if (assigningCase) return;
    setAssigningCase(true);
    const selectedAssignee = availableAssignees.find((option) => option.value === assignUser);

    try {
      await caseApi.reassignDocket(caseId, assignUser);
      setShowAssignModal(false);
      setAssignComment('');
      setActionError(null);
      setActionConfirmation(`Docket moved to ${selectedAssignee?.label || assignUser}.`);
      showSuccess(`Docket owner updated to ${selectedAssignee?.label || assignUser}`);
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

  // PR #45: Extract access mode information from API response
  const accessMode = caseData?.accessMode || {};
  const isViewOnlyMode = accessMode.isViewOnlyMode;
  const canCloneDocket = permissions.canCloneCase?.(caseData) !== false;

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
      warnings.push(`${unresolvedComments} unresolved comment(s) on this case.`);
    }
    if (caseInfo.approvalStatus === 'PENDING') {
      warnings.push('Pending approval is outstanding.');
    }
    const isSlaBreach =
      caseInfo.slaDueDate &&
      new Date(caseInfo.slaDueDate) < new Date() &&
      lifecycleStatus !== 'RESOLVED' &&
      lifecycleStatus !== 'CLOSED';
    if (isSlaBreach) {
      warnings.push('SLA has been breached for this case.');
    }
    return warnings;
  }, [caseInfo, comments, lifecycleStatus]);

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

  const shouldShowActions = useMemo(() => {
    const hiddenLifecycleStates = new Set(['DONE', 'COMPLETED', 'ARCHIVED']);
    return !hiddenLifecycleStates.has(lifecycleStatus);
  }, [lifecycleStatus]);

  const lifecycleActionMap = useMemo(() => ({
    WL: [],
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

  const lifecycleQuickActions = useMemo(() => {
    if (isViewOnlyMode) return [];
    const actions = lifecycleActionMap[lifecycleStatus] || [];
    if (routedTeamCannotResolve) {
      return actions.filter((action) => action.key !== 'resolve');
    }
    return actions;
  }, [isViewOnlyMode, lifecycleActionMap, lifecycleStatus, routedTeamCannotResolve]);

  const canPerformLifecycleActions = lifecycleQuickActions.length > 0;
  const canRouteDocket = Boolean(caseInfo)
    && !isViewOnlyMode
    && !caseInfo?.routedToTeamId
    && routingTeams.length > 0;
  const showQcActions = false;
  const isAnyModalOpen = Boolean(
    showPendModal
    || showResolveModal
    || showAssignModal
    || showUnpendModal
    || confirmModal
  );

  const selectedCloneCategory = useMemo(
    () => categoryCatalog.find((entry) => entry._id === cloneCategoryId),
    [categoryCatalog, cloneCategoryId]
  );
  const cloneSubcategories = useMemo(
    () => (selectedCloneCategory?.subcategories || []).filter((entry) => entry?.isActive !== false),
    [selectedCloneCategory]
  );


  const handleRouteToTeam = async () => {
    if (!routeTeamId) {
      showWarning('Select a team to route.');
      return;
    }
    if (!String(routingNote || '').trim()) {
      showWarning('Comment is compulsory while routing a docket.');
      return;
    }
    try {
      await caseApi.routeToTeam(caseId, routeTeamId, routingNote.trim());
      showSuccess('Docket routed successfully.');
      setRouteTeamId('');
      setRoutingNote('');
      setShowRouteModal(false);
      loadCaseData({ silent: false });
    } catch(err) {
      showError(err?.response?.data?.message || 'Failed to route docket');
    }
  };

  const handleFileCase = async () => {
    const confirmationTimestamp = new Date().toISOString();
    setConfirmModal({
      title: 'File Case',
      description: `Mark this case as filed.\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'File Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setResolvingCase(true);
        try {
          const response = await caseApi.fileCase(caseId, 'Filed from case details');
          if (response.success) {
            const message = `Case ${caseId} filed • ${formatDateTime()}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            loadCase({ background: true });
          }
        } catch (error) {
          const errorMessage = extractErrorMessage(error, 'Failed to file case. Please try again.');
          showError(errorMessage);
          setActionError({ message: errorMessage, retry: handleFileCase });
        } finally {
          setResolvingCase(false);
        }
      },
    });
  };

  const handleAcceptRouted = async () => {
    try {
      await caseApi.acceptRoutedCase(caseId);
      showSuccess('Docket accepted.');
      loadCaseData({ silent: false });
    } catch(err) {
      showError(err?.response?.data?.message || 'Failed to accept docket');
    }
  };

  const handleReturnRouted = async () => {
    try {
      await caseApi.returnRoutedCase(caseId, routingNote);
      showSuccess('Docket returned to origin team.');
      setRoutingNote('');
      loadCaseData({ silent: false });
    } catch(err) {
      showError(err?.response?.data?.message || 'Failed to return docket');
    }
  };

  const handleCloneDocket = async () => {
    if (!cloneCategoryId || !cloneSubcategoryId) {
      showWarning('Select category and subcategory before cloning.');
      return;
    }
    setCloningCase(true);
    try {
      const response = await caseApi.cloneCase(caseId, {
        categoryId: cloneCategoryId,
        subcategoryId: cloneSubcategoryId,
      });
      const clonedId = response?.data?.caseId || response?.data?.docketId || response?.caseId || response?.docketId || 'new docket';
      showSuccess(`Docket cloned successfully: ${clonedId}. It has been moved to the Workbasket.`);
      setActionConfirmation(`Docket cloned successfully: ${clonedId}. It has been moved to the Workbasket.`);
      setCloneModalOpen(false);
      setCloneCategoryId('');
      setCloneSubcategoryId('');
      setActionError(null);
    } catch (error) {
      const message = extractErrorMessage(error, 'Failed to clone docket. Please try again.');
      showError(message);
      setActionError({ message, retry: handleCloneDocket });
    } finally {
      setCloningCase(false);
    }
  };

  const handleGenerateUploadLink = async (payload) => {
    if (!caseId) return;
    setUploadLinkGenerating(true);
    try {
      const response = await caseApi.generateUploadLink(caseId, payload);
      setUploadLinkResult(response?.data || null);
      showSuccess('Document request link generated.');
    } catch (error) {
      showError(extractErrorMessage(error, 'Unable to generate document request link.'));
    } finally {
      setUploadLinkGenerating(false);
    }
  };

  const handleAddCommentSuccess = () => {
    commentsListRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  useEffect(() => {
    console.log('ACTION_VISIBILITY_DEBUG', {
      lifecycle: lifecycleStatus,
      shouldShowActions,
    });
  }, [lifecycleStatus, shouldShowActions]);

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
      <Layout>
        <Loading message="Loading docket..." />
      </Layout>
    );
  }

  if (!caseData) {
    return (
      <Layout>
        <div className="container">
          <Card>
            {loadError ? <p>{loadError}</p> : null}
            <p>Docket not found</p>
            <Button variant="outline" onClick={() => loadCase()}>
              Retry
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!caseInfo) return null;

  return (
    <Layout>
      <div className="case-detail" ref={pageContainerRef} tabIndex={-1}>
        {/* ─── Next/Previous Docket Navigation ────────────────────────── */}
        {sourceList && (
          <div className="case-detail__nav-bar">
            <Button
              variant="outline"
              onClick={handlePrevCase}
              disabled={!hasPrev}
              className="case-detail__nav-btn"
              aria-label="Previous docket"
            >
              ← Previous Docket
            </Button>
            <span className="case-detail__nav-pos">
              {sourceIndex + 1} / {sourceList.length}
            </span>
            <Button
              variant="outline"
              onClick={handleNextCase}
              disabled={!hasNext}
              className="case-detail__nav-btn"
              aria-label="Next docket"
            >
              Next Docket →
            </Button>
          </div>
        )}
        <DocketDetails
          docketId={caseId}
          prefetchedCase={caseInfo}
        >
          {caseInfo?.qc?.status || caseInfo?.qcStatus ? (
            <Badge variant={String(caseInfo?.qc?.status || caseInfo?.qcStatus).toUpperCase() === 'FAILED' ? 'danger' : 'info'}>
              QC: {caseInfo?.qc?.status || caseInfo?.qcStatus}
            </Badge>
          ) : null}
          {caseInfo.approvalStatus === 'PENDING' && <Badge variant="warning">Awaiting Partner Approval</Badge>}
          {caseInfo.lockStatus?.isLocked && <Badge variant="warning">Lifecycle Locked</Badge>}
          {caseInfo?.stage?.requiresApproval === true && isViewOnlyMode && <Badge variant="warning">Role Restricted Action</Badge>}
          <Button variant="ghost" onClick={() => runGuardedAction(() => openSidebar('cfs'), 'Unable to open CFS panel right now.')} title="CFS" className="h-10 w-10 rounded-full p-0" aria-label="Open CFS sidebar">ⓘ</Button>
          <Button variant="ghost" onClick={() => runGuardedAction(() => openSidebar('attachments'), 'Unable to open attachments panel right now.')} title="Attachments" className="h-10 w-10 rounded-full p-0" aria-label="Open attachments sidebar">📎</Button>
          <Button variant="ghost" onClick={() => runGuardedAction(() => openSidebar('history'), 'Unable to open history panel right now.')} title="History" className="h-10 w-10 rounded-full p-0" aria-label="Open history sidebar">🕒</Button>
          {canCloneDocket ? (
            <Button variant="ghost" onClick={() => runGuardedAction(() => setCloneModalOpen(true), 'Unable to open clone docket right now.')} title="Clone Docket" className="h-10 w-10 rounded-full p-0" aria-label="Clone docket">⧉</Button>
          ) : null}
        </DocketDetails>
        {actionConfirmation ? <div className="case-detail__confirmation">{actionConfirmation}</div> : null}
        <div className="case-detail__realtime-status" role="status" aria-live="polite">
          {realtimeStatus === 'live' ? '● Real-time updates active' : '● Reconnecting to real-time updates...'}
          {retryQueue.length > 0 ? ` • ${retryQueue.length} queued offline action(s)` : ''}
        </div>
        {actionError ? (
          <div className="neo-alert neo-alert--danger case-detail__alert">
            {actionError.message}{' '}
            {actionError.retry ? (
              <button type="button" className="case-detail__retry" onClick={actionError.retry}>
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Alerts */}
        {caseInfo?.stage?.requiresApproval === true && isViewOnlyMode && (
          <div className="neo-alert neo-alert--info case-detail__alert">
            <strong>Role Restricted Action</strong> — Action restricted: Only Partners can approve this lifecycle stage.
          </div>
        )}
        {canAdminMoveAssignedDocket && (
          <div className="neo-alert neo-alert--info case-detail__alert">
            <strong>Admin Worklist Movement</strong> — Move this docket between user worklists or back to workbasket.
            {isMoveLockedByAnotherUser ? ` Movement is locked while ${lockOwnerLabel} is active in this docket.` : ''}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowAssignModal(true)} disabled={isMoveLockedByAnotherUser || assigningCase}>
                Move to another WL
              </Button>
              <Button variant="outline" onClick={handleMoveToWorkbasket} disabled={isMoveLockedByAnotherUser || assigningCase}>
                Move WL → WB
              </Button>
              <Button variant="ghost" onClick={() => handleViewUserWorklist(caseInfo?.assignedToXID)}>
                View {caseInfo?.assignedToXID || 'owner'} WL
              </Button>
            </div>
          </div>
        )}
        {caseInfo.lockStatus?.isLocked &&
          caseInfo.lockStatus.activeUserEmail !== user?.email?.toLowerCase() && (
          <div className="neo-alert neo-alert--warning case-detail__alert">
            <strong>Docket {caseInfo?.caseId || caseId} is locked</strong>{' '}
            {(() => {
              const name = caseInfo.lockStatus.activeUserDisplayName;
              const xid  = caseInfo.lockStatus.activeUserXID;
              const who  = name && xid ? `${name} (${xid})` : name || xid || caseInfo.lockStatus.activeUserEmail;
              return `by ${who}`;
            })()}
            {' '}since{' '}
            {formatDateTime(caseInfo.lockStatus.lastActivityAt || caseInfo.lockStatus.lockedAt)}.
          </div>
        )}
        {/* Task 2: Inactivity warning */}
        {isInactiveWarning && (
          <div className="case-detail__inactivity-warning case-detail__alert" role="status">
            ⚠ No activity in 3 days
          </div>
        )}

        <div className="case-detail-layout-grid flex w-full flex-col gap-6">
          <main className="case-detail-main min-w-0">
            <section className="case-card" aria-labelledby="snapshot-heading">
              <div className="case-card__heading">
                <h2 id="snapshot-heading">Snapshot</h2>
              </div>
              <div className="field-grid">
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Client Name</span>
                  <span className="field-value text-sm font-medium text-gray-900 break-words">{clientName}</span>
                </div>
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Client ID</span>
                  <span className="field-value text-sm font-medium text-gray-900 break-words">{clientIdLabel}</span>
                </div>
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Category</span>
                  <span className="field-value text-sm font-medium text-gray-900">{categoryLabel}</span>
                </div>
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Subcategory</span>
                  <span className="field-value text-sm font-medium text-gray-900">{subcategoryLabel}</span>
                </div>
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">SLA (days)</span>
                  <span className="field-value text-sm font-medium text-gray-900">{slaDaysLabel}</span>
                </div>
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Lifecycle</span>
                  {getLifecycleMeta(caseInfo?.lifecycle) ? <LifecycleBadge lifecycle={caseInfo?.lifecycle} /> : <span className="field-value text-sm font-medium text-gray-900">—</span>}
                </div>
              </div>
            </section>

            <section className={`case-card ${lifecycleStatus === 'IN_PROGRESS' ? 'opacity-90' : ''}`} aria-labelledby="overview-heading">
              <div className="case-card__heading">
                <h2 id="overview-heading">Details</h2>
              </div>
              {lifecycleStatus === 'IN_PROGRESS' && (caseInfo?.pendingUntil || caseInfo?.reopenDate) ? (
                <Badge variant="warning" className="mt-3 inline-flex">
                  In progress until {formatDateTime(caseInfo.pendingUntil || caseInfo.reopenDate)}
                </Badge>
              ) : null}
              <div className="field-group mt-4">
                <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Description</span>
                <span className="field-value case-detail__description-text whitespace-pre-wrap break-words text-sm font-medium text-gray-900">{descriptionContent}</span>
              </div>
            </section>

            <section className="case-card case-detail-section case-detail-section--comments" aria-labelledby="comments-heading">
              <div className="case-card__heading case-detail-section__heading">
                <h2 id="comments-heading">Comments</h2>
                <p className="case-detail-section__subheading">Discussion, notes, and decision context.</p>
              </div>
              <div className="case-detail__comments" ref={commentsListRef}>
                {sectionLoading.comments ? (
                  <div className="case-detail__section-skeleton" aria-hidden="true">
                    {Array.from({ length: 4 }).map((_, idx) => <div key={`comment-skeleton-${idx}`} className="case-detail__skeleton-row" />)}
                  </div>
                ) : <DocketComments comments={visibleComments} />}
              </div>
              {comments.length > visibleComments.length ? (
                <div className="case-detail__virtual-actions">
                  <Button variant="outline" onClick={() => setCommentWindowSize((size) => size + INITIAL_VIRTUAL_WINDOW)}>
                    Load older comments ({comments.length - visibleComments.length} remaining)
                  </Button>
                </div>
              ) : null}
              {(accessMode.canComment || permissions.canAddComment(caseData)) && (
                <div className="case-detail__add-comment">
                  <Textarea
                    label="Add Comment"
                    id={commentComposerId}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Enter your comment…"
                    rows={3}
                    className="case-detail__comment-input"
                  />
                  <div className="case-detail__composer-actions">
                    <Button variant="primary" onClick={handleAddComment} disabled={!newComment.trim() || submitting}>
                      {submitting ? 'Adding…' : 'Add Comment'}
                    </Button>
                  </div>
                </div>
              )}
              {shouldShowActions ? (
                <section className="mt-4 border-t pt-4" aria-label="Case actions">
                  <div className="case-detail__composer-actions mt-3">
                    {canPerformLifecycleActions ? lifecycleQuickActions.map((action) => (
                      <Button
                        key={action.key}
                        variant={action.variant}
                        onClick={action.onClick}
                        disabled={actionInFlight}
                      >
                        {action.label}
                      </Button>
                    )) : null}
                    {!isViewOnlyMode ? (
                      <Button variant="secondary" onClick={handleFileCase} disabled={actionInFlight}>
                        File
                      </Button>
                    ) : null}
                    {canRouteDocket ? (
                      <Button variant="outline" onClick={() => setShowRouteModal(true)} disabled={actionInFlight}>
                        Route
                      </Button>
                    ) : null}
                  </div>
                  {canPerformLifecycleActions ? (
                    <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={forceQcReview}
                        onChange={(e) => setForceQcReview(e.target.checked)}
                      />
                      Force QC Review
                    </label>
                  ) : null}
                </section>
              ) : null}
              {showQcActions ? (
                <section className="mt-4 border-t pt-4" aria-label="QC actions">
                  <h3 className="text-sm font-semibold text-gray-900">QC Actions</h3>
                  <div className="case-detail__composer-actions mt-3">
                    <Button variant="primary" onClick={() => { setQcDecisionType('APPROVED'); setQcComment(''); setShowQcModal(true); }}>
                      Approve
                    </Button>
                    <Button variant="secondary" onClick={() => { setQcDecisionType('CORRECTED'); setQcComment(''); setShowQcModal(true); }}>
                      Corrected
                    </Button>
                    <Button variant="danger" onClick={() => { setQcDecisionType('FAILED'); setQcComment(''); setShowQcModal(true); }}>
                      Reject
                    </Button>
                  </div>
                </section>
              ) : null}
            </section>

            <section className="case-card" aria-labelledby="past-dockets-heading">
              <div className="case-card__heading">
                <h2 id="past-dockets-heading">History</h2>
              </div>
              {loadingClientDockets ? (
                <p className="case-detail__empty-note">Loading history…</p>
              ) : clientDockets.length === 0 ? (
                <p className="case-detail__empty-note">No history found for this client.</p>
              ) : (
                <div className="case-detail-table-wrap">
                  <table className="case-detail-table">
                    <thead>
                      <tr>
                        <th>Docket #</th>
                        <th>Created</th>
                        <th>Resolved/Filed</th>
                        <th>Lifecycle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientDockets.map((row) => {
                        const rowId = row.caseId || row.docketId || row._id;
                        const closedDate = row.resolvedAt || row.filedAt || row.closedAt || row.completedAt;
                        return (
                          <tr key={rowId}>
                            <td>
                              <button
                                type="button"
                                className="case-detail-table__link"
                                onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, rowId))}
                              >
                                {formatDocketId(rowId)}
                              </button>
                            </td>
                            <td>{row.createdAt ? formatDateTime(row.createdAt) : '—'}</td>
                            <td>{closedDate ? formatDateTime(closedDate) : '—'}</td>
                            <td>
                              {getLifecycleMeta(row.lifecycle) ? (
                                <LifecycleBadge lifecycle={row.lifecycle} />
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </main>

        </div>

        {caseInfo && (
          <Card>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <strong>Routing:</strong> {caseInfo?.ownerTeamName || '—'}
                {caseInfo?.routedToTeamName ? ` → ${caseInfo.routedToTeamName}` : ''}
              </div>
              <div>
                <strong>Available workbaskets:</strong> {routingTeams.map((team) => team.name).join(', ') || '—'}
              </div>
              {caseInfo?.routingNote && <div><strong>Routing note:</strong> {caseInfo.routingNote}</div>}
              {isRoutedToMyTeam && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="secondary" onClick={handleAcceptRouted}>Accept</Button>
                  <Button variant="secondary" onClick={() => caseApi.updateRoutedStatus(caseId, 'PENDING').then(() => { showSuccess('Docket status marked as Pending'); loadCaseData({ silent: false }); }).catch((err) => showError(err?.response?.data?.message || 'Failed to update docket status'))}>Mark Pending</Button>
                  <Button variant="secondary" onClick={() => caseApi.updateRoutedStatus(caseId, 'FILED').then(() => { showSuccess('Docket status marked as Filed'); loadCaseData({ silent: false }); }).catch((err) => showError(err?.response?.data?.message || 'Failed to update docket status'))}>File</Button>
                  <Button variant="outline" onClick={handleReturnRouted}>Return</Button>
                </div>
              )}
              {routedTeamCannotResolve && <Badge variant="warning">Resolve is disabled for routed team</Badge>}
            </div>
          </Card>
        )}

        <DocketSidebar
          isOpen={sidebarOpen && Boolean(sidebarType)}
          type={sidebarType}
          onClose={() => {
            setSidebarOpen(false);
            setSidebarType(null);
          }}
          caseInfo={caseInfo}
          attachments={attachments}
          timelineEvents={timelineEvents}
          cfsData={clientFactSheet}
          cfsLoading={loadingClientFactSheet}
          selectedAttachmentFile={selectedFile}
          attachmentComment={fileDescription}
          uploadingAttachment={uploadingFile}
          uploadProgress={uploadProgress}
          onAttachmentFileChange={setSelectedFile}
          onAttachmentCommentChange={setFileDescription}
          onUploadAttachment={handleUploadFile}
          onRequestDocuments={() => setRequestDocumentsOpen(true)}
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
              Create a new docket from this one. Select the category and subcategory for the cloned docket.
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

        {/* Pend Docket Modal */}
        <Modal
          isOpen={showPendModal}
          onClose={() => { setShowPendModal(false); setPendComment(''); setPendingUntil(''); }}
          title="Pend Docket"
          actions={
            <>
              <Button variant="outline" onClick={() => { setShowPendModal(false); setPendComment(''); setPendingUntil(''); }} disabled={pendingCase}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handlePendCase} disabled={!pendComment.trim() || !pendingUntil || pendingCase}>
                {pendingCase ? 'Pending…' : 'Pend Docket'}
              </Button>
            </>
          }
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Pending a case temporarily pauses it until a specified date.
              The docket will remain in your worklist but move below active dockets until the selected date.
            </p>
            <Textarea
              label="Comment (Required)"
              value={pendComment}
              onChange={(e) => setPendComment(e.target.value)}
              placeholder="Explain why this case is being pended…"
              rows={4}
              required
              disabled={pendingCase}
            />
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <Input
                type="date"
                label="Reopen Date (Required)"
                value={pendingUntil}
                onChange={(e) => setPendingUntil(e.target.value)}
                min={getISODateInTimezone(new Date())}
                required
                disabled={pendingCase}
              />
            </div>
          </div>
        </Modal>

        {/* Resolve Docket Modal */}
        <Modal
          isOpen={showResolveModal}
          onClose={() => { setShowResolveModal(false); setResolveComment(''); }}
          title="Resolve Docket"
          actions={
            <>
              <Button variant="outline" onClick={() => { setShowResolveModal(false); setResolveComment(''); }} disabled={resolvingCase}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleResolveCase} disabled={!resolveComment.trim() || resolvingCase}>
                {resolvingCase ? 'Resolving…' : 'Resolve Docket'}
              </Button>
            </>
          }
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            {/* Task 3: Smart lifecycle warnings */}
            {lifecycleWarnings.length > 0 && (
              <div className="case-detail__lifecycle-warnings" role="note">
                <strong>⚠ Heads up before resolving:</strong>
                <ul className="case-detail__lifecycle-warnings-list">
                  {lifecycleWarnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Resolving a case marks it as executed with no further action required.
              The case will become read-only after resolution.
            </p>
            <Textarea
              label="Comment (Required)"
              value={resolveComment}
              onChange={(e) => setResolveComment(e.target.value)}
              placeholder="Describe how this case was resolved…"
              rows={4}
              required
              disabled={resolvingCase}
            />
          </div>
        </Modal>
        <ActionModal
          isOpen={showQcModal}
          onClose={() => setShowQcModal(false)}
          title={`QC Action: ${qcDecisionType || 'REVIEW'}`}
          comment={qcComment}
          setComment={setQcComment}
          commentRequired
          submitLabel="Submit QC Action"
          submitting={qcSubmitting}
          onSubmit={async () => {
            if (!qcComment.trim()) {
              showWarning('Comment is mandatory for QC action');
              return;
            }
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
          }}
        />

        <ActionModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title="Move Docket to Another Worklist"
          comment={assignComment}
          setComment={setAssignComment}
          commentRequired={false}
          submitLabel="Move Docket"
          submitting={assigningCase}
          onSubmit={handleAssignDocket}
          disabled={!assignUser}
        >
          <div className="space-y-2">
            <label htmlFor="assign-user" className="block text-sm font-medium text-gray-700">Select user</label>
            <select
              id="assign-user"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={assignUser}
              onChange={(e) => setAssignUser(e.target.value)}
            >
              {availableAssignees.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </ActionModal>

        <Modal
          isOpen={showRouteModal}
          onClose={() => setShowRouteModal(false)}
          title="Route Docket to Workbasket"
          actions={(
            <>
              <Button variant="outline" onClick={() => setShowRouteModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleRouteToTeam} disabled={!routeTeamId || !String(routingNote || '').trim()}>
                Route Docket
              </Button>
            </>
          )}
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <Select
              label="Route to workbasket"
              value={routeTeamId}
              onChange={(event) => setRouteTeamId(event.target.value)}
            >
              <option value="">Select workbasket</option>
              {routingTeams.filter((team) => String(team._id) !== String(caseInfo?.ownerTeamId || '')).map((team) => (
                <option key={team._id} value={team._id}>{team.name}</option>
              ))}
            </Select>
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <Textarea
                label="Routing Comment (Required)"
                value={routingNote}
                onChange={(event) => setRoutingNote(event.target.value)}
                placeholder="Add the reason/context for routing this docket..."
                rows={4}
              />
            </div>
          </div>
        </Modal>

        <RequestDocumentsModal
          isOpen={requestDocumentsOpen}
          onClose={() => setRequestDocumentsOpen(false)}
          clientEmail={caseInfo?.clientEmail || caseInfo?.client?.email || caseData?.client?.email || ''}
          generating={uploadLinkGenerating}
          generatedLink={uploadLinkResult}
          onGenerate={handleGenerateUploadLink}
        />

        {/* Unpend Case Modal */}
        <Modal
          isOpen={showUnpendModal}
          onClose={() => { setShowUnpendModal(false); setUnpendComment(''); }}
          title="Unpend Case"
          actions={
            <>
              <Button variant="outline" onClick={() => { setShowUnpendModal(false); setUnpendComment(''); }} disabled={unpendingCase}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleUnpendCase} disabled={!unpendComment.trim() || unpendingCase}>
                {unpendingCase ? 'Unpending…' : 'Unpend Case'}
              </Button>
            </>
          }
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Unpending a case will move it back to OPEN lifecycle and return it to your worklist.
              Use this when you no longer need to wait for external input.
            </p>
            <Textarea
              label="Comment (Required)"
              value={unpendComment}
              onChange={(e) => setUnpendComment(e.target.value)}
              placeholder="Explain why this case is being unpended…"
              rows={4}
              required
              disabled={unpendingCase}
            />
          </div>
        </Modal>

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
    </Layout>
  );
};
