const LEGACY_TO_CANONICAL = {
  CREATED: 'CREATED',
  UNASSIGNED: 'CREATED',
  ASSIGNED: 'IN_WORKLIST',
  OPEN: 'ACTIVE',
  IN_PROGRESS: 'ACTIVE',
  PENDING: 'ACTIVE',
  PENDED: 'ACTIVE',
  QC_PENDING: 'ACTIVE',
  QC_FAILED: 'ACTIVE',
  QC_CORRECTED: 'ACTIVE',
  RESOLVED: 'COMPLETED',
  CLOSED: 'COMPLETED',
  FILED: 'ARCHIVED',
  ARCHIVED: 'ARCHIVED',
  created: 'CREATED',
  in_worklist: 'IN_WORKLIST',
  active: 'ACTIVE',
  completed: 'COMPLETED',
  archived: 'ARCHIVED',
};

export const normalizeLifecycle = (lifecycle) => {
  const key = String(lifecycle || '').trim();
  if (!key) return 'CREATED';
  return LEGACY_TO_CANONICAL[key] || 'CREATED';
};
