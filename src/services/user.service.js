const Firm = require('../models/Firm.model');
const Plan = require('../models/Plan.model');
const User = require('../models/User.model');

class PlanLimitExceededError extends Error {
  constructor(limit) {
    super(`Your current plan allows only ${limit} users. Please upgrade to add more users.`);
    this.name = 'PlanLimitExceededError';
    this.code = 'PLAN_LIMIT_EXCEEDED';
    this.statusCode = 403;
  }
}

const assertFirmPlanCapacity = async ({ firmId, session }) => {
  const firm = await Firm.findOneAndUpdate(
    { _id: firmId },
    { $set: { subscriptionStatus: null } },
    { new: true, session }
  );

  if (!firm) {
    throw new Error('Firm not found');
  }

  if (!firm.planId) {
    return;
  }

  const plan = await Plan.findById(firm.planId).session(session);
  if (!plan || plan.maxUsers == null) {
    return;
  }

  const count = await User.countDocuments({
    firmId,
    status: { $in: ['active', 'invited', 'ACTIVE', 'INVITED'] },
  }).session(session);

  if (count >= plan.maxUsers) {
    throw new PlanLimitExceededError(plan.maxUsers);
  }
};

module.exports = {
  PlanLimitExceededError,
  assertFirmPlanCapacity,
};
