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
  const formatDatePart = (value) => {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-GB');
  };

  const formatTimePart = (value) => {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
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
