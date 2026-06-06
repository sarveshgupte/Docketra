import { CASE_STATUS } from './constants';

export const isDocketSlaBreached = (row = {}) => {
  if (!row?.slaDueDate) return false;
  if (row.status === CASE_STATUS.RESOLVED || row.status === CASE_STATUS.FILED) return false;
  return new Date(row.slaDueDate) < new Date();
};

export const isDocketDueToday = (row = {}) => {
  if (!row?.slaDueDate) return false;
  const due = new Date(row.slaDueDate);
  const now = new Date();
  return due.getFullYear() === now.getFullYear()
    && due.getMonth() === now.getMonth()
    && due.getDate() === now.getDate();
};

export const getDocketSlaBadgeStatus = (row = {}) => {
  if (row?.slaStatus) return String(row.slaStatus).toUpperCase();
  if (isDocketSlaBreached(row)) return 'RED';
  if (row?.slaDueDate) {
    const due = new Date(row.slaDueDate).getTime();
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
