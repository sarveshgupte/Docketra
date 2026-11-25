#!/usr/bin/env node
const assert = require('assert');
const Firm = require('../src/models/Firm.model');
const User = require('../src/models/User.model');
const {
  assertFirmPlanCapacity,
  PlanLimitExceededError,
  PlanAdminLimitExceededError,
} = require('../src/services/user.service');

async function run() {
  const originalFindById = Firm.findById;
  const originalFind = User.find;
  const originalCountDocuments = User.countDocuments;

  const mockFind = (countGetter) => (query) => ({
    session: function() { return this; },
    select: function() { return this; },
    limit: function(limitNum) {
      return {
        lean: async () => {
          const total = typeof countGetter === 'function' ? await countGetter(query) : countGetter;
          const count = Math.min(total, limitNum);
          return Array.from({ length: count }, (_, i) => ({ _id: `user-${i}` }));
        },
      };
    },
  });

  try {
    Firm.findById = async () => ({ _id: 'firm-1', plan: 'starter', maxUsers: 2 });

    User.countDocuments = async (query) => (query.role ? 1 : 2);
    User.find = mockFind(User.countDocuments);

    let userLimitError = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-1', role: 'Employee' });
    } catch (error) {
      userLimitError = error;
    }
    assert(userLimitError instanceof PlanLimitExceededError, 'Expected starter user limit error');

    User.countDocuments = async (query) => (query.role ? 1 : 1);
    User.find = mockFind(User.countDocuments);

    let adminLimitError = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-1', role: 'Admin' });
    } catch (error) {
      adminLimitError = error;
    }
    assert(adminLimitError instanceof PlanAdminLimitExceededError, 'Expected starter admin limit error');

    Firm.findById = async () => ({ _id: 'firm-2', plan: 'pilot', maxUsers: 10 });
    User.countDocuments = async () => 9;
    User.find = mockFind(User.countDocuments);
    await assertFirmPlanCapacity({ firmId: 'firm-2', role: 'Employee' });

    User.countDocuments = async () => 10;
    User.find = mockFind(User.countDocuments);
    let pilotLimitError = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-2', role: 'Employee' });
    } catch (error) {
      pilotLimitError = error;
    }
    assert(pilotLimitError instanceof PlanLimitExceededError, 'Expected pilot user limit error at 10 users');

    // Verify short-circuit when incrementBy > threshold
    let shortCircuitError = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-2', incrementBy: 15, role: 'Employee' });
    } catch (error) {
      shortCircuitError = error;
    }
    assert(shortCircuitError instanceof PlanLimitExceededError, 'Expected short-circuit error when incrementBy > threshold');

    // Active 26-firm 1-year Pilot Cohort firms allow unlimited users and admins
    const futureExpiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    Firm.findById = async () => ({
      _id: 'firm-cohort',
      plan: 'pilot',
      maxUsers: null,
      billingStatus: 'free_pioneer_1yr',
      subscriptionExpiresAt: futureExpiry,
    });
    User.countDocuments = async () => 250;
    User.find = mockFind(User.countDocuments);
    await assertFirmPlanCapacity({ firmId: 'firm-cohort', incrementBy: 50, role: 'Employee' });
    await assertFirmPlanCapacity({ firmId: 'firm-cohort', incrementBy: 5, role: 'Admin' });

    // Expired cohort grant falls back to bounded capacity when maxUsers is present
    const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
    Firm.findById = async () => ({
      _id: 'firm-expired',
      plan: 'pilot',
      maxUsers: 2,
      billingStatus: 'free_pioneer_1yr',
      subscriptionExpiresAt: pastExpiry,
    });
    User.countDocuments = async () => 2;
    User.find = mockFind(User.countDocuments);
    let expiredErr = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-expired', role: 'Employee' });
    } catch (error) {
      expiredErr = error;
    }
    assert(expiredErr instanceof PlanLimitExceededError, 'Expected expired pioneer grant with bounded maxUsers to enforce limit');

    console.log('User plan limits test passed.');
  } catch (error) {
    console.error('User plan limits test failed:', error);
    process.exit(1);
  } finally {
    Firm.findById = originalFindById;
    User.find = originalFind;
    User.countDocuments = originalCountDocuments;
  }
}

run();
