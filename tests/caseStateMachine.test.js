#!/usr/bin/env node
const assert = require('assert');
const { canTransition, normalizeStatus, assertValidTransition } = require('../src/domain/case/caseStateMachine');
const CaseStatus = require('../src/domain/case/caseStatus');

function testValidTransitions() {
  assert.strictEqual(canTransition(CaseStatus.DRAFT, CaseStatus.SUBMITTED), true);
  assert.strictEqual(canTransition(CaseStatus.SUBMITTED, CaseStatus.UNDER_REVIEW), true);
  assert.strictEqual(canTransition(CaseStatus.UNDER_REVIEW, CaseStatus.APPROVED), true);
  assert.strictEqual(canTransition(CaseStatus.APPROVED, CaseStatus.OPEN), true);
  assert.strictEqual(canTransition(CaseStatus.REJECTED, CaseStatus.DRAFT), true);
  assert.strictEqual(canTransition(CaseStatus.OPEN, CaseStatus.FILED), true);
  assert.strictEqual(canTransition(CaseStatus.OPEN, CaseStatus.PENDING), true);
  assert.strictEqual(canTransition(CaseStatus.OPEN, CaseStatus.RESOLVED), true);
  assert.strictEqual(canTransition(CaseStatus.PENDING, CaseStatus.OPEN), true);

  // Test legacy aliases that map back to the primary state machine
  assert.strictEqual(canTransition(CaseStatus.UNASSIGNED, CaseStatus.PENDING), true);
  assert.strictEqual(canTransition(CaseStatus.PENDING_LEGACY, CaseStatus.OPEN), true);
}

function testInvalidTransitions() {
  assert.strictEqual(canTransition(CaseStatus.RESOLVED, CaseStatus.OPEN), false);
  assert.strictEqual(canTransition(CaseStatus.RESOLVED, CaseStatus.FILED), false);
  assert.strictEqual(canTransition(CaseStatus.CLOSED, CaseStatus.DRAFT), false);
  assert.strictEqual(canTransition(CaseStatus.FILED, CaseStatus.OPEN), false);
  assert.strictEqual(canTransition(CaseStatus.PENDED, CaseStatus.RESOLVED), false);
  assert.strictEqual(canTransition(CaseStatus.OPEN, CaseStatus.OPEN), false);
  assert.strictEqual(canTransition('INVALID_STATUS', CaseStatus.OPEN), false);
}

function testStatusNormalization() {
  assert.strictEqual(normalizeStatus('Pending'), CaseStatus.PENDED);
  assert.strictEqual(normalizeStatus(CaseStatus.OPEN), CaseStatus.OPEN);
}

function testAssertValidTransition() {
  assert.strictEqual(assertValidTransition(CaseStatus.DRAFT, CaseStatus.SUBMITTED), true);
  assert.throws(
    () => assertValidTransition(CaseStatus.DRAFT, CaseStatus.RESOLVED),
    (error) => error && error.code === 'INVALID_CASE_TRANSITION'
  );
}

function run() {
  try {
    testValidTransitions();
    testInvalidTransitions();
    testStatusNormalization();
    testAssertValidTransition();
    console.log('Case state machine transition tests passed.');
  } catch (err) {
    console.error('Case state machine transition tests failed:', err);
    process.exit(1);
  }
}

run();
