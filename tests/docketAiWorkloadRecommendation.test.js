const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

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
  let workloadCalls = 0;

  const docket = {
    caseId: 'CASE-AI-001',
    caseNumber: 'CASE-AI-001',
    firmId: '67e95f7642adf77d7f4e1834',
    aiRouting: {
      suggestedTeam: 'GST Pod',
      suggestedWorkbasketId: '67e95f7642adf77d7f4e1835',
      confidence: 0.82,
      status: 'PENDING',
    },
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../models/Case.model') {
      return {
        findOne: async () => docket,
      };
    }
    if (request === '../utils/caseIdentifier') {
      return {
        resolveCaseIdentifier: async () => 'internal-id',
      };
    }
    if (request === '../services/docketraIntelligence.service') {
      return {
        getWorkloadIntelligence: async (params) => {
          workloadCalls += 1;
          assert.strictEqual(params.workbasketId, '67e95f7642adf77d7f4e1835');
          return {
            recommendations: {
              recommendedAssignee: { xID: 'X100001', availabilityScore: 88, availabilityLabel: 'Available' },
              bestAssignees: [{ xID: 'X100001', availabilityScore: 88, availabilityLabel: 'Available' }],
              avoidAssigning: [],
            },
          };
        },
      };
    }
    return originalLoad(request, parent, isMain);
  };

  delete require.cache[require.resolve('../src/controllers/docketAi.controller')];
  const controller = require('../src/controllers/docketAi.controller');

  const managerRes = createMockRes();
  await controller.getAiRoutingSuggestion({
    params: { caseId: 'CASE-AI-001' },
    user: { firmId: '67e95f7642adf77d7f4e1834', role: 'MANAGER', xID: 'X999999' },
  }, managerRes);

  assert.strictEqual(managerRes.statusCode, 200);
  assert.strictEqual(managerRes.payload.assigneeRecommendations.recommendedAssignee.xID, 'X100001');
  assert.strictEqual(workloadCalls, 1);

  const userRes = createMockRes();
  await controller.getAiRoutingSuggestion({
    params: { caseId: 'CASE-AI-001' },
    user: { firmId: '67e95f7642adf77d7f4e1834', role: 'USER', xID: 'X100002' },
  }, userRes);

  assert.strictEqual(userRes.statusCode, 200);
  assert.strictEqual(userRes.payload.assigneeRecommendations, null);
  assert.strictEqual(workloadCalls, 1, 'regular users should not trigger workload recommendation lookup');

  console.log('docketAiWorkloadRecommendation.test.js passed');
}

run().catch((error) => {
  console.error('docketAiWorkloadRecommendation.test.js failed', error);
  process.exit(1);
}).finally(() => {
  Module._load = originalLoad;
});
