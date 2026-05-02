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

    User.countDocuments = async (query) => (query.role ? 1 : 2);

    let userLimitError = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-1', role: 'Employee' });
    } catch (error) {
      userLimitError = error;
    }
    assert(userLimitError instanceof PlanLimitExceededError, 'Expected starter user limit error');

    User.countDocuments = async (query) => (query.role ? 1 : 1);

    let adminLimitError = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-1', role: 'Admin' });
    } catch (error) {
      adminLimitError = error;
    }
    assert(adminLimitError instanceof PlanAdminLimitExceededError, 'Expected starter admin limit error');

    Firm.findById = async () => ({ _id: 'firm-2', plan: 'pilot', maxUsers: 25 });
    User.countDocuments = async () => 24;
    await assertFirmPlanCapacity({ firmId: 'firm-2', role: 'Employee' });

    User.countDocuments = async () => 25;
    let pilotLimitError = null;
    try {
      await assertFirmPlanCapacity({ firmId: 'firm-2', role: 'Employee' });
    } catch (error) {
      pilotLimitError = error;
    }
    assert(pilotLimitError instanceof PlanLimitExceededError, 'Expected pilot user limit error at 25 users');

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
