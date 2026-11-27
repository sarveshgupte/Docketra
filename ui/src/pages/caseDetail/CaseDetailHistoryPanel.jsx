import React, { useState, useMemo } from 'react';
import { Button } from '../../components/common/Button';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatDocketId } from '../../utils/formatters';
import { ROUTES } from '../../constants/routes';
import { getBusinessLifecycleLabel, getBusinessLifecycleTone, getDocketAssignedToLabel } from './caseDetailUtils';

const getNormalizedHistoryRow = (row) => {
  const docketId = row?.caseId || row?.caseNumber || row?.docketId || row?._id || '';
  const caseName = row?.caseName || row?.title || null;
  const category = row?.category || row?.caseCategory || row?.workType || row?.workTypeName || row?.categorySnapshot?.name;
  const subcategory = row?.subcategory || row?.subCategory || row?.caseSubCategory || row?.subCategoryName || row?.subcategoryName || row?.subCategorySnapshot?.name || row?.categorySnapshot?.subcategory;
  const lifecycle = getBusinessLifecycleLabel(row);
  const status = String(row?.status || 'OPEN').toUpperCase();
  const closedDate = row?.resolvedAt || row?.filedAt || row?.closedAt || row?.completedAt;
  const assignee = getDocketAssignedToLabel(row);
  const workbasket = row?.workbasketName || row?.queueName || row?.ownerTeamName || row?.ownerTeamId || row?.workbasket;
  return {
    docketId,
    caseName,
    category,
    subcategory,
    lifecycle,
    status,
    createdAt: row?.createdAt,
    updatedAt: row?.updatedAt,
    closedDate,
    assignee,
    workbasket,
  };
};

const matchesStatusFilter = (row, filterKey) => {
  if (filterKey === 'ALL') return true;
  const lc = String(row.lifecycle || '').toUpperCase();
  const st = String(row.status || '').toUpperCase();
  if (filterKey === 'DONE') return lc === 'DONE' || st === 'FILED' || st === 'RESOLVED' || st === 'CLOSED';
  if (filterKey === 'ACTIVE') return lc === 'ACTIVE' || st === 'ASSIGNED' || st === 'IN_PROGRESS' || st === 'ROUTED';
  if (filterKey === 'WAITING') return lc === 'WAITING' || st === 'PENDING' || st === 'PEND' || st === 'QC_WB' || st === 'QC_ASSIGNED';
  if (filterKey === 'QUEUE') return lc === 'WL' || st === 'OPEN' || st === 'AVAILABLE' || st === 'IN_WB';
  return true;
};

