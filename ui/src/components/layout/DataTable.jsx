import React from 'react';
import './layoutPrimitives.css';

export const DataTable = ({ columns, data, onRowClick, emptyContent, rowKey = '_id' }) => {
  if (!data.length) {
    return <>{emptyContent}</>;
  }

  const isInteractive = typeof onRowClick === 'function';

  const handleRowKeyDown = (event, row) => {
    if (!isInteractive) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="data-table__wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'right' ? 'data-table__cell--right' : ''}>
                {column.header}
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
                <td key={`${row[rowKey]}-${column.key}`} className={column.align === 'right' ? 'data-table__cell--right' : ''}>
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
