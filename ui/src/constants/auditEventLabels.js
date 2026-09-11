const DEFAULT_AUDIT_ACTION = 'DOCKET_UPDATED';

export const AUDIT_ACTION_LABELS = Object.freeze({
  DOCK_EXITED: 'Exited docket view',
  DOCKET_EXITED: 'Exited docket view',
  DOCKET_OPENED: 'Opened docket view',
  DOCKET_VIEWED: 'Viewed docket',
  DOCK_VIEWED: 'Viewed docket',
  CASE_PULLED: 'Docket pulled for review',
  CASE_CREATED: 'New docket created',
  DOCKET_CREATED: 'New docket created',
  CASE_UPDATED: 'Docket updated',
  DOCKET_UPDATED: 'Docket updated',
  STATUS_CHANGED: 'Status changed',
  CASE_CLOSED: 'Docket closed',
  PENDING_REOPEN: 'Reopened to Workbench',
  CASE_ASSIGNED: 'Docket assigned',
  CASE_UNASSIGNED: 'Moved to global worklist',
  CASE_PENDED: 'Docket pended',
  CASE_UNPENDED: 'Docket unpended',
  CASE_REOPENED: 'Docket reopened',
  CASE_RESOLVED: 'Docket resolved',
  CASE_FILED: 'Docket filed / completed',
  CASE_MOVED_TO_WORKBASKET: 'Moved to workbasket',
  CASE_CLONED: 'Cloned new docket',
  CLONED_FROM_OLD_DOCKET: 'Cloned from historical docket',
  CASE_VIEWED_BY_ADMIN: 'Admin viewed docket',
  CASE_ACCESSED_BY_SUPERADMIN: 'Superadmin accessed docket',
  CASE_COMMENT_ADDED: 'Comment added',
  CASE_FILE_ATTACHED: 'File attached',
  CASE_ATTACHMENT_ADDED: 'File attached',
});

export const normalizeAuditAction = (event = {}) => String(
  event?.actionType || event?.action || DEFAULT_AUDIT_ACTION
).trim().toUpperCase() || DEFAULT_AUDIT_ACTION;

export const getAuditActionLabel = (event = {}) => {
  if (event?.actionLabel) return event.actionLabel;
  const action = normalizeAuditAction(event);
  return AUDIT_ACTION_LABELS[action] || action;
};
