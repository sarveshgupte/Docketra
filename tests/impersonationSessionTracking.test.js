#!/usr/bin/env node
/**
 * Test Impersonation Session Tracking - Impersonation Removed
 *
 * switchFirm now always returns 403 (impersonation capability removed).
 * All previously-valid impersonation scenarios now return 403.
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
  create: async (data) => { mockAuditLogs.push(data); }
};

require.cache[require.resolve('../src/models/Firm.model')] = { exports: mockFirm };
require.cache[require.resolve('../src/models/SuperadminAudit.model')] = { exports: mockSuperadminAudit };

const { switchFirm, exitFirm } = require('../src/controllers/superadmin.controller');

async function testSwitchFirmBlocked() {
  console.log('\n[TEST] switchFirm is blocked - no session ID generated...');

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
    user: { _id: '000000000000000000000001', email: 'superadmin@docketra.local', role: 'SuperAdmin' },
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

  assert.strictEqual(statusCode, 403, 'switchFirm must return 403 - impersonation is removed');
  assert.strictEqual(responseBody.success, false);
  assert.strictEqual(mockAuditLogs.length, 0, 'No audit log should be created for blocked request');

  console.log('  ✓ switchFirm blocked - no session ID, no audit log');
}

async function testExitFirmStillWorks() {
  console.log('\n[TEST] exitFirm still clears impersonation state...');

  mockAuditLogs.length = 0;

  const req = {
    body: { sessionId: 'old-session-id' },
    user: { _id: '000000000000000000000001', email: 'superadmin@docketra.local', role: 'SuperAdmin' },
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

  assert.strictEqual(statusCode, 200, 'exitFirm should return 200');
  assert.strictEqual(responseBody.success, true);
  assert.strictEqual(responseBody.data.scope, 'GLOBAL');
  assert.strictEqual(mockAuditLogs.length, 1, 'Audit log created for exitFirm');
  assert.strictEqual(mockAuditLogs[0].actionType, 'ExitFirm');

  console.log('  ✓ exitFirm clears state and returns GLOBAL scope');
}

async function runTests() {
  console.log('='.repeat(49));
  console.log('Impersonation Session Tracking Tests (Blocked)');
  console.log('='.repeat(49));

  try {
    await testSwitchFirmBlocked();
    await testExitFirmStillWorks();

    console.log('\n='.padEnd(49, '='));
    console.log('  ✓ All tests passed!');
    console.log('='.padEnd(49, '='));
    process.exit(0);
  } catch (error) {
    console.error('\n  ✗ Test failed!');
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
