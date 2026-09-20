const DocketStatus = require('./docketStatus');

const allowedTransitions = Object.freeze({
  [DocketStatus.AVAILABLE]: Object.freeze([DocketStatus.ASSIGNED, DocketStatus.ROUTED]),
  [DocketStatus.ROUTED]: Object.freeze([DocketStatus.ASSIGNED, DocketStatus.ROUTED_ASSIGNED]),
  [DocketStatus.ROUTED_ASSIGNED]: Object.freeze([
    DocketStatus.PENDING,
    DocketStatus.QC_PENDING,
    DocketStatus.RESOLVED,
    DocketStatus.FILED,
  ]),
  [DocketStatus.ASSIGNED]: Object.freeze([
    DocketStatus.IN_PROGRESS,
    DocketStatus.PENDING,
    DocketStatus.QC_PENDING,
    DocketStatus.RESOLVED,
    DocketStatus.FILED,
  ]),
  [DocketStatus.IN_PROGRESS]: Object.freeze([
    DocketStatus.PENDING,
    DocketStatus.QC_PENDING,
    DocketStatus.RESOLVED,
    DocketStatus.FILED,
  ]),
  [DocketStatus.PENDING]: Object.freeze([
    DocketStatus.IN_PROGRESS,
    DocketStatus.OPEN,
    DocketStatus.READY_FOR_REVIEW,
    DocketStatus.COMPLETED,
    DocketStatus.ASSIGNED,
    DocketStatus.ROUTED,
    DocketStatus.ROUTED_ASSIGNED,
    DocketStatus.AVAILABLE,
  ]),
  [DocketStatus.PENDED]: Object.freeze([
    DocketStatus.IN_PROGRESS,
    DocketStatus.OPEN,
    DocketStatus.READY_FOR_REVIEW,
    DocketStatus.COMPLETED,
    DocketStatus.ASSIGNED,
    DocketStatus.ROUTED,
    DocketStatus.ROUTED_ASSIGNED,
    DocketStatus.AVAILABLE,
  ]),
  [DocketStatus.OPEN]: Object.freeze([
    DocketStatus.PENDING,
    DocketStatus.PENDED,
    DocketStatus.IN_PROGRESS,
    DocketStatus.QC_PENDING,
    DocketStatus.RESOLVED,
    DocketStatus.FILED,
  ]),
  [DocketStatus.READY_FOR_REVIEW]: Object.freeze([
    DocketStatus.IN_PROGRESS,
    DocketStatus.RESOLVED,
    DocketStatus.FILED,
  ]),
  [DocketStatus.COMPLETED]: Object.freeze([]),
  [DocketStatus.QC_PENDING]: Object.freeze([DocketStatus.ASSIGNED, DocketStatus.RESOLVED]),
  [DocketStatus.QC_FAILED]: Object.freeze([DocketStatus.IN_PROGRESS]),
  [DocketStatus.QC_CORRECTED]: Object.freeze([DocketStatus.RESOLVED]),
  [DocketStatus.CREATED]: Object.freeze([DocketStatus.AVAILABLE]),
  [DocketStatus.RESOLVED]: Object.freeze([]),
  [DocketStatus.FILED]: Object.freeze([]),
});

const persistenceToDocket = Object.freeze({
  UNASSIGNED: DocketStatus.AVAILABLE,
  OPEN: DocketStatus.OPEN,
  ASSIGNED: DocketStatus.ASSIGNED,
  IN_PROGRESS: DocketStatus.IN_PROGRESS,
  PENDING: DocketStatus.PENDING,
  PENDED: DocketStatus.PENDED,
  READY_FOR_REVIEW: DocketStatus.READY_FOR_REVIEW,
  COMPLETED: DocketStatus.COMPLETED,
  ROUTED: DocketStatus.ROUTED,
  ROUTED_ASSIGNED: DocketStatus.ROUTED_ASSIGNED,
  QC_PENDING: DocketStatus.QC_PENDING,
  QC_FAILED: DocketStatus.QC_FAILED,
  QC_CORRECTED: DocketStatus.QC_CORRECTED,
  RESOLVED: DocketStatus.RESOLVED,
  FILED: DocketStatus.FILED,
  Open: DocketStatus.OPEN,
  Pending: DocketStatus.PENDING,
  Pended: DocketStatus.PENDED,
  Filed: DocketStatus.FILED,
});

