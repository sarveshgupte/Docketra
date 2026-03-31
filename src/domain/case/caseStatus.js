const CaseStatus = Object.freeze({
  UNASSIGNED: 'UNASSIGNED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  OPEN: 'OPEN',
  PENDING: 'PENDING',
  // TODO(docket-lifecycle): remove legacy PENDED alias after data migration.
  PENDED: 'PENDING',
  RESOLVED: 'RESOLVED',
  FILED: 'FILED',
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
  REVIEWED: 'Reviewed',
  OPEN_LEGACY: 'Open',
  PENDING_LEGACY: 'Pending',
  FILED_LEGACY: 'Filed',
  ARCHIVED: 'Archived',
});

module.exports = CaseStatus;
