#!/usr/bin/env node
const assert = require('assert');
const {
  DocketLifecycle,
  assertValidLifecycleTransition,
  lifecycleRequiresAssignment,
  deriveLifecycle,
} = require('../src/domain/docketLifecycle');
const { activateOnOpen } = require('../src/services/docketWorkflow.service');
const { createNotification, NotificationTypes } = require('../src/domain/notifications');
const User = require('../src/models/User.model');
const Case = require('../src/models/Case.model');
const Notification = require('../src/models/Notification.model');

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function testLifecycleTransitions() {
  assert.strictEqual(assertValidLifecycleTransition(DocketLifecycle.CREATED, DocketLifecycle.IN_WORKLIST), true);
  assert.strictEqual(assertValidLifecycleTransition(DocketLifecycle.IN_WORKLIST, DocketLifecycle.ACTIVE), true);
  assert.strictEqual(assertValidLifecycleTransition(DocketLifecycle.ACTIVE, DocketLifecycle.COMPLETED), true);
  assert.throws(
    () => assertValidLifecycleTransition(DocketLifecycle.ACTIVE, DocketLifecycle.IN_WORKLIST),
    (error) => error && error.code === 'INVALID_DOCKET_LIFECYCLE_TRANSITION',
  );
}

function testAssignmentEnforcementRule() {
  assert.strictEqual(lifecycleRequiresAssignment(DocketLifecycle.CREATED), true);
  assert.strictEqual(lifecycleRequiresAssignment(DocketLifecycle.IN_WORKLIST), true);
  assert.strictEqual(lifecycleRequiresAssignment(DocketLifecycle.ACTIVE), false);
}

function testDeriveLifecycle() {
  assert.strictEqual(
    deriveLifecycle({ lifecycle: DocketLifecycle.IN_WORKLIST, assignedToXID: null }),
    DocketLifecycle.IN_WORKLIST,
  );
  assert.strictEqual(deriveLifecycle({ lifecycle: '', assignedToXID: 'X100' }), DocketLifecycle.ACTIVE);
  assert.strictEqual(deriveLifecycle({ lifecycle: null, assignedToXID: null }), DocketLifecycle.CREATED);
  assert.strictEqual(deriveLifecycle({ lifecycle: 'ASSIGNED', assignedToXID: null }), DocketLifecycle.IN_WORKLIST);
  assert.strictEqual(
    deriveLifecycle({ lifecycle: '', assignedToXID: 'X100', status: 'OPEN' }),
    DocketLifecycle.ACTIVE,
  );
  assert.strictEqual(
    deriveLifecycle({ lifecycle: '', assignedToXID: null, status: 'RESOLVED' }),
    DocketLifecycle.COMPLETED,
  );
}

async function testAutoActivationOnOpen() {
  const originalFindOne = Case.findOne;
  const originalNotificationFindOne = Notification.findOne;
  const originalCreate = Notification.create;
  const originalUserFindOne = User.findOne;
  let saved = false;
  let notificationStored = false;
  let capturedQuery = null;

  try {
    User.findOne = () => ({
      select: () => ({
        lean: async () => ({ xID: 'X100' })
      })
    });
    Case.findOne = async (query) => {
      capturedQuery = query;
      return {
        caseId: 'CASE-1',
        lifecycle: DocketLifecycle.IN_WORKLIST,
        status: 'ASSIGNED',
        assignedToXID: 'X100',
        save: async () => { saved = true; },
      };
    };

    Notification.findOne = () => ({
      sort: async () => null,
    });
    Notification.create = async (payload) => {
      notificationStored = payload?.type === NotificationTypes.DOCKET_ACTIVATED;
      return payload;
    };

    const updated = await activateOnOpen({
      docketId: 'DOCKET-1',
      firmId: 'FIRM-1',
      actor: { xID: 'X100' },
    });
    await wait(20);

    assert.strictEqual(updated.lifecycle, DocketLifecycle.ACTIVE);
    assert.strictEqual(saved, true);
    assert.strictEqual(notificationStored, true);
    
    // Verify prefix-insensitive candidates query construction
    assert.ok(capturedQuery, 'Query should be captured');
    const caseIdIn = capturedQuery.$or.find(q => q.caseId)?.[ 'caseId' ]?.[ '$in' ];
    assert.ok(Array.isArray(caseIdIn), 'caseId query should use $in operator');
    assert.ok(caseIdIn.includes('DOCKET-1'), 'Candidates should include DOCKET-1');
    assert.ok(caseIdIn.includes('CASE-1'), 'Candidates should include CASE-1');
    assert.ok(caseIdIn.includes('1'), 'Candidates should include bare number 1');
  } finally {
    Case.findOne = originalFindOne;
    Notification.findOne = originalNotificationFindOne;
    Notification.create = originalCreate;
    User.findOne = originalUserFindOne;
  }
}

async function testNotificationCreation() {
  const originalFindOne = Notification.findOne;
  const originalCreate = Notification.create;
  const originalUserFindOne = User.findOne;
  let captured = null;

  try {
    User.findOne = () => ({
      select: () => ({
        lean: async () => ({ xID: 'X100' })
      })
    });
    Notification.findOne = () => ({
      sort: async () => null,
    });
    Notification.create = async (payload) => {
      captured = payload;
      return payload;
    };

    await createNotification({
      firmId: 'FIRM-1',
      userId: 'X100',
      type: NotificationTypes.ASSIGNED,
      docketId: 'CASE-9',
      actor: { xID: 'X200', role: 'ADMIN' },
    });
    await wait(20);

    assert.strictEqual(captured.type, NotificationTypes.ASSIGNED);

    assert.throws(
      () => createNotification({
        firmId: 'FIRM-1',
        userId: 'X100',
        type: 'RANDOM_EVENT',
        docketId: 'CASE-9',
        actor: { xID: 'X200', role: 'ADMIN' },
      }),
      (error) => error && error.code === 'INVALID_NOTIFICATION_TYPE',
    );
  } finally {
    Notification.findOne = originalFindOne;
    Notification.create = originalCreate;
    User.findOne = originalUserFindOne;
  }
}

async function run() {
  try {
    testLifecycleTransitions();
    testAssignmentEnforcementRule();
    testDeriveLifecycle();
    await testAutoActivationOnOpen();
    await testNotificationCreation();
    console.log('Docket lifecycle workflow tests passed.');
  } catch (error) {
    console.error('Docket lifecycle workflow tests failed:', error);
    process.exit(1);
  }
}

run();
