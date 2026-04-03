const assert = require('assert');
const path = require('path');

// Mock request/response helpers directly since testUtils might not exist or be accessible
const mockRequest = (opts) => ({ ...opts });
const mockResponse = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.jsonData = data; return res; };
  return res;
};

// --- Mock Setup ---
const mockAuditLogService = {
  logCaseHistory: async () => {
    mockAuditLogService.called = true;
    return Promise.resolve();
  },
  called: false
};

const mockCaseRepository = {
  findByCaseId: async (firmId, caseId, role) => {
    if (caseId === 'NOT_FOUND') return null;
    return {
      caseId,
      firmId: 'firm123', // hardcoded because if the user firmId is different_firm, this shouldn't match
      createdByXID: 'creator123',
      assignedToXID: 'assignee123',
    };
  }
};

const mockCaseModel = {
  findOne: (query) => {
    return {
      select: () => {
        if (query.caseId === 'NOT_FOUND') return Promise.resolve(null);
        return Promise.resolve({
          caseId: query.caseId,
          firmId: 'firm123',
          createdByXID: 'creator123',
          assignedToXID: 'assignee123',
        });
      }
    };
  }
};

const mockCaseHistoryModel = {
  find: (query) => {
    return {
      sort: () => ({
        limit: () => ({
          lean: () => Promise.resolve([
            {
              _id: 'history1',
              actionType: 'VIEWED',
              description: 'Case viewed',
              performedByXID: 'user123',
              performedBy: 'user@example.com',
              actorRole: 'USER',
              timestamp: new Date().toISOString(),
              metadata: {},
            }
          ])
        })
      })
    };
  }
};

const wrapWriteHandlerMock = (fn) => fn;

// Inject mocks into require cache
const constantsPath = path.resolve(__dirname, '../src/config/constants.js');
const auditLogPath = path.resolve(__dirname, '../src/services/auditLog.service.js');
const caseRepoPath = path.resolve(__dirname, '../src/repositories/index.js');
const caseModelPath = path.resolve(__dirname, '../src/models/Case.model.js');
const caseHistoryModelPath = path.resolve(__dirname, '../src/models/CaseHistory.model.js');
const wrapWriteHandlerPath = path.resolve(__dirname, '../src/middleware/wrapWriteHandler.js');

require.cache[constantsPath] = {
  id: constantsPath,
  filename: constantsPath,
  loaded: true,
  exports: { CASE_ACTION_TYPES: { CASE_OPENED: 'OPENED', CASE_VIEWED: 'VIEWED', CASE_EXITED: 'EXITED' } }
};

require.cache[auditLogPath] = {
  id: auditLogPath,
  filename: auditLogPath,
  loaded: true,
  exports: mockAuditLogService
};

require.cache[caseRepoPath] = {
  id: caseRepoPath,
  filename: caseRepoPath,
  loaded: true,
  exports: { CaseRepository: mockCaseRepository }
};

require.cache[caseModelPath] = {
  id: caseModelPath,
  filename: caseModelPath,
  loaded: true,
  exports: mockCaseModel
};

require.cache[caseHistoryModelPath] = {
  id: caseHistoryModelPath,
  filename: caseHistoryModelPath,
  loaded: true,
  exports: mockCaseHistoryModel
};

require.cache[wrapWriteHandlerPath] = {
  id: wrapWriteHandlerPath,
  filename: wrapWriteHandlerPath,
  loaded: true,
  exports: wrapWriteHandlerMock
};

// Now require the controller
const caseTrackingController = require('../src/controllers/caseTracking.controller.js');

