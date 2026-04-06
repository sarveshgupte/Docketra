const CaseStatus = require('./case/caseStatus');
const { normalizeStatus } = require('./case/caseStateMachine');

const STATES = Object.freeze(['WL', 'ACTIVE', 'WAITING', 'DONE']);

const TRANSITIONS = Object.freeze({
  WL: Object.freeze(['ACTIVE']),
  ACTIVE: Object.freeze(['WAITING', 'DONE']),
  WAITING: Object.freeze(['ACTIVE']),
  DONE: Object.freeze([]),
});

const DocketLifecycle = Object.freeze({
  WL: 'WL',
  ACTIVE: 'ACTIVE',
  WAITING: 'WAITING',
  DONE: 'DONE',
  // Backward-compatible aliases used across existing services/models.
  CREATED: 'WL',
  IN_WORKLIST: 'WL',
  COMPLETED: 'DONE',
  ARCHIVED: 'DONE',
});

const AllowedTransitions = TRANSITIONS;

const LEGACY_LIFECYCLE_TO_DOCKET = Object.freeze({
  ASSIGNED: DocketLifecycle.WL,
  IN_PROGRESS: DocketLifecycle.ACTIVE,
  REVIEW: DocketLifecycle.ACTIVE,
  CREATED: DocketLifecycle.WL,
  IN_WORKLIST: DocketLifecycle.WL,
  COMPLETED: DocketLifecycle.DONE,
  ARCHIVED: DocketLifecycle.DONE,
});

function isValidState(state) {
  return STATES.includes(String(state || '').trim().toUpperCase());
}

function isValidTransition(from, to) {
  const fromState = String(from || '').trim().toUpperCase();
  const toState = String(to || '').trim().toUpperCase();
  if (!isValidState(fromState) || !isValidState(toState)) return false;
  return TRANSITIONS[fromState].includes(toState);
}

function getNextStates(state) {
  const normalized = String(state || '').trim().toUpperCase();
  return TRANSITIONS[normalized] || [];
}

function toLifecycleFromStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();

  if (normalized === 'PENDING' || normalized === 'QC_PENDING') {
    return 'WAITING';
  }

  if (normalized === 'RESOLVED' || normalized === 'FILED' || normalized === 'CLOSED') {
    return 'DONE';
  }

  if (normalized === 'ASSIGNED') {
    return 'WL';
  }

  return 'ACTIVE';
}

function coerceLifecycleToDocket(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (isValidState(upper)) return upper;
  return LEGACY_LIFECYCLE_TO_DOCKET[upper] || null;
}

function deriveLifecycle({ lifecycle, assignedToXID, status } = {}) {
  const coerced = coerceLifecycleToDocket(lifecycle);
  if (coerced) return coerced;

  const ns = status != null && String(status).trim() !== '' ? normalizeStatus(status) : null;
  if (ns === CaseStatus.RESOLVED || ns === CaseStatus.CLOSED || ns === CaseStatus.FILED) {
    return DocketLifecycle.DONE;
  }

  if (!assignedToXID) {
    return DocketLifecycle.WL;
  }

  if (ns === CaseStatus.PENDING || ns === CaseStatus.QC_PENDING) {
    return DocketLifecycle.WAITING;
  }

  return DocketLifecycle.ACTIVE;
}

function normalizeLifecycle(value) {
  const normalized = coerceLifecycleToDocket(value);
  if (!normalized) {
    return DocketLifecycle.WL;
  }
  return normalized;
}

function lifecycleRequiresAssignment(lifecycle) {
  const normalized = normalizeLifecycle(lifecycle);
  return normalized !== DocketLifecycle.WL;
}

function assertValidLifecycleTransition(fromState, toState) {
  const from = normalizeLifecycle(fromState);
  const to = normalizeLifecycle(toState);
  if (from === to) return true;
  if (isValidTransition(from, to)) return true;

  const error = new Error(`Invalid docket lifecycle transition: ${from} -> ${to}`);
  error.statusCode = 400;
  error.code = 'INVALID_DOCKET_LIFECYCLE_TRANSITION';
  throw error;
}

module.exports = {
  STATES,
  TRANSITIONS,
  isValidState,
  isValidTransition,
  getNextStates,
  toLifecycleFromStatus,
  DocketLifecycle,
  AllowedTransitions,
  coerceLifecycleToDocket,
  deriveLifecycle,
  normalizeLifecycle,
  lifecycleRequiresAssignment,
  assertValidLifecycleTransition,
};
