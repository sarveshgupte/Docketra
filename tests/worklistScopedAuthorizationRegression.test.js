const assert = require('node:assert/strict');
const path = require('node:path');

const root = process.cwd();
const mod = (p) => path.resolve(root, p);

const mockModule = (relativePath, exportsValue) => {
  const full = mod(relativePath);
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: exportsValue,
  };
};

const calls = {
  caseFindQueries: [],
  teamFindOneFilter: null,
  userFindOneFilter: null,
};

const mkChain = (payload = []) => ({
  select() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean: async () => payload,
});

let userDoc = { _id: 'u-target', xID: 'X100', role: 'USER', firmId: '507f1f77bcf86cd799439011', teamId: '507f1f77bcf86cd799439012', teamIds: ['507f1f77bcf86cd799439012'] };
let workbasketDoc = { _id: '507f1f77bcf86cd799439012', type: 'PRIMARY', parentWorkbasketId: null };

const UserMock = {
  findOne: (filter) => {
    calls.userFindOneFilter = filter;
    return { select: () => ({ lean: async () => userDoc }) };
  },
};
const TeamMock = {
  findOne: (filter) => {
    calls.teamFindOneFilter = filter;
    return { select: () => ({ lean: async () => workbasketDoc }) };
  },
};
const CaseMock = {
  find: (query) => {
    calls.caseFindQueries.push(query);
    return mkChain([]);
  },
};

mockModule('src/models/User.model.js', UserMock);
mockModule('src/models/Team.model.js', TeamMock);
mockModule('src/models/Case.model.js', CaseMock);
mockModule('src/models/Client.model.js', { find: () => mkChain([]) });
mockModule('src/models/Comment.model.js', { find: () => mkChain([]) });
mockModule('src/models/Attachment.model.js', { find: () => mkChain([]) });
mockModule('src/utils/tenantScope.js', { enforceTenantScope: (q) => ({ ...q, firmId: q.firmId || '507f1f77bcf86cd799439011' }) });
mockModule('src/services/auditLog.service.js', { logCaseListViewed: async () => {} });
mockModule('src/services/caseAction.service.js', { autoReopenExpiredPendingCases: async () => {} });
mockModule('src/services/worklistAccess.service.js', { canViewUserWorklist: () => true });
mockModule('src/utils/log.js', { error: () => {}, warn: () => {} });
mockModule('src/utils/slowLog.js', { logSlowEndpoint: () => {} });
mockModule('src/domain/case/caseStatus.js', { ASSIGNED: 'ASSIGNED', IN_PROGRESS: 'IN_PROGRESS', OPEN: 'OPEN', QC_PENDING: 'QC_PENDING', PENDING: 'PENDING', RESOLVED: 'RESOLVED', FILED: 'FILED' });

const { employeeWorklist } = require('../src/controllers/search.controller');
const routeSchemas = require('../src/schemas/worklist.routes.schema.js');

const mkRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

const hasOrGroup = (query, expectedKeys) => Array.isArray(query?.$and) && query.$and.some((group) => {
  if (!group || !Array.isArray(group.$or)) return false;
  const keys = new Set(group.$or.flatMap((item) => Object.keys(item || {})));
  return expectedKeys.every((k) => keys.has(k));
});

(async () => {
  const baseReqUser = {
    _id: 'u-requester',
    xID: 'X100',
    role: 'USER',
    firmId: '507f1f77bcf86cd799439011',
    teamId: '507f1f77bcf86cd799439012',
    teamIds: ['507f1f77bcf86cd799439012'],
  };

  calls.caseFindQueries = [];
  const req = {
    query: {
      workbasketId: '507f1f77bcf86cd799439012',
      category: 'Tax',
      subcategory: 'Appeal',
      search: 'C-100',
    },
    user: baseReqUser,
  };
  const res = mkRes();
  await employeeWorklist(req, res);
  assert.equal(res.statusCode, 200);
  const q = calls.caseFindQueries[0];
  assert.ok(q, 'expected query capture');
  assert.equal(q.assignedToXID, 'X100');
  assert.deepEqual(q.status.$in, ['ASSIGNED', 'IN_PROGRESS', 'OPEN', 'QC_PENDING']);
  assert.equal(q.category, 'Tax');
  assert.ok(hasOrGroup(q, ['subcategory', 'caseSubCategory']), 'subcategory OR group missing');
  assert.ok(hasOrGroup(q, ['workbasketId', 'ownerTeamId', 'routedToTeamId']), 'workbasket scope OR group missing');
  assert.ok(hasOrGroup(q, ['caseId', 'caseNumber', 'clientId', 'clientName', 'category', 'subcategory', 'caseSubCategory']), 'search OR group missing');

  // invalid workbasket id -> 400
  const res400 = mkRes();
  await employeeWorklist({ query: { workbasketId: 'bad-id' }, user: baseReqUser }, res400);
  assert.equal(res400.statusCode, 400);

  // unknown/cross-firm workbasket -> 404
  workbasketDoc = null;
  const res404 = mkRes();
  await employeeWorklist({ query: { workbasketId: '507f1f77bcf86cd799439099' }, user: baseReqUser }, res404);
  assert.equal(res404.statusCode, 404);
  workbasketDoc = { _id: '507f1f77bcf86cd799439012', type: 'PRIMARY', parentWorkbasketId: null };

  // non-admin without membership -> 403
  const res403 = mkRes();
  await employeeWorklist({ query: { workbasketId: '507f1f77bcf86cd799439012' }, user: { ...baseReqUser, teamId: '507f1f77bcf86cd799439013', teamIds: ['507f1f77bcf86cd799439013'] } }, res403);
  assert.equal(res403.statusCode, 403);

  // admin bypass -> 200
  calls.caseFindQueries = [];
  const resAdmin = mkRes();
  await employeeWorklist({ query: { workbasketId: '507f1f77bcf86cd799439012' }, user: { ...baseReqUser, role: 'ADMIN', teamId: null, teamIds: [] } }, resAdmin);
  assert.equal(resAdmin.statusCode, 200);
  assert.ok(calls.caseFindQueries.length > 0, 'admin should reach query execution');

  // strict schema accepts workbasketId
  const schema = routeSchemas['GET /employee/me'].query;
  const parsed = schema.parse({ workbasketId: '507f1f77bcf86cd799439012', limit: 10 });
  assert.equal(parsed.workbasketId, '507f1f77bcf86cd799439012');

  console.log('worklistScopedAuthorizationRegression.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
