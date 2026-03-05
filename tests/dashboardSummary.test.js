const assert = require('assert');

const dashboardController = require('../src/controllers/dashboard.controller');
const userRepository = require('../src/repositories/user.repository');
const clientRepository = require('../src/repositories/client.repository');
const caseRepository = require('../src/repositories/case.repository');
const categoryRepository = require('../src/repositories/category.repository');

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
    countUsers: userRepository.countUsers,
    countClients: clientRepository.countClients,
    countCases: caseRepository.countCases,
    countCategories: categoryRepository.countCategories,
  };

  try {
    userRepository.countUsers = async () => 1;
    clientRepository.countClients = async () => 0;
    caseRepository.countCases = async () => 0;
    categoryRepository.countCategories = async () => 0;

    const req = { user: { firmId: 'firm-1', role: 'Admin' } };
    const res = createMockRes();
    await dashboardController.getDashboardSummary(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.payload, {
      success: true,
      data: {
        users: 1,
        clients: 0,
        cases: 0,
        categories: 0,
      },
      count: 1,
    });
    console.log('✓ dashboard summary returns first-run safe aggregate data');

    const missingFirmReq = { user: { role: 'Admin' } };
    const missingFirmRes = createMockRes();
    await dashboardController.getDashboardSummary(missingFirmReq, missingFirmRes);

    assert.strictEqual(missingFirmRes.statusCode, 403);
    assert.strictEqual(missingFirmRes.payload.success, false);
    assert.strictEqual(missingFirmRes.payload.count, 0);
    assert.deepStrictEqual(missingFirmRes.payload.data, {});
    console.log('✓ dashboard summary enforces tenant guard');
  } finally {
    userRepository.countUsers = original.countUsers;
    clientRepository.countClients = original.countClients;
    caseRepository.countCases = original.countCases;
    categoryRepository.countCategories = original.countCategories;
  }
};

run().catch((error) => {
  console.error('Dashboard summary tests failed:', error);
  process.exit(1);
});
