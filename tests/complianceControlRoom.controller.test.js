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

    const allowedReq = {
      user: { firmId: '67e95f7642adf77d7f4e1834', role: 'MANAGER', xID: 'X100001' },
      query: { obligationType: 'GST' },
      params: {},
      body: {},
    };
    const allowedRes = createMockRes();
    await controller.getComplianceControlRoom(allowedReq, allowedRes);
    assert.strictEqual(allowedRes.statusCode, 200);
    assert.strictEqual(allowedRes.payload.success, true);
    assert.strictEqual(allowedRes.payload.data.summary.overdue, 1);
    assert.strictEqual(allowedRes.payload.data.items[0].obligationType, 'GST');

    const deniedReq = {
      user: { firmId: '67e95f7642adf77d7f4e1834', role: 'USER', xID: 'X100002' },
      query: {},
      params: {},
      body: {},
    };
    const deniedRes = createMockRes();
    await controller.getComplianceControlRoom(deniedReq, deniedRes);
    assert.strictEqual(deniedRes.statusCode, 403);

    const updateReq = {
      user: { firmId: '67e95f7642adf77d7f4e1834', role: 'ADMIN', xID: 'X100003' },
      params: { caseId: 'CASE-20260531-00001' },
      body: { nextState: 'ready_to_file' },
      query: {},
    };
    const updateRes = createMockRes();
    await controller.updateComplianceState(updateReq, updateRes);
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.payload.data.complianceState, 'ready_to_file');

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

