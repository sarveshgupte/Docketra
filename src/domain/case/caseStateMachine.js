const CaseStatus = require('./caseStatus');

const STATUS_ALIASES = Object.freeze({
  [CaseStatus.PENDING_ALIAS]: CaseStatus.PENDED,
  [CaseStatus.PENDING_LEGACY]: CaseStatus.PENDED,
  [CaseStatus.OPEN_LEGACY]: CaseStatus.OPEN,
  [CaseStatus.FILED_LEGACY]: CaseStatus.FILED,
  [CaseStatus.REVIEWED]: CaseStatus.UNDER_REVIEW,
  [CaseStatus.ARCHIVED]: CaseStatus.CLOSED,
});

function normalizeStatus(status) {
  return STATUS_ALIASES[status] || status;
}

const transitions = Object.freeze({
  [CaseStatus.UNASSIGNED]: Object.freeze([
    CaseStatus.OPEN,
    CaseStatus.DRAFT,
  ]),
  [CaseStatus.DRAFT]: Object.freeze([
    CaseStatus.SUBMITTED,
  ]),
  [CaseStatus.SUBMITTED]: Object.freeze([
    CaseStatus.UNDER_REVIEW,
    CaseStatus.REJECTED,
  ]),
  [CaseStatus.UNDER_REVIEW]: Object.freeze([
    CaseStatus.APPROVED,
    CaseStatus.REJECTED,
  ]),
  [CaseStatus.REJECTED]: Object.freeze([
    CaseStatus.DRAFT,
    CaseStatus.CLOSED,
  ]),
  [CaseStatus.APPROVED]: Object.freeze([
    CaseStatus.OPEN,
  ]),
  [CaseStatus.OPEN]: Object.freeze([
    CaseStatus.PENDED,
    CaseStatus.FILED,
    CaseStatus.RESOLVED,
  ]),
  [CaseStatus.PENDED]: Object.freeze([
    CaseStatus.OPEN,
    CaseStatus.FILED,
  ]),
  [CaseStatus.FILED]: Object.freeze([
    CaseStatus.RESOLVED,
  ]),
  [CaseStatus.RESOLVED]: Object.freeze([]),
  [CaseStatus.CLOSED]: Object.freeze([]),
});

const CASE_STATUSES = Object.freeze({
  UNASSIGNED: CaseStatus.UNASSIGNED,
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: CaseStatus.RESOLVED,
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [CASE_STATUSES.UNASSIGNED]: Object.freeze([CASE_STATUSES.ASSIGNED]),
  [CASE_STATUSES.ASSIGNED]: Object.freeze([CASE_STATUSES.IN_PROGRESS]),
  [CASE_STATUSES.IN_PROGRESS]: Object.freeze([CASE_STATUSES.RESOLVED]),
  [CASE_STATUSES.RESOLVED]: Object.freeze([]),
});

function canTransition(from, to, _role = null) {
  const normalizedFrom = normalizeStatus(from);
  const normalizedTo = normalizeStatus(to);
  if (!transitions[normalizedFrom]) return false;
  return transitions[normalizedFrom].includes(normalizedTo);
}

function assertValidTransition(from, to) {
  const allowedNextStatuses = ALLOWED_TRANSITIONS[from] || [];
  if (allowedNextStatuses.includes(to)) {
    return true;
  }

  const error = new Error(`Invalid case transition: ${from || 'UNKNOWN'} -> ${to || 'UNKNOWN'}`);
  error.code = 'INVALID_CASE_TRANSITION';
  error.statusCode = 400;
  throw error;
}

module.exports = {
  transitions,
  CASE_STATUSES,
  ALLOWED_TRANSITIONS,
  normalizeStatus,
  canTransition,
  assertValidTransition,
};
