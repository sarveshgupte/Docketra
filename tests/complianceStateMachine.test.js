const assert = require('assert');
const {
  COMPLIANCE_STATES,
  normalizeComplianceState,
  canComplianceTransition,
} = require('../src/domain/compliance/complianceStateMachine');

(() => {
  assert.strictEqual(normalizeComplianceState('IN_PROGRESS'), COMPLIANCE_STATES.IN_PROGRESS);
  assert.strictEqual(normalizeComplianceState('awaiting_partner'), COMPLIANCE_STATES.AWAITING_PARTNER);
  assert.strictEqual(normalizeComplianceState('unknown'), null);

  assert.strictEqual(canComplianceTransition(COMPLIANCE_STATES.NOT_STARTED, COMPLIANCE_STATES.IN_PROGRESS), true);
  assert.strictEqual(canComplianceTransition(COMPLIANCE_STATES.IN_PROGRESS, COMPLIANCE_STATES.READY_TO_FILE), true);
  assert.strictEqual(canComplianceTransition(COMPLIANCE_STATES.READY_TO_FILE, COMPLIANCE_STATES.FILED), true);
  assert.strictEqual(canComplianceTransition(COMPLIANCE_STATES.FILED, COMPLIANCE_STATES.CLOSED), true);

  assert.strictEqual(canComplianceTransition(COMPLIANCE_STATES.FILED, COMPLIANCE_STATES.IN_PROGRESS), false);
  assert.strictEqual(canComplianceTransition(COMPLIANCE_STATES.CLOSED, COMPLIANCE_STATES.IN_PROGRESS), false);
  assert.strictEqual(canComplianceTransition(COMPLIANCE_STATES.BLOCKED, COMPLIANCE_STATES.BLOCKED), false);

  console.log('complianceStateMachine.test.js passed');
})();

