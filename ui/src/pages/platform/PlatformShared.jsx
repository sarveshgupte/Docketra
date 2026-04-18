import React from 'react';

export const toArray = (value) => (Array.isArray(value) ? value : []);

export const DataTable = ({ columns, rows }) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <div className="panel table-wrap">
      <table className="table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {safeRows.length ? safeRows : <tr><td colSpan={columns.length} className="muted">No records.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
