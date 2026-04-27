import React from 'react';
import { Table, TableHead, TableBody, TableRow, TableEmptyState } from './Table';
import { Button } from './Button';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

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
      return <span className="ml-1 text-[var(--dt-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">↕</span>;
    }
    return <span className="ml-1 text-[var(--dt-text-secondary)]">{sortState.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  const cellPaddingClass = dense ? 'px-4 py-2.5' : 'px-6 py-4';
  const headerPaddingClass = dense ? 'px-4 py-3' : 'px-6 py-3';
  const normalizedRows = Array.isArray(rows)
    ? rows
    : (Array.isArray(data) ? data : []);

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="flex flex-col space-y-3">
      {(toolbarLeft || toolbarRight || activeFilters.length > 0) && (
        <div className="flex min-h-10 items-center justify-between gap-4">
          <div className="flex items-center gap-3">{toolbarLeft}</div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {activeFilters.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap" role="list" aria-label="Active filters">
                {activeFilters.map((f) => (
                  <button
                    type="button"
                    key={f.key}
                    onClick={() => onRemoveFilter?.(f.key)}
                    className="inline-flex items-center gap-1 rounded-[var(--dt-radius-control)] bg-[var(--dt-surface-muted)] px-2 py-1 text-xs text-[var(--dt-text-secondary)] hover:bg-[var(--dt-surface-subtle)] transition-colors"
                    aria-label={`Remove filter: ${f.label} ${f.value}`}
                  >
                    <span className="font-medium">{f.label}:</span> {f.value}
                    <span aria-hidden className="ml-0.5 text-[var(--dt-text-muted)] hover:text-[var(--dt-text)]">&times;</span>
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
        <p className="text-xs text-[var(--dt-text-muted)]" role="status" aria-live="polite">{refreshingMessage}</p>
      ) : null}

      <Table loading={loading} loadingMessage={loadingMessage} className="max-h-[70vh] overflow-auto">
        <TableHead className="sticky top-0 z-10">
          <TableRow>
            {columns.map((col) => {
              const isSortedByThis = sortState?.key === col.key;
              const nextDirection = isSortedByThis && sortState?.direction === 'asc' ? 'descending' : 'ascending';
              const ariaSort = !col.sortable ? undefined : (isSortedByThis ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');

              return (
                <th
                  key={String(col.key)}
                  className={joinClasses(
                    headerPaddingClass,
                    'text-left text-xs font-semibold text-[var(--dt-text-muted)] uppercase tracking-wider whitespace-nowrap bg-[var(--dt-surface-subtle)]',
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
                      className={joinClasses('flex items-center w-full group hover:text-[var(--dt-text-secondary)] transition-colors', col.align === 'right' ? 'justify-end' : 'justify-start')}
                    >
                      {col.label || col.header || col.key}
                      {getSortIcon(col.key, col.sortable)}
                      <span className="sr-only">{`Sort ${nextDirection}`}</span>
                    </button>
                  ) : (
                    <div className={joinClasses('flex items-center', col.align === 'right' ? 'justify-end' : 'justify-start')}>
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
              <td colSpan={columns.length} className="px-6 py-8 text-center text-sm text-[var(--dt-error)]">
                <p>{errorMessage}</p>
                {onRetry ? <Button variant="outline" size="sm" onClick={onRetry} className="mt-3">Retry</Button> : null}
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
              className={onRowClick ? 'cursor-pointer hover:bg-[var(--dt-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-focus)] focus-visible:ring-inset transition-colors' : ''}
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={joinClasses(
                    cellPaddingClass,
                    'whitespace-nowrap text-sm text-[var(--dt-text)]',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.className || col.cellClassName,
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
        <div className="flex items-center justify-between text-sm text-[var(--dt-text-secondary)]" role="navigation" aria-label="Queue pagination">
          <span>Page {pagination.page} of {pagination.pages} · {pagination.total || 0} dockets</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange?.(pagination.page - 1)}>Previous</Button>
            <Button type="button" variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => pagination.onPageChange?.(pagination.page + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
