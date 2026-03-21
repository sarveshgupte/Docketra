// NEW
import React from 'react';
import { formatAuditStamp } from '../../utils/formatDateTime';

export const AuditMetadata = ({ actor, timestamp, prefix = 'Updated by', className = '' }) => {
  return (
    <span className={className || 'audit-metadata'}>
      {formatAuditStamp({ actor, timestamp, prefix })}
    </span>
  );
};