async function runTests() {
  console.log('--- Testing caseTracking.controller.js ---');

  // 1. trackCaseOpen
  console.log('Testing trackCaseOpen...');

  // 1a. Unauthenticated
  let req = mockRequest({ params: { caseId: 'CASE-123' }, user: null });
  let res = mockResponse();
  await caseTrackingController.trackCaseOpen(req, res);
  assert.strictEqual(res.statusCode, 401, 'Expected 401 for unauthenticated user');

  // 1b. Case Not Found
  req = mockRequest({ params: { caseId: 'NOT_FOUND' }, user: { xID: 'user123', role: 'USER' } });
  res = mockResponse();
  await caseTrackingController.trackCaseOpen(req, res);
  assert.strictEqual(res.statusCode, 404, 'Expected 404 for case not found');

  // 1c. Access Denied (user not creator, not assignee, not admin)
  req = mockRequest({ params: { caseId: 'CASE-123' }, user: { xID: 'randomUser', role: 'USER' } });
  res = mockResponse();
  await caseTrackingController.trackCaseOpen(req, res);
  assert.strictEqual(res.statusCode, 403, 'Expected 403 for unauthorized user');

  // 1d. Success (creator)
  req = mockRequest({ params: { caseId: 'CASE-123' }, user: { xID: 'creator123', role: 'USER', email: 'creator@example.com' } });
  res = mockResponse();
  mockAuditLogService.called = false;
  await caseTrackingController.trackCaseOpen(req, res);
  assert.strictEqual(res.statusCode, 200, 'Expected 200 for successful tracking');
  assert.strictEqual(res.jsonData.success, true);
  // Give a small tick for the async fire-and-forget log to be called
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.strictEqual(mockAuditLogService.called, true, 'Audit log service should be called');


  // 2. trackCaseView
  console.log('Testing trackCaseView...');
  req = mockRequest({ params: { caseId: 'CASE-123' }, user: { xID: 'creator123', role: 'USER', email: 'creator@example.com' } });
  res = mockResponse();
  mockAuditLogService.called = false;
  await caseTrackingController.trackCaseView(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonData.success, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.strictEqual(mockAuditLogService.called, true);


  // 3. trackCaseExit
  console.log('Testing trackCaseExit...');

  // Case exit when case not found shouldn't fail, just return 200 without access check failure
  req = mockRequest({ params: { caseId: 'NOT_FOUND' }, user: { xID: 'creator123', role: 'USER', email: 'creator@example.com' } });
  res = mockResponse();
  mockAuditLogService.called = false;
  await caseTrackingController.trackCaseExit(req, res);
  assert.strictEqual(res.statusCode, 200, 'Should return 200 even if case not found during exit');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.strictEqual(mockAuditLogService.called, true, 'Should still attempt to log exit');

  // Access Denied on exit
  req = mockRequest({ params: { caseId: 'CASE-123' }, user: { xID: 'randomUser', role: 'USER', email: 'random@example.com' } });
  res = mockResponse();
  await caseTrackingController.trackCaseExit(req, res);
  assert.strictEqual(res.statusCode, 403, 'Should return 403 on exit if unauthorized');


  // 4. getCaseHistory
  console.log('Testing getCaseHistory...');

  // Superadmin
  req = mockRequest({ params: { caseId: 'CASE-123' }, user: { xID: 'super', role: 'SUPER_ADMIN' } });
  res = mockResponse();
  await caseTrackingController.getCaseHistory(req, res);
  assert.strictEqual(res.statusCode, 403, 'Superadmin should not access case history');

  // Wrong firm
  req = mockRequest({ params: { caseId: 'CASE-123' }, user: { xID: 'creator123', role: 'USER', firmId: 'different_firm' } });
  res = mockResponse();
  await caseTrackingController.getCaseHistory(req, res);
  assert.strictEqual(res.statusCode, 403, 'Wrong firm should be denied');

  // Success
  req = mockRequest({ params: { caseId: 'CASE-123' }, user: { xID: 'creator123', role: 'USER', firmId: 'firm123' }, firmId: 'firm123' });
  res = mockResponse();
  await caseTrackingController.getCaseHistory(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonData.success, true);
  assert.strictEqual(res.jsonData.data.history.length, 1);
  assert.strictEqual(res.jsonData.data.history[0].actionType, 'VIEWED');

  console.log('All tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
