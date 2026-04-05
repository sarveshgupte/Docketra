const DocketLifecycle = Object.freeze({
  CREATED: 'created',
  IN_WORKLIST: 'in_worklist',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
});

const AllowedTransitions = Object.freeze({
  [DocketLifecycle.CREATED]: Object.freeze([DocketLifecycle.IN_WORKLIST]),
  [DocketLifecycle.IN_WORKLIST]: Object.freeze([DocketLifecycle.ACTIVE]),
  [DocketLifecycle.ACTIVE]: Object.freeze([DocketLifecycle.COMPLETED]),
  [DocketLifecycle.COMPLETED]: Object.freeze([DocketLifecycle.ARCHIVED]),
  [DocketLifecycle.ARCHIVED]: Object.freeze([]),
});

function normalizeLifecycle(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return DocketLifecycle.CREATED;
  if (!AllowedTransitions[normalized]) {
    const error = new Error(`Unknown docket lifecycle state: ${value}`);
    error.statusCode = 400;
    error.code = 'INVALID_DOCKET_LIFECYCLE';
    throw error;
  }
  return normalized;
}

function lifecycleRequiresAssignment(lifecycle) {
  const normalized = normalizeLifecycle(lifecycle);
  return [
    DocketLifecycle.IN_WORKLIST,
    DocketLifecycle.ACTIVE,
    DocketLifecycle.COMPLETED,
    DocketLifecycle.ARCHIVED,
  ].includes(normalized);
}

function assertValidLifecycleTransition(fromState, toState) {
  const from = normalizeLifecycle(fromState);
  const to = normalizeLifecycle(toState);
  const allowed = AllowedTransitions[from] || [];
  if (allowed.includes(to)) return true;

  const error = new Error(`Invalid docket lifecycle transition: ${from} -> ${to}`);
  error.statusCode = 400;
  error.code = 'INVALID_DOCKET_LIFECYCLE_TRANSITION';
  throw error;
}

module.exports = {
  DocketLifecycle,
  AllowedTransitions,
  normalizeLifecycle,
  lifecycleRequiresAssignment,
  assertValidLifecycleTransition,
};
