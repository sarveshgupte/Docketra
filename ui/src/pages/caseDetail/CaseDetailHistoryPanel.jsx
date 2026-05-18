import { Button } from '../../components/common/Button';
import { LifecycleBadge } from '../../../components/LifecycleBadge';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatDocketId } from '../../utils/formatters';
import { ROUTES } from '../../constants/routes';
import { getLifecycleMeta } from '../../../utils/lifecycleMap';

const getNormalizedHistoryRow = (row) => {
  const docketId = row?.caseId || row?.docketId || row?._id || '';
  const category = row?.category || row?.caseCategory || row?.workType || row?.workTypeName || row?.categorySnapshot?.name;
  const subcategory = row?.subcategory || row?.subCategory || row?.caseSubCategory || row?.subCategoryName || row?.subcategoryName || row?.subCategorySnapshot?.name || row?.categorySnapshot?.subcategory;
  const lifecycle = row?.status || row?.lifecycle || row?.state;
  const closedDate = row?.resolvedAt || row?.filedAt || row?.closedAt || row?.completedAt;
  const assignee = row?.assignedToName || row?.assignedTo || row?.assignedToXID || row?.ownerName || row?.ownerXID;
  const workbasket = row?.workbasketName || row?.queueName || row?.ownerTeamName || row?.ownerTeamId || row?.workbasket;
  return {
    docketId,
    category,
    subcategory,
    lifecycle,
    createdAt: row?.createdAt,
    updatedAt: row?.updatedAt,
    closedDate,
    assignee,
    workbasket,
  };
};

export const CaseDetailHistoryPanel = ({
  sortedTimelineEvents,
  loadingClientDockets,
  clientDockets,
  clientDocketsError,
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
        <p className="case-detail__empty-note">Loading client docket history…</p>
      ) : clientDocketsError ? (
        <p className="case-detail__empty-note">Client docket history could not be loaded.</p>
      ) : clientDockets.length === 0 ? (
        <p className="case-detail__empty-note">No other dockets found for this client.</p>
      ) : (
        <div className="case-detail-table-wrap overflow-x-auto" role="region" aria-label="Client docket history table">
          <table className="case-detail-table" aria-label="Past dockets for this client">
            <thead>
              <tr>
                <th scope="col">Docket ID</th>
                <th scope="col">Category</th>
                <th scope="col">Subcategory</th>
                <th scope="col">Status / Lifecycle</th>
                <th scope="col">Created Date</th>
                <th scope="col">Updated Date</th>
                <th scope="col">Closed/Resolved/Filed Date</th>
                <th scope="col">Assigned To / Owner</th>
                <th scope="col">Workbasket / Queue</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {clientDockets.map((rawRow) => {
                const row = getNormalizedHistoryRow(rawRow);
                const lifecycleKnown = getLifecycleMeta(row.lifecycle);
                return (
                  <tr key={row.docketId || JSON.stringify(rawRow)}>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        className="case-detail-table__link"
                        aria-label={`Open docket ${formatDocketId(row.docketId)}`}
                        onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, row.docketId), { state: { returnTo: linkedClientRoute || returnTo, fromClientRoute: linkedClientRoute || fromClientRoute } })}
                      >
                        {formatDocketId(row.docketId)}
                      </Button>
                    </td>
                    <td>{row.category || '—'}</td>
                    <td>{row.subcategory || '—'}</td>
                    <td>{lifecycleKnown ? <LifecycleBadge lifecycle={row.lifecycle} /> : (row.lifecycle || '—')}</td>
                    <td>{row.createdAt ? formatDateTime(row.createdAt) : '—'}</td>
                    <td>{row.updatedAt ? formatDateTime(row.updatedAt) : '—'}</td>
                    <td>{row.closedDate ? formatDateTime(row.closedDate) : '—'}</td>
                    <td>{row.assignee || '—'}</td>
                    <td>{row.workbasket || '—'}</td>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        className="case-detail-table__link"
                        aria-label={`View docket ${formatDocketId(row.docketId)}`}
                        onClick={() => navigate(ROUTES.CASE_DETAIL(firmSlug, row.docketId), { state: { returnTo: linkedClientRoute || returnTo, fromClientRoute: linkedClientRoute || fromClientRoute } })}
                      >
                        View
                      </Button>
                    </td>
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
