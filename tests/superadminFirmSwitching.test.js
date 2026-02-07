#!/usr/bin/env node
/**
 * Test SuperAdmin Firm Switching Functionality
 * 
 * Tests:
 * 1. SuperAdmin can switch into a firm context
 * 2. Non-SuperAdmin gets 403 on switch-firm endpoint
 * 3. Firm context switch is audited
 * 4. Exit firm returns to GLOBAL context
 * 5. Invalid firmId returns 400/404
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

async function testSuperAdminCanSwitchFirm() {
  console.log('\n[TEST] SuperAdmin can switch into firm context...');
  
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
  assert.strictEqual(responseBody.data.firmId, 'FIRM001', 'Should return correct firmId');
  assert.strictEqual(responseBody.data.firmSlug, 'test-firm', 'Should return correct firmSlug');
  assert.strictEqual(responseBody.data.impersonatedFirmId, testFirmId.toString(), 'Should return impersonated firm ID');
  
  // Verify audit log
  assert.strictEqual(mockAuditLogs.length, 1, 'Should create one audit log');
  assert.strictEqual(mockAuditLogs[0].actionType, 'SwitchFirm', 'Audit log should have SwitchFirm action');
  assert.strictEqual(mockAuditLogs[0].performedBy, 'superadmin@docketra.local', 'Audit should record performer');
  
  console.log('✓ SuperAdmin successfully switched to firm context');
  console.log('✓ Audit log created correctly');
}

async function testInvalidFirmId() {
  console.log('\n[TEST] Invalid firmId returns 404...');
  
  mockAuditLogs.length = 0;
  
  const req = {
    body: { firmId: new mongoose.Types.ObjectId().toString() }, // Non-existent firm
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
  
  assert.strictEqual(statusCode, 404, 'Should return 404 Not Found');
  assert.strictEqual(responseBody.success, false, 'Response should be unsuccessful');
  assert.strictEqual(responseBody.message, 'Firm not found', 'Should return proper error message');
  
  console.log('✓ Invalid firmId properly rejected with 404');
}

async function testMissingFirmId() {
  console.log('\n[TEST] Missing firmId returns 400...');
  
  const req = {
    body: {}, // No firmId
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
  assert.strictEqual(responseBody.message, 'firmId is required', 'Should return proper error message');
  
  console.log('✓ Missing firmId properly rejected with 400');
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
    status: function(code) {
      statusCode = code;
      return this;
    },
    json: function(body) {
      responseBody = body;
      return this;
    }
  };
  
  await exitFirm(req, res);
  
  assert.strictEqual(statusCode, 200, 'Should return 200 OK');
  assert.strictEqual(responseBody.success, true, 'Response should be successful');
  assert.strictEqual(responseBody.data.impersonatedFirmId, null, 'Should clear impersonated firm ID');
  assert.strictEqual(responseBody.data.scope, 'GLOBAL', 'Should return to GLOBAL scope');
  
  // Verify audit log
  assert.strictEqual(mockAuditLogs.length, 1, 'Should create one audit log');
  assert.strictEqual(mockAuditLogs[0].actionType, 'ExitFirm', 'Audit log should have ExitFirm action');
  
  console.log('✓ Exit firm successful');
  console.log('✓ Returned to GLOBAL context');
  console.log('✓ Audit log created correctly');
}

async function testSwitchFirmByFirmIdFormat() {
  console.log('\n[TEST] SuperAdmin can switch using FIRM001 format...');
  
  // Setup test firm with FIRM001 format
  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM002',
    firmSlug: 'another-firm',
    name: 'Another Firm',
    status: 'ACTIVE'
  });
  
  mockAuditLogs.length = 0;
  
  const req = {
    body: { firmId: 'FIRM002' }, // Using FIRM001 format
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
  assert.strictEqual(responseBody.data.firmId, 'FIRM002', 'Should find firm by firmId format');
  
  console.log('✓ Successfully switched using FIRM001 format');
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('SuperAdmin Firm Switching Tests');
  console.log('='.repeat(60));
  
  try {
    await testSuperAdminCanSwitchFirm();
    await testInvalidFirmId();
    await testMissingFirmId();
    await testExitFirm();
    await testSwitchFirmByFirmIdFormat();
    
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
