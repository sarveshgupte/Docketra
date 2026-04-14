#!/usr/bin/env node
const assert = require('assert');

const ROOT = '/home/runner/work/Docketra/Docketra';

const resolveFromRoot = (relativePath) => require.resolve(`${ROOT}/${relativePath}`);

function mockModule(relativePath, exports) {
  const resolvedPath = resolveFromRoot(relativePath);
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports,
  };
  return resolvedPath;
}

function clearModule(relativePath) {
  try {
    delete require.cache[resolveFromRoot(relativePath)];
  } catch (_) {
    // ignore cache misses in tests
  }
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testNotificationProcessorUsesService() {
  const calls = [];
  mockModule('src/services/notification.service.js', {
    createNotification: async (payload) => {
      calls.push(payload);
      return { ok: true };
    },
  });
  clearModule('src/jobs/notification.job.js');

  try {
    const { processNotificationJob } = require(`${ROOT}/src/jobs/notification.job.js`);
    await processNotificationJob({ userId: 'X100001', type: 'COMMENT_ADDED' });
    assert.deepStrictEqual(calls, [{ userId: 'X100001', type: 'COMMENT_ADDED' }]);
  } finally {
    clearModule('src/jobs/notification.job.js');
    clearModule('src/services/notification.service.js');
  }
}

async function testSlaProcessorUsesService() {
  const calls = [];
  mockModule('src/services/sla.service.js', {
    syncSlaBreachNotifications: async (dockets, options) => {
      calls.push({ dockets, options });
      return { ok: true };
    },
  });
  clearModule('src/jobs/slaBreachCheck.job.js');

  try {
    const { processSlaBreachCheckJob } = require(`${ROOT}/src/jobs/slaBreachCheck.job.js`);
    await processSlaBreachCheckJob({
      dockets: [{ docketId: 'DK-1' }],
      firmId: 'firm-a',
      now: new Date('2026-04-14T00:00:00.000Z'),
    });
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0].dockets, [{ docketId: 'DK-1' }]);
    assert.strictEqual(calls[0].options.firmId, 'firm-a');
  } finally {
    clearModule('src/jobs/slaBreachCheck.job.js');
    clearModule('src/services/sla.service.js');
  }
}

async function testNotificationDispatchIsNonBlockingAndFallsBack() {
  let fallbackCalls = 0;
  const enqueueCalls = [];
  mockModule('src/services/notification.service.js', {
    NotificationTypes: {
      DOCKET_ASSIGNED: 'DOCKET_ASSIGNED',
      STATUS_CHANGED: 'STATUS_CHANGED',
      COMMENT_ADDED: 'COMMENT_ADDED',
      DOCKET_REASSIGNED: 'DOCKET_REASSIGNED',
      CLIENT_UPLOAD: 'CLIENT_UPLOAD',
      SLA_BREACHED: 'SLA_BREACHED',
    },
    createNotification: async (payload) => {
      fallbackCalls += 1;
      enqueueCalls.push({ fallback: payload });
      return { ok: true };
    },
  });
  mockModule('src/queues/notification.queue.js', {
    enqueueNotificationJob: async (payload) => {
      enqueueCalls.push({ queued: payload });
      await wait(25);
      return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
    },
  });
  mockModule('src/utils/log.js', {
    warn: () => {},
    error: () => {},
  });
  clearModule('src/domain/notifications.js');

  try {
    const { createNotification, NotificationTypes } = require(`${ROOT}/src/domain/notifications.js`);
    const start = Date.now();
    const result = createNotification({
      firmId: 'firm-a',
      userId: 'X100001',
      type: NotificationTypes.COMMENT_ADDED,
      docketId: 'DK-100',
      actor: { xID: 'X200002' },
    });
    const elapsed = Date.now() - start;

    assert.strictEqual(result.firmId, 'firm-a');
    assert.strictEqual(result.type, 'COMMENT_ADDED');
    assert.ok(elapsed < 20, `dispatch should return immediately, took ${elapsed}ms`);
    assert.strictEqual(fallbackCalls, 0, 'fallback should not run inline');

    await wait(50);

    assert.strictEqual(enqueueCalls.length >= 2, true);
    assert.strictEqual(fallbackCalls, 1, 'fallback persistence should run asynchronously when queue is unavailable');
  } finally {
    clearModule('src/domain/notifications.js');
    clearModule('src/services/notification.service.js');
    clearModule('src/queues/notification.queue.js');
    clearModule('src/utils/log.js');
  }
}

