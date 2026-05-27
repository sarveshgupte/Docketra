const assert = require('assert');

// Mock request and response
const mockReq = (overrides = {}) => ({
  user: { xID: 'X000123', firmId: 'firm-123', role: 'Employee', allowedCategories: ['CAT1'] },
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
      assignedToXID: 'X000123',
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
const logErrorCalls = [];
const logMock = {
  error: (...args) => { logErrorCalls.push(args); },
  warn: () => {},
};

const userDirectory = new Map();
const UserMock = {
  findOne: (query) => ({
    select: () => ({
      lean: async () => {
        const key = String(query?.xID || '').toUpperCase();
        const user = userDirectory.get(key) || null;
        if (!user) return null;
        if (query?.firmId && String(user.firmId) !== String(query.firmId)) return null;
        return { ...user };
      },
    }),
  }),
};

// Inject mocks before requiring controller
require.cache[require.resolve('../src/models/Case.model')] = { exports: CaseMock };
require.cache[require.resolve('../src/models/Comment.model')] = { exports: CommentMock };
require.cache[require.resolve('../src/models/Attachment.model')] = { exports: AttachmentMock };
require.cache[require.resolve('../src/services/auditLog.service')] = { exports: AuditLogServiceMock };
require.cache[require.resolve('../src/services/caseAction.service')] = { exports: caseActionServiceMock };
require.cache[require.resolve('../src/models/User.model')] = { exports: UserMock };
require.cache[require.resolve('../src/domain/case/caseStatus')] = { exports: { OPEN: 'Open', PENDING: 'Pending' } };
require.cache[require.resolve('../src/utils/log')] = { exports: logMock };

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
  req = mockReq({ user: { xID: 'X000123' } }); // firmId is missing
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
  assert.strictEqual(directSearchCall.$and[1].$or[0].assignedToXID, 'X000123');

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
  req = mockReq({ user: { xID: 'X000777', firmId: 'firm-1', role: 'Admin' }, query: { q: 'adminsearch' } });
  res = mockRes();
  mockCaseFind.length = 0;
  await searchController.globalSearch(req, res);
  assert.strictEqual(res.data.success, true);

  // Admin should NOT have $and restriction
  const adminDirectSearchCall = mockCaseFind[0];
  assert.ok(!adminDirectSearchCall.$and, 'Admin should NOT have $and restriction');
  assert.ok(adminDirectSearchCall.$or, 'Admin should use simple $or for search terms');

  // 6. Error payload is sanitized and includes stable code
  const originalCaseFind = CaseMock.find;
  CaseMock.find = () => {
    throw new Error('DB exploded: internal details');
  };
  req = mockReq({ query: { q: 'boom' } });
  res = mockRes();
  await searchController.globalSearch(req, res);
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.data.success, false);
  assert.strictEqual(res.data.code, 'GLOBAL_SEARCH_FAILED');
  assert.ok(!JSON.stringify(res.data).includes('DB exploded'));
  CaseMock.find = originalCaseFind;

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
  req = mockReq({ user: { xID: 'X000123' }, params: { categoryId: 'CAT1' } }); // firmId missing
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
    user: { xID: 'X000777', firmId: 'firm-1', role: 'Admin', allowedCategories: [] },
    params: { categoryId: 'ANY_CAT' }
  });
  res = mockRes();
  await searchController.categoryWorklist(req, res);
  assert.strictEqual(res.data.success, true);

  const adminQueryCall = mockCaseFind[0];
  assert.strictEqual(adminQueryCall.category, 'ANY_CAT');

  // 7. Error payload is sanitized and includes stable code
  const originalCaseFind = CaseMock.find;
  CaseMock.find = () => {
    throw new Error('category crash: should not leak');
  };
  req = mockReq({ params: { categoryId: 'CAT1' } });
  res = mockRes();
  await searchController.categoryWorklist(req, res);
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.data.code, 'CATEGORY_WORKLIST_FETCH_FAILED');
  assert.ok(!JSON.stringify(res.data).includes('category crash'));
  CaseMock.find = originalCaseFind;

  console.log('categoryWorklist tests passed');
}

