import React from 'react';
import { formatDateTime } from '../src/utils/formatDateTime';
import { formatCaseName, formatDocketId } from '../src/utils/formatters';
import { LifecycleBadge } from './LifecycleBadge';

const normalizeDoc = (data) => data?.case || data;
const asDisplayValue = (value) => (!value || value === 'N/A' ? '—' : value);

/**
 * Canonical docket header renderer.
 * Data loading stays in CaseDetailPage to avoid duplicate case fetches.
 */
export function DocketDetails({
  docketId,
  prefetchedCase = null,
  children,
}) {
  const docket = prefetchedCase ? normalizeDoc(prefetchedCase) : null;

  if (!docket) {
    return (
      <header className="case-detail-header">
        <p style={{ color: '#6b7280', margin: 0 }}>Loading docket…</p>
      </header>
    );
  }

  const title = docket.title || formatCaseName(docket.caseName);
  const lastUpdatedLabel = asDisplayValue(formatDateTime(docket.updatedAt));

  return (
    <header className="case-detail-header">
      <div className="case-detail-header__identity">
        <div className="case-detail-header__title-row">
          <h1 className="case-detail-header__title">{formatDocketId(docket.caseId || docketId)}</h1>
          <LifecycleBadge lifecycle={docket.lifecycle} />
        </div>
        <div className="case-detail-header__secondary">
          {asDisplayValue(title) !== '—' ? (
            <p className="case-detail-header__subtitle">{title}</p>
          ) : null}
        </div>
        <div className="case-detail-header__meta">Last updated: {lastUpdatedLabel}</div>
      </div>
      {children ? <div className="case-detail-header__actions">{children}</div> : null}
    </header>
  );
}
