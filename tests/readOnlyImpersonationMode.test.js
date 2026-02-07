#!/usr/bin/env node
/**
 * Test Read-Only Impersonation Mode
 * 
 * Tests:
 * 1. SuperAdmin can switch to READ_ONLY mode (default)
 * 2. SuperAdmin can switch to FULL_ACCESS mode explicitly
 * 3. Invalid mode returns 400
 * 4. READ_ONLY mode blocks POST/PUT/PATCH/DELETE requests
 * 5. FULL_ACCESS mode allows mutations
 * 6. Audit logs include impersonation mode
 */

const assert = require('assert');
const mongoose = require('mongoose');

// Mock database models
const mockFirms = new Map();
const mockAuditLogs = [];

const mockFirm = {
  findById: async (id) => mockFirms.get(id.toString()),
  findOne: async (query) => {
    if (query.$or) {
      for (const condition of query.$or) {
        if (condition._id) {
          const firm = mockFirms.get(condition._id.toString());
          if (firm) return firm;
        }
        if (condition.firmSlug) {
          for (const [, firm] of mockFirms) {
            if (firm.firmSlug === condition.firmSlug) return firm;
          }
        }
      }
    }
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

// Load controller and middleware after mocking
const { switchFirm } = require('../src/controllers/superadmin.controller');
const { firmContext } = require('../src/middleware/firmContext');

async function testDefaultModeIsReadOnly() {
  console.log('\n[TEST] SuperAdmin switches with READ_ONLY mode by default...');
  
  // Setup test firm
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
    body: { firmId: testFirmId.toString() }, // No mode specified
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
    status: function(code) {
      statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    }
  };
  
  await switchFirm(req, res);
  
  assert.strictEqual(statusCode, 200, 'Should return 200 OK');
  assert.strictEqual(responseBody.success, true, 'Response should be successful');
  assert.strictEqual(responseBody.data.impersonationMode, 'READ_ONLY', 'Default mode should be READ_ONLY');
  
  // Verify audit log includes mode
  assert.strictEqual(mockAuditLogs.length, 1, 'Should create one audit log');
  assert.strictEqual(mockAuditLogs[0].metadata.mode, 'READ_ONLY', 'Audit log should record READ_ONLY mode');
  
  console.log('✓ Default mode is READ_ONLY');
  console.log('✓ Audit log includes impersonation mode');
}

async function testExplicitFullAccessMode() {
  console.log('\n[TEST] SuperAdmin can switch with FULL_ACCESS mode explicitly...');
  
  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM002',
    firmSlug: 'test-firm-2',
    name: 'Test Firm 2',
    status: 'ACTIVE'
  });
  
  mockAuditLogs.length = 0;
  
  const req = {
    body: { 
      firmId: testFirmId.toString(),
      mode: 'FULL_ACCESS'
    },
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
    status: function(code) {
      statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    }
  };
  
  await switchFirm(req, res);
  
  assert.strictEqual(statusCode, 200, 'Should return 200 OK');
  assert.strictEqual(responseBody.success, true, 'Response should be successful');
  assert.strictEqual(responseBody.data.impersonationMode, 'FULL_ACCESS', 'Mode should be FULL_ACCESS');
  
  // Verify audit log includes mode
  assert.strictEqual(mockAuditLogs.length, 1, 'Should create one audit log');
  assert.strictEqual(mockAuditLogs[0].metadata.mode, 'FULL_ACCESS', 'Audit log should record FULL_ACCESS mode');
  
  console.log('✓ Explicit FULL_ACCESS mode is accepted');
  console.log('✓ Audit log includes impersonation mode');
}

async function testInvalidModeReturns400() {
  console.log('\n[TEST] Invalid mode returns 400...');
  
  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM003',
    firmSlug: 'test-firm-3',
    name: 'Test Firm 3',
    status: 'ACTIVE'
  });
  
  mockAuditLogs.length = 0;
  
  const req = {
    body: { 
      firmId: testFirmId.toString(),
      mode: 'INVALID_MODE'
    },
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
    status: function(code) {
      statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    }
  };
  
  await switchFirm(req, res);
  
  assert.strictEqual(statusCode, 400, 'Should return 400 Bad Request');
  assert.strictEqual(responseBody.success, false, 'Response should be unsuccessful');
  assert.ok(responseBody.message.includes('Invalid impersonation mode'), 'Should return proper error message');
  
  console.log('✓ Invalid mode rejected with 400');
}

