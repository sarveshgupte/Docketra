// NEW
import React from 'react';
import { formatDateTime } from '../../utils/formatDateTime';

export const ActivityItem = ({ user, action, timestamp }) => (
  <div className="activity-item">
    <div className="activity-item__body">
      <strong>{user || 'System'}</strong> {action}
    </div>
    <div className="activity-item__time">{formatDateTime(timestamp)}</div>
  </div>
);
