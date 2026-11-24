import React from 'react';
import { CASE_STATUS } from '../../utils/constants';
import { isEscalatedCase, CASE_VIEWS } from '../../hooks/useCaseView';
import { Badge } from './Badge';
import { cn } from '../../lib/utils';

const PRIORITY_META = {
  ESCALATED: { label: 'ESCALATED', variant: 'danger', className: 'text-rose-700 font-mono font-semibold' },
  OVERDUE: { label: 'SLA OVERDUE', variant: 'danger', className: 'text-rose-700 font-mono font-semibold' },
  DUE_TODAY: { label: 'DUE TODAY', variant: 'warning', className: 'text-amber-800 font-mono font-medium' },
  NORMAL: { label: 'NORMAL', variant: 'neutral', className: 'text-slate-500 font-mono' },
};

const getPriorityState = (caseRecord, inactivityThresholdHours) => {
  if (!caseRecord) return 'NORMAL';
  if (isEscalatedCase(caseRecord, inactivityThresholdHours)) return 'ESCALATED';
  if (CASE_VIEWS.OVERDUE?.predicate?.(caseRecord)) return 'OVERDUE';
  if (
    caseRecord.status !== CASE_STATUS.RESOLVED &&
    caseRecord.status !== CASE_STATUS.FILED &&
    CASE_VIEWS.DUE_TODAY?.predicate?.(caseRecord)
  ) {
    return 'DUE_TODAY';
  }
  return 'NORMAL';
};

export const PriorityPill = ({ caseRecord, inactivityThresholdHours, className = '' }) => {
  const priority = PRIORITY_META[getPriorityState(caseRecord, inactivityThresholdHours)] || PRIORITY_META.NORMAL;
  return (
    <Badge
      variant={priority.variant}
      className={cn(
        'font-mono text-[10.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--dt-radius-control,2px)] border',
        priority.className,
        className
      )}
    >
      {priority.label}
    </Badge>
  );
};
