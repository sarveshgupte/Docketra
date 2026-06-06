import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { formatDateTime } from '../../utils/formatDateTime';
import { getBusinessLifecycleTone } from './caseDetailUtils';




export const CaseDetailOverviewPanel = ({
  caseInfo,
  firmSlug,
  linkedClientRoute,
  isInternalWork,
  clientName,
  clientIdLabel,
  slaDaysLabel,
  dueDateLabel,
  slaRemainingDays,
  linkedClientEmail,
  linkedClientContact,
  linkedClientId,
  fromClientRoute,
  loadingClientDockets,
  clientDockets,
  returnTo,
  navigate,
  descriptionContent,
  lifecycleStatus,
  shouldShowActions,
  canPerformLifecycleActions,
  lifecycleQuickActions,
  actionInFlight,
  isViewOnlyMode,
  onOpenFileModal,
  showFileAction = true,
  canRouteDocket,
  onOpenRouteModal,
  forceQcReview,
  onForceQcReviewChange,
  isQcContext = false,
  isUnassignedWorkbasket = false,
  isTerminal = false,
  openSidebar,
  runGuardedAction,
  setCloneModalOpen,
  canCloneDocket,
  slaBadgeClass,
  slaBadgeLabel,
  categoryLabel,
  subcategoryLabel,
  locationBadges,
  displayLifecycleLabel,
}) => {
  // Determine overdue display: positive = days left, negative = days overdue
  const slaRemainingDisplay = (() => {
    if (slaRemainingDays == null) return null;
    const n = Number(slaRemainingDays);
    if (!Number.isFinite(n)) return null;
    return n;
  })();
  const hasDescription = Boolean(String(descriptionContent || '').trim());

  return (
  <>
    <section className="case-card docket-overview-panel" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <div className="case-card__heading docket-section-heading flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="docket-section-kicker">Snapshot</p>
          <h2 id="snapshot-heading">Overview</h2>
          
          {/* Location and Status Badges */}
          <div className="docket-overview-panel__badges">
            {locationBadges && locationBadges.map((badge) => (
              <Badge key={badge} variant="secondary">{badge}</Badge>
            ))}
            {(caseInfo?.qc?.status || caseInfo?.qcStatus) ? (
              <Badge variant={String(caseInfo?.qc?.status || caseInfo?.qcStatus).toUpperCase() === 'FAILED' ? 'danger' : 'info'}>
                QC: {caseInfo?.qc?.status || caseInfo?.qcStatus}
              </Badge>
            ) : null}
            {caseInfo?.lockStatus?.isLocked && <Badge variant="warning">Lifecycle Locked</Badge>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="docket-icon-cluster" aria-label="Docket actions">
          <button
            type="button"
            onClick={() => runGuardedAction(() => openSidebar('cfs'), 'Unable to open CFS panel right now.')}
            title="Open Client Fact Sheet"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-base hover:bg-white text-gray-600 hover:text-indigo-600 transition-all border border-transparent hover:border-gray-200 cursor-pointer shadow-sm bg-transparent"
            aria-label="Open client fact sheet"
          >
            ⓘ
          </button>
          {canCloneDocket ? (
            <button
              type="button"
              onClick={() => runGuardedAction(() => setCloneModalOpen(true), 'Unable to open clone docket right now.')}
              title="Clone Docket"
              className="h-9 w-9 rounded-lg flex items-center justify-center text-base hover:bg-white text-gray-600 hover:text-indigo-600 transition-all border border-transparent hover:border-gray-200 cursor-pointer shadow-sm bg-transparent"
              aria-label="Clone docket"
            >
              ⧉
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => runGuardedAction(() => openSidebar('attachments'), 'Unable to open Attachments panel right now.')}
            title="Docket Attachments"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-base hover:bg-white text-gray-600 hover:text-indigo-600 transition-all border border-transparent hover:border-gray-200 cursor-pointer shadow-sm bg-transparent"
            aria-label="Open attachments panel"
          >
            📎
          </button>
          <button
            type="button"
            onClick={() => runGuardedAction(() => openSidebar('history'), 'Unable to open Activity timeline right now.')}
            title="Activity Timeline"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-base hover:bg-white text-gray-600 hover:text-indigo-600 transition-all border border-transparent hover:border-gray-200 cursor-pointer shadow-sm bg-transparent"
            aria-label="Open activity timeline"
          >
            🕒
          </button>
        </div>
      </div>
      <div className="field-grid docket-field-grid">
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Client Name</span>
          <span className="field-value text-sm font-medium text-gray-900 break-words">
            {isInternalWork ? 'Internal work (default client)' : (
              linkedClientRoute ? <Link to={linkedClientRoute} className="case-detail-table__link">{clientName}</Link> : clientName
            )}
          </span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Client ID</span>
          <span className="field-value text-sm font-medium text-gray-900 break-words">{clientIdLabel}</span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Category</span>
          <span className="field-value text-sm font-medium text-gray-900 break-words">{categoryLabel}</span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Subcategory</span>
          <span className="field-value text-sm font-medium text-gray-900 break-words">{subcategoryLabel}</span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">SLA (days)</span>
          {slaRemainingDisplay != null ? (
            <span
              className="field-value text-sm font-semibold px-1.5 py-0.5 rounded-md"
              style={{
                background: slaRemainingDisplay < 0 ? '#fef2f2' : slaRemainingDisplay <= 3 ? '#fffbeb' : '#f0fdf4',
                color: slaRemainingDisplay < 0 ? '#dc2626' : slaRemainingDisplay <= 3 ? '#d97706' : '#16a34a',
              }}
            >
              {slaRemainingDisplay < 0 ? `${slaRemainingDisplay} days overdue` : `+${slaRemainingDisplay} days`}
            </span>
          ) : (
            <span className="field-value text-sm font-medium text-gray-900">{slaDaysLabel}</span>
          )}
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Due / SLA</span>
          <span className="field-value text-sm font-medium text-gray-900">
            {dueDateLabel ? formatDateTime(dueDateLabel) : `SLA ${slaDaysLabel} day(s)`}
          </span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Lifecycle</span>
          <span className={`docket-lifecycle-pill docket-lifecycle-pill--${getBusinessLifecycleTone(displayLifecycleLabel)}`}>
            {displayLifecycleLabel || 'Active'}
          </span>
        </div>
      </div>
    </section>


    {hasDescription ? (
      <section className={`case-card docket-description-panel ${lifecycleStatus === 'IN_PROGRESS' ? 'opacity-90' : ''}`} aria-labelledby="overview-heading">
        <div className="case-card__heading docket-section-heading">
          <div>
            <p className="docket-section-kicker">Context</p>
            <h2 id="overview-heading">Description</h2>
          </div>
        </div>
        {lifecycleStatus === 'IN_PROGRESS' && (caseInfo?.pendingUntil || caseInfo?.reopenDate) ? (
          <Badge variant="warning" className="mt-3 inline-flex">
            In progress until {formatDateTime(caseInfo.pendingUntil || caseInfo.reopenDate)}
          </Badge>
        ) : null}
        <div className="mt-4">
          <span className="field-value case-detail__description-text whitespace-pre-wrap break-words text-sm font-medium text-gray-900">{descriptionContent}</span>
        </div>
      </section>
    ) : null}


  </>
  );
};
