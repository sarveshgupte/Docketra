const Firm = require('../models/Firm.model');
const Plan = require('../models/Plan.model');
const User = require('../models/User.model');

class PlanLimitExceededError extends Error {
  constructor(limit) {
    super(`Starter plan allows maximum ${limit} users. Upgrade required.`);
    this.name = 'PlanLimitExceededError';
    this.code = 'PLAN_LIMIT_EXCEEDED';
    this.statusCode = 403;
  }
}

const assertFirmPlanCapacity = async ({ firmId, session, incrementBy = 1 }) => {
  const attachSession = (query) => (session ? query.session(session) : query);

  const firm = await attachSession(Firm.findById(firmId));
  if (!firm) {
    throw new Error('Firm not found');
  }

  const count = await attachSession(User.countDocuments({
    firmId,
    status: { $in: ['active', 'invited'] },
  }));

  if (firm.plan === 'STARTER') {
    const maxUsers = firm.maxUsers || 2;
    if ((count + incrementBy) > maxUsers) {
      console.warn('[PLAN_LIMIT] starter capacity exceeded', {
        firmId: firmId?.toString?.() || firmId,
        maxUsers,
        currentCount: count,
        incrementBy,
      });
      throw new PlanLimitExceededError(maxUsers);
    }
    return;
  }

  if (!firm.planId) return;

  const plan = await attachSession(Plan.findById(firm.planId));
  if (!plan || plan.maxUsers == null) return;

  if ((count + incrementBy) > plan.maxUsers) {
    console.warn('[PLAN_LIMIT] capacity exceeded', { firmId: firmId?.toString?.() || firmId, planId: plan._id?.toString?.() || plan._id, maxUsers: plan.maxUsers, currentCount: count, incrementBy });
    throw new PlanLimitExceededError(plan.maxUsers);
  }
};

module.exports = {
  PlanLimitExceededError,
  assertFirmPlanCapacity,
};
