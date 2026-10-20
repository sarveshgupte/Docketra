import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { formatDateTime } from '../../utils/formatDateTime';
import { ROUTES } from '../../constants/routes';
import { formatDocketId } from '../../utils/formatters';

export const CaseDetailOverviewPanel = ({
  caseInfo,
  firmSlug,
  linkedClientEmail,
  linkedClientContact,
  linkedClientId,
  isInternalWork = false,
  loadingClientDockets = false,
  clientDockets = [],
  navigate,
  descriptionContent,
  lifecycleStatus,
  isQcContext = false,
  isUnassignedWorkbasket = false,
  isTerminal = false,
  openSidebar,
  runGuardedAction,
  setCloneModalOpen,
  canCloneDocket,
  locationBadges,
}) => {
  const hasDescription = Boolean(String(descriptionContent || '').trim());
  const hasContactInfo = (linkedClientEmail && linkedClientEmail !== '—') || (linkedClientContact && linkedClientContact !== '—');

  return (
    <section className={`case-card docket-description-panel ${lifecycleStatus === 'IN_PROGRESS' ? 'opacity-90' : ''}`} id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <div className="case-card__heading docket-section-heading flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="docket-section-kicker">Context</p>
          <h2 id="overview-heading">Description</h2>
          
          {/* Location & QC Badges */}
          {((locationBadges && locationBadges.length > 0) || caseInfo?.qc?.status || caseInfo?.qcStatus || caseInfo?.lockStatus?.isLocked) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
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
          )}
        </div>

        {/* Action Icon Cluster */}
        <div className="docket-icon-cluster" aria-label="Docket actions">
          <button
            type="button"
            onClick={() => runGuardedAction(() => openSidebar('cfs'), 'Unable to open CFS panel right now.')}
            title="Open Client Fact Sheet"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm hover:bg-gray-100 text-gray-600 hover:text-indigo-600 transition-all border border-gray-200 cursor-pointer bg-white shadow-xs"
            aria-label="Open client fact sheet"
          >
            ⓘ
          </button>
          {canCloneDocket ? (
            <button
              type="button"
              onClick={() => runGuardedAction(() => setCloneModalOpen(true), 'Unable to open clone docket right now.')}
              title="Clone Docket"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-sm hover:bg-gray-100 text-gray-600 hover:text-indigo-600 transition-all border border-gray-200 cursor-pointer bg-white shadow-xs"
              aria-label="Clone docket"
            >
              ⧉
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => runGuardedAction(() => openSidebar('attachments'), 'Unable to open Attachments panel right now.')}
            title="Docket Attachments"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm hover:bg-gray-100 text-gray-600 hover:text-indigo-600 transition-all border border-gray-200 cursor-pointer bg-white shadow-xs"
            aria-label="Open attachments panel"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.373L8.552 18.32a1.5 1.5 0 01-2.121-2.121l9.873-9.874" /></svg>
          </button>
          <button
            type="button"
            onClick={() => runGuardedAction(() => openSidebar('history'), 'Unable to open Audit History panel right now.')}
            title="Audit History"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm hover:bg-gray-100 text-gray-600 hover:text-indigo-600 transition-all border border-gray-200 cursor-pointer bg-white shadow-xs"
            aria-label="Open audit history"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
        </div>
      </div>

      {/* Guidance Banners */}
      {(isUnassignedWorkbasket || isQcContext || isTerminal) && (
        <div className="docket-guidance-banners mt-3 flex flex-col gap-2">
          {isUnassignedWorkbasket && (
            <div className="docket-guidance-banner docket-guidance-banner--warning text-xs p-2 rounded bg-amber-50 text-amber-800 border border-amber-200">
              This docket is currently unassigned in a workbasket. Pull/Assign it from Workbasket flow before personal worklist actions.
            </div>
          )}
          {isQcContext && (
            <div className="docket-guidance-banner docket-guidance-banner--info text-xs p-2 rounded bg-blue-50 text-blue-800 border border-blue-200">
              QC context active. Use QC workbasket actions where appropriate.
            </div>
          )}
          {isTerminal && (
            <div className="docket-guidance-banner docket-guidance-banner--neutral text-xs p-2 rounded bg-gray-50 text-gray-600 border border-gray-200">
              Record view only; active queue actions are hidden.
            </div>
          )}
        </div>
      )}

      {lifecycleStatus === 'IN_PROGRESS' && (caseInfo?.pendingUntil || caseInfo?.reopenDate) ? (
        <Badge variant="warning" className="mt-3 inline-flex">
          In progress until {formatDateTime(caseInfo.pendingUntil || caseInfo.reopenDate)}
        </Badge>
      ) : null}

      {/* Description Content */}
      <div className="mt-3">
        {hasDescription ? (
          <span className="field-value case-detail__description-text whitespace-pre-wrap break-words text-sm font-medium text-gray-900 leading-relaxed">{descriptionContent}</span>
        ) : (
          <span className="field-value case-detail__description-text text-sm font-medium text-gray-400 italic">No description provided for this docket.</span>
        )}
      </div>

      {/* Client Contact Details (Only shown if contact info exists) */}
      {hasContactInfo && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-600">
          {linkedClientEmail && linkedClientEmail !== '—' && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Email:</span>
              <a href={`mailto:${linkedClientEmail}`} className="font-semibold text-indigo-600 hover:underline">{linkedClientEmail}</a>
            </div>
          )}
          {linkedClientContact && linkedClientContact !== '—' && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Contact:</span>
              <span className="font-medium text-gray-800">{linkedClientContact}</span>
            </div>
          )}
        </div>
      )}

      {/* Compact Recent Dockets Card */}
      {!isInternalWork && (
        <div className="mt-5 pt-4 border-t border-gray-100" aria-labelledby="recent-dockets-heading">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <p className="docket-section-kicker">Client Activity</p>
              <h3 id="recent-dockets-heading" className="text-sm font-semibold text-gray-900">Recent dockets</h3>
            </div>
            {linkedClientId && navigate && (
              <button
                type="button"
                onClick={() => navigate('?tab=history')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                View all in History
              </button>
            )}
          </div>

          <div>
            {loadingClientDockets ? (
              <p className="text-xs text-gray-500 italic">Loading client dockets...</p>
            ) : clientDockets && clientDockets.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-900 border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 font-semibold uppercase tracking-wider text-gray-500 text-[10px]">Docket ID</th>
                      <th className="py-2 font-semibold uppercase tracking-wider text-gray-500 text-[10px]">Category</th>
                      <th className="py-2 font-semibold uppercase tracking-wider text-gray-500 text-[10px]">Status</th>
                      <th className="py-2 font-semibold uppercase tracking-wider text-gray-500 text-[10px] text-right">Action</th>
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
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-800">
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
              <p className="text-xs text-gray-500 italic">No related dockets.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
