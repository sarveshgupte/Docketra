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
import { Modal } from '../components/common/Modal';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { SaveIndicator } from '../components/ui/SaveIndicator';
import { AuditMetadata } from '../components/ui/AuditMetadata';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { caseService } from '../services/caseService';
import { extractErrorMessage } from '../services/apiResponse';
import { formatDateTime } from '../utils/formatDateTime';
import { formatClientDisplay } from '../utils/formatters';
import { USER_ROLES, CASE_DETAIL_TABS, VALID_CASE_DETAIL_TAB_NAMES } from '../utils/constants';
import { StickyTabs } from '../components/common/StickyTabs';
import { AuditTimeline } from '../components/common/AuditTimeline';
import { StatusBadge } from '../components/layout/StatusBadge';
import { DocketSidebar } from '../components/docket/DocketSidebar';
import { DocketComments } from '../components/docket/DocketComments';
import { DocketActions } from '../components/docket/DocketActions';
import { ActionModal } from '../components/docket/ActionModal';
import './CaseDetailPage.css';
import { ROUTES } from '../constants/routes';
import { RouteErrorFallback } from '../components/routing/RouteErrorFallback';

/**
 * Helper function to normalize case data structure
 * Handles both old and new API response formats
 * PR #45: Utility to avoid repeated fallback patterns
 */
const normalizeCase = (data) => {
  return data.case || data;
};

const toLifecycleStage = (status) => {
  if (status === 'OPEN') return 'Under Execution';
  if (status === 'RESOLVED') return 'Executed';
  if (status === 'FILED') return 'Marked as Executed';
  return status || 'Under Execution';
};