async function testEmployeeWorklist() {
  console.log('--- Testing employeeWorklist ---');

  userDirectory.clear();
  userDirectory.set('X000123', { _id: 'user-1', xID: 'X000123', role: 'USER', firmId: 'firm-123', managerId: null, teamIds: ['t-1'] });
  userDirectory.set('X000234', { _id: 'user-2', xID: 'X000234', role: 'USER', firmId: 'firm-123', managerId: 'mgr-1', teamIds: ['t-1'] });
  userDirectory.set('X000345', { _id: 'user-3', xID: 'X000345', role: 'USER', firmId: 'firm-123', managerId: 'other-mgr', teamIds: ['t-9'] });

  // 1. Missing user identity
  let req = mockReq({ user: null });
  let res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 401);

  // 2. Missing firm context
  req = mockReq({ user: { xID: 'X000123' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 400);

  // 3. Successful fetch
  let autoReopenCalled = false;
  caseActionServiceMock.autoReopenExpiredPendingCases = async () => { autoReopenCalled = true; };

  mockCaseFind.length = 0;
  req = mockReq({ user: { _id: 'user-1', xID: 'X000123', firmId: 'firm-123', role: 'USER', allowedCategories: ['CAT1'] } }); // Has user.xID and firmId
  res = mockRes();
  await searchController.employeeWorklist(req, res);

  assert.strictEqual(res.data.success, true);

  const queryCall = mockCaseFind[0];
  assert.strictEqual(queryCall.assignedToXID, 'X000123');
  assert.deepStrictEqual(queryCall.status.$in, ['OPEN', 'PENDING']); // CaseStatus injected mock


  // 3b. No assigned dockets returns 200 with an empty array
  const originalCaseFind = CaseMock.find;
  CaseMock.find = (query) => {
    mockCaseFind.push(query);
    return mockQuery([]);
  };
  req = mockReq({ user: { _id: 'user-1', xID: 'X000123', firmId: 'firm-123', role: 'USER' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode || 200, 200);
  assert.strictEqual(res.data.success, true);
  assert.deepStrictEqual(res.data.data, []);
  CaseMock.find = originalCaseFind;

  // 4. USER cannot view another user
  req = mockReq({ user: { _id: 'user-1', xID: 'X000123', firmId: 'firm-123', role: 'USER' }, query: { assigneeXID: 'X000234' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.data.message, 'You do not have access to this worklist');

  // 5. MANAGER can view managed user
  req = mockReq({ user: { _id: 'mgr-1', xID: 'X000900', firmId: 'firm-123', role: 'MANAGER', teamIds: ['t-1'] }, query: { assigneeXID: 'X000234' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.data.success, true);

  // 6. MANAGER denied for non-managed user
  req = mockReq({ user: { _id: 'mgr-1', xID: 'X000900', firmId: 'firm-123', role: 'MANAGER', teamIds: ['t-1'] }, query: { assigneeXID: 'X000345' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 403);

  // 7. ADMIN and PRIMARY_ADMIN allowed
  req = mockReq({ user: { _id: 'X000777', xID: 'X000777', firmId: 'firm-123', role: 'ADMIN' }, query: { assigneeXID: 'X000234' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.data.success, true);

  req = mockReq({ user: { _id: 'pa-1', xID: 'X000778', firmId: 'firm-123', role: 'PRIMARY_ADMIN' }, query: { assigneeXID: 'X000234' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.data.success, true);

  // 8. SUPER_ADMIN denied in tenant worklist flow
  req = mockReq({ user: { _id: 'sa-1', xID: 'X000999', firmId: 'firm-123', role: 'SUPER_ADMIN' }, query: { assigneeXID: 'X000234' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 403);


  // 9. Cross-firm target denied with generic message
  userDirectory.set('X000456', { _id: 'user-4', xID: 'X000456', role: 'USER', firmId: 'firm-999', managerId: null, teamIds: [] });
  req = mockReq({ user: { _id: 'admin-1', xID: 'X000777', firmId: 'firm-123', role: 'ADMIN' }, query: { assigneeXID: 'X000456' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.data.message, 'You do not have access to this worklist');

  // 10. Unknown assignee does not leak enumeration details
  req = mockReq({ user: { _id: 'admin-1', xID: 'X000777', firmId: 'firm-123', role: 'ADMIN' }, query: { assigneeXID: 'X000999' } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.data.message, 'You do not have access to this worklist');

  // 11. Error payload is sanitized and includes stable code
  const originalUserFindOne = UserMock.findOne;
  UserMock.findOne = () => {
    throw new Error('user lookup exploded');
  };
  req = mockReq({ user: { _id: 'user-1', xID: 'X000123', firmId: 'firm-123', role: 'USER', allowedCategories: ['CAT1'] } });
  res = mockRes();
  await searchController.employeeWorklist(req, res);
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.data.code, 'EMPLOYEE_WORKLIST_FETCH_FAILED');
  assert.ok(!JSON.stringify(res.data).includes('lookup exploded'));
  UserMock.findOne = originalUserFindOne;

  console.log('employeeWorklist tests passed');
}

async function testGlobalWorklist() {
  console.log('--- Testing globalWorklist ---');

  // 1. Missing firm context
  let req = mockReq({ user: { xID: 'X000123' } });
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
  assert.strictEqual(queryCall.assignedToXID, null);
  assert.ok(Array.isArray(queryCall.status.$nin));
  assert.strictEqual(queryCall.status.$nin.length, 2);

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
  const orCondition = onTrackCall.$or || (onTrackCall.$and && onTrackCall.$and.find(c => c.$or)?.$or);
  assert.ok(orCondition, 'Should have $or condition for on_track SLA');
  assert.ok(orCondition[0].slaDueAt.$gt instanceof Date, 'Should check for future due date');
  assert.strictEqual(orCondition[1].slaDueAt, null, 'Should include null SLA cases');


  // 4. terminal status filter must be ignored for active queue
  mockCaseFind.length = 0;
  req = mockReq({ query: { status: 'FILED' } });
  res = mockRes();
  await searchController.globalWorklist(req, res);
  const filedCall = mockCaseFind[0];
  assert.notStrictEqual(filedCall.status, 'FILED', 'terminal status override should be blocked');

  // 5. Error payload is sanitized and includes stable code
  const originalCaseCountDocuments = CaseMock.countDocuments;
  CaseMock.countDocuments = async () => {
    throw new Error('count failed: internal query details');
  };
  req = mockReq({ query: { sortBy: 'clientId' } });
  res = mockRes();
  await searchController.globalWorklist(req, res);
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.data.code, 'GLOBAL_WORKLIST_FETCH_FAILED');
  assert.ok(!JSON.stringify(res.data).includes('count failed'));
  CaseMock.countDocuments = originalCaseCountDocuments;

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
