import React from 'react';
import { Loading } from './Loading';
import { spacingClasses, surfaceClasses } from '../../theme/tokens';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

export const Table = ({
  children,
  className = '',
  loading = false,
  loadingMessage = 'Loading data...',
}) => {
  if (loading) {
    return (
      <div className={joinClasses(surfaceClasses.tableWrapper, className)}>
        <Loading message={loadingMessage} />
      </div>
    );
  }

  return (
    <div className={joinClasses(surfaceClasses.tableWrapper, className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">{children}</table>
      </div>
    </div>
  );
};

export const TableHead = ({ children, className = '' }) => {
  return <thead className={joinClasses('bg-gray-50 border-b border-gray-200', className)}>{children}</thead>;
};

export const TableBody = ({ children, className = '' }) => {
  return <tbody className={joinClasses('divide-y divide-gray-200 bg-white', className)}>{children}</tbody>;
};

export const TableRow = ({ children, onClick, className = '' }) => {
  return (
    <tr
      onClick={onClick}
      className={joinClasses(
        'transition-colors duration-150 hover:bg-gray-50',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </tr>
  );
};

export const TableHeader = ({ children, className = '' }) => {
  return (
    <th
      className={joinClasses(
        `${spacingClasses.tableHeaderPadding} text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap`,
        className,
      )}
    >
      {children}
    </th>
  );
};

export const TableCell = ({ children, className = '' }) => {
  return <td className={joinClasses(`${spacingClasses.tableCellPadding} whitespace-nowrap text-sm text-gray-900`, className)}>{children}</td>;
};

export const TableFooter = ({ children, colSpan, className = '' }) => {
  return (
    <tfoot className="bg-white">
      <tr>
        <td colSpan={colSpan} className={joinClasses(`${spacingClasses.tableCellPadding} text-sm text-gray-500 border-t border-gray-200`, className)}>
          {children}
        </td>
      </tr>
    </tfoot>
  );
};

export const TableEmptyState = ({ colSpan, message = 'No records found.' }) => (
  <tr>
    <td colSpan={colSpan} className={`${spacingClasses.tableCellPadding} py-8 text-center text-sm text-gray-500`}>
      {message}
    </td>
  </tr>
);
