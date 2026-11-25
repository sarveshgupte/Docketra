#!/usr/bin/env node
const assert = require('assert');
const Module = require('module');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X123456';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || ('$2b$10$' + 'a'.repeat(53));
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(80);
process.env.ENCRYPTION_PROVIDER = 'disabled';

const { PIONEER_COHORT_CONFIG, isFirmPioneerCohort } = require('../src/constants/subscriptionPlans');

console.log('Running pilotCohort26.test.js...');

// 1. Validate 26-firm cohort & 20-firm review trigger constants
assert.strictEqual(PIONEER_COHORT_CONFIG.maxFirms, 26, 'Cohort limit must be 26 firms');
assert.strictEqual(PIONEER_COHORT_CONFIG.pricingReviewThreshold, 20, 'Pricing review trigger must arm at 20 firms');
assert.strictEqual(PIONEER_COHORT_CONFIG.freeDurationDays, 365, 'Pilot cohort duration must be 1 year (365 days)');
assert.strictEqual(PIONEER_COHORT_CONFIG.plan, 'pilot', 'Cohort firms must be provisioned under pilot');
assert.strictEqual(PIONEER_COHORT_CONFIG.maxUsers, null, 'Cohort seats must be unlimited (null)');

const futureExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000);

assert.strictEqual(
  isFirmPioneerCohort({ plan: 'pilot', maxUsers: null, billingStatus: 'free_pioneer_1yr', subscriptionExpiresAt: futureExpiry }),
  true,
  'Active pilot cohort firm must be recognized'
);
assert.strictEqual(
  isFirmPioneerCohort({ plan: 'pilot', maxUsers: null, billingStatus: 'free_pioneer_1yr', subscriptionExpiresAt: pastExpiry }),
  false,
  'Expired pilot cohort firm must not remain active'
);
assert.strictEqual(
  isFirmPioneerCohort({ plan: 'pilot', maxUsers: 10, billingStatus: null }),
  false,
  'Standard post-cohort pilot firm must not be classified as active cohort grant'
);

// 2. Verify superadmin getPlatformStats milestone trigger (at 19, 20, and 26 firms) & unlimited metadata
const originalLoad = Module._load;
let mockedFirmCount = 19;
let mockedRows = [];

function clearModule(relPath) {
  delete require.cache[require.resolve(relPath)];
}

Module._load = function (request, parent, isMain) {
  if (request === 'bcrypt') {
    return {
      hash: async () => 'hashed',
      compare: async () => true,
      genSalt: async () => 'salt',
    };
  }
  if (request === '../models/Firm.model') {
    return {
      countDocuments: async () => mockedFirmCount,
      find: () => ({
        select: () => ({
          sort: () => ({
            lean: async () => mockedRows,
          }),
        }),
      }),
    };
  }
  if (request === '../models/Client.model') {
    return { countDocuments: async () => 0 };
  }
  if (request === '../models/User.model') {
    return {
      countDocuments: async () => 5,
      aggregate: async () => [{ _id: 'firm-1', count: 42 }],
    };
  }
  if (request === '../middleware/wrapWriteHandler') {
    return (fn) => fn;
  }
  return originalLoad.apply(this, arguments);
};

