/**
 * Case Detail Page
 * PR #45: Added view-only mode indicator and audit log display
 * PR: Comprehensive CaseHistory & Audit Trail - Added view tracking and history display
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Textarea } from '../components/common/Textarea';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { CaseHistory } from '../components/common/CaseHistory';
import { ClientFactSheetModal } from '../components/common/ClientFactSheetModal';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { caseService } from '../services/caseService';
import { clientService } from '../services/clientService';
import { formatDateTime, formatAuditStamp } from '../utils/formatDateTime';
import { formatClientDisplay } from '../utils/formatters';
import { USER_ROLES } from '../utils/constants';
import { AuditTimelineDrawer } from '../components/common/AuditTimelineDrawer';
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

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const CaseDetailPage = () => {
  const { caseId } = useParams();
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
    navigate(location.pathname.replace(caseId, prevId), {
      state: { sourceList, index: sourceIndex - 1 },
    });
  };

  const handleNextCase = () => {
    if (!hasNext) return;
    const nextId = sourceList[sourceIndex + 1];
    navigate(location.pathname.replace(caseId, nextId), {
      state: { sourceList, index: sourceIndex + 1 },
    });
  };

  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pullingCase, setPullingCase] = useState(false);
  const [movingToGlobal, setMovingToGlobal] = useState(false);
  const [actionConfirmation, setActionConfirmation] = useState('');
  const [actionError, setActionError] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const fileInputRef = React.useRef(null);
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

  useEffect(() => {
    loadCase();
    
    // Track case opened
    caseService.trackCaseOpen(caseId);
    
    // Cleanup: track case exit on unmount
    return () => {
      caseService.trackCaseExit(caseId);
    };
  }, [caseId]);

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
        setCaseData(response.data);
      }
    } catch (error) {
      console.error('Failed to load case:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePullCase = () => {
    setConfirmModal({
      title: 'Pull Case',
      description: 'Pull this case? This will assign it to you.',
      confirmText: 'Pull Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setPullingCase(true);
        try {
          const response = await caseService.pullCase(caseId);
          if (response.success) {
            const message = `Case ${caseId} assigned • ${formatDateTime(new Date())}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            await loadCase();
          }
        } catch (error) {
          console.error('Failed to pull case:', error);
          const serverMessage = error.response?.data?.message;
          const errorMessage = serverMessage && typeof serverMessage === 'string'
            ? serverMessage.substring(0, 200)
            : 'Failed to pull case. Please try again.';
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
      description: 'This will remove the current assignment and move the case to the Workbasket. Continue?',
      confirmText: 'Move to Workbasket',
      onConfirm: async () => {
        setConfirmModal(null);
        setMovingToGlobal(true);
        try {
          const response = await caseService.moveCaseToGlobal(caseId);
          if (response.success) {
            const message = `Case ${caseId} moved to Workbasket • ${formatDateTime(new Date())}`;
            showSuccess(message);
            setActionConfirmation(message);
            setActionError(null);
            await loadCase();
          }
        } catch (error) {
          console.error('Failed to move case to workbasket:', error);
          const serverMessage = error.response?.data?.message;
          const errorMessage = serverMessage && typeof serverMessage === 'string'
            ? serverMessage.substring(0, 200)
            : 'Failed to move case. Please try again.';
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
      setNewComment('');
      const message = `Comment added to ${caseId} • ${formatDateTime(new Date())}`;
      showSuccess(message);
      setActionConfirmation(message);
      setActionError(null);
      await loadCase(); // Reload to show new comment
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
      const message = `Attachment added to ${caseId} • ${formatDateTime(new Date())}`;
      showSuccess(message);
      setActionConfirmation(message);
      setActionError(null);
      await loadCase(); // Reload to show new attachment
    } catch (error) {
      console.error('Failed to upload file:', error);
      showError('Failed to upload file. Please try again.');
      setActionError({ message: 'Failed to upload file. Please retry.', retry: handleUploadFile });
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
    const responsibleExecutive = caseData?.case?.assignedToName || caseData?.case?.assignedToXID || user?.name || user?.xID || 'Unassigned';
    setConfirmModal({
      title: 'File Case',
      description: `Stage change: ${toLifecycleStage(caseInfo.status)} → Marked as Executed\nResponsible party: ${responsibleExecutive}\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'File Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setFilingCase(true);
        try {
          const response = await caseService.fileCase(caseId, fileComment);
          if (response.success) {
            const message = `Case ${caseId} filed • ${formatDateTime(new Date())}`;
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
    const responsibleExecutive = caseData?.case?.assignedToName || caseData?.case?.assignedToXID || user?.name || user?.xID || 'Unassigned';
    setConfirmModal({
      title: 'Pend Case',
      description: `Stage change: ${toLifecycleStage(caseInfo.status)} → Awaiting Partner Approval\nResponsible party: ${responsibleExecutive}\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'Pend Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setPendingCase(true);
        try {
          const response = await caseService.pendCase(caseId, pendComment, pendingUntil);
          if (response.success) {
            const message = `Case ${caseId} pended • ${formatDateTime(new Date())}`;
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
    const responsibleExecutive = caseData?.case?.assignedToName || caseData?.case?.assignedToXID || user?.name || user?.xID || 'Unassigned';
    setConfirmModal({
      title: 'Resolve Case',
      description: `Stage change: ${toLifecycleStage(caseInfo.status)} → Executed\nResponsible party: ${responsibleExecutive}\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`,
      confirmText: 'Resolve Case',
      onConfirm: async () => {
        setConfirmModal(null);
        setResolvingCase(true);
        try {
          const response = await caseService.resolveCase(caseId, resolveComment);
          if (response.success) {
            const message = `Case ${caseId} resolved • ${formatDateTime(new Date())}`;
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
    const responsibleExecutive = caseData?.case?.assignedToName || caseData?.case?.assignedToXID || user?.name || user?.xID || 'Unassigned';
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
            const message = `Case ${caseId} unpended • ${formatDateTime(new Date())}`;
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
    const caseInfo = normalizeCase(caseData);
    const timeline = (caseData.auditLog || caseData.history || []).slice(0, 10);
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    const timelineRows = timeline
      .map((entry) => `
        <tr>
          <td>${escapeHtml(entry.actionType || entry.action || 'Updated')}</td>
          <td>${escapeHtml(entry.performedByName || entry.performedByXID || entry.actorXID || 'System')}</td>
          <td>${escapeHtml(formatDateTime(entry.timestamp || entry.createdAt))}</td>
          <td>${escapeHtml(entry.description || entry.comment || '')}</td>
        </tr>
      `)
      .join('');
    printWindow.document.write(`
      <html>
        <head>
          <title>Case Summary - ${escapeHtml(caseInfo.caseId || caseId)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 14px; margin-top: 20px; }
            .meta { color: #4b5563; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
            @media print { body { margin: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(caseInfo.caseName || caseInfo.title || 'Case')}</h1>
          <div class="meta">Case ID: ${escapeHtml(caseInfo.caseId || caseId)}</div>
          <div><strong>Status:</strong> ${escapeHtml(toLifecycleStage(caseInfo.status))}</div>
          <div><strong>SLA Due:</strong> ${escapeHtml(caseInfo.slaDueDate ? formatDateTime(caseInfo.slaDueDate) : 'Not configured')}</div>
          <div><strong>Assigned To:</strong> ${escapeHtml(caseInfo.assignedToName || caseInfo.assignedToXID || 'Unassigned')}</div>
          <div><strong>Client:</strong> ${escapeHtml(formatClientDisplay(caseData.client, true))}</div>
          <h2>Timeline (Last 10 entries)</h2>
          <table>
            <thead><tr><th>Action</th><th>Actor</th><th>Timestamp</th><th>Description</th></tr></thead>
            <tbody>${timelineRows || '<tr><td colspan="4">No timeline records</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading case..." />
      </Layout>
    );
  }

  if (!caseData) {
    return (
      <Layout>
        <div className="container">
          <Card>
            <p>Case not found</p>
          </Card>
        </div>
      </Layout>
    );
  }

  // PR #45: Extract access mode information from API response
  const accessMode = caseData.accessMode || {};
  const isViewOnlyMode = accessMode.isViewOnlyMode;
  
  // PR #45: Normalize case data structure
  const caseInfo = normalizeCase(caseData);

  // Determine if user is admin
  const isAdmin = user?.role === 'Admin';

  // Task 2: Inactivity warning — OPEN case not updated in 3+ days (not pended)
  const isInactiveWarning = useMemo(() => {
    if (!caseInfo) return false;
    if (caseInfo.status !== 'OPEN') return false;
    if (!caseInfo.updatedAt) return false;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return new Date(caseInfo.updatedAt) < threeDaysAgo;
  }, [caseInfo]);

  // Task 3: Smart lifecycle warnings for File/Resolve modals
  const lifecycleWarnings = useMemo(() => {
    if (!caseInfo) return [];
    const warnings = [];
    const unresolvedComments = (caseData?.comments || []).filter((c) => !c.resolved).length;
    if (unresolvedComments > 0) {
      warnings.push(`${unresolvedComments} unresolved comment(s) on this case.`);
    }
    if (caseInfo.approvalStatus === 'PENDING') {
      warnings.push('Pending approval is outstanding.');
    }
    const isSlaBreach =
      caseInfo.slaDueDate &&
      new Date(caseInfo.slaDueDate) < new Date() &&
      caseInfo.status !== 'RESOLVED' &&
      caseInfo.status !== 'FILED';
    if (isSlaBreach) {
      warnings.push('SLA has been breached for this case.');
    }
    return warnings;
  }, [caseInfo, caseData]);

  // Determine button visibility
  // Pull Case button: show only if view-only mode, unassigned, and in GLOBAL queue
  const showPullButton = isViewOnlyMode && 
                          !caseInfo.assignedToXID && 
                          caseInfo.queueType === 'GLOBAL' &&
                          caseInfo.status === 'UNASSIGNED';

  // Move to Workbasket button: show only for admin users AND case is currently assigned
  const showMoveToWorkbasketButton = isAdmin && caseInfo.assignedToXID;

  // Case action buttons (File, Pend, Resolve) - PR: Fix Case Lifecycle
  // Action Visibility Rules:
  // - OPEN: Show File, Pend, Resolve (no Unpend)
  // - PENDING/PENDED: Show ONLY Unpend (no File, Pend, Resolve)
  // - FILED or RESOLVED: Show nothing (terminal states, read-only)
  const canPerformLifecycleActions = caseInfo.status === 'OPEN' && !isViewOnlyMode;
  const canUnpend = (caseInfo.status === 'PENDED' || caseInfo.status === 'PENDING') && !isViewOnlyMode;

  return (
    <Layout>
      <div className="case-detail">
        {/* ─── Next/Previous Case Navigation ────────────────────────── */}
        {sourceList && (
          <div className="case-detail__nav-bar">
            <Button
              variant="outline"
              onClick={handlePrevCase}
              disabled={!hasPrev}
              className="case-detail__nav-btn"
              aria-label="Previous case"
            >
              ← Previous Case
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
              Next Case →
            </Button>
          </div>
        )}
        {/* ─── Page Header ──────────────────────────────────────────── */}
        <div className="case-detail__header">
          <div className="case-detail__header-left">
            <h1 className="case-detail__title">{caseInfo.caseName}</h1>
            <p className="case-detail__subtitle">{caseInfo.category}</p>
            <p className="case-detail__meta-line">
              {formatAuditStamp({
                actor: caseInfo.updatedByName || caseInfo.assignedToName || 'System',
                timestamp: caseInfo.updatedAt,
              })}
            </p>
          </div>
          <div className="case-detail__header-actions">
            {/* Client Fact Sheet Button */}
            <Button
              variant="outline"
              onClick={handleShowClientFactSheet}
              disabled={loadingFactSheet}
              title="View Client Fact Sheet"
              className="case-detail__fact-sheet-btn"
            >
              ⓘ Fact Sheet
            </Button>
            {/* Contextual Action Buttons */}
            {showPullButton && (
              <Button variant="primary" onClick={handlePullCase} disabled={pullingCase}>
                {pullingCase ? 'Pulling…' : 'Pull Case'}
              </Button>
            )}
            {showMoveToWorkbasketButton && (
              <Button
                variant="outline"
                onClick={handleMoveToGlobal}
                disabled={movingToGlobal}
                className="case-detail__btn-warning"
              >
                {movingToGlobal ? 'Moving…' : 'Move to Workbasket'}
              </Button>
            )}
            {canPerformLifecycleActions && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowFileModal(true)}
                  className="case-detail__btn-muted"
                >
                  File
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPendModal(true)}
                  className="case-detail__btn-warning"
                >
                  Pend
                </Button>
                <Button variant="primary" onClick={() => setShowResolveModal(true)}>
                  Resolve
                </Button>
              </>
            )}
            {canUnpend && (
              <Button variant="primary" onClick={() => setShowUnpendModal(true)}>
                Unpend
              </Button>
            )}
            <Button variant="outline" onClick={() => setTimelineOpen(true)}>
              View Timeline
            </Button>
            <Button variant="outline" onClick={handlePrintSummary}>
              Print Summary
            </Button>
            {caseInfo.approvalStatus === 'PENDING' && <Badge variant="warning">Awaiting Partner Approval</Badge>}
            {caseInfo.lockStatus?.isLocked && <Badge variant="warning">Lifecycle Locked</Badge>}
            {isViewOnlyMode && <Badge variant="warning">Role Restricted Action</Badge>}
            <Badge status={caseInfo.status}>{toLifecycleStage(caseInfo.status)}</Badge>
          </div>
        </div>
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
        {isViewOnlyMode && (
          <div className="neo-alert neo-alert--info case-detail__alert">
            <strong>Role Restricted Action</strong> — Action restricted: Only Partners can approve this lifecycle stage.
          </div>
        )}
        {caseInfo.lockStatus?.isLocked &&
          caseInfo.lockStatus.activeUserEmail !== user?.email?.toLowerCase() && (
          <div className="neo-alert neo-alert--warning case-detail__alert">
            <strong>Case is Currently Locked</strong> — Being worked on by another user since{' '}
            {formatDateTime(caseInfo.lockStatus.lastActivityAt || caseInfo.lockStatus.lockedAt)}.
          </div>
        )}
        {/* Task 2: Inactivity warning */}
        {isInactiveWarning && (
          <div className="case-detail__inactivity-warning case-detail__alert" role="status">
            ⚠ No activity in 3 days
          </div>
        )}

        {/* ─── Lifecycle Status Panel (Task 4) ──────────────────── */}
        <div className="case-detail__lifecycle-panel">
          <div className="case-detail__lifecycle-fields">
            <div className="case-detail__lifecycle-field">
              <span className="case-detail__lifecycle-label">Current Stage</span>
              <Badge status={caseInfo.status}>{toLifecycleStage(caseInfo.status)}</Badge>
            </div>
            <div className="case-detail__lifecycle-field">
              <span className="case-detail__lifecycle-label">SLA Due</span>
              <span className={`case-detail__lifecycle-value${caseInfo.slaDueDate && new Date(caseInfo.slaDueDate) < new Date() && caseInfo.status !== 'RESOLVED' && caseInfo.status !== 'FILED' ? ' case-detail__lifecycle-value--danger' : ''}`}>
                {caseInfo.slaDueDate ? formatDateTime(caseInfo.slaDueDate) : '—'}
              </span>
            </div>
            <div className="case-detail__lifecycle-field">
              <span className="case-detail__lifecycle-label">Lock Status</span>
              <span className="case-detail__lifecycle-value">
                {caseInfo.lockStatus?.isLocked ? '🔒 Locked' : '🔓 Unlocked'}
              </span>
            </div>
            <div className="case-detail__lifecycle-field">
              <span className="case-detail__lifecycle-label">Approval Status</span>
              <span className="case-detail__lifecycle-value">
                {caseInfo.approvalStatus === 'PENDING' ? '⏳ Awaiting Approval' : caseInfo.approvalStatus || '—'}
              </span>
            </div>
            <div className="case-detail__lifecycle-field">
              <span className="case-detail__lifecycle-label">Last Updated</span>
              <span className="case-detail__lifecycle-value">{formatDateTime(caseInfo.updatedAt)}</span>
            </div>
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
              {canUnpend && (
                <Button variant="primary" onClick={() => setShowUnpendModal(true)}>
                  🔁 Unpend
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ─── Split-Pane Body ────────────────────────────────────── */}
        <div className="case-detail__split">

          {/* Left pane — 60% — main case content */}
          <div className="case-detail__split-main">

            {/* Case Info + Description */}
            <div className="case-detail__info-grid">
              <Card className="case-detail__section">
                <h2 className="neo-section__header">Case Information</h2>
                <div className="case-detail__field">
                  <span className="case-detail__label">Case Name</span>
                  <span>{caseInfo.caseName}</span>
                </div>
                {caseData.client && (
                  <div className="case-detail__field">
                    <span className="case-detail__label">Client</span>
                    <span>{formatClientDisplay(caseData.client, true)}</span>
                  </div>
                )}
                <div className="case-detail__field">
                  <span className="case-detail__label">Category</span>
                  <span>{caseInfo.category}</span>
                </div>
                <div className="case-detail__field">
                  <span className="case-detail__label">Current Lifecycle Stage</span>
                  <Badge status={caseInfo.status}>{toLifecycleStage(caseInfo.status)}</Badge>
                </div>
                <div className="case-detail__field">
                  <span className="case-detail__label">Responsible Executive</span>
                  <span>{caseInfo.assignedToName || caseInfo.assignedToXID || 'Unassigned'}</span>
                </div>
                <div className="case-detail__field">
                  <span className="case-detail__label">Assigned By</span>
                  <span>{caseInfo.assignedByName || caseInfo.assignedByXID || caseInfo.createdByName || caseInfo.createdByXID || 'System'}</span>
                </div>
                <div className="case-detail__field">
                  <span className="case-detail__label">Due Date</span>
                  <span>{caseInfo.dueDate ? formatDateTime(caseInfo.dueDate) : 'Not configured'}</span>
                </div>
                <div className="case-detail__field">
                  <span className="case-detail__label">Location</span>
                  <span>{caseInfo.assignedToXID ? 'My Worklist' : 'Workbasket'}</span>
                </div>
                <div className="case-detail__field">
                  <span className="case-detail__label">Created</span>
                  <span>{formatDateTime(caseInfo.createdAt)}</span>
                </div>
                <div className="case-detail__field">
                  <span className="case-detail__label">Last Action Timestamp</span>
                  <span>{formatDateTime(caseInfo.updatedAt)}</span>
                </div>
                <div className="case-detail__field">
                  <Button variant="outline" size="sm" onClick={() => setTimelineOpen(true)}>
                    Audit History
                  </Button>
                </div>
              </Card>

              {caseInfo.description && (
                <Card className="case-detail__section">
                  <h2 className="neo-section__header">Description</h2>
                  <p className="case-detail__description-text">{caseInfo.description}</p>
                </Card>
              )}
            </div>

            {/* Comments */}
            <Card className="case-detail__section">
              <h2 className="neo-section__header">Comments</h2>
              <div className="case-detail__comments">
                {caseData.comments && caseData.comments.length > 0 ? (
                  caseData.comments.map((comment, index) => (
                    <div key={index} className="neo-inset case-detail__comment-item">
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
                  <p className="case-detail__empty-note">No comments yet</p>
                )}
              </div>
              {(accessMode.canComment || permissions.canAddComment(caseData)) && (
                <div className="case-detail__add-comment">
                  <Textarea
                    label="Add Comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Enter your comment…"
                    rows={3}
                  />
                  <Button
                    variant="primary"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submitting}
                  >
                    {submitting ? 'Adding…' : 'Add Comment'}
                  </Button>
                </div>
              )}
            </Card>

            {/* Activity Timeline (new audit log) */}
            {caseData.auditLog && caseData.auditLog.length > 0 && (
               <Card className="case-detail__section" id="audit-history-section">
                 <h2 className="neo-section__header">Recent Audit Records</h2>
                <div className="case-detail__audit">
                  {caseData.auditLog.map((entry, index) => (
                    <div key={index} className="neo-inset case-detail__audit-item">
                      <div className="case-detail__audit-entry">
                        <span className="case-detail__audit-time">{formatDateTime(entry.timestamp)}</span>
                        <span className="case-detail__audit-action">{entry.actionType}</span>
                        <span className="case-detail__audit-actor">
                          {entry.performedByName && entry.performedByXID
                            ? `${entry.performedByName} (${entry.performedByXID})`
                            : 'System (Unknown)'}
                        </span>
                      </div>
                      <p className="case-detail__audit-desc">{entry.description}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Fallback: old audit history */}
            {(!caseData.auditLog || caseData.auditLog.length === 0) &&
              caseData.history && caseData.history.length > 0 && (
               <Card className="case-detail__section" id="audit-history-section">
                 <h2 className="neo-section__header">Audit History</h2>
                <div className="case-detail__audit">
                  {caseData.history.map((entry, index) => (
                    <div key={index} className="neo-inset case-detail__audit-item">
                      <div className="case-detail__audit-entry">
                        <span className="case-detail__audit-time">{formatDateTime(entry.timestamp)}</span>
                        <span className="case-detail__audit-action">{entry.actionType}</span>
                        <span className="case-detail__audit-actor">
                          {entry.performedByXID
                            ? `System (${entry.performedByXID})`
                            : 'System (Unknown)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right pane — 40% sticky context panel */}
          <aside className="case-detail__split-context" aria-label="Case context panel">

            {/* Attachments + Dropzone */}
            <Card className="case-detail__context-card">
              <h2 className="neo-section__header">Attachments</h2>
              <div className="case-detail__attachments">
                {caseData.attachments && caseData.attachments.length > 0 ? (
                  caseData.attachments.map((attachment, index) => (
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
                ) : (
                  <p className="case-detail__empty-note">No attachments yet</p>
                )}
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

            {/* Case History (audit trail) */}
            {user && user.role !== USER_ROLES.SUPER_ADMIN && (
              <div className="case-detail__context-history">
                <CaseHistory caseId={caseId} />
              </div>
            )}
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
          isOpen={timelineOpen}
          onClose={() => setTimelineOpen(false)}
          caseId={caseId}
          events={(caseData.auditLog || caseData.history || []).map((entry) => ({
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
