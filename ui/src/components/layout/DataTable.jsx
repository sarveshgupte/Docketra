import React from 'react';
import './layoutPrimitives.css';

export const DataTable = ({ columns, data, onRowClick, emptyContent, rowKey = '_id' }) => {
  if (!data.length) {
    return <>{emptyContent}</>;
  }

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
            <tr key={row[rowKey]} onClick={() => onRowClick?.(row)}>
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
