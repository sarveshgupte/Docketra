/**
 * Enterprise DataTable Component
 * Modernized with shadcn / better-ui architecture:
 * - High-density tabular layouts with sticky header
 * - Optical alignment with Lucide icons for sorting and filtering
 * - Strict keyboard navigation on interactive rows
 * - Accessible ARIA attributes: aria-sort, aria-label, role="status"
 */

import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react';
import { Table, TableHead, TableBody, TableRow, TableEmptyState } from './Table';
import { Button } from './Button';
import { cn } from '../../lib/utils';

const filterChipClassName =
  'inline-flex items-center gap-1.5 rounded-[var(--dt-radius-control,2px)] border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 transition-[border-color,background-color] hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900';

const tableMessageClassName = 'px-6 py-8 text-center text-xs';

export const DataTable = ({
  columns,
  rows,
  data,
  rowKey,
  sortState,
  onSortChange,
  activeFilters = [],
  onRemoveFilter,
  onResetFilters,
  toolbarLeft,
  toolbarRight,
  dense = false,
  loading = false,
  loadingMessage = 'Loading data...',
  emptyMessage = 'No records found.',
  emptyFilteredMessage = 'No dockets match your current filters.',
  errorMessage = '',
  onRetry,
  refreshing = false,
  refreshingMessage = 'Refreshing in the background…',
  onRowClick,
  onRowHover,
  pagination,
}) => {
  const handleSortClick = (key, sortable) => {
    if (!sortable || !onSortChange) return;

    if (sortState?.key === key) {
      onSortChange({ key, direction: sortState.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ key, direction: 'asc' });
    }
  };

  const getSortIcon = (key, sortable) => {
    if (!sortable) return null;
    if (sortState?.key !== key) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />;
    }
    return sortState.direction === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3 text-slate-900" aria-hidden="true" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-slate-900" aria-hidden="true" />
    );
  };

  const cellPaddingClass = dense ? 'px-3 py-2' : 'px-4 py-2.5';
  const headerPaddingClass = dense ? 'px-3 py-2' : 'px-4 py-2.5';
  const normalizedRows = Array.isArray(rows)
    ? rows
    : (Array.isArray(data) ? data : []);

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="flex flex-col space-y-3">
      {(toolbarLeft || toolbarRight || hasActiveFilters) && (
        <div className="flex min-h-9 items-center justify-between gap-4">
          <div className="flex items-center gap-3">{toolbarLeft}</div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap" role="list" aria-label="Active filters">
                {activeFilters.map((f) => (
                  <button
                    type="button"
                    key={f.key}
                    onClick={() => onRemoveFilter?.(f.key)}
                    className={filterChipClassName}
                    aria-label={`Remove filter: ${f.label} ${f.value}`}
                    title={`Remove filter: ${f.label} ${f.value}`}
                  >
                    <span className="font-medium text-slate-500">{f.label}:</span>
                    <span className="font-semibold text-slate-800">{f.value}</span>
                    <X className="h-3 w-3 text-slate-400 hover:text-slate-700" aria-hidden="true" />
                  </button>
                ))}
                <Button variant="ghost" size="xs" onClick={onResetFilters}>
                  Clear all
                </Button>
              </div>
            )}
            {toolbarRight}
          </div>
        </div>
      )}

      {refreshing ? (
        <p className="text-xs text-slate-500" role="status" aria-live="polite">{refreshingMessage}</p>
      ) : null}

      <Table loading={loading} loadingMessage={loadingMessage} className="max-h-[70vh] overflow-auto overscroll-contain">
        <TableHead className="sticky top-0 z-10">
          <TableRow>
            {columns.map((col) => {
              const isSortedByThis = sortState?.key === col.key;
              const nextDirection = isSortedByThis && sortState?.direction === 'asc' ? 'descending' : 'ascending';
              const ariaSort = !col.sortable ? undefined : (isSortedByThis ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');

              return (
                <th
                  key={String(col.key)}
                  className={cn(
                    headerPaddingClass,
                    col.align === 'right' ? 'text-right' : 'text-left',
                    'text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50/90 select-none',
                    col.headerClassName
                  )}
                  style={{ width: col.width }}
                  aria-sort={ariaSort}
                  scope="col"
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSortClick(col.key, col.sortable)}
                      className={cn(
                        'flex items-center w-full group hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 rounded-[var(--dt-radius-control,2px)]',
                        col.align === 'right' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <span>{col.label || col.header || col.key}</span>
                      {getSortIcon(col.key, col.sortable)}
                      <span className="sr-only">{`Sort ${nextDirection}`}</span>
                    </button>
                  ) : (
                    <div className={cn('flex items-center', col.align === 'right' ? 'justify-end' : 'justify-start')}>
                      {col.label || col.header || col.key}
                    </div>
                  )}
                </th>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading && errorMessage ? (
            <tr>
              <td colSpan={columns.length} className={cn(tableMessageClassName, 'text-rose-600')} role="status" aria-live="polite">
                <p>{errorMessage}</p>
                {onRetry ? <Button variant="outline" size="sm" onClick={onRetry} className="mt-3" aria-label="Retry loading table data">Retry</Button> : null}
              </td>
            </tr>
          ) : null}

          {!loading && !errorMessage && normalizedRows.length === 0 ? (
            <TableEmptyState colSpan={columns.length} message={hasActiveFilters ? emptyFilteredMessage : emptyMessage} />
          ) : null}

          {!loading && !errorMessage ? normalizedRows.map((row, rowIndex) => (
            <TableRow
              key={(rowKey && typeof rowKey === 'string' ? row?.[rowKey] : null) || row?.id || row?._id || rowIndex}
              onClick={() => onRowClick?.(row)}
              onMouseEnter={() => onRowHover?.(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRowClick(row);
                }
              } : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-inset transition-colors' : ''}
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={cn(
                    cellPaddingClass,
                    'whitespace-nowrap text-xs text-slate-800',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.className || col.cellClassName
                  )}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </TableRow>
          )) : null}
        </TableBody>
      </Table>

      {pagination?.pages > 1 ? (
        <div className="flex items-center justify-between rounded-[var(--dt-radius-control,2px)] border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600" role="navigation" aria-label="Queue pagination">
          <span className="tabular-nums">Page {pagination.page} of {pagination.pages} · {pagination.total || 0} dockets</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange?.(pagination.page - 1)}>Previous</Button>
            <Button type="button" variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => pagination.onPageChange?.(pagination.page + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
