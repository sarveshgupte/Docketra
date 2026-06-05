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
}) => {
  const sortedSopLinks = getSortedSopLinks(caseInfo?.sop);
  const sortedChecklist = normalizeChecklist(caseInfo?.checklist);

  return (
  <>
    <section className="case-card" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <div className="case-card__heading">
        <h2 id="snapshot-heading">Overview</h2>
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
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">SLA (days)</span>
          <span className="field-value text-sm font-medium text-gray-900">{slaDaysLabel}</span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Lifecycle</span>
          {getLifecycleMeta(caseInfo?.lifecycle) ? <LifecycleBadge lifecycle={caseInfo?.lifecycle} /> : <span className="field-value text-sm font-medium text-gray-900">—</span>}
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Due / SLA</span>
          <span className="field-value text-sm font-medium text-gray-900">{dueDateLabel ? formatDateTime(dueDateLabel) : `SLA ${slaDaysLabel} day(s)`}</span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Work Type</span>
          <Badge variant={caseInfo?.isInternal ? 'info' : 'success'}>{caseInfo?.isInternal ? 'Internal Work' : 'Client Work'}</Badge>
        </div>
      </div>
    </section>
    <section className="case-card" aria-labelledby="client-context-heading">
      <div className="case-card__heading">
        <h2 id="client-context-heading">Client Context</h2>
      </div>
      <div className="field-grid">
        <div className="field-group min-w-0"><span className="field-label">Client ID</span><span className="field-value">{clientIdLabel}</span></div>
        <div className="field-group min-w-0"><span className="field-label">Context</span><span className="field-value">{isInternalWork ? 'Internal work' : 'Client work'}</span></div>
      </div>
      <div className="case-detail__composer-actions mt-4">
        {linkedClientRoute && !isInternalWork ? (
          <Button variant="outline" onClick={() => navigate(linkedClientRoute)}>Open Client Workspace</Button>
        ) : null}
        {linkedClientId && !isInternalWork ? (
          <Button variant="secondary" onClick={() => navigate(`${ROUTES.CREATE_CASE(firmSlug)}?clientId=${encodeURIComponent(linkedClientId)}`)}>Create Docket for Client</Button>
        ) : null}
        {fromClientRoute ? (
          <Button variant="ghost" onClick={() => navigate(fromClientRoute)}>Back to Client</Button>
        ) : null}
      </div>
      {!isInternalWork ? (
        loadingClientDockets ? <p className="case-detail__empty-note mt-4">Loading recent dockets…</p> : (
          clientDockets.length ? (
            <section className="mt-4 rounded-lg border border-gray-200 bg-white p-3" aria-label="Recent dockets">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Recent dockets</h3>
                <Button variant="ghost" onClick={() => navigate(`${ROUTES.CASE_DETAIL(firmSlug, caseInfo?.caseId || caseInfo?._id || '')}?tab=history`, { state: { returnTo, fromClientRoute } })}>
                  View all in History
                </Button>
              </div>
              <table className="case-detail-table">
                <thead>
                  <tr>
                    <th>Docket</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {clientDockets.slice(0, 3).map((row) => {
                    const rowId = row.caseId || row.docketId || row._id;
                    return (
                      <tr key={rowId}>
                        <td>
                          <button type="button" className="case-detail-table__link" onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, rowId), { state: { returnTo: linkedClientRoute || returnTo, fromClientRoute: linkedClientRoute || fromClientRoute } })}>
                            {formatDocketId(rowId)}
                          </button>
                        </td>
                        <td>{row.lifecycle || row.status || '—'}</td>
                        <td>{formatDateTime(row.updatedAt || row.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ) : <p className="case-detail__empty-note mt-4">No related dockets found yet. Use Create Docket for Client to start this client’s history.</p>
        )
      ) : <p className="case-detail__empty-note mt-4">This docket is marked internal and uses your firm default client context.</p>}
    </section>

    <section className={`case-card ${lifecycleStatus === 'IN_PROGRESS' ? 'opacity-90' : ''}`} aria-labelledby="overview-heading">
      <div className="case-card__heading">
        <h2 id="overview-heading">Details</h2>
      </div>
      {lifecycleStatus === 'IN_PROGRESS' && (caseInfo?.pendingUntil || caseInfo?.reopenDate) ? (
        <Badge variant="warning" className="mt-3 inline-flex">
          In progress until {formatDateTime(caseInfo.pendingUntil || caseInfo.reopenDate)}
        </Badge>
      ) : null}
      {shouldShowActions ? (
        <section className="case-detail__actions-panel mt-4 border-t pt-4" aria-label="Docket actions">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Primary</div>
          <div className="case-detail__composer-actions case-detail__lifecycle-actions mt-2">
            {canPerformLifecycleActions ? lifecycleQuickActions.filter((action) => ['resolve', 'submit'].includes(action.key)).map((action) => (
              <Button
                key={action.key}
                variant={action.variant}
                onClick={action.onClick}
                disabled={actionInFlight}
              >
                {action.label}
              </Button>
            )) : null}
          </div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Secondary</div>
          <div className="case-detail__composer-actions case-detail__lifecycle-actions mt-2">
            {canPerformLifecycleActions ? lifecycleQuickActions.filter((action) => action.key === 'pend').map((action) => (
              <Button key={action.key} variant={action.variant} onClick={action.onClick} disabled={actionInFlight}>{action.label}</Button>
            )) : null}
            {!isViewOnlyMode && showFileAction ? (
              <Button variant="secondary" onClick={onOpenFileModal} disabled={actionInFlight}>
                File
              </Button>
            ) : null}
            {canRouteDocket ? (
              <Button variant="outline" onClick={onOpenRouteModal} disabled={actionInFlight}>
                Route
              </Button>
            ) : null}
          </div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Admin / advanced</div>
          <div className="case-detail__composer-actions case-detail__lifecycle-actions mt-2">
            {canPerformLifecycleActions ? lifecycleQuickActions.filter((action) => ['assign', 'move'].includes(action.key)).map((action) => (
              <Button key={action.key} variant={action.variant} onClick={action.onClick} disabled={actionInFlight}>{action.label}</Button>
            )) : null}
          </div>
          {isUnassignedWorkbasket ? (
            <p className="mt-3 text-sm text-gray-600">This docket is currently unassigned in a workbasket. Pull/Assign it from Workbasket flow before personal worklist actions.</p>
          ) : null}
          {isQcContext ? (
            <p className="mt-3 text-sm text-gray-600">QC context active. Use QC workbasket actions where appropriate.</p>
          ) : null}
          {canPerformLifecycleActions ? (
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={forceQcReview}
                onChange={(e) => onForceQcReviewChange(e.target.checked)}
              />
              Force QC Review
            </label>
          ) : null}
        </section>
      ) : null}
      {isTerminal ? (
        <p className="mt-3 text-sm text-gray-600">This docket is in a terminal state. Record view only; active queue actions are hidden.</p>
      ) : null}
      <div className="field-group mt-4">
        <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Description</span>
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
