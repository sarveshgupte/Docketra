import React, { useEffect, useRef } from 'react';
import { formatDateTime } from '../../utils/formatDateTime';

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
  selectedAttachmentFile = null,
  attachmentComment = '',
  uploadingAttachment = false,
  uploadProgress = 0,
  inboundAddress = '',
  onAttachmentFileChange,
  onAttachmentCommentChange,
  onUploadAttachment,
  onCopyInboundAddress,
}) => {
  const attachmentFileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !type) return null;

  const renderContent = () => {
    if (type === 'cfs') {
      const cfsAttachments = cfsData?.attachments || cfsData?.files || [];
      const clientId = cfsData?.clientId || caseInfo?.clientId || caseInfo?.client?.clientId || '—';
      const clientName = cfsData?.businessName
        || cfsData?.basicInfo?.clientName
        || caseInfo?.clientName
        || caseInfo?.businessName
        || caseInfo?.client?.businessName
        || '—';
      const notes = cfsData?.description || cfsData?.notes || '';

      if (cfsLoading) {
        return <p className="docket-sidebar__empty">Loading client fact sheet…</p>;
      }

      return (
        <div className="space-y-4 text-sm text-gray-700">
          <div><span className="font-semibold text-gray-900">Client Name:</span> {clientName}</div>
          <div><span className="font-semibold text-gray-900">Client ID:</span> {clientId}</div>
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
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Attach file</p>
            <p className="mb-3 text-xs text-gray-500">
              Comment is compulsory for every attachment.
            </p>
            <input
              ref={attachmentFileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => onAttachmentFileChange?.(event.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="mb-3 inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => attachmentFileInputRef.current?.click()}
              disabled={uploadingAttachment}
            >
              Attach File
            </button>
            <p className="mb-3 truncate text-xs text-gray-500">{selectedAttachmentFile?.name || 'No file selected'}</p>
            <textarea
              className="mb-3 w-full rounded-md border border-gray-300 p-2 text-sm"
              rows={3}
              value={attachmentComment}
              onChange={(event) => onAttachmentCommentChange?.(event.target.value)}
              placeholder="Add compulsory comment for this attachment"
              disabled={uploadingAttachment}
            />
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onUploadAttachment}
              disabled={uploadingAttachment}
            >
              {uploadingAttachment ? `Uploading${uploadProgress ? ` ${uploadProgress}%` : '...'}` : 'Upload Attachment'}
            </button>
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inbound email for attachments</p>
            {inboundAddress ? (
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="break-all text-xs text-gray-600">{inboundAddress}</p>
                <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700" onClick={onCopyInboundAddress}>
                  Copy
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-500">Inbound email not available for this docket.</p>
            )}
          </div>

          {!attachments.length ? <p className="docket-sidebar__empty">{EMPTY_STATES.attachments}</p> : null}
          <ul className="space-y-3">
            {attachments.map((attachment, index) => (
              <li key={attachment.id || attachment._id || index} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-900">{attachment.fileName || attachment.filename || 'Attachment'}</p>
                <p className="mt-1 text-xs text-gray-500">Attached on {formatDateTime(attachment.createdAt || attachment.uploadedAt)}</p>
                <p className="mt-1 text-xs text-gray-500">Attached by {uploaderLabel(attachment)}</p>
                {attachment.description ? <p className="mt-1 text-xs text-gray-500">Comment: {attachment.description}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (!timelineEvents.length) return <p className="docket-sidebar__empty">{EMPTY_STATES.history}</p>;

    return (
      <ul className="space-y-3">
        {timelineEvents.map((event, index) => (
          <li key={event.id || event._id || index} className="rounded-xl border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-900">{event.action || event.event || event.title || 'Update'}</p>
            <p className="text-xs text-gray-500">{formatDateTime(event.createdAt || event.timestamp || event.date)}</p>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="docket-sidebar docket-sidebar--open" role="presentation" aria-hidden={false}>
      <button type="button" className="docket-sidebar__backdrop" onClick={onClose} aria-label="Close docket sidebar" />
      <aside className="docket-sidebar__panel docket-sidebar__panel--enter" aria-label={`${TITLES[type] || 'Details'} panel`}>
        <div className="docket-sidebar__header">
          <h3 className="text-base font-semibold text-gray-900">{TITLES[type] || 'Details'}</h3>
          <button type="button" onClick={onClose} className="docket-sidebar__close" aria-label="Close panel">✕</button>
        </div>
        <div className="docket-sidebar__content">{renderContent()}</div>
      </aside>
    </div>
  );
};
