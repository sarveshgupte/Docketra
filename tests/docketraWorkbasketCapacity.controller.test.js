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
  const original = docketraIntelligenceService.getWorkbasketCapacityIntelligence;

  try {
    docketraIntelligenceService.getWorkbasketCapacityIntelligence = async (params) => ({
      generatedAt: '2026-06-02T00:00:00.000Z',
      thresholds: { busy: Number(params.thresholds.busy), overloaded: Number(params.thresholds.overloaded) },
      summary: { totalWorkbaskets: 1, healthy: 0, busy: 1, overloaded: 0 },
      workbaskets: [
        {
          workbasketId: '67e95f7642adf77d7f4e1835',
          name: 'GST Team',
          memberCount: 3,
          openDockets: 12,
          overdueDockets: 2,
          totalEstimatedHours: 30,
          totalActualHours: 27,
          averageAvailabilityScore: 19,
          capacityUtilization: 81,
          capacityLabel: 'Busy',
        },
      ],
    });

    delete require.cache[require.resolve('../src/controllers/docketraIntelligence.controller')];
    const controller = require('../src/controllers/docketraIntelligence.controller');

    for (const role of ['MANAGER', 'ADMIN', 'PRIMARY_ADMIN']) {
      const req = {
        user: { firmId: '67e95f7642adf77d7f4e1834', role, xID: 'X999999' },
        query: { busyThreshold: 66, overloadedThreshold: 86, includeQc: false },
      };
      const res = createMockRes();
      await controller.getWorkbasketCapacityIntelligence(req, res);
      assert.strictEqual(res.statusCode, 200, `${role} should be allowed`);
      assert.strictEqual(res.payload.success, true);
      assert.strictEqual(res.payload.data.workbaskets[0].capacityUtilization, 81);
      assert.strictEqual(res.payload.data.workbaskets[0].capacityLabel, 'Busy');
    }

    const deniedReq = {
      user: { firmId: '67e95f7642adf77d7f4e1834', role: 'USER', xID: 'X100002' },
      query: {},
    };
    const deniedRes = createMockRes();
    await controller.getWorkbasketCapacityIntelligence(deniedReq, deniedRes);
    assert.strictEqual(deniedRes.statusCode, 403);
    assert.strictEqual(deniedRes.payload.success, false);

    console.log('docketraWorkbasketCapacity.controller.test.js passed');
  } finally {
    docketraIntelligenceService.getWorkbasketCapacityIntelligence = original;
  }
}

run().catch((error) => {
  console.error('docketraWorkbasketCapacity.controller.test.js failed', error);
  process.exit(1);
});
