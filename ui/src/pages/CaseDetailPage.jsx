/**
 * Case Detail Page
 * PR #45: Added view-only mode indicator and audit log display
 * PR: Comprehensive CaseHistory & Audit Trail - Added view tracking and history display
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Textarea } from '../components/common/Textarea';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { ClientFactSheetModal } from '../components/common/ClientFactSheetModal';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { SaveIndicator } from '../components/ui/SaveIndicator';
import { AuditMetadata } from '../components/ui/AuditMetadata';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { caseService } from '../services/caseService';
import { clientService } from '../services/clientService';
import { formatDateTime } from '../utils/formatDateTime';
import { formatClientDisplay } from '../utils/formatters';
import { USER_ROLES, CASE_DETAIL_TABS, VALID_CASE_DETAIL_TAB_NAMES } from '../utils/constants';
import { AuditTimelineDrawer } from '../components/common/AuditTimelineDrawer';
import { StickyTabs } from '../components/common/StickyTabs';
import { CaseDetailHeader } from '../components/case/CaseDetailHeader';
import { AuditTimeline } from '../components/common/AuditTimeline';
import './CaseDetailPage.css';

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
    navigate(`/app/firm/${firmSlug}/cases/${prevId}`, {
      state: { sourceList, index: sourceIndex - 1 },
    });
  };

  const handleNextCase = () => {
    if (!hasNext) return;
    const nextId = sourceList[sourceIndex + 1];
    navigate(`/app/firm/${firmSlug}/cases/${nextId}`, {
      state: { sourceList, index: sourceIndex + 1 },
    });
  };

  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [commentSaveStatus, setCommentSaveStatus] = useState(null);
  const [commentSavedAt, setCommentSavedAt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pullingCase, setPullingCase] = useState(false);
  const [loadingClientDockets, setLoadingClientDockets] = useState(false);
  const [clientDockets, setClientDockets] = useState([]);
  const [movingToGlobal, setMovingToGlobal] = useState(false);
  const [actionConfirmation, setActionConfirmation] = useState('');
  const [actionError, setActionError] = useState(null);
  const [auditSidebarOpen, setAuditSidebarOpen] = useState(false);
  const fileInputRef = useRef(null);
  const overviewSectionRef = useRef(null);
  const commentsSectionRef = useRef(null);
  const attachmentsSectionRef = useRef(null);
  const historySectionRef = useRef(null);
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

  // State for Unpend action modal
  const [showUnpendModal, setShowUnpendModal] = useState(false);
  const [unpendComment, setUnpendComment] = useState('');
  const [unpendingCase, setUnpendingCase] = useState(false);

  // State for Client Fact Sheet modal
  // PR: Client Fact Sheet Foundation
  const [showClientFactSheet, setShowClientFactSheet] = useState(false);
  const [clientFactSheet, setClientFactSheet] = useState(null);
  const [loadingFactSheet, setLoadingFactSheet] = useState(false);

  // Track case view session
  // PR: Comprehensive CaseHistory & Audit Trail
  const [viewTracked, setViewTracked] = useState(false);
  
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
  const commentDraftKey = `docketra_case_comment_draft_${firmSlug || 'firm'}_${caseId}`;


  useEffect(() => {
    loadCase();
    
    // Track case opened
    caseService.trackCaseOpen(caseId);
    
    // Cleanup: track case exit on unmount
    return () => {
      caseService.trackCaseExit(caseId);
    };
  }, [caseId]);

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
    const refs = [
      ['overview', overviewSectionRef.current],
      ['comments', commentsSectionRef.current],
      ['attachments', attachmentsSectionRef.current],
      ['history', historySectionRef.current],
    ].filter(([, el]) => Boolean(el));
    if (!refs.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: '-120px 0px -50% 0px', threshold: [0.15, 0.4, 0.75] }
    );

    refs.forEach(([, el]) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);


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

  const loadCase = async () => {
    setLoading(true);
    try {
      const response = await caseService.getCaseById(caseId);
      
      if (response.success) {
        const normalized = response.data?.case || response.data;
        setCaseData(normalized);
      }
    } catch (error) {
      console.error('Failed to load case:', error);
    } finally {
      setLoading(false);
    }
  };

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
            navigate('/my-worklist');
          }
        } catch (error) {
          console.error('Failed to pull docket:', error);
          const serverMessage = error.response?.data?.message;
          const errorMessage = serverMessage && typeof serverMessage === 'string'
            ? serverMessage.substring(0, 200)
            : 'Unable to pull docket. Please try again.';
          showError(errorMessage);
          setActionError({ message: errorMessage, retry: handlePullCase });
        } finally {
          setPullingCase(false);
        }
      },
    });
  };

  const handleMoveToGlobal = () => {
    setConfirmModal({
      title: 'Move to Workbasket',
      description: 'This will remove the current assignment and move the docket to the Workbasket. Continue?',
      confirmText: 'Move to Workbasket',
      onConfirm: async () => {
        setConfirmModal(null);
        setMovingToGlobal(true);
        try {
          const response = await caseService.moveCaseToGlobal(caseId);
          if (response.success) {
            const message = `Docket ${caseId} moved to Workbasket • ${formatDateTime(new Date())}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            await loadCase();
          }
        } catch (error) {
          console.error('Failed to move docket to workbasket:', error);
          const serverMessage = error.response?.data?.message;
          const errorMessage = serverMessage && typeof serverMessage === 'string'
            ? serverMessage.substring(0, 200)
            : 'Failed to move docket. Please try again.';
          showError(errorMessage);
          setActionError({ message: errorMessage, retry: handleMoveToGlobal });
        } finally {
          setMovingToGlobal(false);
        }
      },
    });
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      await caseService.addComment(caseId, newComment, user?.email);
      localStorage.removeItem(commentDraftKey);
      setNewComment('');
      const message = `Comment added to docket ${caseId} • ${formatDateTime(new Date())}`;
      showSuccess(message);
      setActionConfirmation(message);
      setActionError(null);
      await loadCase(); // Reload to show new comment
      window.setTimeout(handleAddCommentSuccess, 80);
    } catch (error) {
      console.error('Failed to add comment:', error);
      setActionError({ message: 'Failed to add comment. Please retry.', retry: handleAddComment });
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

  const handleUploadFile = async () => {
    if (!selectedFile || !fileDescription.trim()) {
      showWarning('Please select a file and provide a description');
      return;
    }

    setUploadingFile(true);
    try {
      await caseService.addAttachment(caseId, selectedFile, fileDescription, user?.email);
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
      await loadCase(); // Reload to show new attachment
    } catch (error) {
      console.error('Failed to upload file:', error);
      const safeMessage = error?.response?.data?.message?.toLowerCase?.().includes('malware scanner not configured')
        ? 'File upload temporarily unavailable. Please contact administrator.'
        : 'Failed to upload file. Please try again.';
      showError(safeMessage);
      setActionError({ message: safeMessage, retry: handleUploadFile });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileCase = async () => {
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
          const response = await caseService.fileCase(caseId, fileComment);
          if (response.success) {
            const message = `Docket ${caseId} filed • ${formatDateTime(new Date())}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            setShowFileModal(false);
            setFileComment('');
            await loadCase();
          }
        } catch (error) {
          console.error('Failed to file case:', error);
          const serverMessage = error.response?.data?.message;
          const errorMessage = serverMessage && typeof serverMessage === 'string'
            ? serverMessage.substring(0, 200)
            : 'Failed to file case. Please try again.';
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
          const response = await caseService.pendCase(caseId, pendComment, pendingUntil);
          if (response.success) {
            const message = `Docket ${caseId} pended • ${formatDateTime(new Date())}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            setShowPendModal(false);
            setPendComment('');
            setPendingUntil('');
            await loadCase();
          }
        } catch (error) {
          console.error('Failed to pend case:', error);
          const serverMessage = error.response?.data?.message;
          const errorMessage = serverMessage && typeof serverMessage === 'string'
            ? serverMessage.substring(0, 200)
            : 'Failed to pend case. Please try again.';
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
        setResolvingCase(true);
        try {
          const response = await caseService.resolveCase(caseId, resolveComment);
          if (response.success) {
            const message = `Docket ${caseId} resolved • ${formatDateTime(new Date())}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            setShowResolveModal(false);
            setResolveComment('');
            await loadCase();
          }
        } catch (error) {
          console.error('Failed to resolve case:', error);
          const serverMessage = error.response?.data?.message;
          const errorMessage = serverMessage && typeof serverMessage === 'string'
            ? serverMessage.substring(0, 200)
            : 'Failed to resolve case. Please try again.';
          showError(errorMessage);
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
            await loadCase();
          }
        } catch (error) {
          console.error('Failed to unpend case:', error);
          const serverMessage = error.response?.data?.message;
          const errorMessage = serverMessage && typeof serverMessage === 'string'
            ? serverMessage.substring(0, 200)
            : 'Failed to unpend case. Please try again.';
          showError(errorMessage);
          setActionError({ message: errorMessage, retry: handleUnpendCase });
        } finally {
          setUnpendingCase(false);
        }
      },
    });
  };

  // Handle Client Fact Sheet
  // PR: Client Fact Sheet Foundation
  const handleShowClientFactSheet = async () => {
    setLoadingFactSheet(true);
    setShowClientFactSheet(true);
    try {
      const response = await clientService.getClientFactSheetForCase(caseId);
      if (response.success) {
        setClientFactSheet(response.data);
      }
    } catch (error) {
      console.error('Failed to load client fact sheet:', error);
      showError('Failed to load client fact sheet');
      setShowClientFactSheet(false);
    } finally {
      setLoadingFactSheet(false);
    }
  };

  const handlePrintSummary = () => {
    const pdfUrl = caseService.getSummaryPdfUrl(caseId);
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
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

  const docketMode = caseInfo?.status === 'UNASSIGNED' && caseInfo?.queueType === 'GLOBAL'
    ? 'VIEW'
    : (caseInfo?.status === 'PENDED' || caseInfo?.status === 'PENDING' ? 'PEND' : 'OPEN');

  const showPullButton = docketMode === 'VIEW';

  // Move to Workbasket button: show only for admin users AND case is currently assigned
  const showMoveToWorkbasketButton = isAdmin && caseInfo?.assignedToXID;

  // Case action buttons (File, Pend, Resolve) - PR: Fix Case Lifecycle
  // Action Visibility Rules:
  // - OPEN: Show File, Pend, Resolve (no Unpend)
  // - PENDING/PENDED: Show ONLY Unpend (no File, Pend, Resolve)
  // - FILED or RESOLVED: Show nothing (terminal states, read-only)
  const canPerformLifecycleActions = caseInfo?.status === 'OPEN' && !isViewOnlyMode;
  const canUnpend = docketMode === 'PEND' && !isViewOnlyMode;

  const scrollToSection = (key) => {
    const sectionMap = {
      [CASE_DETAIL_TABS.OVERVIEW]: overviewSectionRef,
      [CASE_DETAIL_TABS.COMMENTS]: commentsSectionRef,
      [CASE_DETAIL_TABS.ATTACHMENTS]: attachmentsSectionRef,
      [CASE_DETAIL_TABS.HISTORY]: historySectionRef,
    };
    setActiveSection(key);
    sectionMap[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <div className="case-detail">
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
        <CaseDetailHeader
          caseId={formatDocketId(caseInfo.caseId || caseId)}
          title={caseInfo.title || caseInfo.category}
          status={toLifecycleStage(caseInfo?.status)}
          lastUpdated={formatDateTime(caseInfo.updatedAt)}
          onOpenAudit={() => setAuditSidebarOpen(true)}
          onAddComment={handleScrollToComments}
          onCloseCase={() => setShowFileModal(true)}
        />
        <div className="case-detail__header-actions case-detail__header-actions--top">
          <Button variant="outline" onClick={handleShowClientFactSheet} disabled={loadingFactSheet}>Fact Sheet</Button>
          {showPullButton && <Button variant="primary" onClick={handlePullCase} disabled={pullingCase}>{pullingCase ? 'Pulling docket...' : 'Pull Docket'}</Button>}
          {canUnpend && <Button variant="primary" onClick={() => setShowUnpendModal(true)}>Unpend Docket</Button>}
          <Button variant="outline" onClick={handlePrintSummary}>Print Summary</Button>
          {caseInfo.approvalStatus === 'PENDING' && <Badge variant="warning">Awaiting Partner Approval</Badge>}
          {caseInfo.lockStatus?.isLocked && <Badge variant="warning">Lifecycle Locked</Badge>}
          {caseInfo?.stage?.requiresApproval === true && isViewOnlyMode && <Badge variant="warning">Role Restricted Action</Badge>}
        </div>

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

        <div className="case-detail__split">
          <div className="case-detail__split-main">
            <Card className="case-detail__section case-section" id="overview" ref={overviewSectionRef}>
              <div className="case-detail__section-heading">
                <h2 className="neo-section__header">Overview</h2>
                {canEditOverview ? (
                  <Button variant="outline" onClick={() => setIsEditingOverview((value) => !value)}>
                    {isEditingOverview ? 'Cancel Edit' : 'Edit'}
                  </Button>
                ) : null}
              </div>
              <div className="case-detail__metadata-grid">
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
                <span className="case-detail__metadata-item">
                  Assigned to: {caseInfo?.assignedToName || caseInfo?.assignedToXID || 'Unassigned'}
                </span>
              </div>
              <div className="case-detail__field">
                <span className="case-detail__label">Client</span>
                <span>{caseData.client ? formatClientDisplay(caseData.client, true) : '—'}</span>
              </div>
              <div className="case-detail__field">
                <span className="case-detail__label">Category</span>
                {isEditingOverview ? (
                  <Input
                    value={overviewDraft.category}
                    onChange={(e) => setOverviewDraft((prev) => ({ ...prev, category: e.target.value }))}
                    aria-label="Case category"
                  />
                ) : (
                  <span>{caseInfo.category}</span>
                )}
              </div>
              <div className="case-detail__field">
                <span className="case-detail__label">Current Lifecycle Stage</span>
                <Badge status={caseInfo?.status}>{toLifecycleStage(caseInfo?.status)}</Badge>
              </div>
              <div className="case-detail__field">
                <span className="case-detail__label">Due Date</span>
                <span>{caseInfo.dueDate ? formatDateTime(caseInfo.dueDate) : 'Not configured'}</span>
              </div>
              <div className="case-detail__field">
                <span className="case-detail__label">Description</span>
                {isEditingOverview ? (
                  <Textarea
                    value={overviewDraft.description}
                    onChange={(e) => setOverviewDraft((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    aria-label="Case description"
                  />
                ) : (
                  <span>{caseInfo.description || 'No description'}</span>
                )}
              </div>
              {(canPerformLifecycleActions || canUnpend) && (
                <div className="case-detail__lifecycle-actions">
                  {canPerformLifecycleActions && (
                    <>
                      <Button variant="outline" onClick={() => setShowFileModal(true)} className="case-detail__btn-muted">
                        📤 File
                      </Button>
                      <Button variant="outline" onClick={() => setShowPendModal(true)} className="case-detail__btn-warning">
                        ⏳ Pend
                      </Button>
                      <Button variant="primary" onClick={() => setShowResolveModal(true)}>
                        ✓ Resolve
                      </Button>
                    </>
                  )}
                  {canUnpend && <Button variant="primary" onClick={() => setShowUnpendModal(true)}>🔁 Unpend</Button>}
                  {showMoveToWorkbasketButton ? <Button variant="outline" onClick={handleMoveToGlobal} disabled={movingToGlobal}>{movingToGlobal ? 'Moving…' : 'Move to Workbasket'}</Button> : null}
                </div>
              )}
            </Card>

            <Card className="case-detail__section case-section" id="comments" ref={commentsSectionRef}>
              <h2 className="neo-section__header">Comments</h2>
              <div className="case-detail__comments" ref={commentsListRef}>
                {comments.length > 0 ? (
                  comments.map((comment, index) => (
                    <div key={index} className="case-detail__comment-item">
                      <div className="case-detail__comment-header">
                        <span className="case-detail__comment-author">
                          {comment.createdByName && comment.createdByXID
                            ? `${comment.createdByName} (${comment.createdByXID})`
                            : 'System (Unknown)'}
                        </span>
                        <span className="case-detail__comment-time">{formatDateTime(comment.createdAt)}</span>
                      </div>
                      <p className="case-detail__comment-text">{comment.text}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No comments yet" description="Use comments to capture updates and handoffs." />
                )}
              </div>
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
                  <Button variant="primary" onClick={handleAddComment} disabled={!newComment.trim() || submitting}>
                    {submitting ? 'Adding…' : 'Add Comment'}
                  </Button>
                </div>
              )}
            </Card>

            <Card className="case-detail__section case-section" id="history" ref={historySectionRef}>
              <h2 className="neo-section__header">History / Audit</h2>
              <div className="case-detail__history-events">
                <AuditTimeline events={timelineEvents} />
              </div>
              <h3 className="case-detail__subheading">Related Dockets</h3>
              {loadingClientDockets ? <p className="case-detail__empty-note">Loading docket history...</p> : (
                <table className="case-detail__history-table">
                  <thead><tr><th>Docket ID</th><th>Category</th><th>Status</th><th>Created</th></tr></thead>
                  <tbody>
                    {clientDockets.map((row) => (
                      <tr key={formatDocketId(row.caseId)} onClick={() => navigate(`/app/firm/${firmSlug}/cases/${row.caseId}`)} style={{ cursor: 'pointer' }}>
                        <td>{formatDocketId(row.caseId)}</td><td>{row.category}</td><td>{row.status}</td><td>{formatDateTime(row.createdAt)}</td>
                      </tr>
                    ))}
                    {!clientDockets.length ? <tr><td colSpan={4}>No related dockets found.</td></tr> : null}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <aside className="case-detail__split-context" aria-label="Case context panel">
            <Card className="case-detail__context-card case-section" id="attachments" ref={attachmentsSectionRef}>
              <h2 className="neo-section__header">Attachments</h2>
              <div className="case-detail__attachments">
                {attachments.length > 0 ? (
                  attachments.map((attachment, index) => (
                    <div key={index} className="neo-inset case-detail__attachment-item">
                      <div className="case-detail__attachment-name">
                        📄 {attachment.fileName || attachment.filename}
                      </div>
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
                      <div className="case-detail__attachment-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => caseService.viewAttachment(caseId, attachment._id)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => caseService.downloadAttachment(caseId, attachment._id, attachment.fileName || attachment.filename)}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  ))
                ) : <EmptyState title="No attachments yet" description="Upload files or forward an email to keep artifacts with this docket." />}
              </div>

              {/* File Upload Dropzone */}
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
                    <div className="neo-dropzone__sub" style={{ marginTop: '8px' }}>
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
                    <Button
                      variant="primary"
                      onClick={handleUploadFile}
                      disabled={!selectedFile || !fileDescription.trim() || uploadingFile}
                      style={{ width: '100%' }}
                    >
                      {uploadingFile ? 'Uploading…' : 'Upload File'}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </aside>
        </div>

        {/* ─── Modals (positioned outside split pane) ─────────────── */}

        {/* File Case Modal */}
        <Modal
          isOpen={showFileModal}
          onClose={() => { setShowFileModal(false); setFileComment(''); }}
          title="File Case"
          actions={
            <>
              <Button variant="outline" onClick={() => { setShowFileModal(false); setFileComment(''); }} disabled={filingCase}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleFileCase} disabled={!fileComment.trim() || filingCase}>
                {filingCase ? 'Filing…' : 'File Case'}
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
                  {lifecycleWarnings.map((w, i) => <li key={i}>{w}</li>)}
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

        {/* Pend Case Modal */}
        <Modal
          isOpen={showPendModal}
          onClose={() => { setShowPendModal(false); setPendComment(''); setPendingUntil(''); }}
          title="Pend Case"
          actions={
            <>
              <Button variant="outline" onClick={() => { setShowPendModal(false); setPendComment(''); setPendingUntil(''); }} disabled={pendingCase}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handlePendCase} disabled={!pendComment.trim() || !pendingUntil || pendingCase}>
                {pendingCase ? 'Pending…' : 'Pend Case'}
              </Button>
            </>
          }
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Pending a case temporarily pauses it until a specified date.
              The case will not appear in your worklist until the reopen date.
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

        {/* Resolve Case Modal */}
        <Modal
          isOpen={showResolveModal}
          onClose={() => { setShowResolveModal(false); setResolveComment(''); }}
          title="Resolve Case"
          actions={
            <>
              <Button variant="outline" onClick={() => { setShowResolveModal(false); setResolveComment(''); }} disabled={resolvingCase}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleResolveCase} disabled={!resolveComment.trim() || resolvingCase}>
                {resolvingCase ? 'Resolving…' : 'Resolve Case'}
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
                  {lifecycleWarnings.map((w, i) => <li key={i}>{w}</li>)}
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

        {/* Client Fact Sheet Modal */}
        {showClientFactSheet && (
          <ClientFactSheetModal
            isOpen={showClientFactSheet}
            onClose={() => { setShowClientFactSheet(false); setClientFactSheet(null); }}
            factSheet={clientFactSheet}
            caseId={caseId}
          />
        )}
        <AuditTimelineDrawer
          isOpen={auditSidebarOpen}
          onClose={() => setAuditSidebarOpen(false)}
          caseId={caseId}
          events={timelineEvents.map((entry) => ({
            id: entry._id || entry.id || `${entry.timestamp}-${entry.actionType}`,
            action: entry.actionType || entry.action || 'Updated',
            actor:
              entry.performedByName ||
              entry.actorXID ||
              entry.performedByXID ||
              entry.createdByName ||
              'System',
            timestamp: entry.timestamp || entry.createdAt,
          }))}
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
    </Layout>
  );
};
