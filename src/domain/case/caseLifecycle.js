const { DocketLifecycle } = require('../docketLifecycle');

const CASE_LIFECYCLE = Object.freeze({
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW: 'REVIEW',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
});

const LEGAL_DOCKET_LIFECYCLES = Object.freeze(Object.values(DocketLifecycle));

const deriveLifecycle = ({ status, assignedToXID, lifecycle }) => {
  const explicitRaw = String(lifecycle || '').trim();
  const explicitLifecycle = explicitRaw.toUpperCase();
  const explicitDocketLifecycle = explicitRaw.toLowerCase();

  if (LEGAL_DOCKET_LIFECYCLES.includes(explicitDocketLifecycle)) {
    return explicitDocketLifecycle;
  }

  if (Object.values(CASE_LIFECYCLE).includes(explicitLifecycle)) {
    return explicitLifecycle;
  }

  const normalizedStatus = String(status || '').toUpperCase();

  if (['FILED', 'ARCHIVED'].includes(normalizedStatus)) return DocketLifecycle.ARCHIVED;
  if (['RESOLVED', 'CLOSED'].includes(normalizedStatus)) return DocketLifecycle.COMPLETED;
  if (['ASSIGNED'].includes(normalizedStatus)) return DocketLifecycle.IN_WORKLIST;
  if (['IN_PROGRESS', 'OPEN', 'PENDING', 'QC_FAILED', 'QC_CORRECTED', 'QC_PENDING'].includes(normalizedStatus)) return DocketLifecycle.ACTIVE;

  return assignedToXID ? DocketLifecycle.IN_WORKLIST : DocketLifecycle.CREATED;
};

module.exports = {
  CASE_LIFECYCLE,
  deriveLifecycle,
};
