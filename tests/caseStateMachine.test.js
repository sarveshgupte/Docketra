#!/usr/bin/env node
const assert = require('assert');
const { canTransition, normalizeStatus } = require('../src/domain/case/caseStateMachine');
const CaseStatus = require('../src/domain/case/caseStatus');

function testValidTransitions() {
  assert.strictEqual(canTransition(CaseStatus.OPEN, CaseStatus.FILED), true);
  assert.strictEqual(canTransition(CaseStatus.OPEN, CaseStatus.PENDED), true);
  assert.strictEqual(canTransition(CaseStatus.OPEN, CaseStatus.RESOLVED), true);
  assert.strictEqual(canTransition(CaseStatus.PENDED, CaseStatus.OPEN), true);
  assert.strictEqual(canTransition(CaseStatus.FILED, CaseStatus.RESOLVED), true);
  assert.strictEqual(canTransition(CaseStatus.UNASSIGNED, CaseStatus.OPEN), true);
  assert.strictEqual(canTransition(CaseStatus.PENDING, CaseStatus.OPEN), true);
}

function testInvalidTransitions() {
  assert.strictEqual(canTransition(CaseStatus.RESOLVED, CaseStatus.OPEN), false);
  assert.strictEqual(canTransition(CaseStatus.RESOLVED, CaseStatus.FILED), false);
  assert.strictEqual(canTransition(CaseStatus.FILED, CaseStatus.OPEN), false);
  assert.strictEqual(canTransition(CaseStatus.PENDED, CaseStatus.RESOLVED), false);
  assert.strictEqual(canTransition(CaseStatus.OPEN, CaseStatus.OPEN), false);
  assert.strictEqual(canTransition('INVALID_STATUS', CaseStatus.OPEN), false);
  assert.strictEqual(normalizeStatus('Pending'), CaseStatus.PENDED);
}

function run() {
  try {
    testValidTransitions();
    testInvalidTransitions();
    console.log('Case state machine transition tests passed.');
  } catch (err) {
    console.error('Case state machine transition tests failed:', err);
    process.exit(1);
  }
}

run();
