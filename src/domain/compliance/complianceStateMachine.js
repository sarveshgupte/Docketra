const COMPLIANCE_STATES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  AWAITING_CLIENT: 'awaiting_client',
  AWAITING_PARTNER: 'awaiting_partner',
  READY_TO_FILE: 'ready_to_file',
  FILED: 'filed',
  BLOCKED: 'blocked',
  CLOSED: 'closed',
});

const TRANSITIONS = Object.freeze({
  [COMPLIANCE_STATES.NOT_STARTED]: Object.freeze([
    COMPLIANCE_STATES.IN_PROGRESS,
    COMPLIANCE_STATES.AWAITING_CLIENT,
    COMPLIANCE_STATES.BLOCKED,
    COMPLIANCE_STATES.CLOSED,
  ]),
  [COMPLIANCE_STATES.IN_PROGRESS]: Object.freeze([
    COMPLIANCE_STATES.AWAITING_CLIENT,
    COMPLIANCE_STATES.AWAITING_PARTNER,
    COMPLIANCE_STATES.READY_TO_FILE,
    COMPLIANCE_STATES.BLOCKED,
    COMPLIANCE_STATES.CLOSED,
  ]),
  [COMPLIANCE_STATES.AWAITING_CLIENT]: Object.freeze([
    COMPLIANCE_STATES.IN_PROGRESS,
    COMPLIANCE_STATES.BLOCKED,
    COMPLIANCE_STATES.CLOSED,
  ]),
  [COMPLIANCE_STATES.AWAITING_PARTNER]: Object.freeze([
    COMPLIANCE_STATES.IN_PROGRESS,
    COMPLIANCE_STATES.READY_TO_FILE,
    COMPLIANCE_STATES.BLOCKED,
    COMPLIANCE_STATES.CLOSED,
  ]),
  [COMPLIANCE_STATES.READY_TO_FILE]: Object.freeze([
    COMPLIANCE_STATES.FILED,
    COMPLIANCE_STATES.BLOCKED,
    COMPLIANCE_STATES.CLOSED,
  ]),
  [COMPLIANCE_STATES.FILED]: Object.freeze([
    COMPLIANCE_STATES.CLOSED,
  ]),
  [COMPLIANCE_STATES.BLOCKED]: Object.freeze([
    COMPLIANCE_STATES.IN_PROGRESS,
    COMPLIANCE_STATES.AWAITING_CLIENT,
    COMPLIANCE_STATES.AWAITING_PARTNER,
    COMPLIANCE_STATES.READY_TO_FILE,
    COMPLIANCE_STATES.CLOSED,
  ]),
  [COMPLIANCE_STATES.CLOSED]: Object.freeze([]),
});

const normalizeComplianceState = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.values(COMPLIANCE_STATES).includes(normalized) ? normalized : null;
};

const canComplianceTransition = (fromState, toState) => {
  const from = normalizeComplianceState(fromState);
  const to = normalizeComplianceState(toState);
  if (!from || !to || from === to) return false;
  return (TRANSITIONS[from] || []).includes(to);
};

module.exports = {
  COMPLIANCE_STATES,
  normalizeComplianceState,
  canComplianceTransition,
};

