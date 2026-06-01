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
    getMyDockets: dashboardService.getMyDockets,
    getOverdueDockets: dashboardService.getOverdueDockets,
    getRecentDockets: dashboardService.getRecentDockets,
    getWorkbasketLoad: dashboardService.getWorkbasketLoad,
    getRiskBrief: dashboardService.getRiskBrief,
  };

  try {
    dashboardService.getMyDockets = async () => ({ items: [], page: 1, limit: 10, total: 0, hasNextPage: false, filter: 'MY' });
    dashboardService.getOverdueDockets = async () => ({ items: [], page: 1, limit: 10, total: 0, hasNextPage: false });
    dashboardService.getRecentDockets = async () => ({ items: [], page: 1, limit: 10, total: 0, hasNextPage: false });
    dashboardService.getWorkbasketLoad = async () => ([]);
    dashboardService.getRiskBrief = async () => ({
      atRiskEntities: 3,
      waitingClient: 2,
      stalePending: 1,
      awaitingApproval: 4,
      overloadedAssignees: [{ assigneeXID: 'X000201', docketCount: 12 }],
      blockedByType: { portal_error: 2, client_documents: 1 },
    });

    delete require.cache[require.resolve('../src/controllers/dashboard.controller')];
    const dashboardController = require('../src/controllers/dashboard.controller');

    const req = { user: { firmId: '67e95f7642adf77d7f4e1834', xID: 'X0001', role: 'Admin' }, query: {} };
    const res = createMockRes();
    await dashboardController.getDashboardSummary(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.success, true);
    assert.deepStrictEqual(Object.keys(res.payload.data), ['myDockets', 'overdueDockets', 'recentDockets', 'workbasketLoad']);
    assert.ok(Array.isArray(res.payload.data.myDockets.items));
    assert.ok(Array.isArray(res.payload.data.overdueDockets.items));
    assert.ok(Array.isArray(res.payload.data.recentDockets.items));
    assert.ok(Array.isArray(res.payload.data.workbasketLoad));
    console.log('✓ dashboard summary returns the action-oriented response shape');

    const missingFirmReq = { user: { role: 'Admin' }, query: {} };
    const missingFirmRes = createMockRes();
    await dashboardController.getDashboardSummary(missingFirmReq, missingFirmRes);

    assert.strictEqual(missingFirmRes.statusCode, 403);
    assert.strictEqual(missingFirmRes.payload.success, false);
    assert.deepStrictEqual(missingFirmRes.payload.data, {});
    console.log('✓ dashboard summary enforces tenant guard');

    const riskReq = { user: { firmId: '67e95f7642adf77d7f4e1834', xID: 'X0001', role: 'Admin' }, query: {} };
    const riskRes = createMockRes();
    await dashboardController.getRiskBrief(riskReq, riskRes);
    assert.strictEqual(riskRes.statusCode, 200);
    assert.strictEqual(riskRes.payload.success, true);
    assert.strictEqual(riskRes.payload.data.atRiskEntities, 3);
    assert.ok(Array.isArray(riskRes.payload.data.overloadedAssignees));
    console.log('✓ dashboard risk brief returns manager-plus risk summary');

    const riskDeniedReq = { user: { firmId: '67e95f7642adf77d7f4e1834', xID: 'X0042', role: 'USER' }, query: {} };
    const riskDeniedRes = createMockRes();
    await dashboardController.getRiskBrief(riskDeniedReq, riskDeniedRes);
    assert.strictEqual(riskDeniedRes.statusCode, 403);
    assert.strictEqual(riskDeniedRes.payload.success, false);
    console.log('✓ dashboard risk brief is restricted to manager and above');
  } finally {
    dashboardService.getMyDockets = original.getMyDockets;
    dashboardService.getOverdueDockets = original.getOverdueDockets;
    dashboardService.getRecentDockets = original.getRecentDockets;
    dashboardService.getWorkbasketLoad = original.getWorkbasketLoad;
    dashboardService.getRiskBrief = original.getRiskBrief;
  }
};

run().catch((error) => {
  console.error('Dashboard summary tests failed:', error);
  process.exit(1);
});
