const assert = require('assert');

const mockReq = (overrides = {}) => ({
  user: { xID: 'X000001', firmId: '69cfb3f9e4f2388b9b889578', role: 'Admin', teamId: 'NOT_AN_OBJECT_ID' },
  query: { limit: '1' },
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

const mockQuery = (mockData = []) => {
  const q = {
    select: () => q,
    sort: () => q,
    limit: () => q,
    skip: () => q,
    lean: async () => mockData,
  };
  return q;
};

const capturedCaseQueries = [];

const CaseMock = {
  find: (query) => {
    capturedCaseQueries.push(query);
    return mockQuery([
    {
      caseId: 'CASE-001',
      caseName: 'Sample case',
      clientId: 'CLIENT-1',
      category: 'Tax',
      status: 'Open',
      slaDueAt: null,
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      createdBy: 'X000001',
      ownerTeamId: null,
      routedToTeamId: null,
      routingNote: null,
    },
  ]);
  },
  countDocuments: async () => 1,
};

const TeamMock = {
  find: () => mockQuery([]),
};

require.cache[require.resolve('../src/models/Case.model')] = { exports: CaseMock };
require.cache[require.resolve('../src/models/Client.model')] = { exports: { find: () => mockQuery([]) } };
require.cache[require.resolve('../src/models/Comment.model')] = { exports: { find: () => mockQuery([]) } };
require.cache[require.resolve('../src/models/Attachment.model')] = { exports: { find: () => mockQuery([]) } };
require.cache[require.resolve('../src/models/Team.model')] = { exports: TeamMock };
require.cache[require.resolve('../src/services/auditLog.service')] = { exports: { logCaseListViewed: async () => {} } };
require.cache[require.resolve('../src/services/caseAction.service')] = { exports: { autoReopenExpiredPendingCases: async () => {} } };
require.cache[require.resolve('../src/domain/case/caseStatus')] = {
  exports: { OPEN: 'Open', RETURNED: 'Returned', UNASSIGNED: 'Unassigned', ROUTED: 'Routed', IN_PROGRESS: 'In Progress', PENDING: 'Pending', FILED: 'Filed' },
};
require.cache[require.resolve('../src/utils/tenantScope')] = {
  exports: {
    enforceTenantScope: (query, req) => ({ ...query, firmId: req.user.firmId }),
  },
};

const searchController = require('../src/controllers/search.controller');

(async () => {
  const req = mockReq();
  const res = mockRes();

  await searchController.globalWorklist(req, res);

  assert.strictEqual(res.statusCode, undefined);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(Array.isArray(res.data.data), true);
  assert.strictEqual(res.data.data.length, 1);

  const scopedWorkbasketId = '69cfb3f9e4f2388b9b889579';
  capturedCaseQueries.length = 0;
  const scopedReq = mockReq({ query: { limit: '1', workbasketId: scopedWorkbasketId } });
  const scopedRes = mockRes();
  await searchController.globalWorklist(scopedReq, scopedRes);
  assert.strictEqual(scopedRes.data.success, true);
  assert.ok(capturedCaseQueries.length > 0, 'expected global worklist to execute a Case.find query');

  const scopedQuery = capturedCaseQueries[0];
  const queueScopeGroup = (Array.isArray(scopedQuery?.$and) ? scopedQuery.$and : []).find(
    (group) => Array.isArray(group?.$or) && group.$or.some((entry) => Object.prototype.hasOwnProperty.call(entry || {}, 'routedToTeamId')),
  );
  assert.ok(queueScopeGroup, 'global worklist should include queue scoping group');

  const routedBranch = queueScopeGroup.$or.find((entry) => entry?.routedToTeamId && !entry?.$or);
  assert.ok(routedBranch, 'queue scope should include direct routedToTeamId branch');
  assert.strictEqual(String(routedBranch.routedToTeamId), scopedWorkbasketId, 'routed branch must target selected team');

  const fallbackBranch = queueScopeGroup.$or.find((entry) => entry?.routedToTeamId === null && Array.isArray(entry?.$or));
  assert.ok(fallbackBranch, 'queue scope should include owner/workbasket fallback branch when routedToTeamId is null');
  const fallbackKeys = new Set(fallbackBranch.$or.flatMap((entry) => Object.keys(entry || {})));
  assert.ok(fallbackKeys.has('ownerTeamId'), 'fallback branch must include ownerTeamId');
  assert.ok(fallbackKeys.has('workbasketId'), 'fallback branch must include workbasketId');

  console.log('globalWorklist handles non-ObjectId user.teamId without throwing');
})();
