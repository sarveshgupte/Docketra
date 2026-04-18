const ALLOWED_TRANSITIONS = Object.freeze({
  IN_WB: Object.freeze(['IN_PROGRESS']),
  IN_PROGRESS: Object.freeze(['IN_QC', 'PENDED', 'RESOLVED']),
  PENDED: Object.freeze(['IN_PROGRESS']),
  IN_QC: Object.freeze(['RESOLVED', 'IN_PROGRESS']),
  RESOLVED: Object.freeze([]),
  FILED: Object.freeze([]),
});

function normalize(state) {
  return String(state || '').trim().toUpperCase();
}

function canTransition(from, to) {
  const fromState = normalize(from);
  const toState = normalize(to);
  const allowed = ALLOWED_TRANSITIONS[fromState] || [];
  return allowed.includes(toState);
}

function canResolve(state) {
  const normalized = normalize(state);
  return normalized === 'IN_PROGRESS' || normalized === 'IN_QC';
}

function canFile(_state) {
  return true;
}

module.exports = {
  ALLOWED_TRANSITIONS,
  canTransition,
  canResolve,
  canFile,
};
