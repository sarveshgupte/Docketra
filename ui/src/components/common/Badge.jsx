/**
 * Enterprise Badge Component
 * Built with CVA and modern shadcn design-system architecture.
 * High-density operational status pill with WCAG 2.2 AA compliant contrast.
 */

import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { getStatusColor } from '../../utils/formatters';

export const badgeVariants = cva(
  'badge inline-flex items-center px-1.5 py-0.5 rounded-[var(--dt-radius-control,2px)] text-[11px] font-medium leading-4 tracking-normal transition-colors border select-none',
  {
    variants: {
      variant: {
        success: 'badge-success bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
        warning: 'badge-warning bg-amber-50 text-amber-900 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
        danger: 'badge-danger bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
        info: 'badge-info bg-sky-50 text-sky-800 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
        neutral: 'badge-neutral bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

export const Badge = ({ children, variant, status, className = '', ...props }) => {
  const badgeVariant = status ? getStatusColor(status) : variant;
  const resolvedVariant = ['success', 'warning', 'danger', 'info', 'neutral'].includes(badgeVariant)
    ? badgeVariant
    : 'neutral';

  return (
    <span
      className={cn(badgeVariants({ variant: resolvedVariant }), className)}
      {...props}
    >
      {children}
    </span>
  );
};
