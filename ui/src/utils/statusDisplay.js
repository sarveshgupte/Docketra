import { UX_COPY } from '../constants/uxCopy';

const STATUS_EMOJI = {
  ACTIVE: '🟢',
  CLOSED: '⚪️',
  DRAFT: '⚪️',
  ESCALATED: '🔴',
  FILED: '⚪️',
  OPEN: '🟢',
  PENDED: '🟡',
  PENDING: '🟡',
  RESOLVED: '⚪️',
  REVIEW: '🟡',
  UNDER_REVIEW: '🟡',
  UNASSIGNED: '⚪️',
};

const STATUS_COPY = {
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  DRAFT: 'Draft',
  ESCALATED: 'Escalated',
  FILED: 'Filed',
  OPEN: UX_COPY.statusLabels.OPEN,
  PENDED: 'Pending',
  PENDING: 'Pending',
  RESOLVED: UX_COPY.statusLabels.RESOLVED,
  REVIEW: 'Pending',
  UNDER_REVIEW: 'Pending',
  UNASSIGNED: UX_COPY.statusLabels.UNASSIGNED,
};

export const getStatusLabel = (status) => {
  const normalizedStatus = String(status ?? '').trim().toUpperCase();

  if (!normalizedStatus) {
    return '⚪️ Unknown';
  }

  const label = STATUS_COPY[normalizedStatus] || UX_COPY.statusLabels[normalizedStatus] || normalizedStatus.replaceAll('_', ' ');
  const emoji = STATUS_EMOJI[normalizedStatus] || '⚪️';

  return `${emoji} ${label}`;
};
