#!/usr/bin/env node
const assert = require('assert');
const TenantStorageHealth = require('../src/models/TenantStorageHealth.model');
const Case = require('../src/models/Case.model');
const { storageHealthGuard, inboundStorageHealthGuard } = require('../src/middleware/storageHealthGuard');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function mockFindOne(result) {
  return {
    select: () => ({
      lean: async () => result,
    }),
  };
}

async function testStorageHealthGuardBlocksDisconnected() {
  const originalFindOne = TenantStorageHealth.findOne;
  TenantStorageHealth.findOne = () => mockFindOne({ status: 'DISCONNECTED' });

  const req = { firmId: 'firm-1', originalUrl: '/api/files/request-upload' };
  const res = createResponse();
  let nextCalled = false;
  await storageHealthGuard(req, res, () => {
    nextCalled = true;
  });

  TenantStorageHealth.findOne = originalFindOne;
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(res.body.code, 'STORAGE_DISCONNECTED');
}

async function testStorageHealthGuardAllowsDegraded() {
  const originalFindOne = TenantStorageHealth.findOne;
  TenantStorageHealth.findOne = () => mockFindOne({ status: 'DEGRADED' });

  const req = { firmId: 'firm-2', originalUrl: '/api/files/request-upload' };
  const res = createResponse();
  let nextCalled = false;
  await storageHealthGuard(req, res, () => {
    nextCalled = true;
  });

  TenantStorageHealth.findOne = originalFindOne;
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
}

async function testInboundStorageHealthGuardBlocksDisconnectedTenant() {
  const originalCaseFindOne = Case.findOne;
  const originalHealthFindOne = TenantStorageHealth.findOne;

  Case.findOne = () => mockFindOne({ firmId: 'firm-3' });
  TenantStorageHealth.findOne = () => mockFindOne({ status: 'DISCONNECTED' });

  const req = {
    body: Buffer.from(JSON.stringify({
      to: 'case-123e4567-e89b-42d3-a456-426614174000@inbound.docketra.com',
      from: 'sender@example.com',
    })),
    originalUrl: '/api/inbound/email',
  };
  const res = createResponse();
  let nextCalled = false;
  await inboundStorageHealthGuard(req, res, () => {
    nextCalled = true;
  });

  Case.findOne = originalCaseFindOne;
  TenantStorageHealth.findOne = originalHealthFindOne;

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(res.body.code, 'STORAGE_DISCONNECTED');
}

async function run() {
  try {
    await testStorageHealthGuardBlocksDisconnected();
    await testStorageHealthGuardAllowsDegraded();
    await testInboundStorageHealthGuardBlocksDisconnectedTenant();
    console.log('Storage health guard tests passed.');
  } catch (error) {
    console.error('Storage health guard tests failed:', error);
    process.exit(1);
  }
}

run();
