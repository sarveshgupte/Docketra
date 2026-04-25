import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LifecycleBadge } from '../../../components/LifecycleBadge';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatDocketId } from '../../utils/formatters';
import { ROUTES } from '../../constants/routes';
import { getLifecycleMeta } from '../../../utils/lifecycleMap';

export const CaseDetailOverviewPanel = ({
  caseInfo,
  firmSlug,
  linkedClientRoute,
  isInternalWork,
  clientName,
  clientIdLabel,
  categoryLabel,
  subcategoryLabel,
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
  canRouteDocket,
  onOpenRouteModal,
  forceQcReview,
  onForceQcReviewChange,
}) => (
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
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Category</span>
          <span className="field-value text-sm font-medium text-gray-900">{categoryLabel}</span>
        </div>
        <div className="field-group min-w-0">
          <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Subcategory</span>
          <span className="field-value text-sm font-medium text-gray-900">{subcategoryLabel}</span>
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
        <div className="field-group min-w-0"><span className="field-label">Business Email</span><span className="field-value break-words">{linkedClientEmail}</span></div>
        <div className="field-group min-w-0"><span className="field-label">Primary Contact</span><span className="field-value">{linkedClientContact}</span></div>
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
        loadingClientDockets ? <p className="case-detail__empty-note mt-4">Loading related client dockets…</p> : (
          clientDockets.length ? (
            <div className="case-detail-table-wrap mt-4">
              <table className="case-detail-table">
                <thead>
                  <tr>
                    <th>Docket</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {clientDockets.slice(0, 5).map((row) => {
                    const rowId = row.caseId || row.docketId || row._id;
                    return (
                      <tr key={rowId}>
                        <td>
                          <button type="button" className="case-detail-table__link" onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, rowId), { state: { returnTo: linkedClientRoute || returnTo, fromClientRoute: linkedClientRoute || fromClientRoute } })}>
                            {formatDocketId(rowId)}
                          </button>
                        </td>
                        <td>{row.title || row.caseName || 'Untitled docket'}</td>
                        <td>{row.lifecycle || row.status || '—'}</td>
                        <td>{formatDateTime(row.updatedAt || row.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="case-detail__empty-note mt-4">No related dockets found for this client.</p>
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
      <div className="field-group mt-4">
        <span className="field-label text-xs font-semibold uppercase tracking-wider text-gray-500">Description</span>
        <span className="field-value case-detail__description-text whitespace-pre-wrap break-words text-sm font-medium text-gray-900">{descriptionContent}</span>
      </div>
      {shouldShowActions ? (
        <section className="case-detail__actions-panel mt-4 border-t pt-4" aria-label="Docket actions">
          <div className="case-detail__composer-actions case-detail__lifecycle-actions mt-3">
            {canPerformLifecycleActions ? lifecycleQuickActions.map((action) => (
              <Button
                key={action.key}
                variant={action.variant}
                onClick={action.onClick}
                disabled={actionInFlight}
              >
                {action.label}
              </Button>
            )) : null}
            {!isViewOnlyMode ? (
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
    </section>
  </>
);

