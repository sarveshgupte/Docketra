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
  const original = docketraIntelligenceService.getWorkloadIntelligence;

  try {
    docketraIntelligenceService.getWorkloadIntelligence = async (params) => ({
      generatedAt: '2026-06-02T00:00:00.000Z',
      summary: { totalMembers: 1, available: 1, moderate: 0, busy: 0, overloaded: 0 },
      recommendations: {
        recommendedAssignee: { xID: 'X100001', availabilityScore: 91, availabilityLabel: 'Available' },
        bestAssignees: [],
        avoidAssigning: [],
        params,
      },
      members: [{ xID: 'X100001', availabilityScore: 91, availabilityLabel: 'Available' }],
    });

    delete require.cache[require.resolve('../src/controllers/docketraIntelligence.controller')];
    const controller = require('../src/controllers/docketraIntelligence.controller');

    for (const role of ['MANAGER', 'ADMIN', 'PRIMARY_ADMIN']) {
      const req = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X999999' },
        query: { assigneeXID: 'X100001' },
      };
      const res = createMockRes();
      await controller.getWorkloadIntelligence(req, res);
      assert.strictEqual(res.statusCode, 200, `${role} should be allowed`);
      assert.strictEqual(res.payload.success, true);
      assert.strictEqual(res.payload.data.recommendations.recommendedAssignee.availabilityScore, 91);
    }

    const deniedReq = {
      user: { firmId: '67e95f7642adf77d7f4e1834', role: 'USER', xID: 'X100002' },
      query: {},
    };
    const deniedRes = createMockRes();
    await controller.getWorkloadIntelligence(deniedReq, deniedRes);
    assert.strictEqual(deniedRes.statusCode, 403);
    assert.strictEqual(deniedRes.payload.success, false);

    console.log('docketraIntelligence.controller.test.js passed');
  } finally {
    docketraIntelligenceService.getWorkloadIntelligence = original;
  }
}

run().catch((error) => {
  console.error('docketraIntelligence.controller.test.js failed', error);
  process.exit(1);
});
