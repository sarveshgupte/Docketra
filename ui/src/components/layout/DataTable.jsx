import React from 'react';
import { SortableTableHeader } from '../ui/SortableTableHeader';
import { EmptyState } from '../ui/EmptyState';
import { Loading } from '../common/Loading';
import { spacingClasses, surfaceClasses } from '../../theme/tokens';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

export const DataTable = React.memo(({
  columns,
  data,
  onRowClick,
  emptyContent,
  rowKey = '_id',
  sortState,
  onSortChange,
  activeFilters = [],
  onRemoveFilter,
  onResetFilters,
  toolbarLeft,
  toolbarRight,
  loading = false,
  loadingMessage = 'Loading data...',
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting filters or create a new record.',
}) => {
  const hasActiveFilters = activeFilters.length > 0;

  if (loading) {
    return <Loading message={loadingMessage} />;
  }

  if (!data.length) {
    const isFilteredEmptyState = hasActiveFilters;
    return emptyContent || (
      <EmptyState
        title={isFilteredEmptyState ? 'No matching dockets' : emptyTitle}
        description={isFilteredEmptyState ? 'Try adjusting or clearing filters' : emptyDescription}
        icon
      />
    );
  }

  const isInteractive = typeof onRowClick === 'function';
  const hasToolbar = toolbarLeft || toolbarRight || hasActiveFilters;

  const handleRowKeyDown = (event, row) => {
    if (!isInteractive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  const handleSortToggle = (nextSortState) => {
    if (typeof onSortChange !== 'function') {
      return;
    }
    onSortChange(nextSortState);
  };

  return (
    <div className={spacingClasses.sectionMargin}>
      {hasToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">{toolbarLeft}</div>
          <div className="flex flex-wrap items-center gap-2">
            {toolbarRight}
          </div>
        </div>
      ) : null}
      {hasActiveFilters ? (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100"
              onClick={() => onRemoveFilter?.(filter.key)}
              aria-label={`Remove filter ${filter.label}: ${filter.value}`}
            >
              <span className="truncate max-w-44">{filter.label}: {filter.value}</span>
              <span aria-hidden>✕</span>
              <span className="sr-only">Remove {filter.label} filter</span>
            </button>
          ))}
          {onResetFilters ? (
            <button
              type="button"
              className="text-xs font-medium text-gray-500 underline underline-offset-2 transition-colors duration-150 hover:text-gray-700"
              onClick={onResetFilters}
              aria-label="Clear all active filters"
            >
              Clear All
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={joinClasses(surfaceClasses.tableWrapper, 'w-full max-w-full min-w-0')}>
        <div className="w-full max-w-full overflow-x-hidden">
          <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={joinClasses(
                      `sticky top-0 z-10 bg-gray-50 drop-shadow-sm ${spacingClasses.tableHeaderPadding} text-left text-xs font-semibold text-gray-500 uppercase tracking-wider`,
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.headerClassName,
                    )}
                  >
                    {column.sortable ? (
                      <SortableTableHeader
                        column={column.key}
                        label={column.header}
                        sortState={sortState}
                        onSortChange={handleSortToggle}
                      />
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.map((row) => (
                <tr
                  key={row[rowKey]}
                  onClick={isInteractive ? () => onRowClick(row) : undefined}
                  onKeyDown={isInteractive ? (event) => handleRowKeyDown(event, row) : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  role={isInteractive ? 'button' : undefined}
                  className={joinClasses(
                    'transition-all duration-200 ease-in-out',
                    isInteractive
                      ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset'
                      : undefined,
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={`${row[rowKey]}-${column.key}`}
                      className={joinClasses(
                        `${spacingClasses.tableCellPadding} text-sm text-gray-900`,
                        (column.align === 'right' || column.tabular) && 'text-right',
                        column.align === 'center' && 'text-center',
                        column.tabular && 'tabular-nums',
                        column.cellClassName,
                      )}
                    >
                      <div className={joinClasses('min-w-0', column.contentClassName)}>
                        {column.render ? column.render(row) : row[column.key]}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