const docketToPersistence = Object.freeze({
  [DocketStatus.CREATED]: 'UNASSIGNED',
  [DocketStatus.AVAILABLE]: 'UNASSIGNED',
  [DocketStatus.ASSIGNED]: 'ASSIGNED',
  [DocketStatus.OPEN]: 'OPEN',
  [DocketStatus.READY_FOR_REVIEW]: 'READY_FOR_REVIEW',
  [DocketStatus.COMPLETED]: 'COMPLETED',
  [DocketStatus.ROUTED]: 'ROUTED',
  [DocketStatus.ROUTED_ASSIGNED]: 'ROUTED_ASSIGNED',
  [DocketStatus.IN_PROGRESS]: 'IN_PROGRESS',
  [DocketStatus.PENDING]: 'PENDING',
  [DocketStatus.PENDED]: 'PENDED',
  [DocketStatus.QC_PENDING]: 'QC_PENDING',
  [DocketStatus.QC_FAILED]: 'QC_FAILED',
  [DocketStatus.QC_CORRECTED]: 'QC_CORRECTED',
  [DocketStatus.RESOLVED]: 'RESOLVED',
  [DocketStatus.FILED]: 'FILED',
});

function toDocketState(state) {
  if (!state) return state;
  return persistenceToDocket[state] || state;
}

function toPersistenceState(state) {
  if (!state) return state;
  return docketToPersistence[state] || state;
}

function assertValidDocketTransition(fromState, toState) {
  const from = toDocketState(fromState);
  const to = toDocketState(toState);
  const allowed = allowedTransitions[from] || [];

  if (allowed.includes(to)) return true;

  const error = new Error(`Invalid docket state transition: ${from || 'UNKNOWN'} -> ${to || 'UNKNOWN'}`);
  error.code = 'INVALID_DOCKET_TRANSITION';
  error.statusCode = 400;
  throw error;
}

function transitionToPended(docket, { reason, autoReopenAt, pendedReason, comment } = {}) {
  const pReason = reason || pendedReason || comment;
  if (!pReason || !String(pReason).trim()) {
    const error = new Error('Pended reason is required when pending a docket');
    error.code = 'PENDED_REASON_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const currentStatus = docket.status || 'IN_PROGRESS';
  const statusBeforePended = docket.statusBeforePended || (currentStatus !== 'PENDED' && currentStatus !== 'PENDING' ? currentStatus : (docket.previousStatus || 'IN_PROGRESS'));

  docket.statusBeforePended = statusBeforePended;
  docket.previousStatus = currentStatus;
  docket.pendedAt = new Date();
  docket.pendedReason = String(pReason).trim();
  docket.autoReopenAt = autoReopenAt ? new Date(autoReopenAt) : (docket.reopenAt || docket.pendingUntil || null);
  docket.reopenAt = docket.autoReopenAt;
  docket.pendingUntil = docket.autoReopenAt;
  docket.status = 'PENDED';
  docket.state = 'PENDED';
  return docket;
}

function transitionFromPended(docket, { targetStatus, unpendNote } = {}) {
  const currentStatus = String(docket.status || '').toUpperCase();
  const currentState = String(docket.state || '').toUpperCase();
  if (currentStatus !== 'PENDED' && currentStatus !== 'PENDING' && currentState !== 'PENDED') {
    const error = new Error(`Docket is not in PENDED status (current status: ${docket.status})`);
    error.code = 'DOCKET_NOT_PENDED';
    error.statusCode = 400;
    throw error;
  }

  const resolvedTarget = targetStatus || docket.statusBeforePended || docket.previousStatus || (docket.assignedToXID ? 'IN_PROGRESS' : 'UNASSIGNED');
  assertValidDocketTransition(currentStatus, resolvedTarget);

  docket.statusBeforePended = null;
  docket.pendedAt = null;
  docket.pendedReason = null;
  docket.autoReopenAt = null;
  docket.pendingUntil = null;
  docket.reopenAt = null;
  docket.unpendedAt = new Date();
  docket.status = resolvedTarget;
  docket.state = resolvedTarget === 'OPEN' || resolvedTarget === 'IN_PROGRESS' || resolvedTarget === 'ASSIGNED' ? 'IN_PROGRESS' : (resolvedTarget === 'UNASSIGNED' || resolvedTarget === 'AVAILABLE' ? 'IN_WB' : resolvedTarget);
  return docket;
}

module.exports = {
  DocketStatus,
  allowedTransitions,
  toDocketState,
  toPersistenceState,
  assertValidDocketTransition,
  transitionToPended,
  transitionFromPended,
};
