const DEFAULT_AUDIT_ACTION = 'CASE_UPDATED';

export const AUDIT_ACTION_LABELS = Object.freeze({
  DOCK_EXITED: 'Exited from system',
  CASE_PULLED: 'Docket pulled for review',
  DOCK_VIEWED: 'Viewed docket',
  CASE_CREATED: 'New docket created',
  CASE_UPDATED: 'Docket updated',
  STATUS_CHANGED: 'Status changed',
  CASE_CLOSED: 'Docket closed',
  PENDING_REOPEN: 'Reopened to Workbench',
});

export const normalizeAuditAction = (event = {}) => String(
  event?.actionType || event?.action || DEFAULT_AUDIT_ACTION
).trim().toUpperCase() || DEFAULT_AUDIT_ACTION;

export const getAuditActionLabel = (event = {}) => {
  const action = normalizeAuditAction(event);
  return AUDIT_ACTION_LABELS[action] || action;
};

