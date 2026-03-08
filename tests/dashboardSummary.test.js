const assert = require('assert');

const userRepository = require('../src/repositories/user.repository');
const clientRepository = require('../src/repositories/client.repository');
const caseRepository = require('../src/repositories/case.repository');
const categoryRepository = require('../src/repositories/category.repository');
const tenantMetricsService = require('../src/services/tenantMetrics.service');

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
    getTenantMetrics: tenantMetricsService.getTenantMetrics,
    upsertTenantMetrics: tenantMetricsService.upsertTenantMetrics,
  };

  try {
    userRepository.countUsers = async () => 1;
    clientRepository.countClients = async () => 0;
    caseRepository.countCases = async () => 0;
    categoryRepository.countCategories = async () => 0;
    tenantMetricsService.getTenantMetrics = async () => null;
    tenantMetricsService.upsertTenantMetrics = async () => null;
    delete require.cache[require.resolve('../src/controllers/dashboard.controller')];
    const dashboardController = require('../src/controllers/dashboard.controller');

    const req = { user: { firmId: 'firm-1', role: 'Admin' } };
    const res = createMockRes();
    await dashboardController.getDashboardSummary(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.success, true);
    assert.deepStrictEqual(Object.keys(res.payload.data), ['users', 'clients', 'cases', 'categories']);
    assert.strictEqual(typeof res.payload.data.users, 'number');
    assert.strictEqual(typeof res.payload.data.clients, 'number');
    assert.strictEqual(typeof res.payload.data.cases, 'number');
    assert.strictEqual(typeof res.payload.data.categories, 'number');
    assert.strictEqual(
      res.payload.count,
      res.payload.data.users + res.payload.data.clients + res.payload.data.cases + res.payload.data.categories
    );
    console.log('✓ dashboard summary returns a safe aggregate response shape');

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
    tenantMetricsService.getTenantMetrics = original.getTenantMetrics;
    tenantMetricsService.upsertTenantMetrics = original.upsertTenantMetrics;
  }
};

run().catch((error) => {
  console.error('Dashboard summary tests failed:', error);
  process.exit(1);
});
