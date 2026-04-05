const CaseStatus = require('./case/caseStatus');
const { normalizeStatus } = require('./case/caseStateMachine');

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

/** Legacy lifecycle strings stored before DocketLifecycle was canonical. */
const LEGACY_LIFECYCLE_TO_DOCKET = Object.freeze({
  ASSIGNED: DocketLifecycle.IN_WORKLIST,
  IN_PROGRESS: DocketLifecycle.ACTIVE,
  REVIEW: DocketLifecycle.ACTIVE,
});

/**
 * Map stored lifecycle (canonical or legacy) to a DocketLifecycle value, or null if unknown/empty.
 */
function coerceLifecycleToDocket(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (AllowedTransitions[lower]) return lower;
  const mapped = LEGACY_LIFECYCLE_TO_DOCKET[raw.toUpperCase()];
  return mapped || null;
}

/**
 * Derive canonical DocketLifecycle from case fields.
 * When `lifecycle` is empty or unknown, uses optional workflow `status` (same rules as case updates),
 * then assignment: ASSIGNED → in_worklist; OPEN / IN_PROGRESS / PENDING / QC_* → active when assigned;
 * unassigned → created; RESOLVED/CLOSED → completed; FILED → archived.
 */
function deriveLifecycle({ lifecycle, assignedToXID, status } = {}) {
  const coerced = coerceLifecycleToDocket(lifecycle);
  if (coerced) return coerced;

  const ns =
    status != null && String(status).trim() !== '' ? normalizeStatus(status) : null;

  if (ns === CaseStatus.RESOLVED || ns === CaseStatus.CLOSED) {
    return DocketLifecycle.COMPLETED;
  }
  if (ns === CaseStatus.FILED) {
    return DocketLifecycle.ARCHIVED;
  }

  if (!assignedToXID) {
    return DocketLifecycle.CREATED;
  }

  if (ns === CaseStatus.ASSIGNED) {
    return DocketLifecycle.IN_WORKLIST;
  }
  if ([
    CaseStatus.IN_PROGRESS,
    CaseStatus.OPEN,
    CaseStatus.PENDING,
    CaseStatus.QC_PENDING,
    CaseStatus.QC_FAILED,
    CaseStatus.QC_CORRECTED,
  ].includes(ns)) {
    return DocketLifecycle.ACTIVE;
  }

  return DocketLifecycle.IN_WORKLIST;
}

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
  coerceLifecycleToDocket,
  deriveLifecycle,
  normalizeLifecycle,
  lifecycleRequiresAssignment,
  assertValidLifecycleTransition,
};
