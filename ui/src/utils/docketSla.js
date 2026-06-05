import { CASE_STATUS } from './constants';

export const isDocketSlaBreached = (row = {}) => {
  const dueAt = row?.slaDueDate || row?.slaDueAt;
  if (!dueAt) return false;
  const status = String(row.status || '').toUpperCase();
  const lifecycle = String(row.lifecycle || '').toUpperCase();
  if (
    status === 'RESOLVED' || status === 'FILED' || status === 'CLOSED' ||
    lifecycle === 'RESOLVED' || lifecycle === 'CLOSED'
  ) {
    return false;
  }
  return new Date(dueAt) < new Date();
};

export const isDocketDueToday = (row = {}) => {
  const dueAt = row?.slaDueDate || row?.slaDueAt;
  if (!dueAt) return false;
  const due = new Date(dueAt);
  const now = new Date();
  return due.getFullYear() === now.getFullYear()
    && due.getMonth() === now.getMonth()
    && due.getDate() === now.getDate();
};

export const getDocketSlaBadgeStatus = (row = {}) => {
  const status = String(row.status || '').toUpperCase();
  const lifecycle = String(row.lifecycle || '').toUpperCase();
  if (
    status === 'RESOLVED' || status === 'FILED' || status === 'CLOSED' ||
    lifecycle === 'RESOLVED' || lifecycle === 'CLOSED'
  ) {
    return 'GREEN';
  }

  if (row?.slaStatus) return String(row.slaStatus).toUpperCase();
  if (isDocketSlaBreached(row)) return 'RED';
  
  const dueAt = row?.slaDueDate || row?.slaDueAt;
  if (dueAt) {
    const due = new Date(dueAt).getTime();
    if (Number.isFinite(due) && (due - Date.now()) < (24 * 60 * 60 * 1000)) return 'YELLOW';
  }
  return 'GREEN';
};

export const getDocketRecencyLabel = (updatedAt) => {
  if (!updatedAt) return null;
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffMins = diffMs / 60000;
  if (diffMins < 30) return 'Just updated';
  if (diffMins < 120) return 'Recently updated';
  return null;
};
