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
    getComplianceControlRoom: dashboardService.getComplianceControlRoom,
    updateComplianceState: dashboardService.updateComplianceState,
  };

  try {
    dashboardService.getComplianceControlRoom = async (_firmId, filters) => ({
      summary: { dueThisWeek: 2, overdue: 1, awaitingClient: 1, awaitingPartner: 0, readyToFile: 1, blocked: 0, filedRecently: 2 },
      items: [{ caseId: 'CASE-20260531-00001', complianceState: 'in_progress', obligationType: filters.obligationType || '' }],
    });
    dashboardService.updateComplianceState = async () => ({
      caseId: 'CASE-20260531-00001',
      compliance_state: 'ready_to_file',
      blocked_reason: null,
      pend_until: null,
      filed_at: null,
    });

    delete require.cache[require.resolve('../src/controllers/dashboard.controller')];
    const controller = require('../src/controllers/dashboard.controller');

    // 1. Verify Manager and above can view the Control Room calendar
    const rolesToTestRead = ['MANAGER', 'ADMIN', 'PRIMARY_ADMIN'];
    for (const role of rolesToTestRead) {
      const readReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100001' },
        query: { obligationType: 'GST' },
        params: {},
        body: {},
      };
      const readRes = createMockRes();
      await controller.getComplianceControlRoom(readReq, readRes);
      assert.strictEqual(readRes.statusCode, 200, `Role ${role} should be allowed to read control room`);
      assert.strictEqual(readRes.payload.success, true);
      assert.strictEqual(readRes.payload.data.summary.overdue, 1);
      assert.strictEqual(readRes.payload.data.items[0].obligationType, 'GST');
    }

    // 2. Verify USER/Employee-tier roles cannot view the Control Room calendar
    const deniedReadRoles = ['USER', 'EMPLOYEE'];
    for (const role of deniedReadRoles) {
      const readReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100004' },
        query: { obligationType: 'GST' },
        params: {},
        body: {},
      };
      const readRes = createMockRes();
      await controller.getComplianceControlRoom(readReq, readRes);
      assert.strictEqual(readRes.statusCode, 403, `Role ${role} should be blocked from reading control room`);
      assert.strictEqual(readRes.payload.success, false);
    }

    // 3. Verify only ADMIN and PRIMARY_ADMIN can edit state transitions
    const deniedRoles = ['USER', 'MANAGER'];
    for (const role of deniedRoles) {
      const editReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100002' },
        params: { caseId: 'CASE-20260531-00001' },
        body: { nextState: 'ready_to_file' },
        query: {},
      };
      const editRes = createMockRes();
      await controller.updateComplianceState(editReq, editRes);
      assert.strictEqual(editRes.statusCode, 403, `Role ${role} should be blocked from making state edits`);
      assert.strictEqual(editRes.payload.success, false);
    }

    // 4. Verify ADMIN and PRIMARY_ADMIN can successfully edit state transitions
    const allowedRoles = ['ADMIN', 'PRIMARY_ADMIN'];
    for (const role of allowedRoles) {
      const editReq = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X100003' },
        params: { caseId: 'CASE-20260531-00001' },
        body: { nextState: 'ready_to_file' },
        query: {},
      };
      const editRes = createMockRes();
      await controller.updateComplianceState(editReq, editRes);
      assert.strictEqual(editRes.statusCode, 200, `Role ${role} should be allowed to make state edits`);
      assert.strictEqual(editRes.payload.data.complianceState, 'ready_to_file');
    }

    console.log('complianceControlRoom.controller.test.js passed');
  } finally {
    dashboardService.getComplianceControlRoom = original.getComplianceControlRoom;
    dashboardService.updateComplianceState = original.updateComplianceState;
  }
};

run().catch((error) => {
  console.error('complianceControlRoom.controller.test.js failed', error);
  process.exit(1);
});
