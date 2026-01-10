/**
 * Enterprise Table Component
 * Features: sticky header, zebra striping, hover states, action column
 */

import React from 'react';

export const Table = ({ children, className = '' }) => {
  return (
    <div className={`table-container ${className}`}>
      <table className="table">
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
      className={`${onClick ? 'cursor-pointer' : ''} ${className}`}
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
        <td colSpan={colSpan} className="px-md py-3 text-sm text-text-body border-t border-border-subtle">
          {children}
        </td>
      </tr>
    </tfoot>
  );
};
