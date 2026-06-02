const assert = require('assert');
const docketraIntelligenceService = require('../src/services/docketraIntelligence.service');

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

async function run() {
  const original = docketraIntelligenceService.getDeadlineRiskIntelligence;

  try {
    docketraIntelligenceService.getDeadlineRiskIntelligence = async (params) => ({
      generatedAt: '2026-06-02T00:00:00.000Z',
      riskLevel: 'Critical',
      recommendedAction: 'Reassign work immediately.',
      affectedDocketCount: 17,
      counts: {
        overdueDockets: 12,
        dueToday: 1,
        dueThisWeek: 6,
        highPriorityDueThisWeek: 4,
        reviewBottlenecks: 5,
      },
      affectedDockets: [],
      radar: [],
      params,
    });

    delete require.cache[require.resolve('../src/controllers/docketraIntelligence.controller')];
    const controller = require('../src/controllers/docketraIntelligence.controller');

    for (const role of ['MANAGER', 'ADMIN', 'PRIMARY_ADMIN']) {
      const req = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X999999' },
        query: {},
      };
      const res = createMockRes();
      await controller.getDeadlineRiskIntelligence(req, res);
      assert.strictEqual(res.statusCode, 200, `${role} should be allowed`);
      assert.strictEqual(res.payload.success, true);
      assert.strictEqual(res.payload.data.riskLevel, 'Critical');
      assert.strictEqual(res.payload.data.recommendedAction, 'Reassign work immediately.');
    }

    const deniedReq = {
      user: { firmId: '67e95f7642adf77d7f4e1834', role: 'USER', xID: 'X100002' },
      query: {},
    };
    const deniedRes = createMockRes();
    await controller.getDeadlineRiskIntelligence(deniedReq, deniedRes);
    assert.strictEqual(deniedRes.statusCode, 403);
    assert.strictEqual(deniedRes.payload.success, false);

    console.log('docketraDeadlineRisk.controller.test.js passed');
  } finally {
    docketraIntelligenceService.getDeadlineRiskIntelligence = original;
  }
}

run().catch((error) => {
  console.error('docketraDeadlineRisk.controller.test.js failed', error);
  process.exit(1);
});
