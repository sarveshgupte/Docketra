import React from 'react';
import { formatDateTime } from '../../utils/formatDateTime';

const ACTION_LABELS = {
  DOCK_EXITED: 'Exited from system',
  CASE_PULLED: 'Case pulled for review',
  DOCK_VIEWED: 'Viewed docket',
  CASE_CREATED: 'New docket created',
  CASE_UPDATED: 'Case updated',
  STATUS_CHANGED: 'Status changed',
  CASE_CLOSED: 'Docket closed',
};

export const AuditTimeline = ({ events = [] }) => {
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
            const action = event.actionType || event.action || 'CASE_UPDATED';
            const actorId = event.actorXID || event.performedByXID || event.actor || event.createdByXID;
            const actorName = event.performedByName || event.createdByName || event.actorName;
            const details = event.details || event.comment;

            return (
              <div key={event._id || event.id || index} className="audit-entry">
                <div className="audit-entry-event">{ACTION_LABELS[action] || action}</div>
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
      {!!orderedEvents.length && (
        <button type="button" className="audit-timeline-link">
          View Full Timeline →
        </button>
      )}
    </div>
  );
};
