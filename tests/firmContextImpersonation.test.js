#!/usr/bin/env node
/**
 * Test Firm Context Middleware - Impersonation Removed
 *
 * SuperAdmin is always blocked from firm-scoped routes (no impersonation).
 * Regular admin access continues to work normally.
 */

const assert = require('assert');
const mongoose = require('mongoose');

// Mock Firm model
const mockFirms = new Map();
const mockFirm = {
  findOne: async (query) => {
    if (query.$or) {
      for (const condition of query.$or) {
        if (condition._id) {
          const firm = mockFirms.get(condition._id.toString());
          if (firm) return firm;
        }
        if (condition.firmId) {
          for (const [, firm] of mockFirms) {
            if (firm.firmId === condition.firmId) return firm;
          }
        }
      }
    }
    return null;
  }
};

// Mock the models
require.cache[require.resolve('../src/models/Firm.model')] = {
  exports: mockFirm
};

// Load middleware after mocking
const { firmContext } = require('../src/middleware/firmContext');

async function testSuperAdminBlockedAlways() {
  console.log('\n[TEST] SuperAdmin is always blocked from firm-scoped routes...');

  const req = {
    method: 'GET',
    originalUrl: '/api/f/test-firm/cases',
    requestId: 'test-req-1',
    headers: {},
    params: { firmSlug: 'test-firm' },
    user: { role: 'SuperAdmin', firmId: null },
    jwt: { isSuperAdmin: true, firmId: null },
    isSuperAdmin: true
  };

  let statusCode = 200;
  let responseBody = null;
  let nextCalled = false;

  const res = {
    status: function(code) { statusCode = code; return this; },
    json: function(body) { responseBody = body; return this; }
  };

  await firmContext(req, res, () => { nextCalled = true; });

  assert.strictEqual(statusCode, 403, 'Should return 403 Forbidden');
  assert.strictEqual(nextCalled, false, 'Should not call next()');
  assert.strictEqual(responseBody.success, false, 'Response should be unsuccessful');
  assert.strictEqual(responseBody.message, 'Superadmin cannot access firm-scoped routes');

  console.log('✓ SuperAdmin properly blocked from firm-scoped routes');
}

async function testSuperAdminBlockedEvenWithImpersonationHeader() {
  console.log('\n[TEST] SuperAdmin blocked even when sending x-impersonated-firm-id header...');

  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM001',
    firmSlug: 'test-firm',
    name: 'Test Firm',
    status: 'ACTIVE'
  });

  const req = {
    method: 'GET',
    originalUrl: '/api/f/test-firm/cases',
    requestId: 'test-req-2',
    headers: {
      'x-impersonated-firm-id': testFirmId.toString(),
      'x-impersonation-session-id': 'fake-session'
    },
    params: { firmSlug: 'test-firm' },
    user: { role: 'SuperAdmin', firmId: null },
    jwt: { isSuperAdmin: true, firmId: null },
    isSuperAdmin: true
  };

  let statusCode = 200;
  let nextCalled = false;

  const res = {
    status: function(code) { statusCode = code; return this; },
    json: function() { return this; }
  };

  await firmContext(req, res, () => { nextCalled = true; });

  assert.strictEqual(statusCode, 403, 'Should return 403 even with impersonation header');
  assert.strictEqual(nextCalled, false, 'Should not call next()');

  console.log('✓ SuperAdmin blocked even when sending impersonation headers');
}

async function testRegularAdminAccessStillWorks() {
  console.log('\n[TEST] Regular admin access works normally...');

  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM002',
    firmSlug: 'another-firm',
    name: 'Another Firm',
    status: 'ACTIVE'
  });

  const req = {
    method: 'GET',
    originalUrl: '/api/f/another-firm/cases',
    requestId: 'test-req-3',
    headers: {},
    params: { firmSlug: 'another-firm' },
    user: { role: 'Admin', firmId: testFirmId },
    jwt: { firmId: testFirmId.toString(), isSuperAdmin: false },
    isSuperAdmin: false
  };

  let statusCode = 200;
  let nextCalled = false;

  const res = {
    status: function(code) { statusCode = code; return this; },
    json: function() { return this; }
  };

  await firmContext(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true, 'Admin should be allowed through');
  assert.strictEqual(req.firmId, testFirmId.toString(), 'Should attach firmId to request');
  assert.strictEqual(req.firmSlug, 'another-firm', 'Should attach firmSlug to request');

  console.log('✓ Regular admin can access firm context');
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Firm Context Middleware Tests (Impersonation Removed)');
  console.log('='.repeat(60));

  try {
    await testSuperAdminBlockedAlways();
    await testSuperAdminBlockedEvenWithImpersonationHeader();
    await testRegularAdminAccessStillWorks();

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
