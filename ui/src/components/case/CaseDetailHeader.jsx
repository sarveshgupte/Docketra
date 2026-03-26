import React from 'react';
import { StatusBadge } from '../layout/StatusBadge';
import { formatDateTime } from '../../utils/formatDateTime';

export const CaseDetailHeader = ({ caseInfo, actions, statusBadges, onInfoClick }) => {
  return (
    <header className="case-detail-header">
      <div className="case-detail-header__identity">
        <div className="case-detail-header__title-row">
          <h1 className="case-detail-header__title">{caseInfo.caseId}</h1>
          <StatusBadge status={caseInfo.status} />
          <button
            type="button"
            className="case-detail-header__info-btn"
            onClick={onInfoClick}
            aria-label="Open client fact sheet"
            title="Open Client Fact Sheet"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
        <p className="case-detail-header__subtitle">{caseInfo.category}</p>
        <div className="case-detail-header__meta">Last updated {formatDateTime(caseInfo.updatedAt)}</div>
      </div>

      <div className="case-detail-header__actions">
        {statusBadges}
        {actions}
      </div>
    </header>
  );
};
