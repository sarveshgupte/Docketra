import { useMemo } from 'react';
import { StatusBadge } from '../layout/StatusBadge';
import { PriorityPill } from '../common/PriorityPill';
import { SlaBadge } from '../common/SlaBadge';
import { AuditMetadata } from '../ui/AuditMetadata';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatCaseName } from '../../utils/formatters';
import { ROUTES } from '../../constants/routes';
import { UX_COPY } from '../../constants/uxCopy';

export const useCasesTableColumns = ({
  enableBulkActions,
  allVisibleSelected,
  handleSelectAll,
  sortedCases,
  selectedCaseIds,
  handleToggleSelectCase,
  getSlaBadgeStatus,
  getRecencyLabel,
  inactivityThresholdHours,
  isAdmin,
  assigningCaseId,
  navigate,
  firmSlug,
  handleAssignToMe,
  location,
  setTimelineCaseId,
}) => useMemo(() => [
  ...(enableBulkActions ? [{
    key: '__select',
    header: (
      <input
        type="checkbox"
        aria-label="Select all"
        checked={allVisibleSelected}
        onChange={() => handleSelectAll(sortedCases)}
      />
    ),
    render: (row) => {
      const isLocked = Boolean(row.lockStatus?.isLocked);
      return (
        <input
          type="checkbox"
          aria-label={`Select ${formatCaseName(row.caseName)}`}
          checked={selectedCaseIds.has(row.caseId)}
          disabled={isLocked}
          onChange={() => handleToggleSelectCase(row.caseId, isLocked)}
          onClick={(e) => e.stopPropagation()}
        />
      );
    },
    align: 'center',
    headerClassName: 'w-[1px] whitespace-nowrap',
    cellClassName: 'w-[1px] whitespace-nowrap',
  }] : []),
  {
    key: 'caseName',
    header: 'Docket Name',
    sortable: true,
    headerClassName: 'w-full max-w-lg',
    cellClassName: 'w-full max-w-lg',
    render: (row) => {
      const slaStatus = getSlaBadgeStatus(row);
      const breached = slaStatus === 'RED';
      const warning = slaStatus === 'YELLOW';
      const recency = getRecencyLabel(row.updatedAt);
      return (
        <div className={`cases-page__name-cell${breached ? ' cases-page__name-cell--sla-breach' : ''}${warning ? ' cases-page__name-cell--sla-warning' : ''}`}>
          <span className="cases-page__case-title">{formatCaseName(row.caseName)}</span>
          <AuditMetadata
            className="cases-page__case-meta"
            actor={row.updatedByName || row.updatedByXID || row.assignedToName || 'System'}
            timestamp={row.updatedAt}
          />
          {recency && (<span className="cases-page__recency" aria-label={recency}>{recency}</span>)}
          <div className="cases-page__pill-row">
            <PriorityPill caseRecord={row} inactivityThresholdHours={inactivityThresholdHours} />
            <SlaBadge status={slaStatus} className="cases-page__sla-badge" />
          </div>
        </div>
      );
    },
  },
  { key: 'category', header: 'Category', sortable: true, headerClassName: 'w-[1px] whitespace-nowrap', cellClassName: 'w-[1px] whitespace-nowrap' },
  {
    key: 'workType', header: 'Work Type', sortable: true, headerClassName: 'w-[1px] whitespace-nowrap', cellClassName: 'w-[1px] whitespace-nowrap',
    render: (row) => (<StatusBadge status={row.isInternal ? 'INTERNAL' : 'CLIENT'} />),
  },
  { key: 'status', header: 'Status', sortable: true, align: 'center', headerClassName: 'w-[1px] whitespace-nowrap', cellClassName: 'w-[1px] whitespace-nowrap', render: (row) => <StatusBadge status={row.status} /> },
  {
    key: 'assignedToName', header: 'Assigned To', sortable: true, headerClassName: 'w-[1px] whitespace-nowrap', cellClassName: 'w-[1px] whitespace-nowrap',
    render: (row) => row.assignedToName || row.assignedToXID || row.assignedTo || 'Unassigned',
  },
  {
    key: 'updatedAt', header: 'Last Updated', align: 'right', tabular: true, sortable: true, headerClassName: 'w-[1px] whitespace-nowrap', cellClassName: 'w-[1px] whitespace-nowrap',
    render: (row) => formatDateTime(row.updatedAt),
  },
  {
    key: 'rowActions', header: '', align: 'right', headerClassName: 'w-[1px] whitespace-nowrap', cellClassName: 'w-[1px] whitespace-nowrap',
    render: (row) => {
      const isLocked = Boolean(row.lockStatus?.isLocked);
      const canAssign = !isAdmin && !isLocked;
      return (
        <details className="cases-page__row-menu" onClick={(event) => event.stopPropagation()}>
          <summary aria-label={`Row actions for ${formatCaseName(row.caseName)}`}>⋯</summary>
          <div className="cases-page__row-menu-panel">
            {(row.assignedToName || row.assignedToXID || row.assignedTo) && (
              <div className="cases-page__row-menu-info">Assigned: {row.assignedToName || row.assignedToXID || row.assignedTo}</div>
            )}
            {isLocked && (<div className="cases-page__row-menu-info cases-page__row-menu-info--locked">🔒 Docket Locked</div>)}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                const index = sortedCases.findIndex((c) => c.caseId === row.caseId);
                const returnTo = `${location.pathname}${location.search || ''}`;
                navigate(`${ROUTES.CASE_DETAIL(firmSlug, row.caseId)}?returnTo=${encodeURIComponent(returnTo)}`, {
                  state: { sourceList: sortedCases.map((c) => c.caseId), index, returnTo },
                });
              }}
            >
              View Docket
            </button>
            {canAssign && (
              <button type="button" disabled={assigningCaseId === row.caseId} onClick={(event) => handleAssignToMe(row, event)}>
                {assigningCaseId === row.caseId ? 'Assigning…' : UX_COPY.actions.ASSIGN_TO_ME}
              </button>
            )}
            <button type="button" onClick={(event) => { event.stopPropagation(); setTimelineCaseId(row.caseId); }}>
              View Timeline
            </button>
          </div>
        </details>
      );
    },
  },
], [
  enableBulkActions,
  allVisibleSelected,
  handleSelectAll,
  sortedCases,
  selectedCaseIds,
  handleToggleSelectCase,
  getSlaBadgeStatus,
  getRecencyLabel,
  inactivityThresholdHours,
  isAdmin,
  assigningCaseId,
  navigate,
  firmSlug,
  handleAssignToMe,
  location,
  setTimelineCaseId,
]);
