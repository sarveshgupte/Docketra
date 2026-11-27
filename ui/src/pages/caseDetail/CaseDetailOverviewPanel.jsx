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
}) => {
  const hasDescription = Boolean(String(descriptionContent || '').trim());
  const hasContactInfo = (linkedClientEmail && linkedClientEmail !== '—') || (linkedClientContact && linkedClientContact !== '—');
  const recentDockets = (clientDockets || []).slice(0, 3);

  return (
    <section
      className="case-card docket-description-panel"
      id="panel-overview"
      role="tabpanel"
      aria-labelledby="tab-overview"
    >
      <div className="case-card__heading docket-section-heading">
        <div>
          <p className="docket-section-kicker">Context</p>
          <h2 id="overview-heading">Description</h2>
        </div>

        {/* Action surface container preserved for architecture contract */}
        <div className="docket-actions-surface hidden" aria-label="Docket actions" aria-hidden="true" />
      </div>

      {(isUnassignedWorkbasket || isQcContext || isTerminal) ? (
        <div className="docket-guidance-banners mb-3 flex flex-col gap-2">
          {isUnassignedWorkbasket ? (
            <div className="docket-guidance-banner docket-guidance-banner--warning">
              This docket is currently unassigned in a workbasket. Pull/Assign it from Workbasket flow before personal worklist actions.
            </div>
          ) : null}
          {isQcContext ? (
            <div className="docket-guidance-banner docket-guidance-banner--info">
              QC context active. Use QC workbasket actions where appropriate.
            </div>
          ) : null}
          {isTerminal ? (
            <div className="docket-guidance-banner docket-guidance-banner--neutral">
              Record view only; active queue actions are hidden.
            </div>
          ) : null}
        </div>
      ) : null}

      {lifecycleStatus === 'IN_PROGRESS' && (caseInfo?.pendingUntil || caseInfo?.reopenDate) ? (
        <Badge variant="warning" className="mb-3 inline-flex">
          Pending until {formatDateTime(caseInfo.pendingUntil || caseInfo.reopenDate)}
        </Badge>
      ) : null}

      <div>
        {hasDescription ? (
          <p className="case-detail__description-text whitespace-pre-wrap break-words text-[13px] font-normal leading-relaxed text-slate-800">
            {descriptionContent}
          </p>
        ) : (
          <p className="case-detail__description-text text-[13px] italic text-slate-500">
            No description provided for this docket.
          </p>
        )}
      </div>

      {hasContactInfo ? (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
          {linkedClientEmail && linkedClientEmail !== '—' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Email:</span>
              <a href={`mailto:${linkedClientEmail}`} className="font-semibold text-blue-700 hover:underline">
                {linkedClientEmail}
              </a>
            </div>
          ) : null}
          {linkedClientContact && linkedClientContact !== '—' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Contact:</span>
              <span className="font-medium text-slate-800">{linkedClientContact}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isInternalWork ? (
        <div className="mt-5 border-t border-slate-100 pt-4" aria-labelledby="recent-dockets-heading">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="docket-section-kicker">Client Activity</p>
              <h3 id="recent-dockets-heading" className="text-xs font-semibold text-slate-900">Recent dockets</h3>
            </div>
            {linkedClientId && navigate ? (
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
                  params.set('tab', 'history');
                  navigate(`?${params.toString()}`, { replace: true });
                }}
                className="rounded text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                View all in History
              </button>
            ) : null}
          </div>

          {loadingClientDockets ? (
            <p className="text-xs text-slate-500">Loading recent client dockets…</p>
          ) : recentDockets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-slate-900">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-1.5 pr-3">Docket ID</th>
                    <th className="py-1.5 pr-3">Category</th>
                    <th className="py-1.5 pr-3">Status</th>
                    <th className="py-1.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentDockets.map((docket) => (
                    <tr key={docket.caseId} className="hover:bg-slate-50/70">
                      <td className="py-2 pr-3 font-mono font-semibold text-slate-900">
                        <Link to={ROUTES.CASE_DETAIL(firmSlug, docket.caseId)} className="text-blue-700 hover:underline">
                          {formatDocketId(docket.caseId)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {docket.category || 'General'}{docket.subcategory ? ` / ${docket.subcategory}` : ''}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="neutral">{docket.lifecycle || docket.status || 'Active'}</Badge>
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          to={ROUTES.CASE_DETAIL(firmSlug, docket.caseId)}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
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
            <p className="text-xs text-slate-500">No previous dockets recorded for this client.</p>
          )}
        </div>
      ) : null}
    </section>
  );
};
