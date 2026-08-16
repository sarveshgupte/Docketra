import { Badge } from '../../components/common/Badge';
import { formatDateTime } from '../../utils/formatDateTime';

export const CaseDetailOverviewPanel = ({
  caseInfo,
  linkedClientEmail,
  linkedClientContact,
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
            📎
          </button>
          <button
            type="button"
            onClick={() => runGuardedAction(() => openSidebar('history'), 'Unable to open Audit History panel right now.')}
            title="Audit History"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm hover:bg-gray-100 text-gray-600 hover:text-indigo-600 transition-all border border-gray-200 cursor-pointer bg-white shadow-xs"
            aria-label="Open audit history"
          >
            🕒
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

      {/* Client Contact Details Pill Bar (Only shown if contact info exists) */}
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
    </section>
  );
};
