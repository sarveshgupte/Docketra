import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateOnly, formatDateTime, formatTimeOnly } from '../../utils/formatDateTime';

const TITLES = {
  cfs: 'Client Fact Sheet',
  attachments: 'Attachments',
  history: 'History',
};

const EMPTY_STATES = {
  attachments: 'No attachments yet. Upload files or forward email artifacts to keep everything together.',
  history: 'No history yet. Lifecycle events will appear here as this docket progresses.',
};

export const DocketSidebar = ({
  isOpen,
  type,
  onClose,
  caseInfo,
  attachments = [],
  timelineEvents = [],
  cfsData = null,
  cfsLoading = false,
  cfsError = '',
  selectedAttachmentFile = null,
  attachmentComment = '',
  uploadingAttachment = false,
  uploadProgress = 0,
  onAttachmentFileChange,
  onAttachmentCommentChange,
  onUploadAttachment,
  onGenerateUploadLink,
  uploadLinkGenerating = false,
  uploadLinkResult = null,
  clientEmail = '',
}) => {
  const sidebarPanelRef = useRef(null);
  const lastFocusedElementRef = useRef(null);
  const attachmentFileInputRef = useRef(null);
  const [requestPanelOpen, setRequestPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [requestExpiry, setRequestExpiry] = useState('24h');
  const [requestRequirePin, setRequestRequirePin] = useState(false);
  const [requestSendEmail, setRequestSendEmail] = useState(true);
  const [showGeneratedPin, setShowGeneratedPin] = useState(false);
  const [copyStatus, setCopyStatus] = useState('idle');
  const copyFeedbackTimeoutRef = useRef(null);
  const expiryLabel = useMemo(() => (requestExpiry === '7d' ? '7 days' : '24 hours'), [requestExpiry]);
  const formatDatePart = (value) => {
    const formatted = formatDateOnly(value);
    return formatted === 'N/A' ? '—' : formatted;
  };

  const formatTimePart = (value) => {
    const formatted = formatTimeOnly(value);
    return formatted === 'N/A' ? '—' : formatted;
  };

  const resolveParticulars = (event) => {
    if (!event) return 'Update';
    return event.actionLabel || event.description || event.actionType || event.action || event.event || event.title || 'Update';
  };

  const resolveActorXid = (event) => event?.performedByXID || event?.actorXID || event?.createdByXID || event?.xID || 'SYSTEM';

  const resolveEventIconAndClass = (event) => {
    const actionType = String(event?.actionType || event?.action || event?.event || '').toUpperCase();
    const particulars = String(event?.description || event?.actionLabel || '').toLowerCase();
    
    // Default
    let icon = '📝';
    let typeClass = 'docket-sidebar__timeline-icon--default';
    
    if (actionType.includes('VIEW') || actionType.includes('OPEN') || actionType.includes('EXIT')) {
      icon = '👁️';
      typeClass = 'docket-sidebar__timeline-icon--view';
    } else if (actionType.includes('COMMENT')) {
      icon = '💬';
      typeClass = 'docket-sidebar__timeline-icon--comment';
    } else if (actionType.includes('FILE') || actionType.includes('ATTACHMENT')) {
      icon = '📎';
      typeClass = 'docket-sidebar__timeline-icon--attachment';
    } else if (actionType.includes('PENDED') || actionType.includes('PEND')) {
      icon = '📅';
      typeClass = 'docket-sidebar__timeline-icon--lifecycle';
    } else if (actionType.includes('RESOLVED')) {
      icon = '✅';
      typeClass = 'docket-sidebar__timeline-icon--lifecycle';
    } else if (actionType.includes('FILED')) {
      icon = '📁';
      typeClass = 'docket-sidebar__timeline-icon--lifecycle';
    } else if (actionType.includes('ASSIGNED') || actionType.includes('PULLED') || actionType.includes('UNASSIGNED')) {
      icon = '👤';
      typeClass = 'docket-sidebar__timeline-icon--routing';
    } else if (actionType.includes('ROUTE') || actionType.includes('MOVE')) {
      icon = '➡️';
      typeClass = 'docket-sidebar__timeline-icon--routing';
    } else if (actionType.includes('CREATED') || actionType.includes('CLONED')) {
      icon = '✨';
      typeClass = 'docket-sidebar__timeline-icon--lifecycle';
    }
    
    return { icon, typeClass };
  };

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyLink = async () => {
    if (!uploadLinkResult?.link) return;

    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }

    if (!navigator?.clipboard?.writeText) {
      setCopyStatus('error');
      copyFeedbackTimeoutRef.current = setTimeout(() => {
        setCopyStatus('idle');
      }, 2000);
      return;
    }

    try {
      await navigator.clipboard.writeText(uploadLinkResult.link);
      setCopyStatus('success');
    } catch (error) {
      setCopyStatus('error');
    }

    copyFeedbackTimeoutRef.current = setTimeout(() => {
      setCopyStatus('idle');
    }, 2000);
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      sidebarPanelRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen, type]);

  useEffect(() => {
    if (isOpen) return undefined;
    const previous = lastFocusedElementRef.current;
    if (previous && typeof previous.focus === 'function') {
      previous.focus();
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (uploadLinkResult?.pin) {
      setShowGeneratedPin(true);
    }
  }, [uploadLinkResult?.pin]);

  if (!isOpen || !type) return null;

  const renderContent = () => {
    try {
      if (type === 'cfs') {
        const cfsAttachments = cfsData?.attachments || cfsData?.files || [];
        const clientId = cfsData?.clientId || caseInfo?.clientId || caseInfo?.client?.clientId || '—';
        const clientName = cfsData?.businessName
          || cfsData?.basicInfo?.clientName
          || caseInfo?.clientName
          || caseInfo?.businessName
          || caseInfo?.client?.businessName
          || '—';
        const clientStatus = cfsData?.status
          || cfsData?.clientStatus
          || caseInfo?.clientStatus
          || caseInfo?.client?.status
          || null;
        const notes = cfsData?.description || cfsData?.notes || '';

        if (cfsLoading) {
          return <p className="docket-sidebar__empty" role="status" aria-live="polite">Loading client fact sheet…</p>;
        }
        if (cfsError) {
          return (
            <div className="docket-sidebar__empty" role="status" aria-live="polite">
              <p>{cfsError}</p>
              <p className="mt-1 text-xs text-gray-500">You can continue working this docket while CFS data is missing.</p>
            </div>
          );
        }
        if (!cfsData) {
          return (
            <div className="docket-sidebar__empty" role="status" aria-live="polite">
              <p>No client fact sheet details added yet.</p>
              <p className="mt-1 text-xs text-gray-500">You can continue working this docket while CFS data is missing.</p>
            </div>
          );
        }

        return (
          <div className="space-y-4 text-sm text-gray-700">
          <div><span className="font-semibold text-gray-900">Client Name:</span> {clientName}</div>
          <div><span className="font-semibold text-gray-900">Client ID:</span> {clientId}</div>
          <div><span className="font-semibold text-gray-900">Client Status:</span> {clientStatus || 'Unavailable'}</div>
          <div>
            <span className="mb-1 block font-semibold text-gray-900">Notes</span>
            <textarea
              value={notes}
              readOnly
              className="w-full min-h-[140px] rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
              placeholder="No client fact sheet notes available."
            />
            <p className="mt-2 text-xs text-gray-500">
              Read-only in dockets. Admins can edit this in Client Management.
            </p>
          </div>
          <div>
            <span className="mb-2 block font-semibold text-gray-900">File Attachments</span>
            {cfsAttachments.length === 0 ? (
              <p className="text-xs text-gray-500">No client fact sheet attachments.</p>
            ) : (
              <ul className="space-y-2">
                {cfsAttachments.map((file, index) => (
                  <li key={file.fileId || file._id || index} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-900">{file.fileName || file.filename || 'Attachment'}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(file.uploadedAt || file.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </div>
        );
      }

      if (type === 'attachments') {
        const uploaderLabel = (attachment) => {
          const uploader = attachment.createdByXID || attachment.uploadedBy || attachment.createdBy || 'Unknown';
          const uploaderName = attachment.createdByName || attachment.uploadedByName;
          return uploaderName ? `${uploaderName} (${uploader})` : uploader;
        };

        return (
          <div className="space-y-4 flex flex-col h-full">
            {/* Premium Segmented Pill Selector */}
            <div className="flex p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'upload'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('upload')}
              >
                Attach File
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'link'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('link')}
              >
                Secure Request Link
              </button>
            </div>

            {/* Tab contents */}
            {activeTab === 'upload' ? (
              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                <input
                  ref={attachmentFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => onAttachmentFileChange?.(event.target.files?.[0] || null)}
                  disabled={uploadingAttachment}
                />
                
                {/* Clean Clickable Upload Dropzone Box */}
                <div
                  onClick={() => !uploadingAttachment && attachmentFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                    selectedAttachmentFile
                      ? 'border-blue-500 bg-blue-50/20'
                      : 'border-gray-300 hover:border-blue-400 bg-gray-50/50 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className={`w-6 h-6 mb-1.5 ${
                        selectedAttachmentFile ? 'text-blue-500 animate-pulse' : 'text-gray-400'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-xs font-semibold text-gray-700 max-w-[200px] truncate">
                      {selectedAttachmentFile ? selectedAttachmentFile.name : 'Click to select or drag a file'}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {selectedAttachmentFile ? 'File attached successfully' : 'Compulsory comment required'}
                    </p>
                  </div>
                </div>

                <textarea
                  className="w-full rounded-md border border-gray-300 p-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={2}
                  value={attachmentComment}
                  onChange={(event) => onAttachmentCommentChange?.(event.target.value)}
                  placeholder="Add compulsory comment for this attachment"
                  disabled={uploadingAttachment}
                />

                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={onUploadAttachment}
                  disabled={uploadingAttachment || !selectedAttachmentFile || !attachmentComment?.trim()}
                >
                  {uploadingAttachment
                    ? `Uploading${uploadProgress ? ` ${uploadProgress}%` : '...'}`
                    : 'Upload Attachment'}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Link Expiry</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={requestExpiry === '24h'}
                        onChange={() => setRequestExpiry('24h')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>24h</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={requestExpiry === '7d'}
                        onChange={() => setRequestExpiry('7d')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>7d</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestRequirePin}
                      onChange={(event) => setRequestRequirePin(event.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Require 4-digit PIN verification</span>
                  </label>
                </div>

                <div className="border-t border-gray-100 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestSendEmail}
                      onChange={(event) => setRequestSendEmail(event.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Send link via email to client</span>
                  </label>
                  {requestSendEmail && (
                    <p className="mt-1 text-[10px] text-gray-500 ml-6 truncate font-medium">
                      To: {clientEmail || 'No client email available'}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() =>
                    onGenerateUploadLink?.({
                      requirePin: requestRequirePin,
                      expiry: requestExpiry,
                      sendEmail: requestSendEmail,
                    })
                  }
                  disabled={uploadLinkGenerating}
                >
                  {uploadLinkGenerating ? 'Generating…' : 'Generate Link'}
                </button>

                {uploadLinkResult?.link ? (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/20 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-blue-800">Secure link ready</p>
                      {uploadLinkResult.expiresAt ? (
                        <p className="text-[9px] text-gray-500">
                          Exp: {new Date(uploadLinkResult.expiresAt).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={uploadLinkResult.link}
                        className="flex-1 rounded-md border border-gray-200 bg-white p-1 text-[10px] font-mono text-gray-600 select-all"
                      />
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap active:bg-gray-100 transition-colors"
                        onClick={handleCopyLink}
                      >
                        {copyStatus === 'success' ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    {uploadLinkResult.pin ? (
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1 border border-gray-100">
                        <span className="text-[10px] font-medium text-gray-500">Verification PIN:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-800">
                            {showGeneratedPin ? uploadLinkResult.pin : '••••'}
                          </span>
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                            onClick={() => setShowGeneratedPin((visible) => !visible)}
                          >
                            {showGeneratedPin ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                    ) : uploadLinkResult.requiresPin ? (
                      <div className="flex items-center justify-between bg-white/60 rounded px-2 py-1 border border-gray-100">
                        <span className="text-[10px] font-medium text-gray-500">Verification PIN:</span>
                        <span className="text-[10px] font-semibold text-gray-500 italic">Protected (Active)</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            {/* Scrollable attachments list at the bottom */}
            <div className="border-t border-gray-200 pt-3 flex flex-col flex-1 min-h-[160px]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center justify-between">
                <span>Attached Files</span>
                <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {attachments.length}
                </span>
              </p>
              {!attachments.length ? (
                <p className="docket-sidebar__empty py-8 text-center text-xs text-gray-400">
                  {EMPTY_STATES.attachments}
                </p>
              ) : (
                <div className="overflow-y-auto max-h-[180px] space-y-2 pr-1 custom-scrollbar">
                  {attachments.map((attachment, index) => (
                    <div
                      key={attachment.id || attachment._id || index}
                      className="rounded-lg border border-gray-150 bg-gray-50/50 p-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="text-xs font-semibold text-gray-800 truncate"
                          title={attachment.fileName || attachment.filename}
                        >
                          {attachment.fileName || attachment.filename || 'Attachment'}
                        </p>
                        {String(attachment.source || '').toUpperCase() === 'CLIENT_UPLOAD' && (
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded text-[9px] font-bold whitespace-nowrap">
                            Client
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {formatDateTime(attachment.createdAt || attachment.uploadedAt)} • {uploaderLabel(attachment)}
                      </p>
                      {attachment.description && (
                        <p className="text-[10px] text-gray-600 mt-1 bg-white border border-gray-100 rounded p-1.5 italic font-serif">
                          Comment: {attachment.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      if (!timelineEvents.length) return <p className="docket-sidebar__empty">{EMPTY_STATES.history}</p>;

      return (
        <div className="docket-sidebar__history-wrap">
          <p className="docket-sidebar__history-note">Complete lifecycle log from docket creation/cloning through resolution/filing, including opens/views/closes and WB ↔ WL movements.</p>
          <div className="docket-sidebar__timeline">
            {timelineEvents.map((event, index) => {
              const eventTimestamp = event?.timestamp || event?.createdAt || event?.date || event?.updatedAt;
              const { icon, typeClass } = resolveEventIconAndClass(event);
              const particulars = resolveParticulars(event);
              const actorXid = resolveActorXid(event);
              const dateText = formatDatePart(eventTimestamp);
              const timeText = formatTimePart(eventTimestamp);
              
              // Extract role if available
              const actorRole = event?.actorRole || (event?.performedBy === 'SYSTEM' || actorXid === 'SYSTEM' ? 'SYSTEM' : 'USER');
              
              return (
                <div key={event.id || event._id || `${particulars}-${eventTimestamp}-${index}`} className="docket-sidebar__timeline-item">
                  <div className={`docket-sidebar__timeline-icon ${typeClass}`} aria-hidden="true">
                    {icon}
                  </div>
                  <div className="docket-sidebar__timeline-content">
                    <div className="docket-sidebar__timeline-title">
                      {particulars}
                    </div>
                    <div className="docket-sidebar__timeline-meta">
                      <span className="docket-sidebar__timeline-actor">{actorXid}</span>
                      {actorRole && actorRole !== 'USER' && (
                        <span className="docket-sidebar__timeline-badge">{actorRole}</span>
                      )}
                      <span className="docket-sidebar__timeline-dot">•</span>
                      <span className="docket-sidebar__timeline-time">{timeText}</span>
                      <span className="docket-sidebar__timeline-date">{dateText}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    } catch (error) {
      console.error('[DocketSidebar] Failed to render sidebar section', { type, error });
      return (
        <p className="docket-sidebar__empty">
          Unable to load this panel right now. Please close and retry.
        </p>
      );
    }
  };

  return (
    <div className="docket-sidebar docket-sidebar--open" role="presentation" aria-hidden={false}>
      <button type="button" className="docket-sidebar__backdrop" onClick={onClose} aria-label="Close docket sidebar backdrop" />
      <aside
        ref={sidebarPanelRef}
        className="docket-sidebar__panel docket-sidebar__panel--enter"
        role="dialog"
        aria-modal="true"
        aria-label={`${TITLES[type] || 'Details'} panel`}
        tabIndex={-1}
      >
        <div className="docket-sidebar__header">
          <h3 className="text-base font-semibold text-gray-900">{TITLES[type] || 'Details'}</h3>
          <button type="button" onClick={onClose} className="docket-sidebar__close" aria-label="Close panel">✕</button>
        </div>
        <div className="docket-sidebar__content">{renderContent()}</div>
      </aside>
    </div>
  );
};
