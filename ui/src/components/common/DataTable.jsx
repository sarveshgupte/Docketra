import React from 'react';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableEmptyState } from './Table';
import { Button } from './Button';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

export const DataTable = ({
  columns,
  rows,
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
  onRowClick,
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
      return <span className="ml-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>;
    }
    return <span className="ml-1 text-slate-700">{sortState.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  const cellPaddingClass = dense ? 'px-4 py-2.5' : 'px-6 py-4';
  const headerPaddingClass = dense ? 'px-4 py-3' : 'px-6 py-3';

  return (
    <div className="flex flex-col space-y-3">
      {/* Compact Toolbar */}
      {(toolbarLeft || toolbarRight || activeFilters.length > 0) && (
        <div className="flex min-h-10 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {toolbarLeft}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Filter Chips */}
            {activeFilters.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => onRemoveFilter?.(f.key)}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <span className="font-medium">{f.label}:</span> {f.value}
                    <span aria-hidden className="ml-0.5 text-slate-500 hover:text-slate-900">&times;</span>
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetFilters}
                  className="text-slate-500 hover:text-slate-900 px-2 h-7"
                >
                  Reset
                </Button>
              </div>
            )}
            {toolbarRight}
          </div>
        </div>
      )}

      {/* Table Area */}
      <Table loading={loading} loadingMessage={loadingMessage}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={() => handleSortClick(col.key, col.sortable)}
                className={joinClasses(
                  headerPaddingClass,
                  'text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50',
                  col.sortable ? 'cursor-pointer select-none group hover:text-slate-700 hover:bg-slate-100 transition-colors' : '',
                  col.headerClassName
                )}
                style={{ width: col.width }}
              >
                <div className={joinClasses("flex items-center", col.align === 'right' ? 'justify-end' : 'justify-start')}>
                  {col.label}
                  {getSortIcon(col.key, col.sortable)}
                </div>
              </th>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && !loading ? (
            <TableEmptyState colSpan={columns.length} message={emptyMessage} />
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow
                key={row.id || rowIndex}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={joinClasses(
                      cellPaddingClass,
                      'whitespace-nowrap text-sm text-slate-800',
                      col.align === 'right' ? 'text-right' : 'text-left',
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
