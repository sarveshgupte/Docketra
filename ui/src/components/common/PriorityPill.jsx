import React from 'react';
import { CASE_STATUS } from '../../utils/constants';
import { isEscalatedCase, CASE_VIEWS } from '../../hooks/useCaseView';
import './PriorityPill.css';

const PRIORITY_META = {
  ESCALATED: { label: 'Escalated', tone: 'escalated' },
  OVERDUE: { label: 'SLA Overdue', tone: 'overdue' },
  DUE_TODAY: { label: 'Due Today', tone: 'today' },
  NORMAL: { label: 'Normal', tone: 'normal' },
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
    <span className={`priority-pill priority-pill--${priority.tone} ${className}`.trim()}>
      {priority.label}
    </span>
  );
};