const formatDocketId = (value = '') => String(value || '').replace(/^CASE-/, 'DOCKET-');
const REALTIME_POLL_MS = 15000;
const INITIAL_VIRTUAL_WINDOW = 30;
const ACTION_RETRY_KEY = 'docketra_case_retry_queue';
const ACTION_RETRY_MAX_ATTEMPTS = 3;
const ACTION_RETRY_BASE_DELAY_MS = 1000;
const formatFileSize = (bytes) => {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return 'Unknown size';
  const value = Number(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};


export const CaseDetailPage = () => {
  const { caseId, firmSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const permissions = usePermissions();
  const { showSuccess, showError, showWarning } = useToast();

  // Next/Previous navigation: read list context passed from CasesPage
  const sourceList = location.state?.sourceList || null; // array of caseIds
  const sourceIndex = location.state?.index ?? -1;
  const hasPrev = sourceList && sourceIndex > 0;
  const hasNext = sourceList && sourceIndex < sourceList.length - 1;

  const handlePrevCase = () => {
    if (!hasPrev) return;
    const prevId = sourceList[sourceIndex - 1];
    navigate(ROUTES.CASE_DETAIL(firmSlug, prevId), {
      state: { sourceList, index: sourceIndex - 1 },
    });
  };

  const handleNextCase = () => {
    if (!hasNext) return;
    const nextId = sourceList[sourceIndex + 1];
    navigate(ROUTES.CASE_DETAIL(firmSlug, nextId), {
      state: { sourceList, index: sourceIndex + 1 },
    });
  };

  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState({ comments: false, history: false, attachments: false });
  const [caseData, setCaseData] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [commentSaveStatus, setCommentSaveStatus] = useState(null);
  const [commentSavedAt, setCommentSavedAt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pullingCase, setPullingCase] = useState(false);
  const [loadingClientDockets, setLoadingClientDockets] = useState(false);
  const [clientDockets, setClientDockets] = useState([]);
  const [movingToGlobal, setMovingToGlobal] = useState(false);
  const [actionConfirmation, setActionConfirmation] = useState('');
  const [actionError, setActionError] = useState(null);
  const fileInputRef = useRef(null);
  const pageContainerRef = useRef(null);
  const commentsListRef = useRef(null);
  const commentComposerId = `case-comment-composer-${caseId}`;
  const queryTab = new URLSearchParams(location.search).get('tab');
  const initialTab = VALID_CASE_DETAIL_TAB_NAMES.includes(queryTab) ? queryTab : CASE_DETAIL_TABS.OVERVIEW;
  const [activeSection, setActiveSection] = useState(initialTab);
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState({ category: '', description: '' });
  // Confirm modal state (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState(null);

  // State for File action modal
  const [showFileModal, setShowFileModal] = useState(false);
  const [fileComment, setFileComment] = useState('');
  const [filingCase, setFilingCase] = useState(false);

  // State for Pend action modal
  const [showPendModal, setShowPendModal] = useState(false);
  const [pendComment, setPendComment] = useState('');
  const [pendingUntil, setPendingUntil] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const inboundEmailDomain = import.meta.env.VITE_INBOUND_EMAIL_DOMAIN || 'inbound.docketra.com';
  const inboundAddress = caseData?.publicEmailToken
    ? `case-${caseData.publicEmailToken}@${inboundEmailDomain}`
    : '';
  const [pendingCase, setPendingCase] = useState(false);

  // State for Resolve action modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveComment, setResolveComment] = useState('');
  const [resolvingCase, setResolvingCase] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignComment, setAssignComment] = useState('');
  const [assignUser, setAssignUser] = useState('');
  const [assigningCase, setAssigningCase] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarType, setSidebarType] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('live');
  const [commentWindowSize, setCommentWindowSize] = useState(INITIAL_VIRTUAL_WINDOW);
  const [historyWindowSize, setHistoryWindowSize] = useState(INITIAL_VIRTUAL_WINDOW);
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
  const [startingWork, setStartingWork] = useState(false);

  // Track case view session
  // PR: Comprehensive CaseHistory & Audit Trail
  const [viewTracked, setViewTracked] = useState(false);
  const loadSequenceRef = useRef(0);
  const previousRealtimeRef = useRef(null);
  const notificationPermissionRequestedRef = useRef(false);
  
  // Configuration for view tracking
  const VIEW_TRACKING_DEBOUNCE_MS = 2000; // 2 seconds

  const caseInfo = useMemo(
    () => (caseData ? normalizeCase(caseData) : null),
    [caseData]
  );
  const comments = caseData?.comments ?? [];
  const attachments = caseData?.attachments ?? [];
  const auditLog = caseData?.auditLog ?? [];
  const history = caseData?.history ?? [];
  const timelineEvents = auditLog.length > 0 ? auditLog : history;
  const sortedTimelineEvents = useMemo(
    () => [...timelineEvents].sort((left, right) => {
      const leftTs = new Date(left?.timestamp || left?.createdAt || left?.updatedAt || 0).getTime();
      const rightTs = new Date(right?.timestamp || right?.createdAt || right?.updatedAt || 0).getTime();
      return rightTs - leftTs;
    }),
    [timelineEvents]
  );
  const visibleComments = useMemo(() => comments.slice(-commentWindowSize), [comments, commentWindowSize]);
  const visibleTimelineEvents = useMemo(
    () => sortedTimelineEvents.slice(0, historyWindowSize),
    [sortedTimelineEvents, historyWindowSize]
  );
  const groupedTimelineEvents = useMemo(() => {
    const importantKeywords = ['resolved', 'filed', 'assigned', 'escalated', 'failed', 'reopened', 'approval'];
    const grouped = [];
    const dateMap = new Map();
    visibleTimelineEvents.forEach((event, index) => {
      const dt = event.timestamp || event.createdAt || event.updatedAt;
      const dateLabel = dt ? new Date(dt).toLocaleDateString() : 'Unknown Date';
      const action = String(event.action || event.type || 'updated').toLowerCase();
      const description = String(event.description || event.comment || '').toLowerCase();
      const important = importantKeywords.some((keyword) => action.includes(keyword) || description.includes(keyword));
      if (!dateMap.has(dateLabel)) {
        const group = { dateLabel, items: [] };
        dateMap.set(dateLabel, group);
        grouped.push(group);
      }
      dateMap.get(dateLabel).items.push({ ...event, _important: important, _eventIndex: index });
    });
    grouped.forEach((group) => {
      group.items.sort((left, right) => {
        const leftTs = new Date(left?.timestamp || left?.createdAt || left?.updatedAt || 0).getTime();
        const rightTs = new Date(right?.timestamp || right?.createdAt || right?.updatedAt || 0).getTime();
        return leftTs - rightTs;
      });
    });

    return grouped.sort((left, right) => {
      const leftTs = new Date(left.items[0]?.timestamp || left.items[0]?.createdAt || left.items[0]?.updatedAt || 0).getTime();
      const rightTs = new Date(right.items[0]?.timestamp || right.items[0]?.createdAt || right.items[0]?.updatedAt || 0).getTime();
      return rightTs - leftTs;
    });
  }, [visibleTimelineEvents]);
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
      const response = await caseService.getCaseById(caseId, {
        commentsPage: 1,
        commentsLimit: 25,
        activityPage: 1,
        activityLimit: 25,
      });
      
      if (response.success && requestId === loadSequenceRef.current) {
        const normalized = response.data?.case || response.data;
        setCaseData((prev) => mergeCaseData(prev, normalized, { source: 'loadCase' }));
      }
    } catch (error) {
      showError(extractErrorMessage(error, 'Unable to load docket details. Please try again.'));
    } finally {
      if (!background) {
        setLoading(false);
      } else {
        setSectionLoading({ comments: false, history: false, attachments: false });
      }
    }
  }, [caseId, showError]);

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
      await caseService.addComment(caseId, action.payload.commentText);
      return true;
    }
    if (action.type === 'RESOLVE_CASE') {
      await caseService.resolveCase(caseId, action.payload.comment);
      return true;
    }
    return false;
  }, [caseId]);

  useEffect(() => {
    loadCase();
    
    // Track case opened
    caseService.trackCaseOpen(caseId);
    
    // Cleanup: track case exit on unmount
    return () => {
      caseService.trackCaseExit(caseId);
    };
  }, [caseId, loadCase]);

  useEffect(() => {
    if (!caseData) return;
    previousRealtimeRef.current = {
      status: caseInfo?.status,
      assignee: caseInfo?.assignedToXID || caseInfo?.assignedToName || null,
      commentsCount: comments.length,
    };
  }, [caseData, caseInfo?.status, caseInfo?.assignedToXID, caseInfo?.assignedToName, comments.length]);

  useEffect(() => {
    const pollForUpdates = async () => {
      try {
        if (document.hidden || !navigator.onLine) {
          return;
        }

        const response = await caseService.getCaseById(caseId, {
          commentsPage: 1,
          commentsLimit: 50,
          activityPage: 1,
          activityLimit: 50,
        });
        if (!response?.success) return;
        const updated = response.data?.case || response.data;
        const previous = previousRealtimeRef.current;
        const nextInfo = normalizeCase(updated);
        const nextCommentsCount = updated?.comments?.length || 0;
        const nextAssignee = nextInfo?.assignedToXID || nextInfo?.assignedToName || null;

        if (previous) {
          if (nextCommentsCount > previous.commentsCount) {
            showSuccess('New comment update received.');
            sendBrowserNotification('Docketra update', 'A new comment was added to this docket.');
          }
          if (nextInfo?.status && previous.status && nextInfo.status !== previous.status) {
            showSuccess(`Status updated: ${previous.status} → ${nextInfo.status}`);
            sendBrowserNotification('Docket status changed', `${previous.status} → ${nextInfo.status}`);
          }
          if (nextAssignee && previous.assignee && nextAssignee !== previous.assignee) {
            showWarning(`Assignment updated: ${previous.assignee} → ${nextAssignee}`);
          }
        }
        setCaseData((prev) => mergeCaseData(prev, updated, { source: 'polling' }));
        setRealtimeStatus('live');
      } catch (error) {
        setRealtimeStatus('reconnecting');
      }
    };

    const timer = setInterval(pollForUpdates, REALTIME_POLL_MS);
    return () => clearInterval(timer);
  }, [caseId, mergeCaseData, sendBrowserNotification, showSuccess, showWarning]);

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
      setCommentSaveStatus('saved');
      setCommentSavedAt(new Date());
    }
  }, [commentDraftKey]);

  useEffect(() => {
    if (!newComment) return undefined;
    setCommentSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(commentDraftKey, newComment);
        setCommentSaveStatus('saved');
        setCommentSavedAt(new Date());
      } catch (error) {
        setCommentSaveStatus('error');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [newComment, commentDraftKey]);

  useEffect(() => {
    if (!caseInfo) return;
    setOverviewDraft({
      category: caseInfo.category || '',
      description: caseInfo.description || '',
    });
    setIsEditingOverview(false);
  }, [caseInfo?.caseId, caseInfo?.category, caseInfo?.description]);

  useEffect(() => {
    if (!assignUser && availableAssignees.length > 0) {
      setAssignUser(availableAssignees[0].value);
    }
  }, [assignUser, availableAssignees]);

  useEffect(() => {
    const tabFromUrl = new URLSearchParams(location.search).get('tab');
    if (VALID_CASE_DETAIL_TAB_NAMES.includes(tabFromUrl) && tabFromUrl !== activeSection) {
      setActiveSection(tabFromUrl);
      setTimeout(() => scrollToSection(tabFromUrl), 80);
    }
  }, [location.search, activeSection]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!newComment) return;
      try {
        localStorage.setItem(commentDraftKey, newComment);
        setCommentSaveStatus('saved');
        setCommentSavedAt(new Date());
      } catch (error) {
        setCommentSaveStatus('error');
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [newComment, commentDraftKey]);

  // Track case viewed after successful load (debounced, once per session)
  useEffect(() => {
    if (caseData && !viewTracked) {
      // Delay slightly to ensure page is fully rendered
      const timer = setTimeout(() => {
        caseService.trackCaseView(caseId);
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
        const response = await caseService.getClientDockets(caseData.clientId);
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

  const handlePullCase = () => {
    setConfirmModal({
      title: 'Pull Docket',
      description: 'Pull this case? This will assign it to you.',
      confirmText: 'Pull Docket',
      onConfirm: async () => {
        setConfirmModal(null);
        setPullingCase(true);
        try {
          const response = await caseService.pullCase(caseId);
          if (response.success) {
            const message = 'Docket moved to My Worklist';
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            navigate(ROUTES.MY_WORKLIST(firmSlug));
          }
        } catch (error) {
          const errorMessage = extractErrorMessage(error, 'Unable to pull docket. Please try again.');
          showError(errorMessage);
          setActionError({ message: errorMessage, retry: handlePullCase });
        } finally {
          setPullingCase(false);
        }
      },
    });
  };

  const handleMoveToWB = async () => {
    try {
      if (!caseInfo?.version && caseInfo?.version !== 0) {
        showError('Case version missing. Please refresh.');
        return;
      }

      setMovingToGlobal(true);
      await caseService.updateStatus(caseId, {
        status: 'UNASSIGNED',
        version: statusVersion,
        performedBy,
        notes: 'Moved back to Workbasket',
      });
      showSuccess(`Docket ${caseId} moved to Workbasket`);
      loadCase({ background: true });
    } catch (error) {
      showError(extractErrorMessage(error, 'Failed to move docket to Workbasket.'));
    } finally {
      setMovingToGlobal(false);
    }
  };

  const handleAddComment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newComment.trim() || submitting) return;
    
    const commentText = newComment.trim();
    const tempId = `tmp-comment-${Date.now()}`;
    const optimisticComment = {
      tempId,
      _id: tempId,
      text: commentText,
      createdBy: user?.email || 'Unknown',
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
      const response = await caseService.addComment(caseId, commentText);
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
      const message = `Comment added to docket ${caseId} • ${formatDateTime(new Date())}`;
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

  const handleCopyInboundAddress = async () => {
    if (!inboundAddress || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(inboundAddress);
      showSuccess('Inbound email address copied');
    } catch (error) {
      showError('Unable to copy inbound email address');
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
      await caseService.addAttachment(caseId, uploadedFile, description, ({ percent }) => {
        setUploadProgress(percent);
      });
      const newFileObj = {
        _id: Date.now().toString(), // Temporary ID
        fileName: uploadedFile.name,
        filename: uploadedFile.name,
        description,
        uploadedBy: user?.email || 'Unknown',
        createdBy: user?.email || 'Unknown',
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
      // Reset file input using ref
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      const message = `Attachment added to docket ${caseId} • ${formatDateTime(new Date())}`;
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

  const handleFileCase = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!fileComment.trim()) {
      showWarning('Comment is mandatory for filing a case');
      return;
    }

    const confirmationTimestamp = new Date().toISOString();
    const responsibleExecutive = caseInfo?.assignedToName || caseInfo?.assignedToXID || user?.name || user?.xID || 'Unassigned';
    setConfirmModal({
      title: 'File Case',
      description: `Stage change: ${toLifecycleStage(caseInfo?.status)} → Marked as Executed\nResponsible party: ${responsibleExecutive}\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'File Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setFilingCase(true);
        try {
          if (!caseInfo?.version && caseInfo?.version !== 0) {
            showError('Case version missing. Please refresh.');
            return;
          }
          const response = await caseService.updateStatus(caseId, {
            status: 'FILED',
            version: statusVersion,
            performedBy,
            notes: fileComment.trim(),
          });
          if (response.success) {
            const message = `Docket ${caseId} filed • ${formatDateTime(new Date())}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            setShowFileModal(false);
            setFileComment('');
            loadCase({ background: true });
          }
        } catch (error) {
          const errorMessage = extractErrorMessage(error, 'Failed to file case. Please try again.');
          showError(errorMessage);
          setActionError({ message: errorMessage, retry: handleFileCase });
        } finally {
          setFilingCase(false);
        }
      },
    });
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
    const responsibleExecutive = caseInfo?.assignedToName || caseInfo?.assignedToXID || user?.name || user?.xID || 'Unassigned';
    setConfirmModal({
      title: 'Pend Case',
      description: `Stage change: ${toLifecycleStage(caseInfo?.status)} → Awaiting Partner Approval\nResponsible party: ${responsibleExecutive}\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'Pend Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setPendingCase(true);
        try {
          if (!caseInfo?.version && caseInfo?.version !== 0) {
            showError('Case version missing. Please refresh.');
            return;
          }
          const response = await caseService.updateStatus(caseId, {
            status: 'PENDED',
            version: statusVersion,
            performedBy,
            reason: pendComment.trim(),
            notes: `Reopen date: ${pendingUntil}`,
          });
          if (response.success) {
            const message = `Docket ${caseId} pended • ${formatDateTime(new Date())}`;
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
    const responsibleExecutive = caseInfo?.assignedToName || caseInfo?.assignedToXID || user?.name || user?.xID || 'Unassigned';
    setConfirmModal({
      title: 'Resolve Case',
      description: `Stage change: ${toLifecycleStage(caseInfo?.status)} → Executed\nResponsible party: ${responsibleExecutive}\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'Resolve Case',
      onConfirm: async () => {
        setConfirmModal(null);
        const previousState = caseData;
        setResolvingCase(true);
        setCaseData((prev) => ({
          ...prev,
          status: 'RESOLVED',
          case: prev?.case ? { ...prev.case, status: 'RESOLVED' } : prev?.case,
        }));
        try {
          if (!caseInfo?.version && caseInfo?.version !== 0) {
            showError('Case version missing. Please refresh.');
            return;
          }
          const response = await caseService.updateStatus(caseId, {
            status: 'RESOLVED',
            version: statusVersion,
            performedBy,
            notes: resolveComment.trim(),
          });
          if (response.success) {
            const message = `Docket ${caseId} resolved • ${formatDateTime(new Date())}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            setShowResolveModal(false);
            setResolveComment('');
            appendTimelineEvent({
              id: `resolved-event-${Date.now()}`,
              action: 'RESOLVED',
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
    const responsibleExecutive = caseInfo?.assignedToName || caseInfo?.assignedToXID || user?.name || user?.xID || 'Unassigned';
    setConfirmModal({
      title: 'Unpend Case',
      description: `Stage change: Awaiting Partner Approval → Under Execution\nResponsible party: ${responsibleExecutive}\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'Unpend Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setUnpendingCase(true);
        try {
          const response = await caseService.unpendCase(caseId, unpendComment);
          if (response.success) {
            const message = `Docket ${caseId} unpended • ${formatDateTime(new Date())}`;
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
    const value = String(caseInfo?.description || '').trim();
    if (!value) return 'No description available';
    if (/^v\d+:[A-Za-z0-9+/=_-]+$/.test(value)) {
      return <span className="text-gray-400 italic">Description unavailable</span>;
    }
    return value;
  }, [caseInfo?.description]);
  const docketState = String(caseInfo?.status || '').toUpperCase();
  const statusVersion = Number.isFinite(Number(caseInfo?.version)) ? Number(caseInfo.version) : 0;
  const performedBy = user?.email || user?.xID || 'system';

  const openSidebar = (type) => {
    setSidebarType(type);
    setSidebarOpen(true);
  };

  const handleAssignDocket = async () => {
    if (!assignUser) {
      showWarning('Please select a user to assign.');
      return;
    }

    if (assigningCase) return;
    setAssigningCase(true);
    const selectedAssignee = availableAssignees.find((option) => option.value === assignUser);
    const previous = caseData;
    const optimisticComment = assignComment.trim()
      ? {
          id: `assign-${Date.now()}`,
          text: assignComment.trim(),
          createdAt: new Date().toISOString(),
          createdBy: user?.xID || user?.email || 'System',
        }
      : null;

    setCaseData((prev) => ({
      ...prev,
      assignedToXID: assignUser,
      assignedToName: selectedAssignee?.label || assignUser,
      comments: optimisticComment ? [...(prev?.comments || []), optimisticComment] : (prev?.comments || []),
    }));
    setShowAssignModal(false);
    setAssignComment('');
    setActionError(null);
    setActionConfirmation(`Docket assigned to ${selectedAssignee?.label || assignUser}.`);

    try {
      if (!caseInfo?.version && caseInfo?.version !== 0) {
        showError('Case version missing. Please refresh.');
        setCaseData(previous);
        return;
      }
      await caseService.updateStatus(caseId, {
        status: 'ASSIGNED',
        version: statusVersion,
        performedBy,
        notes: assignComment.trim(),
      });
      showSuccess(`Assigned to ${selectedAssignee?.label || assignUser}`);
      appendTimelineEvent({
        id: `assigned-event-${Date.now()}`,
        action: 'ASSIGNED',
        description: assignComment.trim() || `Assigned to ${selectedAssignee?.label || assignUser}`,
        createdAt: new Date().toISOString(),
        createdBy: user?.name || user?.xID || user?.email || 'System',
      });
      loadCase({ background: true });
    } catch (error) {
      setCaseData(previous);
      const message = extractErrorMessage(error, 'Failed to assign docket. Please try again.');
      showError(message);
      setActionError({ message, retry: handleAssignDocket });
    } finally {
      setAssigningCase(false);
    }
  };

  // PR #45: Extract access mode information from API response
  const accessMode = caseData?.accessMode || {};
  const isViewOnlyMode = accessMode.isViewOnlyMode;
  const canEditOverview = permissions.canEditCase(caseData) && !isViewOnlyMode;
  const hasOverviewChanges =
    overviewDraft.category !== (caseInfo?.category || '') ||
    overviewDraft.description !== (caseInfo?.description || '');

  // Determine if user is admin
  const isAdmin = user?.role === 'Admin';

  // Task 2: Inactivity warning — OPEN case not updated in 3+ days (not pended)
  const isInactiveWarning = useMemo(() => {
    if (!caseInfo) return false;
    if (caseInfo?.status !== 'OPEN') return false;
    if (!caseInfo.updatedAt) return false;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return new Date(caseInfo.updatedAt) < threeDaysAgo;
  }, [caseInfo]);

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
      caseInfo?.status !== 'RESOLVED' &&
      caseInfo?.status !== 'FILED';
    if (isSlaBreach) {
      warnings.push('SLA has been breached for this case.');
    }
    return warnings;
  }, [caseInfo, comments]);

  const actionInFlight = pullingCase || assigningCase || pendingCase || resolvingCase || filingCase || unpendingCase || startingWork || movingToGlobal;

  const handleStartWork = async () => {
    setStartingWork(true);
    try {
      if (!caseInfo?.version && caseInfo?.version !== 0) {
        showError('Case version missing. Please refresh.');
        return;
      }
      await caseService.updateStatus(caseId, {
        status: 'IN_PROGRESS',
        version: statusVersion,
        performedBy,
        notes: 'Started work',
      });
      showSuccess(`Docket ${caseId} moved to In Progress`);
      loadCase({ background: true });
    } catch (error) {
      showError(extractErrorMessage(error, 'Failed to start work.'));
    } finally {
      setStartingWork(false);
    }
  };

  const headerActions = useMemo(() => {
    if (isViewOnlyMode) return [];
    if (docketState === 'UNASSIGNED') {
      return [{ key: 'move_wl', label: 'Move to WL', variant: 'primary', onClick: handlePullCase, disabled: actionInFlight }];
    }
    if (docketState === 'OPEN') {
      return [{ key: 'assign', label: 'Assign', variant: 'primary', onClick: () => setShowAssignModal(true), disabled: actionInFlight }];
    }
    if (docketState === 'ASSIGNED') {
      return [
        { key: 'start_work', label: 'Start Work', variant: 'primary', onClick: handleStartWork, disabled: actionInFlight },
        { key: 'move_wb', label: 'Move to WB', variant: 'outline', onClick: handleMoveToWB, disabled: actionInFlight },
      ];
    }
    if (docketState === 'IN_PROGRESS') {
      return [
        { key: 'pend', label: 'Pend', onClick: () => setShowPendModal(true), disabled: actionInFlight },
        { key: 'resolve', label: 'Resolve', variant: 'primary', onClick: () => setShowResolveModal(true), disabled: actionInFlight },
        { key: 'file', label: 'File', onClick: () => setShowFileModal(true), disabled: actionInFlight },
        { key: 'move_wb', label: 'Move to WB', variant: 'outline', onClick: handleMoveToWB, disabled: actionInFlight },
      ];
    }
    if (docketState === 'PENDED') {
      return [
        { key: 'resume', label: 'Resume Work', variant: 'primary', onClick: () => setShowUnpendModal(true), disabled: actionInFlight },
        { key: 'move_wb', label: 'Move to WB', variant: 'outline', onClick: handleMoveToWB, disabled: actionInFlight },
      ];
    }
    return [];
  }, [actionInFlight, docketState, isViewOnlyMode, handleMoveToWB, handlePullCase, handleStartWork]);

  // Move to Workbasket button: show only for admin users AND case is currently assigned
  const showMoveToWorkbasketButton = isAdmin && caseInfo?.assignedToXID;

  // Case action buttons (File, Pend, Resolve) - PR: Fix Case Lifecycle
  // Action Visibility Rules:
  // - OPEN: Show File, Pend, Resolve (no Unpend)
  // - PENDING/PENDED: Show ONLY Unpend (no File, Pend, Resolve)
  // - FILED or RESOLVED: Show nothing (terminal states, read-only)
  const canPerformLifecycleActions = docketState === 'IN_PROGRESS' && !isViewOnlyMode;
  const isAnyModalOpen = Boolean(
    showFileModal
    || showPendModal
    || showResolveModal
    || showAssignModal
    || showUnpendModal
    || confirmModal
  );

  const scrollToSection = (key) => {
    setActiveSection(key);
  };

  const handleScrollToComments = () => {
    scrollToSection(CASE_DETAIL_TABS.COMMENTS);
    window.setTimeout(() => {
      document.getElementById(commentComposerId)?.focus?.();
    }, 250);
  };

  const handleSaveOverview = () => {
    setCaseData((prev) => ({
      ...prev,
      category: overviewDraft.category,
      description: overviewDraft.description,
      case: prev?.case
        ? {
            ...prev.case,
            category: overviewDraft.category,
            description: overviewDraft.description,
          }
        : prev?.case,
    }));
    setIsEditingOverview(false);
    showSuccess('Overview updated locally');
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
        handleScrollToComments();
      }
      if (key === 'a') {
        event.preventDefault();
        setShowAssignModal(true);
      }
      if (key === 'r' && canPerformLifecycleActions) {
        event.preventDefault();
        setShowResolveModal(true);
      }
    };
    const container = pageContainerRef.current;
    if (!container) return undefined;
    container.addEventListener('keydown', handleKeyboardShortcuts);
    return () => container.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [canPerformLifecycleActions, handleScrollToComments, isAnyModalOpen]);

  if (!firmSlug) {
    return <RouteErrorFallback title="Invalid firm" message="Unable to open this docket because firm context is missing." backTo={ROUTES.SUPERADMIN_LOGIN} />;
  }

  if (loading) {
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
            <p>Docket not found</p>
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
              aria-label="Previous case"
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
              aria-label="Next case"
            >
              Next Docket →
            </Button>
          </div>
        )}
        <header className="case-detail-header">
          <div className="case-detail-header__identity">
            <div className="case-detail-header__title-row">
              <h1 className="case-detail-header__title">{caseInfo.title || caseInfo.caseName || formatDocketId(caseInfo.caseId || caseId)}</h1>
            </div>
            <p className="case-detail-header__subtitle">Assigned to: {caseInfo?.assignedToName || caseInfo?.assignedToXID || 'Unassigned'}</p>
            <div className="case-detail-header__meta">
              Priority: {caseInfo.priority || caseInfo.slaPriority || 'Standard'} • Last updated {formatDateTime(caseInfo.updatedAt)}
            </div>
          </div>

          <div className="case-detail-header__actions">
            <StatusBadge status={docketState} className="case-detail-header__status-prominent" />
            {caseInfo.approvalStatus === 'PENDING' && <Badge variant="warning">Awaiting Partner Approval</Badge>}
            {caseInfo.lockStatus?.isLocked && <Badge variant="warning">Lifecycle Locked</Badge>}
            {caseInfo?.stage?.requiresApproval === true && isViewOnlyMode && <Badge variant="warning">Role Restricted Action</Badge>}
            <Button variant="ghost" onClick={() => openSidebar('cfs')} title="CFS" className="h-10 w-10 rounded-full p-0" aria-label="Open CFS sidebar">ⓘ</Button>
            <Button variant="ghost" onClick={() => openSidebar('attachments')} title="Attachments" className="h-10 w-10 rounded-full p-0" aria-label="Open attachments sidebar">📎</Button>
            <Button variant="ghost" onClick={() => openSidebar('history')} title="History" className="h-10 w-10 rounded-full p-0" aria-label="Open history sidebar">🕒</Button>
          </div>
        </header>

        <StickyTabs
          tabs={[
            { name: CASE_DETAIL_TABS.OVERVIEW, label: 'Overview' },
            { name: CASE_DETAIL_TABS.COMMENTS, label: 'Comments', badge: comments.length || null },
            { name: CASE_DETAIL_TABS.ATTACHMENTS, label: 'Files', badge: attachments.length || null },
            { name: CASE_DETAIL_TABS.HISTORY, label: 'History' },
          ]}
          defaultTab={CASE_DETAIL_TABS.OVERVIEW}
          onTabChange={scrollToSection}
        />
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

        <div className="case-detail-layout-grid flex w-full flex-col gap-6 lg:flex-row">
          <main className="case-detail-main min-w-0 lg:w-[70%]">
            <section className="case-card" aria-labelledby="snapshot-heading">
              <div className="case-card__heading">
                <h2 id="snapshot-heading">Case Snapshot</h2>
              </div>
              <div className="field-grid">
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Client</span>
                  <span className="field-value text-sm font-medium text-gray-900 break-words">{caseData.client ? formatClientDisplay(caseData.client, true) : '—'}</span>
                </div>
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Assigned To</span>
                  <span className="field-value text-sm font-medium text-gray-900 break-words">{caseInfo?.assignedToName || caseInfo?.assignedToXID || 'Unassigned'}</span>
                </div>
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Lifecycle</span>
                  <StatusBadge status={caseInfo?.status} />
                </div>
                <div className="field-group min-w-0">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Due Date</span>
                  <span className="field-value text-sm font-medium text-gray-900 break-words">{caseInfo.dueDate ? formatDateTime(caseInfo.dueDate) : 'Not configured'}</span>
                </div>
              </div>
            </section>

            {activeSection === CASE_DETAIL_TABS.OVERVIEW && (
              <section className={`case-card ${caseInfo?.status === 'PENDED' ? 'opacity-90' : ''}`} aria-labelledby="overview-heading">
                <div className="case-card__heading">
                  <h2 id="overview-heading">Overview</h2>
                  {canEditOverview ? (
                    <Button variant="outline" onClick={() => setIsEditingOverview((value) => !value)}>
                      {isEditingOverview ? 'Cancel Edit' : 'Edit'}
                    </Button>
                  ) : null}
                </div>
                <div className="field-grid">
                  <div className="field-group min-w-0">
                    <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Category</span>
                    {isEditingOverview ? (
                      <Input
                        value={overviewDraft.category}
                        onChange={(e) => setOverviewDraft((prev) => ({ ...prev, category: e.target.value }))}
                        aria-label="Case category"
                      />
                    ) : (
                      <span className="field-value text-sm font-medium text-gray-900">{caseInfo.category}</span>
                    )}
                  </div>
                  <div className="field-group min-w-0">
                    <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Current Lifecycle Stage</span>
                    <StatusBadge status={caseInfo?.status} />
                    {caseInfo?.status === 'PENDED' && (caseInfo?.pendingUntil || caseInfo?.reopenDate) ? (
                      <Badge variant="warning" className="mt-2 inline-flex">
                        PENDED till {formatDateTime(caseInfo.pendingUntil || caseInfo.reopenDate)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="field-group">
                  <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Description</span>
                  {isEditingOverview ? (
                    <Textarea
                      value={overviewDraft.description}
                      onChange={(e) => setOverviewDraft((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      aria-label="Case description"
                    />
                  ) : (
                    <span className="field-value case-detail__description-text whitespace-pre-wrap break-words text-sm font-medium text-gray-900">{descriptionContent}</span>
                  )}
                </div>
                {canEditOverview && isEditingOverview && (
                  <div className="case-detail-lifecycle-actions flex flex-wrap justify-end gap-3">
                    <Button variant="primary" onClick={handleSaveOverview} disabled={!hasOverviewChanges}>Save Overview</Button>
                  </div>
                )}
              </section>
            )}

            {activeSection === CASE_DETAIL_TABS.COMMENTS && (
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
                    <SaveIndicator
                      status={commentSaveStatus}
                      time={commentSavedAt}
                      onRetry={() => {
                        try {
                          setCommentSaveStatus('saving');
                          localStorage.setItem(commentDraftKey, newComment);
                          setCommentSaveStatus('saved');
                          setCommentSavedAt(new Date());
                        } catch (error) {
                          setCommentSaveStatus('error');
                        }
                      }}
                    />
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
              </section>
            )}

            {activeSection === CASE_DETAIL_TABS.ATTACHMENTS && (
              <section className="case-card case-detail-section case-detail-section--attachments" aria-labelledby="attachments-heading">
                <div className="case-card__heading case-detail-section__heading">
                  <h2 id="attachments-heading">Attachments</h2>
                  <p className="case-detail-section__subheading">Files and supporting artifacts for this docket.</p>
                </div>
                <div className="case-detail__attachments">
                  {attachments.length > 0 ? (
                    attachments.map((attachment) => (
                      <article key={attachment._id || attachment.id || `${attachment.createdAt}-${attachment.fileName || attachment.filename}`} className="case-detail__attachment-item case-detail__attachment-card">
                        <div className="case-detail__attachment-main">
                          <div className="case-detail__attachment-name">📄 {attachment.fileName || attachment.filename}</div>
                          <div className="case-detail__attachment-date">Size: {formatFileSize(attachment.size || attachment.fileSize)}</div>
                          <div className="case-detail__attachment-meta-group">
                            <div className="case-detail__attachment-meta">
                              {attachment.visibility === 'external' ? (
                                <><strong>📧 External Email</strong> · From: {attachment.createdBy}</>
                              ) : (
                                <>{attachment.source === 'email' ? '📧' : '📤'} Attached by {attachment.createdByName && attachment.createdByXID
                                  ? `${attachment.createdByName} (${attachment.createdByXID})`
                                  : 'System (Unknown)'}</>
                              )}
                            </div>
                            <div className="case-detail__attachment-date">
                              {attachment.visibility === 'external' ? 'Received: ' : 'Attached: '}
                              {formatDateTime(attachment.createdAt)}
                            </div>
                            {attachment.description && (
                              <div className="case-detail__attachment-desc">{attachment.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="case-detail__attachment-actions" aria-label="Attachment actions">
                          <Button variant="outline" className="case-detail__attachment-action" onClick={() => caseService.viewAttachment(caseId, attachment._id)}>View</Button>
                          <Button variant="outline" className="case-detail__attachment-action" onClick={() => caseService.downloadAttachment(caseId, attachment._id, attachment.fileName || attachment.filename)}>Download</Button>
                        </div>
                      </article>
                    ))
                  ) : <div className="case-detail__empty-state rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-gray-500"><EmptyState title="No attachments yet" description="Upload files or forward an email to keep artifacts with this docket." /></div>}
                </div>
                {(accessMode.canAttach || permissions.canAddAttachment(caseData)) && (
                  <div className="case-detail__upload">
                    <div className={`neo-dropzone${isDragActive ? ' neo-dropzone--active' : ''}`} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                      onDragLeave={() => setIsDragActive(false)}
                      onDrop={handleDropFiles}
                      aria-label="Click to upload attachment">
                      <div className="neo-dropzone__icon" aria-hidden="true">📎</div>
                      <div className="neo-dropzone__label">
                        {selectedFile ? selectedFile.name : 'Drag files here or click to attach'}
                      </div>
                      <div className="neo-dropzone__sub">PDF, DOCX, XLSX, images up to 25MB</div>
                    </div>
                    {inboundAddress && (
                      <div className="case-detail-upload-hint">
                        Forward emails to: <strong>{inboundAddress}</strong>{' '}
                        <button type="button" className="neo-btn neo-btn--ghost neo-btn--sm" onClick={handleCopyInboundAddress}>Copy</button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                      disabled={uploadingFile}
                      aria-hidden="true"
                    />
                    {selectedFile && (
                      <Textarea
                        label="File Description"
                        value={fileDescription}
                        onChange={(e) => setFileDescription(e.target.value)}
                        placeholder="Describe this attachment…"
                        rows={2}
                        disabled={uploadingFile}
                      />
                    )}
                    {selectedFile && (
                      <Button variant="primary" onClick={handleUploadFile} disabled={!selectedFile || !fileDescription.trim() || uploadingFile}>
                        {uploadingFile ? 'Uploading…' : 'Upload File'}
                      </Button>
                    )}
                    {uploadingFile ? (
                      <div className="case-detail__upload-progress" role="status" aria-live="polite">
                        Upload progress: {uploadProgress}%
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            )}

            {activeSection === CASE_DETAIL_TABS.HISTORY && (
              <section className="case-card case-detail-section case-detail-section--history" aria-labelledby="history-heading">
                <div className="case-card__heading case-detail-section__heading">
                  <h2 id="history-heading">History</h2>
                  <p className="case-detail-section__subheading">Lifecycle timeline and audit events.</p>
                </div>
                <div className="case-detail-history-list">
                  {sectionLoading.history ? (
                    <div className="case-detail__section-skeleton" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, idx) => <div key={`history-skeleton-${idx}`} className="case-detail__skeleton-row" />)}
                    </div>
                  ) : (timelineEvents.length ? (
                    <div className="case-detail__timeline-groups">
                      {groupedTimelineEvents.map((group) => (
                        <section key={group.dateLabel} className="case-detail__timeline-group">
                          <h3 className="case-detail__timeline-group-title">{group.dateLabel}</h3>
                          <AuditTimeline events={group.items} />
                        </section>
                      ))}
                    </div>
                  ) : <div className="case-detail__empty-state rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-gray-500"><EmptyState title="No activity yet" description="Timeline events and lifecycle updates will appear here as the docket changes." /></div>)}
                </div>
                {timelineEvents.length > visibleTimelineEvents.length ? (
                  <div className="case-detail__virtual-actions">
                    <Button variant="outline" onClick={() => setHistoryWindowSize((size) => size + INITIAL_VIRTUAL_WINDOW)}>
                      Load older timeline events ({timelineEvents.length - visibleTimelineEvents.length} remaining)
                    </Button>
                  </div>
                ) : null}
              </section>
            )}
          </main>

          <aside className="case-detail-sidebar w-full lg:w-[30%] flex-shrink-0" aria-label="Audit history and related case details">
            <div className="case-detail-sidebar__section">
              <p className="case-detail-sidebar__label">Audit History</p>
              <div className="case-detail-sidebar__stack space-y-6">
                <AuditMetadata
                  className="case-detail__metadata-item"
                  prefix="Created by"
                  actor={caseInfo.createdByName || caseInfo.createdByXID || 'System'}
                  timestamp={caseInfo.createdAt}
                />
                <AuditMetadata
                  className="case-detail__metadata-item"
                  prefix="Last updated by"
                  actor={caseInfo.updatedByName || caseInfo.assignedToName || 'System'}
                  timestamp={caseInfo.updatedAt}
                />
              </div>
              <div className="case-detail-history-list">
                {timelineEvents.length ? <AuditTimeline events={timelineEvents.slice(0, 6)} /> : <p className="case-detail__empty-note">No audit history yet.</p>}
              </div>
            </div>

            <div className="case-detail-sidebar__section">
              <p className="case-detail-sidebar__label">Related Dockets</p>
              {loadingClientDockets ? <p className="case-detail__empty-note">Loading docket history...</p> : (
                <div className="case-detail-related-list">
                  {clientDockets.length ? clientDockets.map((row) => (
                    <button
                      key={formatDocketId(row.caseId)}
                      type="button"
                      className="case-detail-related-item"
                      onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, row.caseId))}
                    >
                      <span className="case-detail-related-item__title">{formatDocketId(row.caseId)}</span>
                      <span className="case-detail-related-item__meta">{row.category}</span>
                      <span className="case-detail-related-item__meta">{formatDateTime(row.createdAt)}</span>
                    </button>
                  )) : <p className="case-detail__empty-note">No related dockets found.</p>}
                </div>
              )}
            </div>
          </aside>
        </div>

        <DocketActions actions={headerActions} />

        <DocketSidebar
          isOpen={sidebarOpen}
          type={sidebarType}
          onClose={() => setSidebarOpen(false)}
          caseInfo={caseInfo}
          attachments={attachments}
          timelineEvents={timelineEvents}
        />

        {/* ─── Modals (positioned outside split pane) ─────────────── */}

        {/* File Docket Modal */}
        <Modal
          isOpen={showFileModal}
          onClose={() => { setShowFileModal(false); setFileComment(''); }}
          title="File Docket"
          actions={
            <>
              <Button variant="outline" onClick={() => { setShowFileModal(false); setFileComment(''); }} disabled={filingCase}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleFileCase} disabled={!fileComment.trim() || filingCase}>
                {filingCase ? 'Filing…' : 'File Docket'}
              </Button>
            </>
          }
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            {/* Task 3: Smart lifecycle warnings */}
            {lifecycleWarnings.length > 0 && (
              <div className="case-detail__lifecycle-warnings" role="note">
                <strong>⚠ Heads up before filing:</strong>
                <ul className="case-detail__lifecycle-warnings-list">
                  {lifecycleWarnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Filing a case indicates it was opened in error, is a duplicate, or was incorrectly created.
              The case will become read-only after filing.
            </p>
            <Textarea
              label="Comment (Required)"
              value={fileComment}
              onChange={(e) => setFileComment(e.target.value)}
              placeholder="Explain why this case is being filed…"
              rows={4}
              required
              disabled={filingCase}
            />
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
                min={new Date().toISOString().split('T')[0]}
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
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title="Assign Docket"
          comment={assignComment}
          setComment={setAssignComment}
          commentRequired={false}
          submitLabel="Assign Docket"
          submitting={assigningCase}
          onSubmit={handleAssignDocket}
          disabled={!assignUser}
        >
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Currently assigned to: {caseInfo?.assignedToName || caseInfo?.assignedToXID || 'Unassigned'}
            </p>
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
              Unpending a case will move it back to OPEN status and return it to your worklist.
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
