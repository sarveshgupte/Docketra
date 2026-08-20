const CaseStatus = require('./caseStatus');

const STATUS_ALIASES = Object.freeze({
  [CaseStatus.PENDING_LEGACY]: 'PENDING',
  [CaseStatus.OPEN_LEGACY]: 'OPEN',
  [CaseStatus.FILED_LEGACY]: 'FILED',
  [CaseStatus.ARCHIVED]: 'FILED',
});

function normalizeStatus(status) {
  return STATUS_ALIASES[status] || status;
}

const transitions = Object.freeze({
  DRAFT: Object.freeze([
    'SUBMITTED',
  ]),
  SUBMITTED: Object.freeze([
    'UNDER_REVIEW',
    'REJECTED',
  ]),
  UNDER_REVIEW: Object.freeze([
    'APPROVED',
    'REJECTED',
  ]),
  REJECTED: Object.freeze([
    'DRAFT',
    'CLOSED',
  ]),
  APPROVED: Object.freeze([
    'OPEN',
  ]),
  UNASSIGNED: Object.freeze([
    'ASSIGNED',
    'ROUTED',
  ]),
  [CaseStatus.OPEN]: Object.freeze([
    CaseStatus.ASSIGNED,
    'IN_PROGRESS',
    'PENDING',
    CaseStatus.PEND,
    CaseStatus.RESOLVED,
    CaseStatus.FILED,
  ]),
  [CaseStatus.ASSIGNED]: Object.freeze([
    'IN_PROGRESS',
    CaseStatus.PEND,
    'PENDING',
    CaseStatus.ROUTED,
    CaseStatus.QC_WB,
    CaseStatus.RESOLVED,
    CaseStatus.FILED,
  ]),
  IN_PROGRESS: Object.freeze([
    'OPEN',
    'PENDING',
    CaseStatus.PEND,
    CaseStatus.FILED,
    CaseStatus.RESOLVED,
  ]),
  [CaseStatus.PEND]: Object.freeze([
    CaseStatus.OPEN,
    CaseStatus.ASSIGNED,
    'IN_PROGRESS',
  ]),
  PENDING: Object.freeze([
    CaseStatus.OPEN,
    CaseStatus.ASSIGNED,
    'IN_PROGRESS',
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
    'IN_PROGRESS',
  ]),
  [CaseStatus.QC_WB]: Object.freeze([
    CaseStatus.QC_ASSIGNED,
  ]),
  [CaseStatus.QC_ASSIGNED]: Object.freeze([
    CaseStatus.RESOLVED,
    CaseStatus.ASSIGNED,
    'IN_PROGRESS',
  ]),
  [CaseStatus.FILED]: Object.freeze([]),
  [CaseStatus.RESOLVED]: Object.freeze([]),
  CLOSED: Object.freeze([]),
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
