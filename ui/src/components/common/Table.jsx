/**
 * Enterprise Table Component
 * Features: compact density, sticky header, subtle hover states, action column
 */

import React from 'react';

export const Table = ({ children, className = '', dense = true }) => {
  return (
    <div className={`table-container${dense ? ' table-container--dense' : ''} ${className}`.trim()}>
      <table className={`table${dense ? ' table--dense' : ''}`.trim()}>
        {children}
      </table>
    </div>
  );
};

export const TableHead = ({ children }) => {
  return <thead>{children}</thead>;
};

export const TableBody = ({ children }) => {
  return <tbody>{children}</tbody>;
};

export const TableRow = ({ children, onClick, className = '' }) => {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer table__row--interactive' : ''} ${className}`.trim()}
    >
      {children}
    </tr>
  );
};

export const TableHeader = ({ children, className = '' }) => {
  return <th className={className}>{children}</th>;
};

export const TableCell = ({ children, className = '' }) => {
  return <td className={className}>{children}</td>;
};

export const TableFooter = ({ children, colSpan }) => {
  return (
    <tfoot>
      <tr>
        <td
          colSpan={colSpan}
          className="text-sm border-t border-border-subtle"
          style={{
            padding: 'var(--space-2) var(--space-3)',
            color: 'var(--text-body)',
          }}
        >
          {children}
        </td>
      </tr>
    </tfoot>
  );
};
