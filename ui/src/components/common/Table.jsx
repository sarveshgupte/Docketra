/**
 * Enterprise Table Component
 * Built with composable shadcn table architecture and Linear/Attio high-density polish:
 * - Crisp borders with subtle alternating hover states
 * - Sticky header with hair-thin border
 * - ForwardRef on all subcomponents for virtualized or ref-driven tables
 * - High-density text hierarchy (12px headers, 12px cells)
 */

import React, { forwardRef } from 'react';
import { Loading } from './Loading';
import { spacingClasses, surfaceClasses } from '../../theme/tokens';
import { cn } from '../../lib/utils';

export const Table = forwardRef(({
  children,
  className = '',
  tableClassName = '',
  loading = false,
  loadingMessage = 'Loading data...',
  ...props
}, ref) => {
  if (loading) {
    return (
      <div className={cn(surfaceClasses.tableWrapper || 'bg-white border border-slate-200/90 rounded-[var(--dt-radius-card,6px)] overflow-hidden shadow-none', className)}>
        <div className="px-4 py-8" role="status" aria-live="polite">
          <Loading message={loadingMessage} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(surfaceClasses.tableWrapper || 'bg-white border border-slate-200/90 rounded-[var(--dt-radius-card,6px)] overflow-hidden shadow-none', className)}>
      <div className="overflow-x-auto overscroll-x-contain">
        <table ref={ref} className={cn('min-w-full divide-y divide-slate-100 text-xs text-left', tableClassName)} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
});
Table.displayName = 'Table';

export const TableHead = forwardRef(({ children, className = '', ...props }, ref) => {
  return (
    <thead
      ref={ref}
      className={cn(
        'sticky top-0 z-10 bg-slate-50/90 backdrop-blur-xs border-b border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
        className
      )}
      {...props}
    >
      {children}
    </thead>
  );
});
TableHead.displayName = 'TableHead';

export const TableHeader = forwardRef(({ children, className = '', ...props }, ref) => {
  return (
    <th
      ref={ref}
      className={cn(
        'px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap select-none',
        spacingClasses.tableHeaderPadding,
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
});
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef(({ children, className = '', ...props }, ref) => {
  return (
    <tbody
      ref={ref}
      className={cn('divide-y divide-slate-100/90 bg-white', className)}
      {...props}
    >
      {children}
    </tbody>
  );
});
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef(({ children, onClick, className = '', ...props }, ref) => {
  return (
    <tr
      ref={ref}
      onClick={onClick}
      className={cn(
        'transition-colors duration-150 hover:bg-slate-50/80 focus-within:bg-slate-50/80',
        onClick && 'cursor-pointer hover:bg-slate-100/70 active:bg-slate-100',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
});
TableRow.displayName = 'TableRow';

export const TableCell = forwardRef(({ children, className = '', ...props }, ref) => {
  return (
    <td
      ref={ref}
      className={cn(
        'px-4 py-2.5 whitespace-nowrap text-xs text-slate-800 leading-normal',
        spacingClasses.tableCellPadding,
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
});
TableCell.displayName = 'TableCell';

export const TableFooter = forwardRef(({ children, colSpan, className = '', ...props }, ref) => {
  return (
    <tfoot ref={ref} className={cn('bg-slate-50 border-t border-slate-200/80', className)} {...props}>
      <tr>
        <td colSpan={colSpan} className={cn('px-4 py-2.5 text-xs text-slate-500', className)}>
          {children}
        </td>
      </tr>
    </tfoot>
  );
});
TableFooter.displayName = 'TableFooter';

export const TableCaption = forwardRef(({ children, className = '', ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-xs text-slate-500', className)} {...props}>
    {children}
  </caption>
));
TableCaption.displayName = 'TableCaption';

export const TableEmptyState = ({ colSpan, message = 'No records found.' }) => (
  <tr>
    <td
      colSpan={colSpan}
      className="px-4 py-10 text-center text-xs text-slate-500"
      role="status"
      aria-live="polite"
    >
      {message}
    </td>
  </tr>
);
