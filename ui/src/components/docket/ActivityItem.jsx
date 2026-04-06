import React from 'react';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDateTime';

export function ActivityItem({ event, className = '', itemRef = null }) {
  const actor = event?.actor || 'System';
  const timestamp = formatDateTime(event?.createdAt);
  const relativeTime = formatRelativeTime(event?.createdAt);
  const readableTime = relativeTime || timestamp;
  const primaryLabel = event?.count > 1 ? `${event.count} updates · ${event.action}` : event?.action;
  const summary = `${primaryLabel} by ${actor} · ${readableTime}`;
  const itemClassName = ['docket-activity-item', className].filter(Boolean).join(' ');

  return (
    <li className={itemClassName} ref={itemRef}>
      <div className="docket-activity-item__marker" aria-hidden="true">
        <span className="docket-activity-item__dot" />
      </div>
      <div className="docket-activity-item__content">
        <p className="docket-activity-item__primary">{summary}</p>
        <p className="docket-activity-item__secondary">At {timestamp}</p>
      </div>
    </li>
  );
}
