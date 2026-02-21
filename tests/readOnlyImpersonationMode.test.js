#!/usr/bin/env node
/**
 * Test Read-Only Impersonation Mode - Impersonation Removed
 *
 * switchFirm now always returns 403 regardless of mode parameter.
 * Firm context middleware blocks SuperAdmin unconditionally.
 */

const assert = require('assert');
const mongoose = require('mongoose');

// Mock database models
const mockFirms = new Map();
const mockAuditLogs = [];

const mockFirm = {
  findById: async (id) => mockFirms.get(id.toString()),
  findOne: async () => null,
};

const mockSuperadminAudit = {
  create: async (data) => { mockAuditLogs.push(data); }
};

require.cache[require.resolve('../src/models/Firm.model')] = { exports: mockFirm };
require.cache[require.resolve('../src/models/SuperadminAudit.model')] = { exports: mockSuperadminAudit };

const { switchFirm } = require('../src/controllers/superadmin.controller');

async function testSwitchFirmReturns403ForReadOnly() {
  console.log('\n[TEST] switchFirm returns 403 even with READ_ONLY mode...');

  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM001',
    firmSlug: 'test-firm',
    name: 'Test Firm',
    status: 'ACTIVE'
  });

  const req = {
    body: { firmId: testFirmId.toString(), mode: 'READ_ONLY' },
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

  assert.strictEqual(statusCode, 403, 'switchFirm must return 403');
  assert.strictEqual(responseBody.success, false);
  console.log('  ✓ switchFirm returns 403 with READ_ONLY mode');
}

async function testSwitchFirmReturns403ForFullAccess() {
  console.log('\n[TEST] switchFirm returns 403 even with FULL_ACCESS mode...');

  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM002',
    firmSlug: 'firm-two',
    name: 'Firm Two',
    status: 'ACTIVE'
  });

  const req = {
    body: { firmId: testFirmId.toString(), mode: 'FULL_ACCESS' },
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

  assert.strictEqual(statusCode, 403, 'switchFirm must return 403');
  assert.strictEqual(responseBody.success, false);
  console.log('  ✓ switchFirm returns 403 with FULL_ACCESS mode');
}

async function runTests() {
  console.log('Running Read-Only Impersonation Mode Tests (Impersonation Blocked)');
  console.log('='.repeat(60));

  try {
    await testSwitchFirmReturns403ForReadOnly();
    await testSwitchFirmReturns403ForFullAccess();

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
