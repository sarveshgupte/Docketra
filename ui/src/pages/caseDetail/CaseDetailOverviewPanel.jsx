import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LifecycleBadge } from '../../../components/LifecycleBadge';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatDocketId } from '../../utils/formatters';
import { ROUTES } from '../../constants/routes';
import { getLifecycleMeta } from '../../../utils/lifecycleMap';

const hasSopContent = (sop) => Boolean(sop?.title && sop?.body);
const getSortedSopLinks = (sop) => (Array.isArray(sop?.links) ? [...sop.links].sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0)) : []);

const normalizeChecklist = (checklist) => (
  Array.isArray(checklist)
    ? [...checklist].sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0))
    : []
);
const formatApprovalLabel = (value) => String(value || '').split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');


export const CaseDetailOverviewPanel = ({
  caseInfo,
  firmSlug,
  linkedClientRoute,
  isInternalWork,
  clientName,
  clientIdLabel,
  slaDaysLabel,
  dueDateLabel,
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
}) => {
  const sortedSopLinks = getSortedSopLinks(caseInfo?.sop);
  const sortedChecklist = normalizeChecklist(caseInfo?.checklist);

  return (
  <>
    <section className="case-card" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <div className="case-card__heading flex items-center justify-between flex-wrap gap-4 border-b border-gray-100 pb-4 mb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 id="snapshot-heading" className="text-lg font-bold text-gray-900 m-0">Overview</h2>
          
          {/* Location and Status Badges */}
          {locationBadges && locationBadges.map((badge) => (
            <Badge key={badge} variant="secondary">{badge}</Badge>
          ))}
          {(caseInfo?.qc?.status || caseInfo?.qcStatus) ? (
            <Badge variant={String(caseInfo?.qc?.status || caseInfo?.qcStatus).toUpperCase() === 'FAILED' ? 'danger' : 'info'}>
              QC: {caseInfo?.qc?.status || caseInfo?.qcStatus}
            </Badge>
          ) : null}
          {caseInfo?.approvalStatus === 'PENDING' && <Badge variant="warning">Awaiting Internal Approval</Badge>}
          {caseInfo?.lockStatus?.isLocked && <Badge variant="warning">Lifecycle Locked</Badge>}

          {/* SLA Badge */}
          {slaBadgeLabel && (
            <span className={`status-badge status-badge--${slaBadgeClass}`}>
              {slaBadgeLabel}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 bg-gray-100/60 p-1 rounded-xl border border-gray-200/40" aria-label="Docket actions">
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
      <div className="field-grid">
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
          <span className="field-value text-sm font-medium text-gray-900">{slaDaysLabel}</span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Due / SLA</span>
          <span className="field-value text-sm font-medium text-gray-900">{dueDateLabel ? formatDateTime(dueDateLabel) : `SLA ${slaDaysLabel} day(s)`}</span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Lifecycle</span>
          {getLifecycleMeta(caseInfo?.lifecycle) ? <LifecycleBadge lifecycle={caseInfo?.lifecycle} /> : <span className="field-value text-sm font-medium text-gray-900">—</span>}
        </div>
      </div>
    </section>


    <section className={`case-card ${lifecycleStatus === 'IN_PROGRESS' ? 'opacity-90' : ''}`} aria-labelledby="overview-heading">
      <div className="case-card__heading">
        <h2 id="overview-heading">Description</h2>
      </div>
      {lifecycleStatus === 'IN_PROGRESS' && (caseInfo?.pendingUntil || caseInfo?.reopenDate) ? (
        <Badge variant="warning" className="mt-3 inline-flex">
          In progress until {formatDateTime(caseInfo.pendingUntil || caseInfo.reopenDate)}
        </Badge>
      ) : null}
      <div className="mt-4">
        <span className="field-value case-detail__description-text whitespace-pre-wrap break-words text-sm font-medium text-gray-900">{descriptionContent || 'No description provided for this docket.'}</span>
      </div>
    </section>

    <section className="case-card" aria-labelledby="sop-heading">
      <div className="case-card__heading">
        <h2 id="sop-heading">SOP / Work Instructions</h2>
      </div>
      {hasSopContent(caseInfo?.sop) ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">{caseInfo.sop.title}</p>
          <p className="text-xs uppercase tracking-wider text-gray-500">Format: {caseInfo.sop.format || 'plain_text'}</p>
          {caseInfo.sop.capturedAt ? <p className="text-xs text-gray-500">Captured: {formatDateTime(caseInfo.sop.capturedAt)}</p> : null}
          <div className="case-detail__description-text whitespace-pre-wrap break-words text-sm text-gray-800">{caseInfo.sop.body}</div>
          {sortedSopLinks.length ? (
            <ul className="space-y-2 pt-2">
              {sortedSopLinks.map((link, idx) => (
                <li key={link?.id || `${link?.title || 'sop-link'}-${idx}`} className="rounded-md border border-gray-200 bg-white p-3">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 underline break-all">{link.title}</a>
                  {link?.type ? <p className="text-xs uppercase tracking-wider text-gray-500">{link.type}</p> : null}
                  {link?.description ? <p className="text-sm text-gray-700">{link.description}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : <p className="case-detail__empty-note">No SOP attached to this docket.</p>}
    </section>

    <section className="case-card" aria-labelledby="checklist-heading">
      <div className="case-card__heading">
        <h2 id="checklist-heading">Checklist</h2>
      </div>
      {sortedChecklist.length ? (
        <ul className="space-y-2">
          {sortedChecklist.map((item, idx) => (
            <li key={item?.id || `${item?.title || 'item'}-${idx}`} className="rounded-md border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{item?.title || 'Untitled item'}</span>
                {item?.required ? <Badge variant="warning">Required</Badge> : <Badge variant="default">Optional</Badge>}
                <Badge variant={item?.completed ? 'success' : 'neutral'}>{item?.completed ? 'Completed' : 'Incomplete'}</Badge>
                <Badge variant={item?.status === 'accepted' ? 'success' : item?.status === 'rejected' ? 'danger' : item?.status === 'submitted' ? 'info' : 'neutral'}>
                  {item?.status || 'requested'}
                </Badge>
                {item?.dueDate ? <span className="text-xs text-gray-500">Due {formatDateTime(item.dueDate)}</span> : null}
              </div>
              {item?.reviewerNotes ? <p className="mt-2 text-xs text-gray-600">Reviewer note: {item.reviewerNotes}</p> : null}
            </li>
          ))}
        </ul>
      ) : <p className="case-detail__empty-note">No checklist attached to this docket.</p>}
    </section>

    <section className="case-card" aria-labelledby="approval-stage-heading">
      <div className="case-card__heading">
        <h2 id="approval-stage-heading">Approval Stage</h2>
      </div>
      {caseInfo?.approvalStage ? (
        <div className="space-y-2 text-sm text-gray-800">
          <div className="flex flex-wrap gap-2">
            <Badge variant={caseInfo.approvalStage.status === 'pending' ? 'warning' : caseInfo.approvalStage.status === 'approved' ? 'success' : 'neutral'}>
              {formatApprovalLabel(caseInfo.approvalStage.status)}
            </Badge>
            <Badge variant="default">{formatApprovalLabel(caseInfo.approvalStage.approvalType)}</Badge>
          </div>
          <p>Requested by: <strong>{caseInfo.approvalStage.requestedBy || '—'}</strong></p>
          <p>Approver: <strong>{caseInfo.approvalStage.approver || '—'}</strong></p>
          <p>Requested at: <strong>{formatDateTime(caseInfo.approvalStage.requestedAt)}</strong></p>
          <p>Due at: <strong>{formatDateTime(caseInfo.approvalStage.dueAt)}</strong></p>
          {caseInfo.approvalStage.comments ? <p>Comments: {caseInfo.approvalStage.comments}</p> : null}
          {caseInfo.approvalStage.evidenceAttachmentId ? <p>Evidence reference: {caseInfo.approvalStage.evidenceAttachmentId}</p> : null}
          {caseInfo.approvalStage.decisionComment ? <p>Decision note: {caseInfo.approvalStage.decisionComment}</p> : null}
        </div>
      ) : <p className="case-detail__empty-note">No active approval stage on this docket.</p>}
    </section>
  </>
  );
};
