const assert = require('assert');

// Mock request and response
const mockReq = (overrides = {}) => ({
  user: { xID: 'xid-123', firmId: 'firm-123', role: 'Employee', allowedCategories: ['CAT1'] },
  query: {},
  params: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

// Chainable query builder mock
const mockQuery = (mockData = [], count = 0) => {
  const q = {
    select: () => q,
    sort: () => q,
    limit: () => q,
    skip: () => q,
    lean: async () => mockData,
  };
  return q;
};

// Replace models in the require cache to intercept calls in the controller
const mockCaseFind = [];
const mockCaseCount = [];
const CaseMock = {
  find: (query) => {
    mockCaseFind.push(query);
    return mockQuery([{
      _id: 'case-obj-1',
      caseId: 'C-123',
      title: 'Test Case',
      status: 'Open',
      category: 'CAT1',
      clientId: 'client-1',
      clientName: 'Test Client',
      createdAt: new Date('2023-01-01T00:00:00Z'),
      createdBy: 'User1',
      assignedToXID: 'xid-123',
    }]);
  },
  countDocuments: async (query) => {
    mockCaseCount.push(query);
    return 1;
  }
};

const mockCommentFind = [];
const CommentMock = {
  find: (query, options) => {
    mockCommentFind.push(query);
    if (query.$text && query.$text.$search === 'error') {
      throw new Error('Text search not ready'); // Trigger fallback
    }
    return mockQuery([{ caseId: 'C-999' }]);
  }
};

const mockAttachmentFind = [];
const AttachmentMock = {
  find: (query, options) => {
    mockAttachmentFind.push(query);
    if (query.$text && query.$text.$search === 'error') {
      throw new Error('Text search not ready'); // Trigger fallback
    }
    return mockQuery([{ caseId: 'C-888' }]);
  }
};

const AuditLogServiceMock = {
  logCaseListViewed: async () => {}
};

const caseActionServiceMock = {
  autoReopenExpiredPendingCases: async () => {}
};

// Inject mocks before requiring controller
require.cache[require.resolve('../src/models/Case.model')] = { exports: CaseMock };
require.cache[require.resolve('../src/models/Comment.model')] = { exports: CommentMock };
require.cache[require.resolve('../src/models/Attachment.model')] = { exports: AttachmentMock };
require.cache[require.resolve('../src/services/auditLog.service')] = { exports: AuditLogServiceMock };
require.cache[require.resolve('../src/services/caseAction.service')] = { exports: caseActionServiceMock };
require.cache[require.resolve('../src/domain/case/caseStatus')] = { exports: { OPEN: 'Open', PENDING: 'Pending' } };

// Tenant Scope mocked
require.cache[require.resolve('../src/utils/tenantScope')] = {
  exports: {
    enforceTenantScope: (query, req) => ({ ...query, firmId: req.user?.firmId || 'mock-firm-id' })
  }
};

const searchController = require('../src/controllers/search.controller');

async function runTests() {
  console.log('Setup complete');
}

async function testGlobalSearch() {
  console.log('--- Testing globalSearch ---');

  // 1. Missing user identity
  let req = mockReq({ user: null });
  let res = mockRes();
  await searchController.globalSearch(req, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.data.success, false);

  // 2. Missing firm context
  req = mockReq({ user: { xID: 'xid-123' } }); // firmId is missing
  res = mockRes();
  await searchController.globalSearch(req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.data.success, false);

  // 3. Missing search query
  req = mockReq({ query: {} }); // no 'q'
  res = mockRes();
  await searchController.globalSearch(req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.data.success, false);

  // Reset mock call trackers
  mockCaseFind.length = 0;
  mockCommentFind.length = 0;
  mockAttachmentFind.length = 0;

  // 4. Successful search (Employee role)
  req = mockReq({ query: { q: 'test' } });
  res = mockRes();
  await searchController.globalSearch(req, res);
  assert.strictEqual(res.statusCode, undefined); // json called directly
  assert.strictEqual(res.data.success, true);

  // Verify that employee rules were applied in direct search
  const directSearchCall = mockCaseFind[0];
  assert.ok(directSearchCall.$and, 'Employee should have $and restriction');
  assert.strictEqual(directSearchCall.$and[1].$or[0].assignedToXID, 'xid-123');

  // Verify text search fallback mechanism
  req = mockReq({ query: { q: 'error' } }); // 'error' triggers our error mock
  res = mockRes();
  mockCommentFind.length = 0;
  mockAttachmentFind.length = 0;
  await searchController.globalSearch(req, res);
  assert.strictEqual(res.data.success, true);

  assert.strictEqual(mockCommentFind.length, 2);
  assert.ok(mockCommentFind[1].text.$regex, 'Should fallback to regex search');
  assert.strictEqual(mockCommentFind[1].text.$regex, 'error');

  // 5. Successful search (Admin role)
  req = mockReq({ user: { xID: 'admin-1', firmId: 'firm-1', role: 'Admin' }, query: { q: 'adminsearch' } });
  res = mockRes();
  mockCaseFind.length = 0;
  await searchController.globalSearch(req, res);
  assert.strictEqual(res.data.success, true);

  // Admin should NOT have $and restriction
  const adminDirectSearchCall = mockCaseFind[0];
  assert.ok(!adminDirectSearchCall.$and, 'Admin should NOT have $and restriction');
  assert.ok(adminDirectSearchCall.$or, 'Admin should use simple $or for search terms');

  console.log('globalSearch tests passed');
}

async function testCategoryWorklist() {
  console.log('--- Testing categoryWorklist ---');

  // 1. Missing user identity
  let req = mockReq({ user: null });
  let res = mockRes();
  await searchController.categoryWorklist(req, res);
  assert.strictEqual(res.statusCode, 401);

  // 2. Missing categoryId
  req = mockReq(); // params is empty by default
  res = mockRes();
  await searchController.categoryWorklist(req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.data.message, 'Category ID is required');

  // 3. Missing firm context
  req = mockReq({ user: { xID: 'xid-123' }, params: { categoryId: 'CAT1' } }); // firmId missing
  res = mockRes();
  await searchController.categoryWorklist(req, res);
  assert.strictEqual(res.statusCode, 400);

  // 4. Employee unauthorized category
  req = mockReq({ params: { categoryId: 'FORBIDDEN_CAT' } }); // allowed is 'CAT1'
  res = mockRes();
  await searchController.categoryWorklist(req, res);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.data.success, false);

  // 5. Successful fetch (Employee authorized category)
  mockCaseFind.length = 0;
  req = mockReq({ params: { categoryId: 'CAT1' } });
  res = mockRes();
  await searchController.categoryWorklist(req, res);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.length, 1);

  const queryCall = mockCaseFind[0];
  assert.strictEqual(queryCall.category, 'CAT1');
  assert.strictEqual(queryCall.status.$ne, 'Pending');

  // 6. Admin can fetch any category
  mockCaseFind.length = 0;
  req = mockReq({
    user: { xID: 'admin-1', firmId: 'firm-1', role: 'Admin', allowedCategories: [] },
    params: { categoryId: 'ANY_CAT' }
  });
  res = mockRes();
  await searchController.categoryWorklist(req, res);
  assert.strictEqual(res.data.success, true);

  const adminQueryCall = mockCaseFind[0];
  assert.strictEqual(adminQueryCall.category, 'ANY_CAT');

  console.log('categoryWorklist tests passed');
}