async function run() {
  try {
    clearModule('../src/controllers/superadmin.controller');
    const superadminController = require('../src/controllers/superadmin.controller');

    const invokeStats = async () => {
      let jsonBody = null;
      const res = {
        status: () => res,
        json: (body) => { jsonBody = body; return res; },
      };
      await superadminController.getPlatformStats({ user: { firmId: null } }, res);
      return jsonBody;
    };

    mockedFirmCount = 19;
    const stats19 = await invokeStats();
    assert.strictEqual(stats19.data.pilotCohort.onboardedFirms, 19);
    assert.strictEqual(stats19.data.pilotCohort.pricingReviewTriggered, false);
    assert.strictEqual(stats19.data.pilotCohort.cohortFull, false);
    assert.strictEqual(stats19.data.pilotCohort.remainingSlots, 7);

    mockedFirmCount = 20;
    const stats20 = await invokeStats();
    assert.strictEqual(stats20.data.pilotCohort.pricingReviewTriggered, true, 'Trigger must fire at 20 firms');
    assert.strictEqual(stats20.data.pilotCohort.cohortFull, false);
    assert.strictEqual(stats20.data.pilotCohort.remainingSlots, 6);

    mockedFirmCount = 26;
    const stats26 = await invokeStats();
    assert.strictEqual(stats26.data.pilotCohort.pricingReviewTriggered, true);
    assert.strictEqual(stats26.data.pilotCohort.cohortFull, true, 'Cohort must report full at 26 firms');
    assert.strictEqual(stats26.data.pilotCohort.remainingSlots, 0);

    // Unlimited maxUsers must not report over_capacity in getPlansCapacity
    mockedRows = [
      {
        _id: 'firm-1',
        firmId: 'FIRM001',
        firmSlug: 'pilot-one',
        name: 'Pilot One',
        status: 'active',
        plan: 'pilot',
        maxUsers: null,
        subscriptionStatus: 'active',
        billingStatus: 'free_pioneer_1yr',
        subscriptionExpiresAt: futureExpiry,
      },
    ];
    let plansJson = null;
    const plansRes = {
      status: () => plansRes,
      json: (body) => { plansJson = body; return plansRes; },
    };
    await superadminController.getPlansCapacity({}, plansRes);
    assert.strictEqual(plansJson.data.firms[0].maxUsers, null);
    assert.strictEqual(plansJson.data.firms[0].isUnlimited, true);
    assert.strictEqual(plansJson.data.firms[0].capacityStatus, 'unlimited');
    assert.strictEqual(plansJson.data.totals.overCapacity, 0, 'Unlimited cohort firm must never count as overCapacity');

    // Verify adminController.getFirmPlan returns null/unlimited limits and hides prices
    Module._load = function (request, parent, isMain) {
      if (request === 'bcrypt') {
        return { hash: async () => 'hashed', compare: async () => true, genSalt: async () => 'salt' };
      }
      if (request === '../models/Firm.model') {
        return {
          findById: async () => ({
            _id: 'firm-1',
            firmId: 'FIRM001',
            plan: 'pilot',
            maxUsers: null,
            billingStatus: 'free_pioneer_1yr',
            subscriptionExpiresAt: futureExpiry,
            storage: { mode: 'firm_connected', provider: 'google_drive' },
            settings: { firm: { restrictTraineeDownloads: true } },
          }),
        };
      }
      if (request === '../models/User.model') {
        return { countDocuments: async () => 14 };
      }
      if (request === '../repositories/client.repository') {
        return { count: async () => 85 };
      }
      if (request === '../models/Case.model') {
        return { countDocuments: async () => 120 };
      }
      return originalLoad.apply(this, arguments);
    };

    clearModule('../src/controllers/admin.controller');
    const adminController = require('../src/controllers/admin.controller');
    let firmPlanJson = null;
    const adminRes = {
      status: () => adminRes,
      json: (body) => { firmPlanJson = body; return adminRes; },
    };
    await adminController.getFirmPlan({
      user: { firmId: 'firm-1', firmObjectId: 'firm-1', role: 'PRIMARY_ADMIN' },
      firm: { ownershipFirmId: 'firm-1' },
    }, adminRes);
    assert.strictEqual(firmPlanJson.success, true);
    assert.strictEqual(firmPlanJson.data.plan, 'pilot');
    assert.strictEqual(firmPlanJson.data.isPioneerCohort, true);
    assert.deepStrictEqual(firmPlanJson.data.limits, {
      maxSeats: null,
      maxClients: null,
      maxDocketsMonthly: null,
    });
    for (const option of firmPlanJson.data.upgradeOptions) {
      assert.strictEqual(option.comingSoon, true, `Expected comingSoon=true on ${option.tier}`);
      assert.strictEqual(option.annualPrice, null, `Expected hidden annualPrice on ${option.tier}`);
      assert.strictEqual(option.monthlyPrice, null, `Expected hidden monthlyPrice on ${option.tier}`);
    }

    console.log('✓ All 26-firm pilot cohort & 20-firm milestone tests passed!');
  } finally {
    Module._load = originalLoad;
  }
}

run().catch((err) => {
  console.error('pilotCohort26 test failed:', err);
  process.exit(1);
});
