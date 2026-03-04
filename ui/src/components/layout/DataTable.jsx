import React from 'react';
import './layoutPrimitives.css';

export const DataTable = ({
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
  dense = false,
}) => {
  if (!data.length) {
    return <>{emptyContent}</>;
  }

  const isInteractive = typeof onRowClick === 'function';
  const hasToolbar = toolbarLeft || toolbarRight || activeFilters.length > 0;

  const handleRowKeyDown = (event, row) => {
    if (!isInteractive) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  const handleSortToggle = (column) => {
    if (!column.sortable || typeof onSortChange !== 'function') {
      return;
    }
    const nextDirection = sortState?.key === column.key && sortState.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ key: column.key, direction: nextDirection });
  };

  return (
    <div className="data-table__wrapper">
      {hasToolbar ? (
        <div className="data-table__toolbar">
          <div className="data-table__toolbar-left">{toolbarLeft}</div>
          <div className="data-table__toolbar-right">
            {activeFilters.length ? (
              <div className="data-table__chips" aria-label="Active filters">
                {activeFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className="data-table__chip"
                    onClick={() => onRemoveFilter?.(filter.key)}
                  >
                    {filter.label}: {filter.value} ×
                  </button>
                ))}
                {onResetFilters ? (
                  <button type="button" className="data-table__reset" onClick={onResetFilters}>
                    Reset filters
                  </button>
                ) : null}
              </div>
            ) : null}
            {toolbarRight}
          </div>
        </div>
      ) : null}
      <table className={`data-table${dense ? ' data-table--dense' : ''}`}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'right' ? 'data-table__cell--right' : ''}>
                {column.sortable ? (
                  <button type="button" className="data-table__sort" onClick={() => handleSortToggle(column)}>
                    <span>{column.header}</span>
                    <span className="data-table__sort-indicator" aria-hidden="true">
                      {sortState?.key === column.key ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row[rowKey]}
              onClick={isInteractive ? () => onRowClick(row) : undefined}
              onKeyDown={isInteractive ? (event) => handleRowKeyDown(event, row) : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              role={isInteractive ? 'button' : undefined}
              className={isInteractive ? 'data-table__row--clickable' : ''}
            >
              {columns.map((column) => (
                <td
                  key={`${row[rowKey]}-${column.key}`}
                  className={`${column.align === 'right' ? 'data-table__cell--right' : ''}${column.tabular ? ' data-table__cell--tabular' : ''}`}
                >
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