async function testEmployeeWorklist() {
  console.log('--- Testing employeeWorklist ---');

  // 1. Missing user identity
  let req = mockReq({ user: null });
  let res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 401);

  // 2. Missing firm context
  req = mockReq({ user: { xID: 'xid-123' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 400);

  // 3. Successful fetch
  let autoReopenCalled = false;
  caseActionServiceMock.autoReopenExpiredPendingCases = async () => { autoReopenCalled = true; };

  mockCaseFind.length = 0;
  req = mockReq(); // Has user.xID and firmId
  res = mockRes();
  await searchController.employeeWorklist(req, res);

  assert.strictEqual(res.data.success, true);
  assert.strictEqual(autoReopenCalled, true, 'autoReopenExpiredPendingCases should be called');

  const queryCall = mockCaseFind[0];
  assert.strictEqual(queryCall.assignedToXID, 'xid-123');
  assert.deepStrictEqual(queryCall.status.$in, ['Open', 'Pending']); // CaseStatus injected mock

  console.log('employeeWorklist tests passed');
}

async function testGlobalWorklist() {
  console.log('--- Testing globalWorklist ---');

  // 1. Missing firm context
  let req = mockReq({ user: { xID: 'xid-123' } });
  let res = mockRes();
  await searchController.globalWorklist(req, res);
  assert.strictEqual(res.statusCode, 400);

  // 2. Default fetch and logic
  mockCaseFind.length = 0;
  req = mockReq({ query: { sortBy: 'clientId', limit: 5 } });
  res = mockRes();
  await searchController.globalWorklist(req, res);

  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.pagination.limit, 5);

  const queryCall = mockCaseFind[0];
  assert.strictEqual(queryCall.status, 'Open');
  assert.strictEqual(queryCall.assignedToXID, null);

  // 3. SLA Filter checks
  mockCaseFind.length = 0;
  req = mockReq({ query: { slaStatus: 'overdue' } });
  res = mockRes();
  await searchController.globalWorklist(req, res);
  assert.strictEqual(res.data.success, true);

  const overdueCall = mockCaseFind[0];
  assert.ok(overdueCall.slaDueAt.$lt instanceof Date, 'Should check for due date less than now');

  // Check on_track filter
  mockCaseFind.length = 0;
  req = mockReq({ query: { slaStatus: 'on_track' } });
  res = mockRes();
  await searchController.globalWorklist(req, res);
  assert.strictEqual(res.data.success, true);

  const onTrackCall = mockCaseFind[0];
  assert.ok(onTrackCall.$or[0].slaDueAt.$gt instanceof Date, 'Should check for future due date');
  assert.strictEqual(onTrackCall.$or[1].slaDueAt, null, 'Should include null SLA cases');

  console.log('globalWorklist tests passed');
}

const originalRunTests = runTests;
runTests = async function() {
  await originalRunTests();
  await testGlobalSearch();
  await testCategoryWorklist();
  await testEmployeeWorklist();
  await testGlobalWorklist();
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
