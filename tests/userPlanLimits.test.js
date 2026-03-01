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
  const originalCountDocuments = User.countDocuments;

  try {
    Firm.findById = async () => ({ _id: 'firm-1', plan: 'starter', maxUsers: 2 });

    User.countDocuments = async (query) => {
      if (query.role === 'Admin') return 1;
      return 2;
    };

    let userLimitError = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-1', role: 'Employee' });
    } catch (error) {
      userLimitError = error;
    }
    assert(userLimitError instanceof PlanLimitExceededError, 'Expected starter user limit error');

    User.countDocuments = async (query) => {
      if (query.role === 'Admin') return 1;
      return 1;
    };

    let adminLimitError = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-1', role: 'Admin' });
    } catch (error) {
      adminLimitError = error;
    }
    assert(adminLimitError instanceof PlanAdminLimitExceededError, 'Expected starter admin limit error');

    console.log('User plan limits test passed.');
  } catch (error) {
    console.error('User plan limits test failed:', error);
    process.exit(1);
  } finally {
    Firm.findById = originalFindById;
    User.countDocuments = originalCountDocuments;
  }
}

run();