export const CaseDetailHistoryPanel = ({
  loadingClientDockets,
  clientDockets = [],
  clientDocketsError,
  firmSlug,
  linkedClientRoute,
  returnTo,
  fromClientRoute,
  navigate,
  caseInfo,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const clientName = caseInfo?.client?.businessName
    || caseInfo?.client?.name
    || caseInfo?.clientName
    || caseInfo?.clientSnapshot?.businessName
    || 'Client';

  const normalizedRows = useMemo(
    () => (clientDockets || []).map(getNormalizedHistoryRow),
    [clientDockets],
  );

  const counts = useMemo(() => {
    const result = { total: normalizedRows.length, done: 0, active: 0, waiting: 0, queue: 0 };
    normalizedRows.forEach((row) => {
      if (matchesStatusFilter(row, 'DONE')) result.done += 1;
      else if (matchesStatusFilter(row, 'ACTIVE')) result.active += 1;
      else if (matchesStatusFilter(row, 'WAITING')) result.waiting += 1;
      else result.queue += 1;
    });
    return result;
  }, [normalizedRows]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return normalizedRows.filter((row) => {
      if (!matchesStatusFilter(row, statusFilter)) return false;
      if (!term) return true;
      return [row.docketId, row.caseName, row.category, row.subcategory, row.assignee]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [normalizedRows, statusFilter, searchTerm]);

  const filterChips = [
    { id: 'ALL', label: `All (${counts.total})` },
    { id: 'DONE', label: `Done / Filed (${counts.done})` },
    { id: 'ACTIVE', label: `Active (${counts.active})` },
    { id: 'WAITING', label: `Waiting (${counts.waiting})` },
    { id: 'QUEUE', label: `Queue (${counts.queue})` },
  ];

  return (
    <section
      className="case-card rounded-[var(--dt-radius-card,6px)] border border-slate-200 bg-white p-5"
      id="panel-history"
      role="tabpanel"
      aria-labelledby="tab-history"
    >
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
        <div>
          <p className="docket-section-kicker">Client Archive</p>
          <div className="flex items-center gap-2">
            <h2 id="past-dockets-heading" className="text-sm font-bold text-slate-900">
              Change History
            </h2>
            <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700">
              {counts.total} {counts.total === 1 ? 'Matter' : 'Matters'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Prior compliance matters and filings recorded for <strong className="text-slate-700">{clientName}</strong>.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 pt-3.5 pb-2 md:flex-row md:items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0" role="group" aria-label="Filter client dockets by status">
          {filterChips.map((chip) => {
            const isSelected = statusFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setStatusFilter(chip.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[220px]">
          <label htmlFor="client-history-search" className="sr-only">
            Search past dockets
          </label>
          <input
            id="client-history-search"
            type="text"
            aria-label="Search past dockets"
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            placeholder="Search past dockets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1.5 px-1 text-xs font-semibold text-slate-400 hover:text-slate-700"
            >
              <span aria-hidden="true">✕</span>
            </button>
          ) : null}
        </div>
      </div>

      {loadingClientDockets ? (
        <div className="py-10 text-center text-xs text-slate-500">
          <div className="mb-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" aria-hidden="true" />
          <p>Loading client docket history…</p>
        </div>
      ) : clientDocketsError ? (
        <div className="my-3 rounded-md border border-rose-200 bg-rose-50 py-8 text-center text-xs text-rose-700" role="alert">
          <p>Client docket history could not be loaded. Refresh the page to retry.</p>
        </div>
      ) : clientDockets.length === 0 ? (
        <div className="my-3 rounded-md border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700">No previous dockets for this client</p>
          <p className="mt-0.5 text-slate-500">This is the first docket created for {clientName}.</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="my-3 rounded-md border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-xs text-slate-500">
          <p className="font-medium text-slate-700">No dockets matched your search or filter.</p>
          <button
            type="button"
            onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }}
            className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="case-detail-table-wrap mt-2 overflow-x-auto rounded-md border border-slate-200" role="region" aria-label="Client docket history table">
          <table className="case-detail-table w-full text-left text-xs" aria-label="Past dockets for this client">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5">Docket ID</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5">Matter / Subject</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5">Category &amp; Subcategory</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5">Lifecycle</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5">Created</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5">Completed / Filed</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5">Assigned &amp; Workbasket</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {filteredRows.map((row) => {
                const openDocketInViewMode = () => navigate(
                  `${ROUTES.CASE_DETAIL(firmSlug, row.docketId)}?mode=view`,
                  { state: { returnTo: linkedClientRoute || returnTo, fromClientRoute: linkedClientRoute || fromClientRoute, viewOnly: true } },
                );
                return (
                  <tr key={row.docketId} className="transition-colors hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono font-medium tabular-nums">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="case-detail-table__link font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                        aria-label={`Open docket ${formatDocketId(row.docketId)}`}
                        onClick={openDocketInViewMode}
                      >
                        {formatDocketId(row.docketId)}
                      </Button>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 font-medium text-slate-900" title={row.caseName || '—'}>
                      {row.caseName || `${row.category || 'Matter'}${row.subcategory ? ` - ${row.subcategory}` : ''}`}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{row.category || 'General'}</span>
                        {row.subcategory ? (
                          <span className="text-[11px] text-slate-500">{row.subcategory}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`docket-lifecycle-pill inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase docket-lifecycle-pill--${getBusinessLifecycleTone(row.lifecycle)}`}>
                        {row.status === 'FILED' ? 'FILED' : row.status === 'RESOLVED' ? 'RESOLVED' : row.lifecycle || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600">
                      {row.createdAt ? formatDateTime(row.createdAt) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600">
                      {row.closedDate ? (
                        <span className="font-medium text-emerald-700">{formatDateTime(row.closedDate)}</span>
                      ) : (
                        <span className="italic text-slate-400">In progress</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">{row.assignee || 'Unassigned'}</span>
                        {row.workbasket ? (
                          <span className="text-[11px] text-slate-500">{row.workbasket}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={openDocketInViewMode}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900"
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
  );
};
