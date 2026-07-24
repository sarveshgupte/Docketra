const CaseStatus = require('./caseStatus');

const STATUS_ALIASES = Object.freeze({
  PENDING: CaseStatus.PEND,
  IN_PROGRESS: CaseStatus.ASSIGNED,
  AVAILABLE: CaseStatus.OPEN,
  UNASSIGNED: CaseStatus.OPEN,
  QC_PENDING: CaseStatus.QC_WB,
  QC_FAILED: CaseStatus.QC_FAIL,
  [CaseStatus.PENDING_LEGACY]: CaseStatus.PEND,
  [CaseStatus.OPEN_LEGACY]: CaseStatus.OPEN,
  [CaseStatus.FILED_LEGACY]: CaseStatus.FILED,
  [CaseStatus.ARCHIVED]: CaseStatus.FILED,
});

function normalizeStatus(status) {
  return STATUS_ALIASES[status] || status;
}

const transitions = Object.freeze({
  [CaseStatus.OPEN]: Object.freeze([
    CaseStatus.ASSIGNED,
    CaseStatus.FILED,
  ]),
  [CaseStatus.ASSIGNED]: Object.freeze([
    CaseStatus.PEND,
    CaseStatus.ROUTED,
    CaseStatus.QC_WB,
    CaseStatus.RESOLVED,
    CaseStatus.FILED,
  ]),
  [CaseStatus.PEND]: Object.freeze([
    CaseStatus.ASSIGNED,
  ]),
  [CaseStatus.ROUTED]: Object.freeze([
    CaseStatus.ROUTED_ASSIGNED,
  ]),
  [CaseStatus.ROUTED_ASSIGNED]: Object.freeze([
    CaseStatus.ROUTED_PEND,
    CaseStatus.ROUTED_SUBMITTED,
  ]),
  [CaseStatus.ROUTED_PEND]: Object.freeze([
    CaseStatus.ROUTED_ASSIGNED,
  ]),
  [CaseStatus.ROUTED_SUBMITTED]: Object.freeze([
    CaseStatus.ASSIGNED,
  ]),
  [CaseStatus.QC_WB]: Object.freeze([
    CaseStatus.QC_ASSIGNED,
  ]),
  [CaseStatus.QC_ASSIGNED]: Object.freeze([
    CaseStatus.RESOLVED,
    CaseStatus.ASSIGNED,
  ]),
  [CaseStatus.FILED]: Object.freeze([]),
  [CaseStatus.RESOLVED]: Object.freeze([]),
});

function canTransition(from, to, _role = null) {
  const normalizedFrom = normalizeStatus(from);
  const normalizedTo = normalizeStatus(to);
  if (!transitions[normalizedFrom]) return false;
  return transitions[normalizedFrom].includes(normalizedTo);
}

function assertValidTransition(from, to) {
  const normalizedFrom = normalizeStatus(from);
  const normalizedTo = normalizeStatus(to);
  const allowedNextStatuses = transitions[normalizedFrom] || [];
  if (allowedNextStatuses.includes(normalizedTo)) {
    return true;
  }

  const error = new Error(`Invalid case transition: ${from || 'UNKNOWN'} -> ${to || 'UNKNOWN'}`);
  error.code = 'INVALID_CASE_TRANSITION';
  error.statusCode = 400;
  throw error;
}

module.exports = {
  transitions,
  normalizeStatus,
  canTransition,
  assertValidTransition,
};
