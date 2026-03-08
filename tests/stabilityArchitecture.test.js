#!/usr/bin/env node
'use strict';

const assert = require('assert');

async function testAttachRequestContextBuildsStructuredContext() {
  const { attachRequestContext } = require('../src/middleware/attachRequestContext');

  const req = {
    originalUrl: '/api/admin/clients',
    requestId: 'req-123',
    user: {
      _id: 'user-1',
      firmId: 'firm-1',
      xID: 'X000001',
    },
  };

  await new Promise((resolve) => attachRequestContext(req, {}, resolve));

  assert.deepStrictEqual(req.context, {
    firmId: 'firm-1',
    userId: 'user-1',
    userXID: 'X000001',
    dbSession: undefined,
    route: '/api/admin/clients',
    requestId: 'req-123',
  });
  console.log('✓ attachRequestContext adds structured request metadata');
}

async function testStorageHealthEndpointIsReadOnly() {
  const TenantStorageHealth = require('../src/models/TenantStorageHealth.model');
  const TenantStorageConfig = require('../src/models/TenantStorageConfig.model');
  const { getStorageHealth } = require('../src/controllers/storage.controller');

  const originalHealthFindOne = TenantStorageHealth.findOne;
  const originalConfigFindOne = TenantStorageConfig.findOne;
  const originalHealthWrite = TenantStorageHealth.findOneAndUpdate;

  const selectChain = (result) => ({
    select() {
      return this;
    },
    lean: async () => result,
  });

  let writeAttempted = false;
  TenantStorageHealth.findOne = () => selectChain(null);
  TenantStorageConfig.findOne = () => selectChain(null);
  TenantStorageHealth.findOneAndUpdate = async () => {
    writeAttempted = true;
    throw new Error('health endpoint must be read-only');
  };

  const res = {
    body: null,
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  try {
    await getStorageHealth({ firmId: 'firm-1' }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(writeAttempted, false, 'read-only health endpoint must not write TenantStorageHealth');
    assert.strictEqual(res.body.status, 'DISCONNECTED');
  } finally {
    TenantStorageHealth.findOne = originalHealthFindOne;
    TenantStorageConfig.findOne = originalConfigFindOne;
    TenantStorageHealth.findOneAndUpdate = originalHealthWrite;
  }

  console.log('✓ storage health endpoint remains read-only');
}

async function testSafeQueueEmailNeverThrows() {
  const { safeQueueEmail, safeAnalyticsEvent } = require('../src/services/safeSideEffects.service');

  await safeQueueEmail({
    operation: 'EMAIL_QUEUE',
    payload: { action: 'TEST_EMAIL' },
    execute: async () => {
      throw new Error('smtp unavailable');
    },
  });

  await safeAnalyticsEvent({
    eventName: 'ANALYTICS_EVENT',
    payload: { action: 'TEST_ANALYTICS' },
    execute: async () => {
      throw new Error('analytics offline');
    },
  });

  console.log('✓ safe side-effect helpers swallow downstream failures');
}

async function testXidGeneratorUsesAtomicGlobalCounterWithoutSession() {
  const Counter = require('../src/models/Counter.model');
  const xIDGenerator = require('../src/services/xIDGenerator');
  const originalFindOneAndUpdate = Counter.findOneAndUpdate;
  const calls = [];

  Counter.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
    return { seq: 7 };
  };

  try {
    const xid = await xIDGenerator.generateNextXID('firm-1', { id: 'session-1' });
    assert.strictEqual(xid, 'X000007');
    assert.deepStrictEqual(calls[0].filter, { name: 'user_xid', firmId: 'GLOBAL' });
    assert.strictEqual(calls[0].options.session, undefined, 'xID generation must not join business transactions');
  } finally {
    Counter.findOneAndUpdate = originalFindOneAndUpdate;
  }

  console.log('✓ xID generation uses a global atomic counter outside the active transaction');
}

async function run() {
  await testAttachRequestContextBuildsStructuredContext();
  await testStorageHealthEndpointIsReadOnly();
  await testSafeQueueEmailNeverThrows();
  await testXidGeneratorUsesAtomicGlobalCounterWithoutSession();
  console.log('Stability architecture tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
