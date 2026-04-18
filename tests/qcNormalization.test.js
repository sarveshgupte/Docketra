#!/usr/bin/env node
const assert = require('assert');
const { getQcDecisionTransition } = require('../src/services/docketWorkflow.service');

(function run() {
  assert.strictEqual(
    getQcDecisionTransition('IN_QC', 'FAILED').state,
    'IN_PROGRESS'
  );

  assert.strictEqual(
    getQcDecisionTransition('IN_QC', 'PASSED').state,
    'RESOLVED'
  );

  assert.strictEqual(
    getQcDecisionTransition('IN_QC', 'CORRECTED').qcOutcome,
    'CORRECTED'
  );

  assert.throws(
    () => getQcDecisionTransition('IN_PROGRESS', 'FAILED'),
    (error) => error && error.message === 'QC can only be performed when docket is in QC state'
  );

  console.log('✓ qc normalization transitions');
})();
