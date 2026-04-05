import React from 'react';
import { formatDateTime } from '../../utils/formatDateTime';

export function ActivityItem({ event, className = '', itemRef = null }) {
  const actor = event?.actor || 'System';
  const timestamp = formatDateTime(event?.createdAt);
  const secondary = `${actor} • ${timestamp}`;
  const itemClassName = ['docket-activity-item', className].filter(Boolean).join(' ');

  return (
    <li className={itemClassName} ref={itemRef}>
      <div className="docket-activity-item__marker" aria-hidden="true">
        <span className="docket-activity-item__dot" />
      </div>
      <div className="docket-activity-item__content">
        <p className="docket-activity-item__primary">
          {event?.count > 1 ? `${event.count} updates · ${event.action}` : event?.action}
        </p>
        <p className="docket-activity-item__secondary">{secondary}</p>
      </div>
    </li>
  );
}
