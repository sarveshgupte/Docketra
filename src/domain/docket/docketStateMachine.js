const CaseStatus = require('../case/caseStatus');

const DocketState = Object.freeze({
  WB: 'WB',
  WL: 'WL',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDED: 'PENDED',
  FILED: 'FILED',
  RESOLVED: 'RESOLVED',
});

const allowedTransitions = Object.freeze({
  [DocketState.WB]: Object.freeze([DocketState.WL]),
  [DocketState.WL]: Object.freeze([DocketState.ASSIGNED]),
  [DocketState.ASSIGNED]: Object.freeze([DocketState.IN_PROGRESS]),
  [DocketState.IN_PROGRESS]: Object.freeze([DocketState.PENDED, DocketState.FILED, DocketState.RESOLVED]),
  [DocketState.PENDED]: Object.freeze([DocketState.IN_PROGRESS]),
  [DocketState.FILED]: Object.freeze([]),
  [DocketState.RESOLVED]: Object.freeze([]),
});

const persistenceToDocket = Object.freeze({
  [CaseStatus.UNASSIGNED]: DocketState.WB,
  [CaseStatus.OPEN]: DocketState.WL,
  [CaseStatus.ASSIGNED]: DocketState.ASSIGNED,
  [CaseStatus.IN_PROGRESS]: DocketState.IN_PROGRESS,
  [CaseStatus.PENDED]: DocketState.PENDED,
  [CaseStatus.FILED]: DocketState.FILED,
  [CaseStatus.RESOLVED]: DocketState.RESOLVED,
  [CaseStatus.PENDING_ALIAS]: DocketState.PENDED,
  [CaseStatus.PENDING_LEGACY]: DocketState.PENDED,
  [CaseStatus.OPEN_LEGACY]: DocketState.WL,
  [CaseStatus.FILED_LEGACY]: DocketState.FILED,
});

const docketToPersistence = Object.freeze({
  [DocketState.WB]: CaseStatus.UNASSIGNED,
  [DocketState.WL]: CaseStatus.OPEN,
  [DocketState.ASSIGNED]: CaseStatus.ASSIGNED,
  [DocketState.IN_PROGRESS]: CaseStatus.IN_PROGRESS,
  [DocketState.PENDED]: CaseStatus.PENDED,
  [DocketState.FILED]: CaseStatus.FILED,
  [DocketState.RESOLVED]: CaseStatus.RESOLVED,
});

function toDocketState(state) {
  return persistenceToDocket[state] || state;
}

function toPersistenceState(state) {
  return docketToPersistence[state] || state;
}

function assertValidDocketTransition(fromState, toState) {
  const from = toDocketState(fromState);
  const to = toDocketState(toState);
  const allowed = allowedTransitions[from] || [];
  if (allowed.includes(to)) {
    return true;
  }

  const error = new Error(`Invalid docket state transition: ${from || 'UNKNOWN'} -> ${to || 'UNKNOWN'}`);
  error.code = 'INVALID_DOCKET_TRANSITION';
  error.statusCode = 400;
  throw error;
}

module.exports = {
  DocketState,
  allowedTransitions,
  toDocketState,
  toPersistenceState,
  assertValidDocketTransition,
};
