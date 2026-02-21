#!/usr/bin/env node
/**
 * Test SuperAdmin Firm Switching - Impersonation Removed
 *
 * switchFirm now always returns 403 (impersonation capability removed).
 * exitFirm still returns 200 (no-op cleanup).
 */

const assert = require('assert');
const mongoose = require('mongoose');

// Mock database models
const mockFirms = new Map();
const mockAuditLogs = [];

const mockFirm = {
  findById: async (id) => mockFirms.get(id.toString()),
  findOne: async (query) => {
    if (query.firmId) {
      for (const [, firm] of mockFirms) {
        if (firm.firmId === query.firmId) return firm;
      }
    }
    return null;
  }
};

const mockSuperadminAudit = {
  create: async (data) => {
    mockAuditLogs.push(data);
  }
};

// Mock the models
require.cache[require.resolve('../src/models/Firm.model')] = {
  exports: mockFirm
};

require.cache[require.resolve('../src/models/SuperadminAudit.model')] = {
  exports: mockSuperadminAudit
};

// Load controller after mocking
const { switchFirm, exitFirm } = require('../src/controllers/superadmin.controller');

async function testSwitchFirmReturns403() {
  console.log('\n[TEST] switchFirm returns 403 (impersonation removed)...');

  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM001',
    firmSlug: 'test-firm',
    name: 'Test Firm',
    status: 'ACTIVE'
  });

  mockAuditLogs.length = 0;

  const req = {
    body: { firmId: testFirmId.toString() },
    user: {
      _id: '000000000000000000000001',
      email: 'superadmin@docketra.local',
      role: 'SuperAdmin'
    },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' }
  };

  let statusCode = 200;
  let responseBody = null;

  const res = {
    status: function(code) { statusCode = code; return this; },
    json: function(body) { responseBody = body; return this; }
  };

  await switchFirm(req, res);

  assert.strictEqual(statusCode, 403, 'switchFirm must return 403 - impersonation is disabled');
  assert.strictEqual(responseBody.success, false, 'Response should not be successful');
  assert.ok(responseBody.message, 'Response must include a message');

  console.log('✓ switchFirm returns 403 - impersonation capability is removed');
}

async function testExitFirm() {
  console.log('\n[TEST] Exit firm returns to GLOBAL context...');

  mockAuditLogs.length = 0;

  const req = {
    body: {},
    user: {
      _id: '000000000000000000000001',
      email: 'superadmin@docketra.local',
      role: 'SuperAdmin'
    },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' }
  };

  let statusCode = 200;
  let responseBody = null;

  const res = {
    status: function(code) { statusCode = code; return this; },
    json: function(body) { responseBody = body; return this; }
  };

  await exitFirm(req, res);

  assert.strictEqual(statusCode, 200, 'Should return 200 OK');
  assert.strictEqual(responseBody.success, true, 'Response should be successful');
  assert.strictEqual(responseBody.data.impersonatedFirmId, null, 'Should clear impersonated firm ID');
  assert.strictEqual(responseBody.data.scope, 'GLOBAL', 'Should return to GLOBAL scope');

  console.log('✓ exitFirm clears impersonation state and returns GLOBAL scope');
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('SuperAdmin Firm Switching Tests (Impersonation Blocked)');
  console.log('='.repeat(60));

  try {
    await testSwitchFirmReturns403();
    await testExitFirm();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('='.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
