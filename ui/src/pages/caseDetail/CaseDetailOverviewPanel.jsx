import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { formatDateTime } from '../../utils/formatDateTime';
import { getBusinessLifecycleTone } from './caseDetailUtils';
import { ROUTES } from '../../constants/routes';
import { formatDocketId } from '../../utils/formatters';

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

      {/* Guidance Banners */}
      {(isUnassignedWorkbasket || isQcContext || isTerminal) && (
        <div className="docket-guidance-banners mb-4 flex flex-col gap-2">
          {isUnassignedWorkbasket && (
            <div className="docket-guidance-banner docket-guidance-banner--warning">
              This docket is currently unassigned in a workbasket. Pull/Assign it from Workbasket flow before personal worklist actions.
            </div>
          )}
          {isQcContext && (
            <div className="docket-guidance-banner docket-guidance-banner--info">
              QC context active. Use QC workbasket actions where appropriate.
            </div>
          )}
          {isTerminal && (
            <div className="docket-guidance-banner docket-guidance-banner--neutral">
              Record view only; active queue actions are hidden.
            </div>
          )}
        </div>
      )}

      {/* Client Context Field Grid */}
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
          <span className="field-value text-sm font-medium text-gray-900 break-words">{clientIdLabel || '—'}</span>
        </div>
        {linkedClientEmail && linkedClientEmail !== '—' && (
          <div className="field-group min-w-0">
            <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Contact Email</span>
            <span className="field-value text-sm font-medium text-gray-900 break-words">
              <a href={`mailto:${linkedClientEmail}`} className="hover:underline text-indigo-600 font-semibold">{linkedClientEmail}</a>
            </span>
          </div>
        )}
        {linkedClientContact && linkedClientContact !== '—' && (
          <div className="field-group min-w-0">
            <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Contact Person / Phone</span>
            <span className="field-value text-sm font-medium text-gray-900 break-words">{linkedClientContact}</span>
          </div>
        )}
      </div>

      {isInternalWork && (
        <div className="mt-3 text-xs text-gray-500 italic">
          Internal work docket context.
        </div>
      )}
    </section>

    {/* Context & Description Panel */}
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
        {hasDescription ? (
          <span className="field-value case-detail__description-text whitespace-pre-wrap break-words text-sm font-medium text-gray-900">{descriptionContent}</span>
        ) : (
          <span className="field-value case-detail__description-text text-sm font-medium text-gray-400 italic">No description provided for this docket.</span>
        )}
      </div>
    </section>

    {/* Compact Recent Dockets Card */}
    {!isInternalWork && (
      <section className="case-card docket-recent-dockets mt-5" aria-labelledby="recent-dockets-heading">
        <div className="case-card__heading docket-section-heading flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="docket-section-kicker">Client Activity</p>
            <h2 id="recent-dockets-heading">Recent dockets</h2>
          </div>
          {linkedClientId && (
            <button
              type="button"
              onClick={() => navigate('?tab=history')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              View all in History
            </button>
          )}
        </div>

        <div className="mt-4">
          {loadingClientDockets ? (
            <p className="text-sm text-gray-500 italic">Loading client dockets...</p>
          ) : clientDockets && clientDockets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-900 border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 font-semibold text-xs uppercase tracking-wider text-gray-500">Docket ID</th>
                    <th className="py-2 font-semibold text-xs uppercase tracking-wider text-gray-500">Category</th>
                    <th className="py-2 font-semibold text-xs uppercase tracking-wider text-gray-500">Status</th>
                    <th className="py-2 font-semibold text-xs uppercase tracking-wider text-gray-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clientDockets.slice(0, 3).map((docket) => (
                    <tr key={docket.caseId} className="hover:bg-gray-50/50">
                      <td className="py-2 font-semibold text-indigo-600">
                        <Link to={ROUTES.CASE_DETAIL(firmSlug, docket.caseId)} className="hover:underline">
                          {formatDocketId(docket.caseId)}
                        </Link>
                      </td>
                      <td className="py-2 text-gray-600">
                        {docket.category} {docket.subcategory ? `• ${docket.subcategory}` : ''}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-md bg-gray-100 text-gray-800`}>
                          {docket.lifecycle || docket.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          to={ROUTES.CASE_DETAIL(firmSlug, docket.caseId)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No related dockets.</p>
          )}
        </div>
      </section>
    )}
  </>
  );
};
