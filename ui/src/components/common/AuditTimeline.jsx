import React from 'react';
import { formatDateTime } from '../../utils/formatDateTime';
import { getAuditActionLabel } from '../../constants/auditEventLabels';

export const AuditTimeline = ({ events = [], onViewFullTimeline }) => {
  const orderedEvents = [...events].sort((a, b) => {
    const left = new Date(b.timestamp || b.createdAt || 0).getTime();
    const right = new Date(a.timestamp || a.createdAt || 0).getTime();
    return left - right;
  });

  return (
    <div className="audit-timeline">
      <h3 className="audit-timeline-title">Audit History</h3>
      {!orderedEvents.length ? (
        <p className="case-detail__empty-note">No history yet</p>
      ) : (
        <div className="audit-timeline-list">
          {orderedEvents.map((event, index) => {
            const actionLabel = getAuditActionLabel(event);
            const actorId = event.actorXID || event.performedByXID || event.actor || event.createdByXID;
            const actorName = event.performedByName || event.createdByName || event.actorName;
            const details = event.details || event.comment;

            return (
              <div key={event._id || event.id || index} className="audit-entry">
                <div className="audit-entry-event">
                  {actionLabel}
                  {event._important ? <span className="audit-entry-important">Important</span> : null}
                </div>
                <div className="audit-entry-actor">
                  by {actorName ? `${actorName}${actorId ? ` (${actorId})` : ''}` : actorId || 'System'}
                </div>
                <div className="audit-entry-timestamp">{formatDateTime(event.timestamp || event.createdAt)}</div>
                {details ? <div className="audit-entry-details">{details}</div> : null}
              </div>
            );
          })}
        </div>
      )}
      {!!orderedEvents.length && onViewFullTimeline && (
        <button type="button" className="audit-timeline-link" onClick={onViewFullTimeline}>
          View Full Timeline →
        </button>
      )}
    </div>
  );
};
