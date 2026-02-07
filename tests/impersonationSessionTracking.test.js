#!/usr/bin/env node
/**
 * Test Impersonation Session Tracking
 * 
 * Tests:
 * 1. switchFirm generates and returns a sessionId
 * 2. sessionId is logged in SwitchFirm audit metadata
 * 3. exitFirm accepts and logs sessionId in metadata
 * 4. firmContext middleware requires X-Impersonation-Session-Id header
 * 5. firmContext middleware attaches impersonationSessionId to req.context
 * 6. Audit entries include impersonationActive and impersonationSessionId
 */

const assert = require('assert');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Mock database models
const mockFirms = new Map();
const mockAuditLogs = [];
const mockCaseAudits = [];
const mockClientAudits = [];

const mockFirm = {
  findById: async (id) => mockFirms.get(id.toString()),
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
    return data;
  }
};

const mockCaseAudit = {
  create: async (data) => {
    mockCaseAudits.push(data);
    return data;
  }
};

const mockClientAudit = {
  create: async (data) => {
    mockClientAudits.push(data);
    return data;
  }
};

// Mock the models
require.cache[require.resolve('../src/models/Firm.model')] = {
  exports: mockFirm
};

require.cache[require.resolve('../src/models/SuperadminAudit.model')] = {
  exports: mockSuperadminAudit
};

require.cache[require.resolve('../src/models/CaseAudit.model')] = {
  exports: mockCaseAudit
};

require.cache[require.resolve('../src/models/ClientAudit.model')] = {
  exports: mockClientAudit
};

// Load controller and middleware after mocking
const { switchFirm, exitFirm } = require('../src/controllers/superadmin.controller');
const { firmContext } = require('../src/middleware/firmContext');

async function testSwitchFirmGeneratesSessionId() {
  console.log('\n[TEST 1] switchFirm generates and returns sessionId...');
  
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
      _id: new mongoose.Types.ObjectId(),
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
  assert.ok(responseBody.data.sessionId, 'Response should include sessionId');
  
  // Validate sessionId format (UUID v4)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.ok(uuidPattern.test(responseBody.data.sessionId), 'sessionId should be a valid UUID');
  
  console.log('✓ sessionId generated:', responseBody.data.sessionId);
}

async function testSessionIdLoggedInAudit() {
  console.log('\n[TEST 2] sessionId is logged in SwitchFirm audit metadata...');
  
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
    body: { firmId: testFirmId.toString() },
    user: {
      _id: new mongoose.Types.ObjectId(),
      email: 'superadmin@docketra.local',
      role: 'SuperAdmin'
    },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' }
  };
  
  let responseBody = null;
  const res = {
    status: function(code) { return this; },
    json: function(body) {
      responseBody = body;
      return this;
    }
  };
  
  await switchFirm(req, res);
  
  assert.strictEqual(mockAuditLogs.length, 1, 'Should create one audit log');
  assert.strictEqual(mockAuditLogs[0].actionType, 'SwitchFirm', 'Audit should be SwitchFirm type');
  assert.ok(mockAuditLogs[0].metadata.sessionId, 'Audit metadata should include sessionId');
  assert.strictEqual(
    mockAuditLogs[0].metadata.sessionId,
    responseBody.data.sessionId,
    'Audit sessionId should match response sessionId'
  );
  
  console.log('✓ sessionId logged in audit metadata:', mockAuditLogs[0].metadata.sessionId);
}

async function testExitFirmLogsSessionId() {
  console.log('\n[TEST 3] exitFirm accepts and logs sessionId...');
  
  mockAuditLogs.length = 0;
  
  const testSessionId = crypto.randomUUID();
  const req = {
    body: { sessionId: testSessionId },
    user: {
      _id: new mongoose.Types.ObjectId(),
      email: 'superadmin@docketra.local',
      role: 'SuperAdmin'
    },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' }
  };
  
  const res = {
    status: function(code) { return this; },
    json: function(body) { return this; }
  };
  
  await exitFirm(req, res);
  
  assert.strictEqual(mockAuditLogs.length, 1, 'Should create one audit log');
  assert.strictEqual(mockAuditLogs[0].actionType, 'ExitFirm', 'Audit should be ExitFirm type');
  assert.strictEqual(
    mockAuditLogs[0].metadata.sessionId,
    testSessionId,
    'Audit should log the provided sessionId'
  );
  
  console.log('✓ sessionId logged in ExitFirm audit:', mockAuditLogs[0].metadata.sessionId);
}

