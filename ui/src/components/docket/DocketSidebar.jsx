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

export const DocketSidebar = ({ isOpen, type, onClose, caseInfo, attachments = [], timelineEvents = [] }) => {
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
      return (
        <div className="space-y-4 text-sm text-gray-700">
          <div><span className="font-semibold text-gray-900">Client:</span> {caseInfo?.clientName || caseInfo?.businessName || 'Unknown'}</div>
          <div><span className="font-semibold text-gray-900">Category:</span> {caseInfo?.category || '—'}</div>
          <div><span className="font-semibold text-gray-900">Assigned To:</span> {caseInfo?.assignedToName || caseInfo?.assignedToXID || 'Unassigned'}</div>
          <div><span className="font-semibold text-gray-900">Created:</span> {formatDateTime(caseInfo?.createdAt)}</div>
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
