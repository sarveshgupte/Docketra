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
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'DONE' | 'ACTIVE' | 'WAITING' | 'QUEUE'

  const clientName = caseInfo?.client?.businessName || caseInfo?.client?.name || caseInfo?.clientName || 'Client';

  const normalizedRows = useMemo(() => {
    return (clientDockets || []).map(getNormalizedHistoryRow);
  }, [clientDockets]);

  // Counts by lifecycle
  const counts = useMemo(() => {
    const total = normalizedRows.length;
    let done = 0;
    let active = 0;
    let waiting = 0;
    let queue = 0;

    normalizedRows.forEach((r) => {
      const lc = String(r.lifecycle || '').toUpperCase();
      const st = String(r.status || '').toUpperCase();
      if (lc === 'DONE' || st === 'FILED' || st === 'RESOLVED' || st === 'CLOSED') done++;
      else if (lc === 'ACTIVE' || st === 'ASSIGNED' || st === 'IN_PROGRESS' || st === 'ROUTED') active++;
      else if (lc === 'WAITING' || st === 'PENDING' || st === 'PEND' || st === 'QC_WB' || st === 'QC_ASSIGNED') waiting++;
      else queue++;
    });

    return { total, done, active, waiting, queue };
  }, [normalizedRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return normalizedRows.filter((r) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const lc = String(r.lifecycle || '').toUpperCase();
        const st = String(r.status || '').toUpperCase();
        if (statusFilter === 'DONE') {
          if (lc !== 'DONE' && st !== 'FILED' && st !== 'RESOLVED' && st !== 'CLOSED') return false;
        } else if (statusFilter === 'ACTIVE') {
          if (lc !== 'ACTIVE' && st !== 'ASSIGNED' && st !== 'IN_PROGRESS' && st !== 'ROUTED') return false;
        } else if (statusFilter === 'WAITING') {
          if (lc !== 'WAITING' && st !== 'PENDING' && st !== 'PEND' && st !== 'QC_WB' && st !== 'QC_ASSIGNED') return false;
        } else if (statusFilter === 'QUEUE') {
          if (lc !== 'WL' && st !== 'OPEN' && st !== 'AVAILABLE' && st !== 'IN_WB') return false;
        }
      }

      // 2. Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const docketIdMatch = String(r.docketId || '').toLowerCase().includes(term);
        const nameMatch = String(r.caseName || '').toLowerCase().includes(term);
        const catMatch = String(r.category || '').toLowerCase().includes(term);
        const subCatMatch = String(r.subcategory || '').toLowerCase().includes(term);
        const assigneeMatch = String(r.assignee || '').toLowerCase().includes(term);
        if (!docketIdMatch && !nameMatch && !catMatch && !subCatMatch && !assigneeMatch) return false;
      }

      return true;
    });
  }, [normalizedRows, statusFilter, searchTerm]);

  return (
    <section className="case-card border border-slate-200 rounded-xl bg-white shadow-sm p-6" aria-labelledby="past-dockets-heading">
      {/* Header & Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="past-dockets-heading" className="text-lg font-bold text-slate-900">
              Client Docket History
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {counts.total} {counts.total === 1 ? 'Matter' : 'Matters'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete historical track record of compliance, filings, and matters for <strong className="text-slate-700">{clientName}</strong>.
          </p>
        </div>

        {/* BYOS Cloud Storage Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-medium self-start sm:self-auto">
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7M19 19H5a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2z" />
          </svg>
          <span>Stored on Firm BYOS</span>
        </div>
      </div>

      {/* Controls: Search and Filter Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-4 pb-2">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DONE')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'DONE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Done / Filed ({counts.done})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Active ({counts.active})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('WAITING')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'WAITING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Waiting ({counts.waiting})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('QUEUE')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'QUEUE'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            Queue ({counts.queue})
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all"
            placeholder="Search past dockets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content Body */}
      {loadingClientDockets ? (
        <div className="py-12 text-center text-xs text-slate-500">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-slate-900 mb-2"></div>
          <p>Loading client docket history…</p>
        </div>
      ) : clientDocketsError ? (
        <div className="py-8 text-center text-xs text-rose-600 bg-rose-50 rounded-lg my-3 border border-rose-200">
          <p>Client docket history could not be loaded. Please refresh.</p>
        </div>
      ) : clientDockets.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-xl my-3 border border-dashed border-slate-200">
          <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="font-semibold text-slate-700">No previous dockets for this client</p>
          <p className="text-slate-400 mt-0.5">This is the first docket created for {clientName}.</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl my-3 border border-dashed border-slate-200">
          <p className="font-medium text-slate-600">No dockets matched your search or filter</p>
          <button
            type="button"
            onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }}
            className="mt-2 text-xs text-blue-600 hover:underline font-semibold"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="case-detail-table-wrap overflow-x-auto mt-2 rounded-lg border border-slate-200/80 shadow-xs" role="region" aria-label="Client docket history table">
          <table className="case-detail-table w-full text-left text-xs" aria-label="Past dockets for this client">
            <thead className="bg-slate-50/90 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th scope="col" className="py-2.5 px-3">Docket ID</th>
                <th scope="col" className="py-2.5 px-3">Matter / Subject</th>
                <th scope="col" className="py-2.5 px-3">Category & Subcategory</th>
                <th scope="col" className="py-2.5 px-3">Lifecycle / Status</th>
                <th scope="col" className="py-2.5 px-3">Created Date</th>
                <th scope="col" className="py-2.5 px-3">Completed / Filed Date</th>
                <th scope="col" className="py-2.5 px-3">Assigned To & Team</th>
                <th scope="col" className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              {filteredRows.map((row) => {
                const openDocketInViewMode = () => navigate(
                  `${ROUTES.CASE_DETAIL(firmSlug, row.docketId)}?mode=view`,
                  { state: { returnTo: linkedClientRoute || returnTo, fromClientRoute: linkedClientRoute || fromClientRoute, viewOnly: true } },
                );
                return (
                  <tr key={row.docketId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium">
                      <Button
                        type="button"
                        variant="ghost"
                        className="case-detail-table__link text-blue-700 hover:text-blue-900 font-bold hover:underline p-0"
                        aria-label={`Open docket ${formatDocketId(row.docketId)}`}
                        onClick={openDocketInViewMode}
                      >
                        {formatDocketId(row.docketId)}
                      </Button>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[200px] truncate" title={row.caseName || '—'}>
                      {row.caseName || `${row.category || 'Matter'} - ${row.subcategory || ''}`}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{row.category || 'General'}</span>
                        {row.subcategory && (
                          <span className="text-[11px] text-slate-500">{row.subcategory}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase docket-lifecycle-pill docket-lifecycle-pill--${getBusinessLifecycleTone(row.lifecycle)}`}>
                        {row.status === 'FILED' ? 'FILED' : row.status === 'RESOLVED' ? 'RESOLVED' : row.lifecycle || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {row.createdAt ? formatDateTime(row.createdAt) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {row.closedDate ? (
                        <span className="text-emerald-700 font-medium">{formatDateTime(row.closedDate)}</span>
                      ) : (
                        <span className="text-slate-400 italic">In progress</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">{row.assignee || 'Unassigned'}</span>
                        {row.workbasket && (
                          <span className="text-[11px] text-slate-500">{row.workbasket}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={openDocketInViewMode}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                      >
                        View Docket →
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
