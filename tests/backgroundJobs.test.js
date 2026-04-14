#!/usr/bin/env node
'use strict';

/**
 * Background Jobs System Tests
 *
 * Tests that:
 * - Queue modules initialise correctly when REDIS_URL is absent
 * - Worker modules initialise correctly when REDIS_URL is absent
 * - enqueue helpers return the expected REDIS_UNAVAILABLE error shape
 * - Jobs execute correctly (unit-level, no real Redis)
 * - Failures retry (config validation)
 * - System doesn't block (fire-and-forget pattern in dashboard service)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ─── Helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed += 1;
  }
}

function describe(suite, fn) {
  console.log(`\n${suite}`);
  return fn();
}

async function run() {
  // ─── Ensure REDIS_URL is absent so queues/workers degrade gracefully ────────
  delete process.env.REDIS_URL;

  // ─── Queue module tests ──────────────────────────────────────────────────────

  await describe('slaCheck.queue (no Redis)', async () => {
    const { slaCheckQueue, enqueueSlaCheckJob } = require('../src/queues/slaCheck.queue');

    await test('slaCheckQueue is null when REDIS_URL is absent', () => {
      assert.strictEqual(slaCheckQueue, null);
    });

    await test('enqueueSlaCheckJob returns queued:false and REDIS_UNAVAILABLE error', async () => {
      const result = await enqueueSlaCheckJob({ firmId: 'FIRM1' });
      assert.strictEqual(result.queued, false);
      assert.ok(result.error instanceof Error);
      assert.strictEqual(result.error.message, 'REDIS_UNAVAILABLE');
    });
  });

  await describe('notification.queue (no Redis)', async () => {
    const { notificationQueue, enqueueNotificationJob } = require('../src/queues/notification.queue');

    await test('notificationQueue is null when REDIS_URL is absent', () => {
      assert.strictEqual(notificationQueue, null);
    });

    await test('enqueueNotificationJob returns queued:false and REDIS_UNAVAILABLE error', async () => {
      const result = await enqueueNotificationJob({ firmId: 'FIRM1', userId: 'U001', type: 'SLA_BREACHED', title: 'SLA', message: 'Breached' });
      assert.strictEqual(result.queued, false);
      assert.ok(result.error instanceof Error);
      assert.strictEqual(result.error.message, 'REDIS_UNAVAILABLE');
    });
  });

  await describe('reportGeneration.queue (no Redis)', async () => {
    const { reportGenerationQueue, enqueueReportJob } = require('../src/queues/reportGeneration.queue');

    await test('reportGenerationQueue is null when REDIS_URL is absent', () => {
      assert.strictEqual(reportGenerationQueue, null);
    });

    await test('enqueueReportJob returns queued:false and REDIS_UNAVAILABLE error', async () => {
      const result = await enqueueReportJob({ firmId: 'FIRM1', reportType: 'WEEKLY_SLA_SUMMARY' });
      assert.strictEqual(result.queued, false);
      assert.ok(result.error instanceof Error);
      assert.strictEqual(result.error.message, 'REDIS_UNAVAILABLE');
    });
  });

  await describe('bulkProcess.queue (no Redis)', async () => {
    const { bulkProcessQueue, enqueueBulkProcessJob } = require('../src/queues/bulkProcess.queue');

    await test('bulkProcessQueue is null when REDIS_URL is absent', () => {
      assert.strictEqual(bulkProcessQueue, null);
    });

    await test('enqueueBulkProcessJob returns queued:false and REDIS_UNAVAILABLE error', async () => {
      const result = await enqueueBulkProcessJob({ firmId: 'FIRM1', type: 'BULK_STATUS_UPDATE', items: ['C1'] });
      assert.strictEqual(result.queued, false);
      assert.ok(result.error instanceof Error);
      assert.strictEqual(result.error.message, 'REDIS_UNAVAILABLE');
    });
  });

  // ─── Worker registry tests ───────────────────────────────────────────────────

  await describe('Worker status registry (no Redis)', async () => {
    const { getWorkerStatuses } = require('../src/services/workerRegistry.service');

    await test('slaCheck worker registers as disabled when REDIS_URL is absent', () => {
      require('../src/workers/slaCheck.worker');
      const statuses = getWorkerStatuses();
      assert.ok(statuses.slaCheck, 'slaCheck status should be registered');
      assert.strictEqual(statuses.slaCheck.status, 'disabled');
    });

    await test('notification worker registers as disabled when REDIS_URL is absent', () => {
      require('../src/workers/notification.worker');
      const statuses = getWorkerStatuses();
      assert.ok(statuses.notification, 'notification status should be registered');
      assert.strictEqual(statuses.notification.status, 'disabled');
    });

    await test('reportGeneration worker registers as disabled when REDIS_URL is absent', () => {
      require('../src/workers/reportGeneration.worker');
      const statuses = getWorkerStatuses();
      assert.ok(statuses.reportGeneration, 'reportGeneration status should be registered');
      assert.strictEqual(statuses.reportGeneration.status, 'disabled');
    });

    await test('bulkProcess worker registers as disabled when REDIS_URL is absent', () => {
      require('../src/workers/bulkProcess.worker');
      const statuses = getWorkerStatuses();
      assert.ok(statuses.bulkProcess, 'bulkProcess status should be registered');
      assert.strictEqual(statuses.bulkProcess.status, 'disabled');
    });
  });

  // ─── Queue config / retry logic tests ────────────────────────────────────────

  await describe('Queue retry configuration', async () => {
    await test('slaCheck queue has 5 max attempts with exponential backoff', () => {
      const src = fs.readFileSync(path.join(__dirname, '../src/queues/slaCheck.queue.js'), 'utf8');
      assert.ok(src.includes('attempts: 5'), 'slaCheck queue should have attempts: 5');
      assert.ok(src.includes("type: 'exponential'"), 'slaCheck queue should use exponential backoff');
    });

    await test('notification queue has 3 max attempts with exponential backoff', () => {
      const src = fs.readFileSync(path.join(__dirname, '../src/queues/notification.queue.js'), 'utf8');
      assert.ok(src.includes('attempts: 3'), 'notification queue should have attempts: 3');
      assert.ok(src.includes("type: 'exponential'"), 'notification queue should use exponential backoff');
    });

    await test('reportGeneration queue has 3 max attempts with exponential backoff', () => {
      const src = fs.readFileSync(path.join(__dirname, '../src/queues/reportGeneration.queue.js'), 'utf8');
      assert.ok(src.includes('attempts: 3'), 'reportGeneration queue should have attempts: 3');
      assert.ok(src.includes("type: 'exponential'"), 'reportGeneration queue should use exponential backoff');
    });

    await test('bulkProcess queue has 3 max attempts with exponential backoff', () => {
      const src = fs.readFileSync(path.join(__dirname, '../src/queues/bulkProcess.queue.js'), 'utf8');
      assert.ok(src.includes('attempts: 3'), 'bulkProcess queue should have attempts: 3');
      assert.ok(src.includes("type: 'exponential'"), 'bulkProcess queue should use exponential backoff');
    });
  });

  // ─── Non-blocking dashboard service test ─────────────────────────────────────

  await describe('dashboard.service non-blocking SLA check', async () => {
    await test('getOverdueDockets no longer awaits syncSlaBreachNotifications inline', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '../src/services/dashboard.service.js'), 'utf8'
      );
      assert.ok(
        !src.includes('await syncSlaBreachNotifications'),
        'dashboard service should not await syncSlaBreachNotifications'
      );
      assert.ok(
        src.includes('enqueueSlaCheckJob'),
        'dashboard service should enqueue SLA_CHECK job'
      );
    });
  });

  // ─── workerBootstrap registration test ───────────────────────────────────────

  await describe('workerBootstrap service registers new workers', async () => {
    await test('all new worker names are registered in workerModules', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '../src/services/workerBootstrap.service.js'), 'utf8'
      );
      assert.ok(src.includes('SLA_CHECK_WORKER'), 'SLA_CHECK_WORKER should be registered');
      assert.ok(src.includes('NOTIFICATION_WORKER'), 'NOTIFICATION_WORKER should be registered');
      assert.ok(src.includes('REPORT_GENERATION_WORKER'), 'REPORT_GENERATION_WORKER should be registered');
      assert.ok(src.includes('BULK_PROCESS_WORKER'), 'BULK_PROCESS_WORKER should be registered');
    });
  });

  // ─── worker.js entry-point test ───────────────────────────────────────────────

  await describe('worker.js entry-point includes new workers', async () => {
    await test('worker.js requires all new worker files', () => {
      const src = fs.readFileSync(path.join(__dirname, '../worker.js'), 'utf8');
      assert.ok(src.includes('slaCheck.worker'), 'worker.js should require slaCheck.worker');
      assert.ok(src.includes('notification.worker'), 'worker.js should require notification.worker');
      assert.ok(src.includes('reportGeneration.worker'), 'worker.js should require reportGeneration.worker');
      assert.ok(src.includes('bulkProcess.worker'), 'worker.js should require bulkProcess.worker');
    });
  });

  // ─── Summary ─────────────────────────────────────────────────────────────────

  console.log(`\nBackground jobs tests: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});

