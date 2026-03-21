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

const ACTION_COLORS = {
  CASE_CREATED: 'blue',
  CASE_UPDATED: 'gray',
  STATUS_CHANGED: 'amber',
  CASE_CLOSED: 'red',
  DOCK_EXITED: 'gray',
};

export const AuditTimeline = ({ events = [] }) => {
  const orderedEvents = [...events].sort((a, b) => {
    const left = new Date(b.timestamp || b.createdAt || 0).getTime();
    const right = new Date(a.timestamp || a.createdAt || 0).getTime();
    return left - right;
  });

  if (!orderedEvents.length) {
    return <p className="empty-state">No history yet</p>;
  }

  return (
    <div className="timeline">
      {orderedEvents.map((event, index) => {
        const action = event.actionType || event.action || 'CASE_UPDATED';
        const actorId = event.actorXID || event.performedByXID || event.actor || event.createdByXID;
        const actorName = event.performedByName || event.createdByName || event.actorName;
        return (
          <div key={event._id || event.id || index} className={`timeline-item timeline-item--${ACTION_COLORS[action] || 'gray'}`}>
            <div className="timeline-item__dot" />
            <div className="timeline-item__content">
              <div className="timeline-item__header">
                <time>{formatDateTime(event.timestamp || event.createdAt)}</time>
                <span className="actor">
                  {actorName ? `${actorName}${actorId ? ` (${actorId})` : ''}` : actorId || 'System'}
                </span>
              </div>
              <p className="timeline-item__action">{ACTION_LABELS[action] || action}</p>
              {event.details || event.comment ? <p className="timeline-item__details">{event.details || event.comment}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
