#!/usr/bin/env node
const assert = require('assert');
const Module = require('module');

// Override require cache for specific dependencies before loading the controller
const originalLoad = Module._load;

// Intercept specific requires
Module._load = function (request, parent, isMain) {
  if (request === '../middleware/wrapWriteHandler') {
    return (fn) => fn;
  }
  if (request === '../services/tenantCaseMetrics.service') {
    return {
      getLatestTenantMetrics: async () => global.mockGetLatestTenantMetrics()
    };
  }
  if (request === '../repositories/user.repository') {
    return {
      countUsers: async (...args) => global.mockCountUsers(...args)
    };
  }
  if (request === '../repositories/client.repository') {
    return {
      countClients: async (...args) => global.mockCountClients(...args)
    };
  }
  if (request === '../repositories/category.repository') {
    return {
      countCategories: async (...args) => global.mockCountCategories(...args)
    };
  }
  if (request === '../services/featureFlags.service') {
    return {
      isExternalStorageEnabled: () => global.mockIsExternalStorageEnabled()
    };
  }
  if (request === '../utils/tenantGuard') {
    return {
      assertFirmContext: () => global.mockAssertFirmContext()
    };
  }
  return originalLoad.apply(this, arguments);
};

const { getAdminStats, updateRestrictedClients, getStorageConfig } = require('../src/controllers/admin.controller');

// Mock Dependencies that use models (mongoose intercepts can just use the models)
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

async function run() {
  let passed = 0;
  let failed = 0;

  console.log('🧪 Starting admin.controller tests...');

  // --- Mock Implementations Setup ---

  const origUserFindOne = User.findOne;
  const origFirmFindById = Firm.findById;

  try {
    // ----------------------------------------------------------------------
    // TEST: getAdminStats
    // ----------------------------------------------------------------------
    console.log('Testing getAdminStats...');
    global.mockAssertFirmContext = () => {};
    global.mockCountUsers = async (tenantId, query) => {
      if (query.status === 'invited') return 5;
      return 100; // totalUsers
    };
    global.mockCountClients = async () => 200;
    global.mockCountCategories = async () => 10;
    global.mockGetLatestTenantMetrics = async () => ({
      pendingApprovals: 2,
      openCases: 50,
      pendedCases: 15,
      filedCases: 5,
      resolvedCases: 100,
      overdueCases: 3,
      avgResolutionTimeSeconds: 86400, // 1 day
      date: '2023-01-01',
    });

    const reqStats = { user: { firmId: 'firm123' } };
    const resStats = createMockRes();

    await getAdminStats(reqStats, resStats);

    assert.strictEqual(resStats.statusCode, 200);
    assert.strictEqual(resStats.body.success, true);
    assert.deepStrictEqual(resStats.body.data, {
      totalUsers: 100,
      totalClients: 200,
      totalCategories: 10,
      pendingApprovals: 7, // 2 (metrics) + 5 (invited)
      allOpenCases: 50,
      allPendingCases: 15,
      filedCases: 5,
      resolvedCases: 100,
      overdueCases: 3,
      avgResolutionTimeSeconds: 86400,
      metricsDate: '2023-01-01',
    });
    console.log('  ✅ getAdminStats returned expected stats');
    passed++;

    // ----------------------------------------------------------------------
    // TEST: updateRestrictedClients
    // ----------------------------------------------------------------------
    console.log('Testing updateRestrictedClients...');

    // Test 1: Missing xID
    const reqRestrict1 = { params: {}, body: { restrictedClientIds: [] } };
    const resRestrict1 = createMockRes();
    await updateRestrictedClients(reqRestrict1, resRestrict1);
    assert.strictEqual(resRestrict1.statusCode, 400);
    assert.strictEqual(resRestrict1.body.message, 'xID is required');

    // Test 2: Missing Array
    const reqRestrict2 = { params: { xID: 'U123' }, body: {} };
    const resRestrict2 = createMockRes();
    await updateRestrictedClients(reqRestrict2, resRestrict2);
    assert.strictEqual(resRestrict2.statusCode, 400);
    assert.strictEqual(resRestrict2.body.message, 'restrictedClientIds must be an array');

    // Test 3: Success
    let savedUser = null;
    User.findOne = async (query) => {
      if (query.xID === 'U123') {
        return {
          xID: 'U123',
          restrictedClientIds: [],
          save: async function() {
             savedUser = this;
             return this;
          }
        };
      }
      return null;
    };

    const reqRestrict3 = {
      params: { xID: 'U123' },
      body: { restrictedClientIds: ['C123456', 'C654321'] },
      user: { firmId: 'firm123' }
    };
    const resRestrict3 = createMockRes();
    await updateRestrictedClients(reqRestrict3, resRestrict3);

    assert.strictEqual(resRestrict3.statusCode, 200);
    assert.strictEqual(resRestrict3.body.success, true);
    assert.deepStrictEqual(savedUser.restrictedClientIds, ['C123456', 'C654321']);
    assert.deepStrictEqual(resRestrict3.body.data.restrictedClientIds, ['C123456', 'C654321']);
    console.log('  ✅ updateRestrictedClients handled success and validation');
    passed++;

    // ----------------------------------------------------------------------
    // TEST: getStorageConfig
    // ----------------------------------------------------------------------
    console.log('Testing getStorageConfig...');

    // Mock feature flag
    global.mockIsExternalStorageEnabled = () => true;

    // Test 1: Success with existing config
    Firm.findById = () => ({
      select: async () => ({
        firmId: 'firm123',
        name: 'Test Firm',
        storage: { mode: 'google_drive', provider: 'google' }
      })
    });

    const reqStorage = { user: { firmId: 'firm123' } };
    const resStorage = createMockRes();
    await getStorageConfig(reqStorage, resStorage);

    assert.strictEqual(resStorage.statusCode, 200);
    assert.strictEqual(resStorage.body.success, true);
    assert.deepStrictEqual(resStorage.body.data, {
      mode: 'google_drive',
      provider: 'google',
      capabilities: {
        externalStorageEnabled: true
      }
    });

    // Test 2: Fallback to docketra_managed
    Firm.findById = () => ({
      select: async () => ({
        firmId: 'firm123',
        name: 'Test Firm'
      })
    });

    const resStorage2 = createMockRes();
    await getStorageConfig(reqStorage, resStorage2);

    assert.strictEqual(resStorage2.statusCode, 200);
    assert.strictEqual(resStorage2.body.data.mode, 'docketra_managed');
    assert.strictEqual(resStorage2.body.data.provider, null);
    console.log('  ✅ getStorageConfig returned correct configs and defaults');
    passed++;


  } catch (error) {
    console.error('❌ Test failed with error:', error);
    failed++;
  } finally {
    // Restore mocks
    User.findOne = origUserFindOne;
    Firm.findById = origFirmFindById;
    Module._load = originalLoad;
  }

  console.log(`\nTests completed: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(console.error);
