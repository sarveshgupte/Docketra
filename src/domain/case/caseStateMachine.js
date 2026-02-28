const CaseStatus = require('./caseStatus');

const STATUS_ALIASES = Object.freeze({
  [CaseStatus.PENDING_ALIAS]: CaseStatus.PENDED,
  [CaseStatus.PENDING_LEGACY]: CaseStatus.PENDED,
  [CaseStatus.OPEN_LEGACY]: CaseStatus.OPEN,
  [CaseStatus.FILED_LEGACY]: CaseStatus.FILED,
});

function normalizeStatus(status) {
  return STATUS_ALIASES[status] || status;
}

const transitions = Object.freeze({
  [CaseStatus.UNASSIGNED]: Object.freeze([
    CaseStatus.OPEN,
    CaseStatus.PENDED,
    CaseStatus.FILED,
    CaseStatus.RESOLVED,
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
});

function canTransition(from, to, _role = null) {
  const normalizedFrom = normalizeStatus(from);
  const normalizedTo = normalizeStatus(to);
  if (!transitions[normalizedFrom]) return false;
  return transitions[normalizedFrom].includes(normalizedTo);
}

module.exports = {
  transitions,
  normalizeStatus,
  canTransition,
};
