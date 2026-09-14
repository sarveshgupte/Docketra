#!/usr/bin/env node
const assert = require('assert');
const {
  DocketStatus,
  allowedTransitions,
  assertValidDocketTransition,
  transitionToPended,
  transitionFromPended,
} = require('../src/domain/docket/docketStateMachine');
const { toLifecycleFromStatus } = require('../src/domain/docketLifecycle');

async function testStateMachine() {
  console.log('--- Testing Docket State Machine Guardrails for PENDED ---');

  // 1. Allowed transitions from PENDED
  const pendedTransitions = allowedTransitions[DocketStatus.PENDED];
  assert.ok(pendedTransitions.includes(DocketStatus.IN_PROGRESS), 'PENDED should allow transition to IN_PROGRESS');
  assert.ok(pendedTransitions.includes(DocketStatus.OPEN), 'PENDED should allow transition to OPEN');
  assert.ok(pendedTransitions.includes(DocketStatus.READY_FOR_REVIEW), 'PENDED should allow transition to READY_FOR_REVIEW');
  assert.ok(pendedTransitions.includes(DocketStatus.COMPLETED), 'PENDED should allow transition to COMPLETED');

  // 2. assertValidDocketTransition
  assert.doesNotThrow(() => {
    assertValidDocketTransition('PENDED', 'IN_PROGRESS');
    assertValidDocketTransition('PENDED', 'OPEN');
    assertValidDocketTransition('PENDED', 'READY_FOR_REVIEW');
    assertValidDocketTransition('PENDED', 'COMPLETED');
  });

  // 3. transitionToPended
  const mockDocket = {
    status: 'IN_PROGRESS',
    assignedToXID: 'USER123',
  };

  assert.throws(() => {
    transitionToPended(mockDocket, { reason: '' });
  }, /Pended reason is required/);

  const pendedDate = new Date('2026-10-01T08:00:00Z');
  transitionToPended(mockDocket, { reason: 'Awaiting MCA response', autoReopenAt: pendedDate });

  assert.strictEqual(mockDocket.status, 'PENDED');
  assert.strictEqual(mockDocket.state, 'PENDED');
  assert.strictEqual(mockDocket.statusBeforePended, 'IN_PROGRESS');
  assert.strictEqual(mockDocket.previousStatus, 'IN_PROGRESS');
  assert.ok(mockDocket.pendedAt instanceof Date, 'pendedAt must be a Date instance');
  assert.strictEqual(mockDocket.pendedReason, 'Awaiting MCA response');
  assert.strictEqual(mockDocket.autoReopenAt.toISOString(), pendedDate.toISOString());

  // 4. transitionFromPended (Unpending)
  transitionFromPended(mockDocket, { unpendNote: 'Received response' });

  assert.strictEqual(mockDocket.status, 'IN_PROGRESS', 'Should default to statusBeforePended');
  assert.strictEqual(mockDocket.statusBeforePended, null, 'statusBeforePended must be cleared');
  assert.strictEqual(mockDocket.pendedAt, null, 'pendedAt must be cleared');
  assert.strictEqual(mockDocket.pendedReason, null, 'pendedReason must be cleared');
  assert.strictEqual(mockDocket.autoReopenAt, null, 'autoReopenAt must be cleared');
  assert.ok(mockDocket.unpendedAt instanceof Date, 'unpendedAt must be set to Date instance');

  // 5. toLifecycleFromStatus
  assert.strictEqual(toLifecycleFromStatus('PENDED'), 'WAITING');
  assert.strictEqual(toLifecycleFromStatus('PENDING'), 'WAITING');

  console.log('✓ All Docket State Machine PENDED/UNPEND tests passed successfully.');
}

testStateMachine().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
