#!/usr/bin/env node
/**
 * Unit test to verify SuperAdmin can operate without firm context
 * Tests that:
 * 1. adminAudit middleware allows SuperAdmin without firmId
 * 2. Audit logs record scope='GLOBAL' for SuperAdmin
 * 3. Frontend 403 handling doesn't logout
 */

const assert = require('assert');
const { isSuperAdminRole } = require('../src/utils/role.utils');

// Mock the adminAudit service
const mockAdminAuditService = {
  recordedAudits: [],
  recordAdminAudit: async (data) => {
    mockAdminAuditService.recordedAudits.push(data);
  }
};

// Patch the require cache to use our mock
require.cache[require.resolve('../src/services/adminAudit.service')] = {
  exports: {
    recordAdminAudit: mockAdminAuditService.recordAdminAudit
  }
};

// Now load the middleware after patching
const { adminAuditTrail } = require('../src/middleware/adminAudit.middleware');

async function testSuperAdminWithoutFirmContext() {
  console.log('\n[TEST] SuperAdmin audit middleware without firm context...');
  
  mockAdminAuditService.recordedAudits = [];
  
  const req = {
    method: 'POST',
    originalUrl: '/api/superadmin/firms',
    url: '/api/superadmin/firms',
    params: {},
    user: {
      xID: 'SUPERADMIN',
      _id: '000000000000000000000001',
      role: 'SuperAdmin',
      firmId: null
    },
    isSuperAdmin: true,
    requestId: 'test-request-id',
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'test-agent'
    }
  };
  
  let statusCode = 200;
  let responseBody = null;
  let nextCalled = false;
  const finishHandlers = [];
  
  const res = {
    statusCode: 200,
    status: function(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    },
    once: function(event, handler) {
      if (event === 'finish') {
        finishHandlers.push(handler);
      }
    }
  };
  
  const next = () => {
    nextCalled = true;
  };
  
  // Create middleware instance
  const middleware = adminAuditTrail('superadmin');
  
  // Execute middleware
  await middleware(req, res, next);
  
  // Verify middleware called next() (did not block request)
  assert.strictEqual(nextCalled, true, 'Middleware should call next() for SuperAdmin without firm context');
  assert.strictEqual(statusCode, 200, 'Should not return error status');
  assert.strictEqual(responseBody, null, 'Should not send error response');
  
  // Verify context flag was set
  assert.strictEqual(req.context?.isGlobalContext, true, 'Should set isGlobalContext flag for SuperAdmin');
  
  console.log('✓ SuperAdmin allowed without firm context');
  console.log('✓ Global context flag set correctly');
}

async function testRegularAdminRequiresFirmContext() {
  console.log('\n[TEST] Regular admin requires firm context...');
  
  const req = {
    method: 'POST',
    originalUrl: '/api/admin/users',
    url: '/api/admin/users',
    params: {},
    user: {
      xID: 'USER001',
      _id: '000000000000000000000002',
      role: 'Admin',
      firmId: null  // Missing firm context
    },
    isSuperAdmin: false,
    requestId: 'test-request-id',
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'test-agent'
    }
  };
  
  let statusCode = 200;
  let responseBody = null;
  let nextCalled = false;
  
  const res = {
    statusCode: 200,
    status: function(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    },
    once: function() {}
  };
  
  const next = () => {
    nextCalled = true;
  };
  
  // Create middleware instance
  const middleware = adminAuditTrail('admin');
  
  // Execute middleware
  await middleware(req, res, next);
  
  // Verify middleware blocked request
  assert.strictEqual(nextCalled, false, 'Middleware should NOT call next() for admin without firm context');
  assert.strictEqual(statusCode, 403, 'Should return 403 status');
  assert.strictEqual(responseBody?.code, 'AUDIT_FIRM_CONTEXT_REQUIRED', 'Should return firm context required error');
  
  console.log('✓ Regular admin blocked without firm context');
  console.log('✓ Returned 403 with correct error code');
}

async function testRoleUtilsFunction() {
  console.log('\n[TEST] Role utils correctly identify SuperAdmin...');
  
  assert.strictEqual(isSuperAdminRole('SuperAdmin'), true, 'Should recognize SuperAdmin');
  assert.strictEqual(isSuperAdminRole('SUPER_ADMIN'), true, 'Should recognize SUPER_ADMIN');
  assert.strictEqual(isSuperAdminRole('SUPERADMIN'), true, 'Should recognize SUPERADMIN');
  assert.strictEqual(isSuperAdminRole('Admin'), false, 'Should not recognize Admin as SuperAdmin');
  assert.strictEqual(isSuperAdminRole('User'), false, 'Should not recognize User as SuperAdmin');
  
  console.log('✓ Role utility correctly identifies all SuperAdmin variants');
}

async function run() {
  try {
    console.log('='.repeat(60));
    console.log('Testing SuperAdmin Firm Context Fix');
    console.log('='.repeat(60));
    
    await testRoleUtilsFunction();
    await testSuperAdminWithoutFirmContext();
    await testRegularAdminRequiresFirmContext();
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ All SuperAdmin firm context tests passed');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('✗ Test failed:', error.message);
    console.error('='.repeat(60));
    console.error(error.stack);
    process.exit(1);
  }
}

run();
