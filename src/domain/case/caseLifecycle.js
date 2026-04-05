const CASE_LIFECYCLE = Object.freeze({
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW: 'REVIEW',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
});

const deriveLifecycle = ({ status, assignedToXID, lifecycle }) => {
  const explicitLifecycle = String(lifecycle || '').toUpperCase();
  if (Object.values(CASE_LIFECYCLE).includes(explicitLifecycle)) {
    return explicitLifecycle;
  }

  const normalizedStatus = String(status || '').toUpperCase();

  if (['FILED', 'ARCHIVED'].includes(normalizedStatus)) return CASE_LIFECYCLE.ARCHIVED;
  if (['RESOLVED', 'CLOSED'].includes(normalizedStatus)) return CASE_LIFECYCLE.COMPLETED;
  if (['QC_PENDING', 'UNDER_REVIEW', 'REVIEWED'].includes(normalizedStatus)) return CASE_LIFECYCLE.REVIEW;
  if (['IN_PROGRESS', 'OPEN', 'PENDING', 'QC_FAILED', 'QC_CORRECTED'].includes(normalizedStatus)) return CASE_LIFECYCLE.IN_PROGRESS;
  if (['ASSIGNED'].includes(normalizedStatus)) return CASE_LIFECYCLE.ASSIGNED;

  return assignedToXID ? CASE_LIFECYCLE.ASSIGNED : CASE_LIFECYCLE.CREATED;
};

module.exports = {
  CASE_LIFECYCLE,
  deriveLifecycle,
};
