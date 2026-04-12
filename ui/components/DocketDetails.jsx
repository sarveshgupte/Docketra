import React from 'react';
import { formatDateTime } from '../src/utils/formatDateTime';
import { formatCaseName, formatDocketId } from '../src/utils/formatters';
import { LifecycleBadge } from './LifecycleBadge';
import { useAuth } from '../src/hooks/useAuth';

const normalizeDoc = (data) => data?.case || data;
const asDisplayValue = (value) => (!value || value === 'N/A' ? '—' : value);

function assignmentLabel(docket) {
  if (!docket) return null;
  const name = docket.assignedToName;
  const xid = docket.assignedToXID;
  if (name != null && String(name).trim() !== '') return String(name).trim();
  if (xid != null && String(xid).trim() !== '') return String(xid).trim();
  return null;
}

/**
 * Canonical docket header renderer.
 * Data loading stays in CaseDetailPage to avoid duplicate case fetches.
 */
export function DocketDetails({
  docketId,
  prefetchedCase = null,
  children,
  openedFromWorklist = false,
}) {
  const { user } = useAuth();
  const docket = prefetchedCase ? normalizeDoc(prefetchedCase) : null;

  if (!docket) {
    return (
      <header className="case-detail-header">
        <p style={{ color: '#6b7280', margin: 0 }}>Loading docket…</p>
      </header>
    );
  }

  const isWorklistLifecycle = String(docket.lifecycle || '').trim().toUpperCase() === 'WL'
    || String(docket.lifecycle || '').trim().toLowerCase() === 'in_worklist';
  const assigned = openedFromWorklist
    ? (user?.name || user?.xID || 'You')
    : (assignmentLabel(docket) || (isWorklistLifecycle ? '—' : 'Unassigned'));
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
          <p className="case-detail-header__subtitle">{asDisplayValue(title) === '—' ? 'Untitled docket' : title}</p>
          <div className="case-detail-header__meta">Assigned to: {assigned}</div>
        </div>
        <div className="case-detail-header__meta">Last updated: {lastUpdatedLabel}</div>
      </div>
      {children ? <div className="case-detail-header__actions">{children}</div> : null}
    </header>
  );
}