async function testSlaDispatchQueuesWithoutBlocking() {
  let syncCalls = 0;
  let queueCalls = 0;
  mockModule('src/models/Case.model.js', {});
  mockModule('src/models/SlaRule.model.js', {});
  mockModule('src/services/caseSla.service.js', {
    DEFAULT_SLA_CONFIG: { tatDurationMinutes: 480 },
    calculateDueDate: () => new Date(),
  });
  mockModule('src/services/notification.service.js', {
    createNotification: async () => ({ ok: true }),
    NotificationTypes: { SLA_BREACHED: 'SLA_BREACHED' },
  });
  mockModule('src/queues/sla.queue.js', {
    enqueueSlaBreachCheckJob: async () => {
      queueCalls += 1;
      await wait(25);
      return { queued: true, jobId: 'job-1' };
    },
  });
  mockModule('src/utils/log.js', {
    warn: () => {},
    error: () => {},
  });
  clearModule('src/services/sla.service.js');

  try {
    const slaService = require(`${ROOT}/src/services/sla.service.js`);
    const originalSync = slaService.syncSlaBreachNotifications;
    slaService.syncSlaBreachNotifications = async () => {
      syncCalls += 1;
      return { ok: true };
    };

    const start = Date.now();
    const result = slaService.dispatchSlaBreachNotifications([{ docketId: 'DK-1' }], {
      firmId: 'firm-a',
      now: new Date(),
    });
    const elapsed = Date.now() - start;

    assert.strictEqual(result, undefined);
    assert.ok(elapsed < 20, `dispatch should return immediately, took ${elapsed}ms`);

    await wait(50);

    assert.strictEqual(queueCalls, 1);
    assert.strictEqual(syncCalls, 0, 'synchronous fallback should not run when queue accepts the job');
    slaService.syncSlaBreachNotifications = originalSync;
  } finally {
    clearModule('src/services/sla.service.js');
    clearModule('src/models/Case.model.js');
    clearModule('src/models/SlaRule.model.js');
    clearModule('src/services/caseSla.service.js');
    clearModule('src/services/notification.service.js');
    clearModule('src/queues/sla.queue.js');
    clearModule('src/utils/log.js');
  }
}

function testRetryConfigurationIsExposed() {
  clearModule('src/queues/notification.queue.js');
  clearModule('src/queues/sla.queue.js');
  clearModule('src/queues/bulkUpload.queue.js');

  const notificationQueue = require(`${ROOT}/src/queues/notification.queue.js`);
  const slaQueue = require(`${ROOT}/src/queues/sla.queue.js`);
  const bulkUploadQueue = require(`${ROOT}/src/queues/bulkUpload.queue.js`);

  assert.strictEqual(notificationQueue.NOTIFICATION_JOB_NAME, 'notification-job');
  assert.strictEqual(slaQueue.SLA_BREACH_JOB_NAME, 'sla-breach-check');
  assert.strictEqual(notificationQueue.NOTIFICATION_JOB_OPTIONS.attempts, 3);
  assert.strictEqual(slaQueue.SLA_BREACH_JOB_OPTIONS.attempts, 3);
  assert.strictEqual(bulkUploadQueue.BULK_UPLOAD_JOB_OPTIONS.attempts, 3);
}

async function run() {
  try {
    await testNotificationProcessorUsesService();
    await testSlaProcessorUsesService();
    await testNotificationDispatchIsNonBlockingAndFallsBack();
    await testSlaDispatchQueuesWithoutBlocking();
    testRetryConfigurationIsExposed();
    console.log('Background job tests passed.');
  } catch (error) {
    console.error('Background job tests failed:', error);
    process.exit(1);
  }
}

run();
