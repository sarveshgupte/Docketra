import React from 'react';
import { Loading } from './Loading';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

export const Table = ({
  children,
  className = '',
  loading = false,
  loadingMessage = 'Loading data...',
}) => {
  if (loading) {
    return (
      <div className={joinClasses('bg-white border border-gray-200 rounded-xl shadow-sm', className)}>
        <Loading message={loadingMessage} />
      </div>
    );
  }

  return (
    <div className={joinClasses('bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm', className)}>
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
        'px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap',
        className,
      )}
    >
      {children}
    </th>
  );
};

export const TableCell = ({ children, className = '' }) => {
  return <td className={joinClasses('px-6 py-4 whitespace-nowrap text-sm text-gray-900', className)}>{children}</td>;
};

export const TableFooter = ({ children, colSpan, className = '' }) => {
  return (
    <tfoot className="bg-white">
      <tr>
        <td colSpan={colSpan} className={joinClasses('px-6 py-4 text-sm text-gray-500 border-t border-gray-200', className)}>
          {children}
        </td>
      </tr>
    </tfoot>
  );
};

export const TableEmptyState = ({ colSpan, message = 'No records found.' }) => (
  <tr>
    <td colSpan={colSpan} className="px-6 py-8 text-center text-sm text-gray-500">
      {message}
    </td>
  </tr>
);
