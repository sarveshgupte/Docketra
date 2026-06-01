const assert = require('assert');
const dashboardService = require('../src/services/dashboard.service');

const createMockRes = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

const run = async () => {
  const original = {
    getPartnerMorningDashboard: dashboardService.getPartnerMorningDashboard,
  };

  try {
    dashboardService.getPartnerMorningDashboard = async (_firmId, params) => ({
      summary: {
        atRiskEntities: 3,
        clientsBlocking: 2,
        filingsAwaitingApproval: 4,
        overloadedTeamMembers: 1,
        exceptionBlockedFilings: 2,
      },
      filtersApplied: params,
      sections: {
        atRiskEntities: [{ caseId: 'CASE-MRN-001' }],
        clientBlockers: [],
        approvalBlockers: [],
        teamLoad: [],
        exceptions: [],
      },
    });

    delete require.cache[require.resolve('../src/controllers/dashboard.controller')];
    const controller = require('../src/controllers/dashboard.controller');

    // 1. Verify ADMIN and PRIMARY_ADMIN are allowed
    const allowedRoles = ['ADMIN', 'PRIMARY_ADMIN'];
    for (const role of allowedRoles) {
      const allowedReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100001' },
        query: { assigneeXID: 'X100001', exceptionType: 'portal_issue' },
        params: {},
        body: {},
      };
      const allowedRes = createMockRes();
      await controller.getPartnerMorningDashboard(allowedReq, allowedRes);
      assert.strictEqual(allowedRes.statusCode, 200, `Role ${role} should be allowed to view morning dashboard`);
      assert.strictEqual(allowedRes.payload.success, true);
      assert.strictEqual(allowedRes.payload.data.summary.atRiskEntities, 3);
      assert.strictEqual(allowedRes.payload.data.filtersApplied.exceptionType, 'portal_issue');
    }

    // 2. Verify USER and MANAGER are blocked
    const deniedRoles = ['USER', 'MANAGER'];
    for (const role of deniedRoles) {
      const deniedReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100002' },
        query: {},
        params: {},
        body: {},
      };
      const deniedRes = createMockRes();
      await controller.getPartnerMorningDashboard(deniedReq, deniedRes);
      assert.strictEqual(deniedRes.statusCode, 403, `Role ${role} should be blocked from morning dashboard`);
      assert.strictEqual(deniedRes.payload.success, false);
    }

    console.log('dashboardPartnerMorning.controller.test.js passed');
  } finally {
    dashboardService.getPartnerMorningDashboard = original.getPartnerMorningDashboard;
  }
};

run().catch((error) => {
  console.error('dashboardPartnerMorning.controller.test.js failed', error);
  process.exit(1);
});
