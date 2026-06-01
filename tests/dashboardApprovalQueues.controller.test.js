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
    getApprovalQueues: dashboardService.getApprovalQueues,
    remindApproval: dashboardService.remindApproval,
  };

  try {
    dashboardService.getApprovalQueues = async (_firmId, params) => ({
      summary: {
        myApprovals: 2,
        awaitingPartner: 1,
        awaitingClientSignatory: 1,
        overdueApprovals: 1,
      },
      view: params.view || 'my_approvals',
      items: [{ caseId: 'CASE-APQ-001', status: 'pending', approvalType: 'internal_partner' }],
    });
    dashboardService.remindApproval = async () => ({
      docketId: 'CASE-APQ-001',
      recipients: ['X000900'],
      escalated: true,
    });

    delete require.cache[require.resolve('../src/controllers/dashboard.controller')];
    const controller = require('../src/controllers/dashboard.controller');

    // 1. Verify ADMIN and PRIMARY_ADMIN can fetch approval queues
    const allowedRoles = ['ADMIN', 'PRIMARY_ADMIN'];
    for (const role of allowedRoles) {
      const allowedReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100001' },
        query: { view: 'awaiting_partner' },
        params: {},
        body: {},
      };
      const allowedRes = createMockRes();
      await controller.getApprovalQueues(allowedReq, allowedRes);
      assert.strictEqual(allowedRes.statusCode, 200, `Role ${role} should be allowed to view approval queues`);
      assert.strictEqual(allowedRes.payload.success, true);
      assert.strictEqual(allowedRes.payload.data.summary.awaitingPartner, 1);
      assert.strictEqual(allowedRes.payload.data.view, 'awaiting_partner');
    }

    // 2. Verify USER and MANAGER are blocked from fetching approval queues
    const deniedRoles = ['USER', 'MANAGER'];
    for (const role of deniedRoles) {
      const deniedReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100002' },
        query: {},
        params: {},
        body: {},
      };
      const deniedRes = createMockRes();
      await controller.getApprovalQueues(deniedReq, deniedRes);
      assert.strictEqual(deniedRes.statusCode, 403, `Role ${role} should be blocked from approval queues`);
      assert.strictEqual(deniedRes.payload.success, false);
    }

    // 3. Verify ADMIN and PRIMARY_ADMIN can trigger reminders
    for (const role of allowedRoles) {
      const remindReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100003' },
        params: { caseId: 'CASE-APQ-001' },
        body: { escalate: true },
        query: {},
      };
      const remindRes = createMockRes();
      await controller.remindApproval(remindReq, remindRes);
      assert.strictEqual(remindRes.statusCode, 200, `Role ${role} should be allowed to trigger reminders`);
      assert.strictEqual(remindRes.payload.success, true);
      assert.strictEqual(remindRes.payload.data.escalated, true);
    }

    // 4. Verify USER and MANAGER are blocked from triggering reminders
    for (const role of deniedRoles) {
      const remindReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100004' },
        params: { caseId: 'CASE-APQ-001' },
        body: { escalate: true },
        query: {},
      };
      const remindRes = createMockRes();
      await controller.remindApproval(remindReq, remindRes);
      assert.strictEqual(remindRes.statusCode, 403, `Role ${role} should be blocked from triggering reminders`);
      assert.strictEqual(remindRes.payload.success, false);
    }

    console.log('dashboardApprovalQueues.controller.test.js passed');
  } finally {
    dashboardService.getApprovalQueues = original.getApprovalQueues;
    dashboardService.remindApproval = original.remindApproval;
  }
};

run().catch((error) => {
  console.error('dashboardApprovalQueues.controller.test.js failed', error);
  process.exit(1);
});