async function testFirmContextRequiresSessionHeader() {
  console.log('\n[TEST 4] firmContext requires X-Impersonation-Session-Id header...');
  
  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM003',
    firmSlug: 'test-firm-3',
    name: 'Test Firm 3',
    status: 'ACTIVE'
  });
  
  // Test 1: SuperAdmin without session ID should be rejected
  const req = {
    user: {
      _id: new mongoose.Types.ObjectId(),
      email: 'superadmin@docketra.local',
      role: 'SuperAdmin',
      xID: 'X000001'
    },
    jwt: { isSuperAdmin: true },
    headers: {
      'x-impersonated-firm-id': testFirmId.toString()
      // Missing 'x-impersonation-session-id'
    },
    originalUrl: '/api/firms/test-firm-3/cases',
    method: 'GET'
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
  
  const next = () => { nextCalled = true; };
  
  await firmContext(req, res, next);
  
  assert.strictEqual(statusCode, 403, 'Should return 403 Forbidden');
  assert.strictEqual(nextCalled, false, 'Should not call next()');
  assert.ok(responseBody.message.includes('session'), 'Error should mention session');
  
  console.log('✓ Request without session ID rejected');
}

async function testFirmContextAttachesSessionId() {
  console.log('\n[TEST 5] firmContext attaches impersonationSessionId to req.context...');
  
  const testFirmId = new mongoose.Types.ObjectId();
  mockFirms.set(testFirmId.toString(), {
    _id: testFirmId,
    firmId: 'FIRM004',
    firmSlug: 'test-firm-4',
    name: 'Test Firm 4',
    status: 'ACTIVE'
  });
  
  const testSessionId = crypto.randomUUID();
  
  const req = {
    user: {
      _id: new mongoose.Types.ObjectId(),
      email: 'superadmin@docketra.local',
      role: 'SuperAdmin',
      xID: 'X000001'
    },
    jwt: { isSuperAdmin: true },
    headers: {
      'x-impersonated-firm-id': testFirmId.toString(),
      'x-impersonation-session-id': testSessionId
    },
    originalUrl: '/api/firms/test-firm-4/cases',
    method: 'GET'
  };
  
  let nextCalled = false;
  
  const res = {
    status: function(code) { return this; },
    json: function(body) { return this; }
  };
  
  const next = () => { nextCalled = true; };
  
  await firmContext(req, res, next);
  
  assert.strictEqual(nextCalled, true, 'Should call next()');
  assert.ok(req.context, 'req.context should be set');
  assert.strictEqual(req.context.isSuperAdmin, true, 'context should mark SuperAdmin');
  assert.strictEqual(
    req.context.impersonationSessionId,
    testSessionId,
    'context should include sessionId'
  );
  
  console.log('✓ sessionId attached to req.context:', req.context.impersonationSessionId);
}

async function testAuditEntriesIncludeImpersonationFields() {
  console.log('\n[TEST 6] Audit entries include impersonationActive and impersonationSessionId...');
  
  mockCaseAudits.length = 0;
  mockClientAudits.length = 0;
  
  const testSessionId = crypto.randomUUID();
  
  // Simulate a request with impersonation context
  const req = {
    context: {
      isSuperAdmin: true,
      impersonationSessionId: testSessionId
    }
  };
  
  // Load and test audit services
  const { logCaseAction } = require('../src/services/auditLog.service');
  const { logClientFactSheetAction } = require('../src/services/clientFactSheetAudit.service');
  
  // Test CaseAudit
  await logCaseAction({
    caseId: 'CASE-TEST-001',
    actionType: 'CASE_VIEWED',
    description: 'Test case viewed during impersonation',
    performedByXID: 'X000001',
    req
  });
  
  assert.strictEqual(mockCaseAudits.length, 1, 'Should create one case audit');
  assert.strictEqual(mockCaseAudits[0].impersonationActive, true, 'Should mark impersonation active');
  assert.strictEqual(
    mockCaseAudits[0].impersonationSessionId,
    testSessionId,
    'Should include sessionId'
  );
  
  console.log('✓ CaseAudit includes impersonation fields');
  
  // Test ClientAudit
  await logClientFactSheetAction({
    clientId: 'C000001',
    firmId: new mongoose.Types.ObjectId(),
    actionType: 'CLIENT_FACT_SHEET_VIEWED',
    description: 'Test fact sheet viewed during impersonation',
    performedByXID: 'X000001',
    req
  });
  
  assert.strictEqual(mockClientAudits.length, 1, 'Should create one client audit');
  assert.strictEqual(mockClientAudits[0].impersonationActive, true, 'Should mark impersonation active');
  assert.strictEqual(
    mockClientAudits[0].impersonationSessionId,
    testSessionId,
    'Should include sessionId'
  );
  
  console.log('✓ ClientAudit includes impersonation fields');
}

async function runTests() {
  console.log('=================================================');
  console.log('  Impersonation Session Tracking Test Suite');
  console.log('=================================================');
  
  try {
    await testSwitchFirmGeneratesSessionId();
    await testSessionIdLoggedInAudit();
    await testExitFirmLogsSessionId();
    await testFirmContextRequiresSessionHeader();
    await testFirmContextAttachesSessionId();
    await testAuditEntriesIncludeImpersonationFields();
    
    console.log('\n=================================================');
    console.log('  ✓ All tests passed!');
    console.log('=================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n=================================================');
    console.error('  ✗ Test failed!');
    console.error('=================================================');
    console.error(error);
    process.exit(1);
  }
}

runTests();
