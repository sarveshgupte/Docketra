require('dotenv').config();
const assert = require('assert');
const mongoose = require('mongoose');
const Firm = require('../src/models/Firm.model');
const User = require('../src/models/User.model');
const Client = require('../src/models/Client.model');
const { getDashboardSnapshot } = require('../src/utils/operationalMetrics');
const { listFirms, getPlatformStats, getOperationalHealth, getFirmBySlug } = require('../src/controllers/superadmin.controller');

// Mock utilities
const createMockReq = (overrides = {}) => ({
  user: { _id: new mongoose.Types.ObjectId(), role: 'SuperAdmin', email: 'admin@test.com' },
  params: {},
  body: {},
  ...overrides,
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

// Store original methods
const originalFirmFind = Firm.find;
const originalFirmCountDocuments = Firm.countDocuments;
const originalFirmFindOne = Firm.findOne;
const originalClientCountDocuments = Client.countDocuments;
const originalClientAggregate = Client.aggregate;
const originalUserCountDocuments = User.countDocuments;
const originalUserAggregate = User.aggregate;
const originalUserFind = User.find;



const restoreMocks = () => {
  Firm.find = originalFirmFind;
  Firm.countDocuments = originalFirmCountDocuments;
  Firm.findOne = originalFirmFindOne;
  Client.countDocuments = originalClientCountDocuments;
  Client.aggregate = originalClientAggregate;
  User.countDocuments = originalUserCountDocuments;
  User.aggregate = originalUserAggregate;
  User.find = originalUserFind;
};

async function testListFirms() {
  console.log('Testing listFirms...');

  const mockFirmId = new mongoose.Types.ObjectId();

  Firm.find = () => ({
    select: () => ({
      sort: () => Promise.resolve([
        { _id: mockFirmId, firmId: 'FIRM001', firmSlug: 'firm-001', name: 'Test Firm', status: 'active', createdAt: new Date() }
      ])
    })
  });

  Client.aggregate = () => Promise.resolve([{ _id: mockFirmId, count: 5 }]);
  User.aggregate = () => Promise.resolve([{ _id: mockFirmId, count: 2 }]);

  User.find = () => ({
    select: () => ({
      lean: () => Promise.resolve([
        {
          firmId: mockFirmId,
          email: 'admin@firm001.com',
          emailVerified: true,
          termsAccepted: true
        }
      ])
    })
  });

  const req = createMockReq();
  const res = createMockRes();

  await listFirms(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].firmId, 'FIRM001');
  assert.strictEqual(res.body.data[0].clientCount, 5);
  assert.strictEqual(res.body.data[0].userCount, 2);
  assert.strictEqual(res.body.data[0].adminEmail, 'admin@firm001.com');
  assert.strictEqual(res.body.data[0].emailVerified, true);

  restoreMocks();
  console.log('✅ listFirms tests passed');
}

async function testGetPlatformStats() {
  console.log('Testing getPlatformStats...');

  Firm.countDocuments = async (filter) => {
    if (filter && filter.status === 'active') return 8;
    return 10;
  };
  Client.countDocuments = async () => 50;
  User.countDocuments = async () => 20;

  const req = createMockReq();
  const res = createMockRes();

  await getPlatformStats(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.totalFirms, 10);
  assert.strictEqual(res.body.data.activeFirms, 8);
  assert.strictEqual(res.body.data.inactiveFirms, 2);
  assert.strictEqual(res.body.data.totalClients, 50);
  assert.strictEqual(res.body.data.totalUsers, 20);

  // Test error handling fallback
  Firm.countDocuments = async () => { throw new Error('DB Error'); };

  const errRes = createMockRes();
  await getPlatformStats(req, errRes);

  assert.strictEqual(errRes.statusCode, 200);
  assert.strictEqual(errRes.body.success, false);
  assert.strictEqual(errRes.body.degraded, true);
  assert.strictEqual(errRes.body.data.totalFirms, 0);

  restoreMocks();
  console.log('✅ getPlatformStats tests passed');
}

async function testGetOperationalHealth() {
  console.log('Testing getOperationalHealth...');

  const operationalMetrics = require('../src/utils/operationalMetrics');

  // Test non-SuperAdmin access
  const badReq = createMockReq({ user: { role: 'Admin' } });
  const badRes = createMockRes();

  await getOperationalHealth(badReq, badRes);

  assert.strictEqual(badRes.statusCode, 403);
  assert.strictEqual(badRes.body.success, false);

  // Test SuperAdmin access
  const req = createMockReq();
  const res = createMockRes();

  // Create test data in operationalMetrics instead of overriding the exported function
  operationalMetrics.recordRequest({ firmId: 'FIRM123' });

  await getOperationalHealth(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.timestamp);

  // Just test that the endpoint works and returns firms array
  assert.ok(Array.isArray(res.body.data.firms));

  console.log('✅ getOperationalHealth tests passed');
}

async function testGetFirmBySlug() {
  console.log('Testing getFirmBySlug...');

  // Test missing slug
  const req1 = createMockReq({ params: {} });
  const res1 = createMockRes();
  await getFirmBySlug(req1, res1);
  assert.strictEqual(res1.statusCode, 400);
  assert.strictEqual(res1.body.success, false);

  // Test not found
  Firm.findOne = () => ({
    select: () => Promise.resolve(null)
  });

  const req2 = createMockReq({ params: { firmSlug: 'non-existent' } });
  const res2 = createMockRes();
  await getFirmBySlug(req2, res2);
  assert.strictEqual(res2.statusCode, 404);
  assert.strictEqual(res2.body.success, false);

  // Test success
  Firm.findOne = () => ({
    select: () => Promise.resolve({
      firmId: 'FIRM001',
      firmSlug: 'test-firm',
      name: 'Test Firm',
      status: 'active'
    })
  });

  const req3 = createMockReq({ params: { firmSlug: 'test-firm' } });
  const res3 = createMockRes();
  await getFirmBySlug(req3, res3);
  assert.strictEqual(res3.statusCode, 200);
  assert.strictEqual(res3.body.success, true);
  assert.strictEqual(res3.body.data.firmId, 'FIRM001');
  assert.strictEqual(res3.body.data.isActive, true);

  restoreMocks();
  console.log('✅ getFirmBySlug tests passed');
}

async function run() {
  try {
    await testListFirms();
    await testGetPlatformStats();
    await testGetOperationalHealth();
    await testGetFirmBySlug();

    console.log('\n✅ All superadmin controller tests passed.');
    process.exit(0);
  } catch (error) {
    console.error('✗ SuperAdmin controller test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
