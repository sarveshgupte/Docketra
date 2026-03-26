import React, { useEffect } from 'react';
import { formatDateTime } from '../../utils/formatDateTime';

const TITLES = {
  cfs: 'CFS',
  attachments: 'Attachments',
  history: 'History',
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

  if (!isOpen) return null;

  const renderContent = () => {
    if (type === 'cfs') {
      return (
        <div className="space-y-3 text-sm text-gray-700">
          <div><span className="font-semibold text-gray-900">Client:</span> {caseInfo?.clientName || caseInfo?.businessName || 'Unknown'}</div>
          <div><span className="font-semibold text-gray-900">Category:</span> {caseInfo?.category || '—'}</div>
          <div><span className="font-semibold text-gray-900">Assigned To:</span> {caseInfo?.assignedToName || caseInfo?.assignedToXID || 'Unassigned'}</div>
          <div><span className="font-semibold text-gray-900">Created:</span> {formatDateTime(caseInfo?.createdAt)}</div>
        </div>
      );
    }

    if (type === 'attachments') {
      if (!attachments.length) return <p className="text-sm text-gray-500">No attachments yet.</p>;
      return (
        <ul className="space-y-3">
          {attachments.map((attachment, index) => (
            <li key={attachment.id || attachment._id || index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">{attachment.fileName || attachment.filename || 'Attachment'}</p>
              <p className="text-xs text-gray-500">{formatDateTime(attachment.createdAt || attachment.uploadedAt)}</p>
            </li>
          ))}
        </ul>
      );
    }

    if (!timelineEvents.length) return <p className="text-sm text-gray-500">No history yet.</p>;

    return (
      <ul className="space-y-3">
        {timelineEvents.map((event, index) => (
          <li key={event.id || event._id || index} className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-900">{event.action || event.event || event.title || 'Update'}</p>
            <p className="text-xs text-gray-500">{formatDateTime(event.createdAt || event.timestamp || event.date)}</p>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="fixed inset-0 z-[90]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close docket sidebar" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[35%] min-w-[320px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{TITLES[type] || 'Details'}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="h-[calc(100%-57px)] overflow-y-auto p-5">{renderContent()}</div>
      </aside>
    </div>
  );
};
