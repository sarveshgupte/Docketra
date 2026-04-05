const LEGACY_TO_CANONICAL = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING: 'IN_PROGRESS',
  PENDED: 'IN_PROGRESS',
  QC_PENDING: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  FILED: 'CLOSED',
  CLOSED: 'CLOSED',
};

export const normalizeLifecycle = (lifecycle) => {
  const key = String(lifecycle || '').trim().toUpperCase();
  return LEGACY_TO_CANONICAL[key] || 'OPEN';
};