async function testReadOnlyModeBlocksMutations() {
  console.log('\n[TEST] READ_ONLY mode blocks POST/PUT/PATCH/DELETE requests...');
  
  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM004',
    firmSlug: 'test-firm-4',
    name: 'Test Firm 4',
    status: 'ACTIVE'
  });
  
  // Test POST request in READ_ONLY mode
  const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  for (const method of methods) {
    const req = {
      method,
      originalUrl: '/api/test',
      headers: {
        'x-impersonated-firm-id': testFirmId.toString(),
        'x-impersonation-session-id': 'test-session-id',
        'x-impersonation-mode': 'READ_ONLY'
      },
      user: {
        _id: '000000000000000000000001',
        email: 'superadmin@docketra.local',
        role: 'SuperAdmin'
      },
      jwt: {
        isSuperAdmin: true
      },
      requestId: 'test-request-id'
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
    
    assert.strictEqual(statusCode, 403, `${method} should return 403 Forbidden`);
    assert.strictEqual(responseBody.success, false, 'Response should be unsuccessful');
    assert.ok(responseBody.message.includes('READ_ONLY impersonation mode'), 'Should return read-only error message');
    assert.strictEqual(nextCalled, false, 'next() should not be called');
    
    console.log(`✓ ${method} blocked in READ_ONLY mode`);
  }
}

async function testFullAccessModeAllowsMutations() {
  console.log('\n[TEST] FULL_ACCESS mode allows POST/PUT/PATCH/DELETE requests...');
  
  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM005',
    firmSlug: 'test-firm-5',
    name: 'Test Firm 5',
    status: 'ACTIVE'
  });
  
  // Test POST request in FULL_ACCESS mode
  const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  for (const method of methods) {
    const req = {
      method,
      originalUrl: '/api/test',
      headers: {
        'x-impersonated-firm-id': testFirmId.toString(),
        'x-impersonation-session-id': 'test-session-id',
        'x-impersonation-mode': 'FULL_ACCESS'
      },
      user: {
        _id: '000000000000000000000001',
        email: 'superadmin@docketra.local',
        role: 'SuperAdmin'
      },
      jwt: {
        isSuperAdmin: true
      },
      requestId: 'test-request-id'
    };
    
    let statusCode = 200;
    let nextCalled = false;
    
    const res = {
      status: function(code) {
        statusCode = code;
        return this;
      },
      json: function(body) {
        return this;
      }
    };
    
    const next = () => {
      nextCalled = true;
    };
    
    await firmContext(req, res, next);
    
    assert.strictEqual(nextCalled, true, `${method} should call next() in FULL_ACCESS mode`);
    assert.ok(req.context, 'Request context should be set');
    assert.strictEqual(req.context.impersonationMode, 'FULL_ACCESS', 'Context should include FULL_ACCESS mode');
    
    console.log(`✓ ${method} allowed in FULL_ACCESS mode`);
  }
}

async function testReadOnlyModeAllowsGetRequests() {
  console.log('\n[TEST] READ_ONLY mode allows GET requests...');
  
  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM006',
    firmSlug: 'test-firm-6',
    name: 'Test Firm 6',
    status: 'ACTIVE'
  });
  
  const req = {
    method: 'GET',
    originalUrl: '/api/test',
    headers: {
      'x-impersonated-firm-id': testFirmId.toString(),
      'x-impersonation-session-id': 'test-session-id',
      'x-impersonation-mode': 'READ_ONLY'
    },
    user: {
      _id: '000000000000000000000001',
      email: 'superadmin@docketra.local',
      role: 'SuperAdmin'
    },
    jwt: {
      isSuperAdmin: true
    },
    requestId: 'test-request-id'
  };
  
  let nextCalled = false;
  
  const res = {
    status: function(code) {
      return this;
    },
    json: function(body) {
      return this;
    }
  };
  
  const next = () => {
    nextCalled = true;
  };
  
  await firmContext(req, res, next);
  
  assert.strictEqual(nextCalled, true, 'GET should call next() in READ_ONLY mode');
  assert.ok(req.context, 'Request context should be set');
  assert.strictEqual(req.context.impersonationMode, 'READ_ONLY', 'Context should include READ_ONLY mode');
  
  console.log('✓ GET allowed in READ_ONLY mode');
}

// Run all tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('Running Read-Only Impersonation Mode Tests');
  console.log('='.repeat(60));
  
  try {
    await testDefaultModeIsReadOnly();
    await testExplicitFullAccessMode();
    await testInvalidModeReturns400();
    await testReadOnlyModeBlocksMutations();
    await testFullAccessModeAllowsMutations();
    await testReadOnlyModeAllowsGetRequests();
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ All tests passed!');
    console.log('='.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('✗ Test failed:', error.message);
    console.error('='.repeat(60));
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
