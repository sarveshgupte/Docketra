import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateOnly, formatDateTime, formatTimeOnly } from '../../utils/formatDateTime';
import { caseApi } from '../../api/case.api';
import { useAuth } from '../../hooks/useAuth';
import { isFirmManagerOrAbove } from '../../utils/permissions';
import { getFirmConfig } from '../../utils/firmConfig';
import {
  formatIndianPhoneNumber,
  buildWhatsAppShareUrl,
  buildWhatsAppDocumentRequestMessage,
  getValidityLabel,
} from '../../utils/whatsapp';

const TITLES = {
  cfs: 'Client Fact Sheet',
  attachments: 'Attachments',
  history: 'Audit History',
};

const EMPTY_STATES = {
  attachments: 'No attachments yet. Upload files or forward email artifacts to keep everything together.',
  history: 'No audit events yet. Operational and lifecycle events will appear here as this docket progresses.',
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
  clientPhone = '',
  clientName = '',
  clientEmail = '',
}) => {
  const sidebarPanelRef = useRef(null);
  const lastFocusedElementRef = useRef(null);
  const attachmentFileInputRef = useRef(null);
  const waFileInputRef = useRef(null);
  const copyFeedbackTimeoutRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState('idle');
  const [requestPanelOpen, setRequestPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [waSender, setWaSender] = useState('');
  const [waNote, setWaNote] = useState('');
  const [waFile, setWaFile] = useState(null);
  const [waCopiedTag, setWaCopiedTag] = useState(false);
  const [requestPhone, setRequestPhone] = useState(clientPhone || '');
  const [requestClientMessage, setRequestClientMessage] = useState('');
  const [requestInternalComment, setRequestInternalComment] = useState('');
  const [requestExpiry, setRequestExpiry] = useState('7d');
  const [requestRequirePin, setRequestRequirePin] = useState(false);
  const [requestAutoPend, setRequestAutoPend] = useState(true);
  const [requestSendEmail, setRequestSendEmail] = useState(true);
  const [requestFeedback, setRequestFeedback] = useState('');
  const [showGeneratedPin, setShowGeneratedPin] = useState(false);
  const { user } = useAuth();
  const firmConfig = getFirmConfig();
  const isManagerOrAbove = isFirmManagerOrAbove(user);
  const isTraineeShieldActive = Boolean(firmConfig.restrictTraineeDownloads) && !isManagerOrAbove;
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const [downloadErrorNotice, setDownloadErrorNotice] = useState('');

  useEffect(() => {
    const candidatePhone = clientPhone || cfsData?.basicInfo?.phone || '';
    if (candidatePhone && candidatePhone !== '—' && !requestPhone) {
      setRequestPhone(candidatePhone);
    }
  }, [clientPhone, cfsData?.basicInfo?.phone, requestPhone]);

  const handleViewAttachment = (attachment) => {
    const caseId = caseInfo?.caseId || caseInfo?.internalId || caseInfo?._id;
    const attachmentId = attachment?.id || attachment?._id;
    if (!caseId || !attachmentId) return;
    caseApi.viewAttachment(caseId, attachmentId);
  };

  const handleDownloadAttachment = async (attachment) => {
    const caseId = caseInfo?.caseId || caseInfo?.internalId || caseInfo?._id;
    const attachmentId = attachment?.id || attachment?._id;
    const filename = attachment?.fileName || attachment?.filename || 'attachment';
    if (!caseId || !attachmentId) return;

    if (isTraineeShieldActive) {
      setDownloadErrorNotice('Trainee Laptop Shield is active for your firm. File downloads to personal devices are restricted for junior staff. Please use in-app document preview.');
      return;
    }

    try {
      setDownloadingAttachmentId(attachmentId);
      setDownloadErrorNotice('');
      await caseApi.downloadAttachment(caseId, attachmentId, filename);
    } catch (err) {
      if (err?.code === 'TRAINEE_DOWNLOAD_RESTRICTED' || err?.message?.includes('Trainee Laptop Shield')) {
        setDownloadErrorNotice('Trainee Laptop Shield is active: Raw file downloads to local devices are restricted for junior staff. Please use in-app document preview.');
      } else {
        setDownloadErrorNotice(err?.message || 'Download failed');
      }
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

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
    let icon = '•';
    let typeClass = 'docket-sidebar__timeline-icon--default';
    
    if (actionType.includes('VIEW') || actionType.includes('OPEN') || actionType.includes('EXIT')) {
      icon = '○';
      typeClass = 'docket-sidebar__timeline-icon--view';
    } else if (actionType.includes('COMMENT')) {
      icon = '▪';
      typeClass = 'docket-sidebar__timeline-icon--comment';
    } else if (actionType.includes('FILE') || actionType.includes('ATTACHMENT')) {
      icon = '⧉';
      typeClass = 'docket-sidebar__timeline-icon--attachment';
    } else if (actionType.includes('PENDED') || actionType.includes('PEND')) {
      icon = '⏱';
      typeClass = 'docket-sidebar__timeline-icon--lifecycle';
    } else if (actionType.includes('RESOLVED')) {
      icon = '✓';
      typeClass = 'docket-sidebar__timeline-icon--lifecycle';
    } else if (actionType.includes('FILED')) {
      icon = '↓';
      typeClass = 'docket-sidebar__timeline-icon--lifecycle';
    } else if (actionType.includes('ASSIGNED') || actionType.includes('PULLED') || actionType.includes('UNASSIGNED')) {
      icon = '→';
      typeClass = 'docket-sidebar__timeline-icon--routing';
    } else if (actionType.includes('ROUTE') || actionType.includes('MOVE')) {
      icon = '⇲';
      typeClass = 'docket-sidebar__timeline-icon--routing';
    } else if (actionType.includes('CREATED') || actionType.includes('CLONED')) {
      icon = '+';
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
      setRequestFeedback('Upload link copied to clipboard.');
    } catch (error) {
      setCopyStatus('error');
    }

    copyFeedbackTimeoutRef.current = setTimeout(() => {
      setCopyStatus('idle');
      setRequestFeedback('');
    }, 2000);
  };

  const handleShareOnWhatsApp = async () => {
    if (!onGenerateUploadLink) return;
    const cleanPhone = formatIndianPhoneNumber(requestPhone);
    const payload = {
      sendEmail: false,
      expiry: requestExpiry,
      requirePin: requestRequirePin,
      autoPend: requestAutoPend,
      channel: 'WHATSAPP',
      to: cleanPhone || undefined,
    };
    try {
      const result = await onGenerateUploadLink(payload);
      const generatedLink = result?.link || uploadLinkResult?.link;
      const generatedPin = result?.pin || uploadLinkResult?.pin;
      if (generatedLink) {
        const fullMessage = buildWhatsAppDocumentRequestMessage({
          clientName: clientName || cfsData?.basicInfo?.clientName || caseInfo?.clientName,
          docketTitle: caseInfo?.title || caseInfo?.caseCategory,
          docketNumber: caseInfo?.caseNumber || caseInfo?.caseId,
          uploadLink: generatedLink,
          validity: requestExpiry,
          pin: generatedPin || null,
          firmName: firmConfig?.name || user?.firmName || 'Our Firm',
        });
        const textToSend = requestCustomNote.trim()
          ? `${requestCustomNote.trim()}\n\n${fullMessage}`
          : fullMessage;

        if (navigator?.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(textToSend);
          } catch (_e) {}
        }
        const waUrl = buildWhatsAppShareUrl({ phone: cleanPhone, text: textToSend });
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        setRequestFeedback('Upload link copied to clipboard.');
        setTimeout(() => setRequestFeedback(''), 3000);
      }
    } catch (_err) {
      setRequestFeedback('Failed to generate request link.');
      setTimeout(() => setRequestFeedback(''), 3000);
    }
  };

  const handleCopyRequestLinkOnly = async () => {
    let linkToCopy = uploadLinkResult?.link;
    if (!linkToCopy && onGenerateUploadLink) {
      const cleanPhone = formatIndianPhoneNumber(requestPhone);
      const result = await onGenerateUploadLink({
        sendEmail: false,
        expiry: requestExpiry,
        requirePin: requestRequirePin,
        autoPend: requestAutoPend,
        channel: 'WHATSAPP',
        to: cleanPhone || undefined,
      });
      linkToCopy = result?.link;
    }
    if (linkToCopy && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(linkToCopy);
      setRequestFeedback('Upload link copied to clipboard.');
      setTimeout(() => setRequestFeedback(''), 3000);
    }
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
        const rawStatus = cfsData?.status
          || cfsData?.clientStatus
          || cfsData?.client?.status
          || caseInfo?.clientStatus
          || caseInfo?.client?.status
          || 'active';
        const clientStatus = String(rawStatus).charAt(0).toUpperCase() + String(rawStatus).slice(1).toLowerCase();
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
          <div><span className="font-semibold text-gray-900">Client Status:</span> {clientStatus}</div>
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
          <div className="space-y-3 flex flex-col h-full">
            {/* Intake Mode Switcher */}
            <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs font-medium shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 rounded-md py-1 text-center transition-all ${
                  activeTab === 'upload'
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('whatsapp')}
                className={`flex-1 rounded-md py-1 text-center transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                <span>WhatsApp Drop</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('request')}
                className={`flex-1 rounded-md py-1 text-center transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'request'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-blue-700 hover:text-blue-900'
                }`}
              >
                <span>Request Files</span>
              </button>
            </div>

            {/* Tab 1: Standard Upload Form */}
            {activeTab === 'upload' && (
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
            )}

            {/* Tab 2: WhatsApp Forwarding Bridge Form */}
            {activeTab === 'whatsapp' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-emerald-100">
                  <div className="text-[11px] font-semibold text-emerald-900">
                    Forward WhatsApp Media to Docket
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const tag = `#${caseInfo?.caseNumber || caseInfo?.caseId || 'DOCKET'}`;
                      navigator.clipboard?.writeText(tag);
                      setWaCopiedTag(true);
                      setTimeout(() => setWaCopiedTag(false), 2000);
                    }}
                    className="font-mono text-[10px] px-2 py-0.5 rounded border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 font-semibold"
                  >
                    {waCopiedTag ? 'Copied #' : `Copy Tag #${caseInfo?.caseNumber || caseInfo?.caseId || 'DOCKET'}`}
                  </button>
                </div>
                <p className="text-[10px] text-emerald-700 leading-tight">
                  Clients dump files in WhatsApp? Drop the media here with sender details. Docketra syncs it into Google Drive without forcing clients onto a web portal.
                </p>

                <input
                  ref={waFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => setWaFile(event.target.files?.[0] || null)}
                  disabled={uploadingAttachment}
                />

                <div
                  onClick={() => !uploadingAttachment && waFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
                    waFile
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-emerald-300 hover:border-emerald-400 bg-white hover:bg-emerald-50/30'
                  }`}
                >
                  <p className="text-xs font-semibold text-emerald-950 truncate">
                    {waFile ? waFile.name : 'Select or drop WhatsApp media'}
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    {waFile ? `${(waFile.size / 1024).toFixed(1)} KB ready` : 'PDF, Screenshot, Bank Challan, or Photo'}
                  </p>
                </div>

                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={waSender}
                  onChange={(event) => setWaSender(event.target.value)}
                  placeholder="WhatsApp Sender (e.g. +91 98200 12345 / Director)"
                  disabled={uploadingAttachment}
                />

                <textarea
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  rows={2}
                  value={waNote}
                  onChange={(event) => setWaNote(event.target.value)}
                  placeholder="Client WhatsApp message/caption (e.g. 'Paid advance tax challan')"
                  disabled={uploadingAttachment}
                />

                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60 shadow-xs"
                  onClick={(e) => {
                    const desc = waSender.trim()
                      ? `Forwarded from WhatsApp (${waSender.trim()})`
                      : 'Forwarded via WhatsApp Bridge';
                    onUploadAttachment?.(e, {
                      file: waFile,
                      description: desc,
                      note: waNote.trim() || undefined,
                      source: 'WHATSAPP_FORWARD',
                    });
                    setWaFile(null);
                    setWaSender('');
                    setWaNote('');
                  }}
                  disabled={uploadingAttachment || !waFile}
                >
                  <span>{uploadingAttachment ? `Bridging${uploadProgress ? ` ${uploadProgress}%` : '...'}` : 'Bridge WhatsApp Media to Drive →'}</span>
                </button>
              </div>
            )}

            {/* Tab 3: 1-Click WhatsApp Document Request Form */}
            {activeTab === 'request' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-blue-100">
                  <div className="text-[11px] font-semibold text-blue-950">
                    Request Documents via WhatsApp
                  </div>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                    1-Click Drop
                  </span>
                </div>
                <p className="text-[10px] text-blue-800 leading-tight">
                  Generates a secure drop link and opens WhatsApp with a pre-filled message for your client.
                </p>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Client WhatsApp Phone</label>
                  <input
                    type="tel"
                    className="w-full rounded-md border border-gray-300 bg-white p-1.5 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    value={requestPhone}
                    onChange={(e) => setRequestPhone(e.target.value)}
                    placeholder="e.g. 9820012345 (Leave empty to choose in WhatsApp)"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Link Validity</label>
                    <select
                      className="w-full rounded-md border border-gray-300 bg-white p-1.5 text-xs"
                      value={requestExpiry}
                      onChange={(e) => setRequestExpiry(e.target.value)}
                    >
                      <option value="24h">24 Hours</option>
                      <option value="48h">48 Hours</option>
                      <option value="7d">7 Days</option>
                      <option value="14d">14 Days</option>
                      <option value="30d">30 Days</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1 pt-0.5">
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestAutoPend}
                      onChange={(e) => setRequestAutoPend(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Auto-set docket to Waiting / Pending</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestRequirePin}
                      onChange={(e) => setRequestRequirePin(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Require 4-digit PIN for upload</span>
                  </label>
                </div>

                {/* Message Preview */}
                <div className="rounded border border-gray-200 bg-white p-2 text-[10px] text-gray-600 leading-relaxed font-sans max-h-24 overflow-y-auto">
                  {buildWhatsAppDocumentRequestMessage({
                    clientName: clientName || cfsData?.basicInfo?.clientName || caseInfo?.clientName,
                    docketTitle: caseInfo?.title || caseInfo?.caseCategory,
                    docketNumber: caseInfo?.caseNumber || caseInfo?.caseId,
                    uploadLink: uploadLinkResult?.link || 'https://docketra.in/upload/[link]',
                    validity: requestExpiry,
                    pin: uploadLinkResult?.pin || (requestRequirePin ? '••••' : null),
                    firmName: firmConfig?.name || user?.firmName || 'Our Firm',
                  })}
                </div>

                {requestFeedback && (
                  <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-medium text-center">
                    {requestFeedback}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleShareOnWhatsApp}
                    disabled={uploadLinkGenerating}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-60"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.054-1.748-.415-1.424-.601-2.336-2.038-2.408-2.133-.07-.095-.572-.76-.572-1.448 0-.689.362-1.028.49-1.168.129-.14.282-.175.376-.175.093 0 .188.001.27.005.087.004.204-.033.32.244.119.288.406.993.442 1.065.035.072.059.156.012.25-.047.094-.07.153-.14.235-.07.082-.148.184-.211.247-.07.07-.144.146-.062.287.082.141.365.602.784.975.54.48 1.002.628 1.144.698.141.07.225.059.308-.036.083-.095.355-.413.45-.554.094-.141.189-.118.318-.07.129.047.822.388.963.458.141.07.235.106.27.165.035.059.035.341-.109.746z"/>
                    </svg>
                    <span>{uploadLinkGenerating ? 'Opening…' : 'Share on WhatsApp →'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyRequestLinkOnly}
                    disabled={uploadLinkGenerating}
                    className="px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-xs font-semibold"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable attachments list at the bottom */}
            <div className="border-t border-gray-200 pt-3 flex flex-col flex-1 min-h-[160px]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center justify-between">
                <span>Attached Files</span>
                <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-xs tabular-nums text-[10px] font-bold font-mono">
                  {attachments.length}
                </span>
              </p>
              {downloadErrorNotice && (
                <div className="mb-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-tight flex items-start justify-between gap-1">
                  <span>{downloadErrorNotice}</span>
                  <button type="button" onClick={() => setDownloadErrorNotice('')} className="text-amber-500 hover:text-amber-700 ml-1 font-bold" aria-label="Dismiss error notice" title="Dismiss error notice"><span aria-hidden="true">×</span></button>
                </div>
              )}
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
                        {(String(attachment.source || '').toUpperCase() === 'WHATSAPP_FORWARD' || String(attachment.source || '').toLowerCase() === 'whatsapp_intake') ? (
                          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[9px] font-bold whitespace-nowrap">
                            WhatsApp
                          </span>
                        ) : String(attachment.source || '').toUpperCase() === 'CLIENT_UPLOAD' ? (
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded text-[9px] font-bold whitespace-nowrap">
                            Client
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {formatDateTime(attachment.createdAt || attachment.uploadedAt)} • {uploaderLabel(attachment)}
                      </p>
                      {attachment.description && (
                        <p className="text-[10px] text-gray-600 mt-1 bg-white border border-gray-100 rounded p-1.5 italic font-serif">
                          Comment: {attachment.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-gray-200/60">
                        <button
                          type="button"
                          onClick={() => handleViewAttachment(attachment)}
                          className="text-[10px] font-medium text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-0.5"
                        >
                          Preview in-app
                        </button>
                        <span className="text-gray-300 text-[10px]">•</span>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(attachment)}
                          disabled={downloadingAttachmentId === (attachment.id || attachment._id)}
                          className={`text-[10px] font-medium transition-colors ${
                            isTraineeShieldActive
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title={isTraineeShieldActive ? 'Download restricted by Trainee Laptop Shield' : 'Download raw file'}
                        >
                          {downloadingAttachmentId === (attachment.id || attachment._id) ? 'Downloading…' : isTraineeShieldActive ? 'Download restricted' : 'Download'}
                        </button>
                      </div>
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
          <button type="button" onClick={onClose} className="docket-sidebar__close" aria-label="Close panel" title="Close panel">✕</button>
        </div>
        <div className="docket-sidebar__content">{renderContent()}</div>
      </aside>
    </div>
  );
};
