import React from 'react';
import { StatusBadge } from '../layout/StatusBadge';
import { formatDateTime } from '../../utils/formatDateTime';

export const CaseDetailHeader = ({ caseInfo, actions, statusBadges }) => {
  return (
    <header className="case-detail-header">
      <div className="case-detail-header__identity">
        <h1 className="case-detail-header__title">{caseInfo.caseId}</h1>
        <p className="case-detail-header__subtitle">{caseInfo.category}</p>
        <div className="case-detail-header__meta">Last updated {formatDateTime(caseInfo.updatedAt)}</div>
      </div>

      <div className="case-detail-header__actions">
        <StatusBadge status={caseInfo.status} />
        {statusBadges}
        {actions}
      </div>
    </header>
  );
};
