#!/usr/bin/env node
/**
 * Test Firm Context Middleware with Impersonation
 * 
 * Tests:
 * 1. SuperAdmin without impersonation header gets blocked
 * 2. SuperAdmin with impersonation header gets access
 * 3. Regular admin access still works normally
 * 4. Impersonation context is attached to request
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

async function testSuperAdminBlockedWithoutImpersonation() {
  console.log('\n[TEST] SuperAdmin blocked without impersonation header...');
  
  const req = {
    method: 'GET',
    originalUrl: '/api/f/test-firm/cases',
    requestId: 'test-req-1',
    headers: {},
    params: { firmSlug: 'test-firm' },
    user: {
      role: 'SuperAdmin',
      firmId: null
    },
    jwt: {
      isSuperAdmin: true,
      firmId: null
    },
    isSuperAdmin: true
  };
  
  let statusCode = 200;
  let responseBody = null;
  let nextCalled = false;
  
  const res = {
    status: function(code) {
      statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    }
  };
  
  const next = () => {
    nextCalled = true;
  };
  
  await firmContext(req, res, next);
  
  assert.strictEqual(statusCode, 403, 'Should return 403 Forbidden');
  assert.strictEqual(nextCalled, false, 'Should not call next()');
  assert.strictEqual(responseBody.success, false, 'Response should be unsuccessful');
  assert.strictEqual(responseBody.message, 'Superadmin cannot access firm-scoped routes', 'Should return proper error message');
  
  console.log('✓ SuperAdmin properly blocked without impersonation');
}

async function testSuperAdminAllowedWithImpersonation() {
  console.log('\n[TEST] SuperAdmin allowed with impersonation header...');
  
  // Setup test firm
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
      'x-impersonated-firm-id': testFirmId.toString()
    },
    params: { firmSlug: 'test-firm' },
    user: {
      role: 'SuperAdmin',
      firmId: null
    },
    jwt: {
      isSuperAdmin: true,
      firmId: null
    },
    isSuperAdmin: true
  };
  
  let statusCode = 200;
  let responseBody = null;
  let nextCalled = false;
  
  const res = {
    status: function(code) {
      statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    }
  };
  
  const next = () => {
    nextCalled = true;
  };
  
  await firmContext(req, res, next);
  
  assert.strictEqual(statusCode, 200, 'Should return 200 OK');
  assert.strictEqual(nextCalled, true, 'Should call next()');
  assert.strictEqual(req.firmId, testFirmId.toString(), 'Should attach firmId to request');
  assert.strictEqual(req.firmSlug, 'test-firm', 'Should attach firmSlug to request');
  
  // Verify impersonation context
  assert.strictEqual(req.context?.isSuperAdmin, true, 'Context should mark as SuperAdmin');
  assert.strictEqual(req.context?.isGlobalContext, false, 'Context should not be global');
  assert.strictEqual(req.context?.impersonatedFirmId, testFirmId.toString(), 'Context should contain impersonated firm ID');
  
  console.log('✓ SuperAdmin successfully accessed firm with impersonation');
  console.log('✓ Impersonation context properly attached');
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
    user: {
      role: 'Admin',
      firmId: testFirmId
    },
    jwt: {
      firmId: testFirmId.toString(),
      isSuperAdmin: false
    },
    isSuperAdmin: false
  };
  
  let statusCode = 200;
  let responseBody = null;
  let nextCalled = false;
  
  const res = {
    status: function(code) {
      statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    }
  };
  
  const next = () => {
    nextCalled = true;
  };
  
  await firmContext(req, res, next);
  
  assert.strictEqual(statusCode, 200, 'Should return 200 OK');
  assert.strictEqual(nextCalled, true, 'Should call next()');
  assert.strictEqual(req.firmId, testFirmId.toString(), 'Should attach firmId to request');
  assert.strictEqual(req.firmSlug, 'another-firm', 'Should attach firmSlug to request');
  
  console.log('✓ Regular admin access works normally');
}

async function testInvalidImpersonationFirmId() {
  console.log('\n[TEST] Invalid impersonation firm ID returns error...');
  
  const req = {
    method: 'GET',
    originalUrl: '/api/f/test-firm/cases',
    requestId: 'test-req-4',
    headers: {
      'x-impersonated-firm-id': new mongoose.Types.ObjectId().toString() // Non-existent firm
    },
    params: {},
    user: {
      role: 'SuperAdmin',
      firmId: null
    },
    jwt: {
      isSuperAdmin: true,
      firmId: null
    },
    isSuperAdmin: true
  };
  
  let statusCode = 200;
  let responseBody = null;
  let nextCalled = false;
  
  const res = {
    status: function(code) {
      statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    }
  };
  
  const next = () => {
    nextCalled = true;
  };
  
  await firmContext(req, res, next);
  
  assert.strictEqual(statusCode, 400, 'Should return 400 Bad Request');
  assert.strictEqual(nextCalled, false, 'Should not call next()');
  assert.strictEqual(responseBody.success, false, 'Response should be unsuccessful');
  
  console.log('✓ Invalid impersonation firm ID properly rejected');
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Firm Context Middleware Impersonation Tests');
  console.log('='.repeat(60));
  
  try {
    await testSuperAdminBlockedWithoutImpersonation();
    await testSuperAdminAllowedWithImpersonation();
    await testRegularAdminAccessStillWorks();
    await testInvalidImpersonationFirmId();
    
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

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
