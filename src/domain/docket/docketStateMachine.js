const DocketStatus = require('./docketStatus');

const allowedTransitions = Object.freeze({
  [DocketStatus.AVAILABLE]: Object.freeze([DocketStatus.ASSIGNED]),
  [DocketStatus.ASSIGNED]: Object.freeze([DocketStatus.IN_PROGRESS]),
  [DocketStatus.IN_PROGRESS]: Object.freeze([
    DocketStatus.PENDING,
    DocketStatus.QC_PENDING,
    DocketStatus.RESOLVED,
    DocketStatus.FILED,
  ]),
  [DocketStatus.PENDING]: Object.freeze([DocketStatus.IN_PROGRESS]),
  [DocketStatus.QC_PENDING]: Object.freeze([DocketStatus.ASSIGNED, DocketStatus.RESOLVED]),
  [DocketStatus.QC_FAILED]: Object.freeze([DocketStatus.IN_PROGRESS]),
  [DocketStatus.QC_CORRECTED]: Object.freeze([DocketStatus.RESOLVED]),
  [DocketStatus.CREATED]: Object.freeze([DocketStatus.AVAILABLE]),
  [DocketStatus.RESOLVED]: Object.freeze([]),
  [DocketStatus.FILED]: Object.freeze([]),
});

const persistenceToDocket = Object.freeze({
  UNASSIGNED: DocketStatus.AVAILABLE,
  OPEN: DocketStatus.ASSIGNED,
  ASSIGNED: DocketStatus.ASSIGNED,
  IN_PROGRESS: DocketStatus.IN_PROGRESS,
  PENDING: DocketStatus.PENDING,
  QC_PENDING: DocketStatus.QC_PENDING,
  QC_FAILED: DocketStatus.QC_FAILED,
  QC_CORRECTED: DocketStatus.QC_CORRECTED,
  RESOLVED: DocketStatus.RESOLVED,
  FILED: DocketStatus.FILED,
  Open: DocketStatus.ASSIGNED,
  Pending: DocketStatus.PENDING,
  Filed: DocketStatus.FILED,
});

const docketToPersistence = Object.freeze({
  [DocketStatus.CREATED]: 'UNASSIGNED',
  [DocketStatus.AVAILABLE]: 'UNASSIGNED',
  [DocketStatus.ASSIGNED]: 'ASSIGNED',
  [DocketStatus.IN_PROGRESS]: 'IN_PROGRESS',
  [DocketStatus.PENDING]: 'PENDING',
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

module.exports = {
  DocketStatus,
  allowedTransitions,
  toDocketState,
  toPersistenceState,
  assertValidDocketTransition,
};
