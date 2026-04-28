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
        <div className="px-4 py-6" role="status" aria-live="polite">
          <Loading message={loadingMessage} />
        </div>
      </div>
    );
  }

  return (
    <div className={joinClasses(surfaceClasses.tableWrapper, className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--dt-border-whisper)]">{children}</table>
      </div>
    </div>
  );
};

export const TableHead = ({ children, className = '' }) => {
  return <thead className={joinClasses('bg-[var(--dt-surface-subtle)] border-b border-[var(--dt-border-whisper)]', className)}>{children}</thead>;
};

export const TableBody = ({ children, className = '' }) => {
  return <tbody className={joinClasses('divide-y divide-[var(--dt-border-whisper)] bg-[var(--dt-surface)]', className)}>{children}</tbody>;
};

export const TableRow = ({ children, onClick, className = '', ...rest }) => {
  return (
    <tr
      onClick={onClick}
      {...rest}
      className={joinClasses(
        'transition-colors duration-150 hover:bg-[var(--dt-surface-subtle)] focus-within:bg-[var(--dt-surface-subtle)]',
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
        `${spacingClasses.tableHeaderPadding} text-left text-xs font-semibold text-[var(--dt-text-muted)] uppercase tracking-wider whitespace-nowrap`,
        className,
      )}
    >
      {children}
    </th>
  );
};

export const TableCell = ({ children, className = '' }) => {
  return <td className={joinClasses(`${spacingClasses.tableCellPadding} whitespace-nowrap text-sm text-[var(--dt-text)]`, className)}>{children}</td>;
};

export const TableFooter = ({ children, colSpan, className = '' }) => {
  return (
    <tfoot className="bg-[var(--dt-surface)]">
      <tr>
        <td colSpan={colSpan} className={joinClasses(`${spacingClasses.tableCellPadding} text-sm text-[var(--dt-text-muted)] border-t border-[var(--dt-border-whisper)]`, className)}>
          {children}
        </td>
      </tr>
    </tfoot>
  );
};

export const TableEmptyState = ({ colSpan, message = 'No records found.' }) => (
  <tr>
    <td colSpan={colSpan} className={`${spacingClasses.tableCellPadding} py-8 text-center text-sm text-[var(--dt-text-muted)]`} role="status" aria-live="polite">
      {message}
    </td>
  </tr>
);
