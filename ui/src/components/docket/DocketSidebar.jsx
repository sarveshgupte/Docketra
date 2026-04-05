import React, { useEffect } from 'react';
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
  cfsData = null,
  cfsLoading = false,
}) => {
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
      if (!attachments.length) return <p className="docket-sidebar__empty">{EMPTY_STATES.attachments}</p>;
      return (
        <ul className="space-y-3">
          {attachments.map((attachment, index) => (
            <li key={attachment.id || attachment._id || index} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">{attachment.fileName || attachment.filename || 'Attachment'}</p>
              <p className="text-xs text-gray-500">{formatDateTime(attachment.createdAt || attachment.uploadedAt)}</p>
            </li>
          ))}
        </ul>
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
