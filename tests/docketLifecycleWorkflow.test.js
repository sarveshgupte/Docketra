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
const Case = require('../src/models/Case.model');
const Notification = require('../src/models/Notification.model');

function testLifecycleTransitions() {
  assert.strictEqual(assertValidLifecycleTransition(DocketLifecycle.CREATED, DocketLifecycle.IN_WORKLIST), true);
  assert.strictEqual(assertValidLifecycleTransition(DocketLifecycle.IN_WORKLIST, DocketLifecycle.ACTIVE), true);
  assert.strictEqual(assertValidLifecycleTransition(DocketLifecycle.ACTIVE, DocketLifecycle.COMPLETED), true);
  assert.throws(
    () => assertValidLifecycleTransition(DocketLifecycle.CREATED, DocketLifecycle.ACTIVE),
    (error) => error && error.code === 'INVALID_DOCKET_LIFECYCLE_TRANSITION',
  );
}

function testAssignmentEnforcementRule() {
  assert.strictEqual(lifecycleRequiresAssignment(DocketLifecycle.CREATED), false);
  assert.strictEqual(lifecycleRequiresAssignment(DocketLifecycle.IN_WORKLIST), true);
  assert.strictEqual(lifecycleRequiresAssignment(DocketLifecycle.ACTIVE), true);
}

function testDeriveLifecycle() {
  assert.strictEqual(
    deriveLifecycle({ lifecycle: DocketLifecycle.IN_WORKLIST, assignedToXID: null }),
    DocketLifecycle.IN_WORKLIST,
  );
  assert.strictEqual(deriveLifecycle({ lifecycle: '', assignedToXID: 'X100' }), DocketLifecycle.IN_WORKLIST);
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
  const originalCreate = Notification.create;
  let saved = false;
  let notificationStored = false;

  try {
    Case.findOne = async () => ({
      caseId: 'CASE-1',
      lifecycle: DocketLifecycle.IN_WORKLIST,
      status: 'ASSIGNED',
      assignedToXID: 'X100',
      save: async () => { saved = true; },
    });

    Notification.create = async (payload) => {
      notificationStored = payload?.type === NotificationTypes.DOCKET_ACTIVATED;
      return payload;
    };

    const updated = await activateOnOpen({
      docketId: 'CASE-1',
      firmId: 'FIRM-1',
      actor: { xID: 'X100' },
    });

    assert.strictEqual(updated.lifecycle, DocketLifecycle.ACTIVE);
    assert.strictEqual(saved, true);
    assert.strictEqual(notificationStored, true);
  } finally {
    Case.findOne = originalFindOne;
    Notification.create = originalCreate;
  }
}

async function testNotificationCreation() {
  const originalCreate = Notification.create;
  let captured = null;

  try {
    Notification.create = async (payload) => {
      captured = payload;
      return payload;
    };

    await createNotification({
      firmId: 'FIRM-1',
      user_id: 'X100',
      type: NotificationTypes.DOCKET_ASSIGNED,
      docket_id: 'CASE-9',
      message: 'Assigned',
    });

    assert.strictEqual(captured.type, NotificationTypes.DOCKET_ASSIGNED);

    await assert.rejects(
      () => createNotification({
        firmId: 'FIRM-1',
        user_id: 'X100',
        type: 'RANDOM_EVENT',
        docket_id: 'CASE-9',
        message: 'Assigned',
      }),
      (error) => error && error.code === 'INVALID_NOTIFICATION_TYPE',
    );
  } finally {
    Notification.create = originalCreate;
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
