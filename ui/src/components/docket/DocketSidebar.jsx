import React, { useEffect, useRef } from 'react';
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
  selectedAttachmentFile = null,
  attachmentComment = '',
  uploadingAttachment = false,
  uploadProgress = 0,
  onAttachmentFileChange,
  onAttachmentCommentChange,
  onUploadAttachment,
}) => {
  const attachmentFileInputRef = useRef(null);
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
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Upload via secure link</p>
            <p className="mt-1 text-xs text-gray-500">Share a client upload link from this docket to collect documents securely.</p>
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
        <div className="docket-sidebar__history-wrap">
        <p className="docket-sidebar__history-note">Complete lifecycle log from docket creation/cloning through resolution/filing, including opens/views/closes and WB ↔ WL movements.</p>
        <div className="docket-sidebar__history-table-wrap">
          <table className="docket-sidebar__history-table">
            <thead>
              <tr>
                <th scope="col">Particulars</th>
                <th scope="col">xID</th>
                <th scope="col">Time</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {timelineEvents.map((event, index) => {
                const eventTimestamp = event?.timestamp || event?.createdAt || event?.date || event?.updatedAt;
                return (
                  <tr key={event.id || event._id || `${resolveParticulars(event)}-${eventTimestamp}-${index}`}>
                    <td>{resolveParticulars(event)}</td>
                    <td>{resolveActorXid(event)}</td>
                    <td>{formatTimePart(eventTimestamp)}</td>
                    <td>{formatDatePart(eventTimestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
