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
        </div>

        {/* Action surface container preserved for architecture contract */}
        <div className="docket-actions-surface hidden" aria-label="Docket actions" aria-hidden="true" />
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
    </section>
  );
};
