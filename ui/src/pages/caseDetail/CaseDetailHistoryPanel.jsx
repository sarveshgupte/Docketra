import { Button } from '../../components/common/Button';
import { LifecycleBadge } from '../../../components/LifecycleBadge';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatDocketId } from '../../utils/formatters';
import { ROUTES } from '../../constants/routes';
import { getLifecycleMeta } from '../../../utils/lifecycleMap';

export const CaseDetailHistoryPanel = ({
  sortedTimelineEvents,
  loadingClientDockets,
  clientDockets,
  firmSlug,
  linkedClientRoute,
  returnTo,
  fromClientRoute,
  navigate,
}) => (
  <>
    <section className="case-card" id="panel-history" role="tabpanel" aria-labelledby="tab-history">
      <div className="case-card__heading">
        <h2>Change History</h2>
      </div>
      <p className="mb-3 text-xs text-gray-500">Audit-style change record using available timeline/audit data.</p>
      {!sortedTimelineEvents.length ? <p className="case-detail__empty-note">No audit history available yet.</p> : null}
      {sortedTimelineEvents.length ? (
        <ul className="space-y-3">
          {sortedTimelineEvents.map((event, index) => {
            const changeSet = event?.changes || event?.diff || event?.fieldsChanged || null;
            const actor = event?.performedByName || event?.performedByXID || event?.performedBy || event?.actorXID || 'System';
            return (
              <li key={`${event._id || event.id || index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-sm font-medium text-gray-900">{event?.actionLabel || event?.description || event?.actionType || event?.action || 'Updated'}</div>
                <div className="mt-1 text-xs text-gray-500">{actor} • {formatDateTime(event?.timestamp || event?.createdAt || event?.updatedAt)}</div>
                {Array.isArray(changeSet) && changeSet.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-600">
                    {changeSet.map((change, changeIndex) => (
                      <li key={`${index}-change-${changeIndex}`}>
                        {change?.field || change?.key || 'Field'}: {String(change?.from ?? change?.before ?? '—')} → {String(change?.to ?? change?.after ?? '—')}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
    <section className="case-card" aria-labelledby="past-dockets-heading">
      <div className="case-card__heading">
        <h2 id="past-dockets-heading">Client Docket History</h2>
      </div>
      {loadingClientDockets ? (
        <p className="case-detail__empty-note">Loading history…</p>
      ) : clientDockets.length === 0 ? (
        <p className="case-detail__empty-note">No history found for this client.</p>
      ) : (
        <div className="case-detail-table-wrap">
          <table className="case-detail-table">
            <thead>
              <tr>
                <th>Docket #</th>
                <th>Created</th>
                <th>Resolved/Filed</th>
                <th>Lifecycle</th>
              </tr>
            </thead>
            <tbody>
              {clientDockets.map((row) => {
                const rowId = row.caseId || row.docketId || row._id;
                const closedDate = row.resolvedAt || row.filedAt || row.closedAt || row.completedAt;
                return (
                  <tr key={rowId}>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        className="case-detail-table__link"
                        onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, rowId), { state: { returnTo: linkedClientRoute || returnTo, fromClientRoute: linkedClientRoute || fromClientRoute } })}
                      >
                        {formatDocketId(rowId)}
                      </Button>
                    </td>
                    <td>{row.createdAt ? formatDateTime(row.createdAt) : '—'}</td>
                    <td>{closedDate ? formatDateTime(closedDate) : '—'}</td>
                    <td>{getLifecycleMeta(row.lifecycle) ? <LifecycleBadge lifecycle={row.lifecycle} /> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  </>
);
