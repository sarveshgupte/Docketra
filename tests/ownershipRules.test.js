#!/usr/bin/env node
const assert = require('assert');
const {
  enforceOwnershipRules,
  validateOwnershipRules,
} = require('../src/services/docketWorkflow.service');

(function run() {
  assert.throws(
    () => validateOwnershipRules({ state: 'IN_PROGRESS', assignedToXID: null }),
    (error) => error && error.message === 'Active/QC docket must have owner'
  );

  assert.throws(
    () => validateOwnershipRules({ state: 'IN_QC', assignedToXID: null }),
    (error) => error && error.message === 'Active/QC docket must have owner'
  );

  const normalizedWorkbench = enforceOwnershipRules({
    state: 'IN_WB',
    assignedToXID: 'USER1',
    assignedTo: '507f1f77bcf86cd799439011',
    queueType: 'PERSONAL',
    qcOutcome: 'FAILED',
  });
  assert.strictEqual(normalizedWorkbench.assignedToXID, null);
  assert.strictEqual(normalizedWorkbench.assignedTo, null);
  assert.strictEqual(normalizedWorkbench.queueType, 'GLOBAL');

  assert.throws(
    () => enforceOwnershipRules({ state: 'IN_PROGRESS', assignedToXID: null }),
    (error) => error && error.message === 'IN_PROGRESS docket must have an owner'
  );

  const normalizedWorklist = enforceOwnershipRules({
    state: 'IN_PROGRESS',
    assignedToXID: 'USER1',
    queueType: 'GLOBAL',
  });
  assert.strictEqual(normalizedWorklist.queueType, 'PERSONAL');

  const qcValid = enforceOwnershipRules({
    state: 'IN_QC',
    assignedToXID: 'USER1',
  });
  assert.strictEqual(qcValid.assignedToXID, 'USER1');

  console.log('✓ ownership rules enforced');
})();
