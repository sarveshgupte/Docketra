import React from 'react';
import { CASE_STATUS } from '../../utils/constants';
import { isEscalatedCase, CASE_VIEWS } from '../../hooks/useCaseView';
import { Badge } from './Badge';

const PRIORITY_META = {
  ESCALATED: { label: 'Escalated', variant: 'warning', className: 'bg-purple-50 text-purple-700 border border-purple-200' },
  OVERDUE: { label: 'SLA Overdue', variant: 'danger', className: '' },
  DUE_TODAY: { label: 'Due Today', variant: 'warning', className: '' },
  NORMAL: { label: 'Normal', variant: 'neutral', className: '' },
};

const getPriorityState = (caseRecord, inactivityThresholdHours) => {
  if (!caseRecord) return 'NORMAL';
  if (isEscalatedCase(caseRecord, inactivityThresholdHours)) return 'ESCALATED';
  if (CASE_VIEWS.OVERDUE.predicate(caseRecord)) return 'OVERDUE';
  if (
    caseRecord.status !== CASE_STATUS.RESOLVED &&
    caseRecord.status !== CASE_STATUS.FILED &&
    CASE_VIEWS.DUE_TODAY.predicate(caseRecord)
  ) {
    return 'DUE_TODAY';
  }
  return 'NORMAL';
};

export const PriorityPill = ({ caseRecord, inactivityThresholdHours, className = '' }) => {
  const priority = PRIORITY_META[getPriorityState(caseRecord, inactivityThresholdHours)];
  return (
    <Badge variant={priority.variant} className={`font-semibold px-2 py-0.5 rounded-full ${priority.className} ${className}`.trim()}>
      {priority.label}
    </Badge>
  );
};
