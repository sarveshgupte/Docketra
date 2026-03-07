const Firm = require('../models/Firm.model');
const Plan = require('../models/Plan.model');
const User = require('../models/User.model');

class PrimaryAdminActionError extends Error {
  constructor(message, code = 'PRIMARY_ADMIN_ACTION_FORBIDDEN') {
    super(message);
    this.name = 'PrimaryAdminActionError';
    this.code = code;
    this.statusCode = 403;
  }
}

const isPrimaryAdmin = (user) => {
  if (!user) return false;
  return user.isPrimaryAdmin === true
    || user.isSystem === true
    || (user.role === 'Admin' && String(user.xID || '').toUpperCase() === 'X000001');
};

const assertCanDeactivateUser = (user) => {
  if (isPrimaryAdmin(user)) {
    throw new PrimaryAdminActionError('Primary admin cannot be deactivated', 'PRIMARY_ADMIN_DEACTIVATION_FORBIDDEN');
  }
};

const assertCanDeleteUser = (user) => {
  if (isPrimaryAdmin(user)) {
    throw new PrimaryAdminActionError('Primary admin cannot be deleted', 'PRIMARY_ADMIN_DELETE_FORBIDDEN');
  }
};

class PlanLimitExceededError extends Error {
  constructor(limit) {
    super(`Starter plan allows maximum ${limit} users. Upgrade required.`);
    this.name = 'PlanLimitExceededError';
    this.code = 'PLAN_LIMIT_EXCEEDED';
    this.statusCode = 403;
  }
}

class PlanAdminLimitExceededError extends Error {
  constructor(limit) {
    super(`Starter plan allows only ${limit} Admin user.`);
    this.name = 'PlanAdminLimitExceededError';
    this.code = 'PLAN_ADMIN_LIMIT_EXCEEDED';
    this.statusCode = 403;
  }
}

const assertFirmPlanCapacity = async ({ firmId, session, incrementBy = 1, role = null }) => {
  const attachSession = (query) => (session ? query.session(session) : query);

  const firm = await attachSession(Firm.findById(firmId));
  if (!firm) {
    throw new Error('Firm not found');
  }

  const count = await attachSession(User.countDocuments({
    firmId,
    status: { $in: ['active', 'invited'] },
  }));

  const normalizedPlan = String(firm.plan || 'starter').toLowerCase();
  if (normalizedPlan === 'starter') {
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

    if (String(role || '').toLowerCase() === 'admin' && incrementBy > 0) {
      const adminCount = await attachSession(User.countDocuments({
        firmId,
        role: 'Admin',
        status: { $in: ['active', 'invited'] },
      }));

      if ((adminCount + incrementBy) > 1) {
        console.warn('[PLAN_LIMIT] starter admin capacity exceeded', {
          firmId: firmId?.toString?.() || firmId,
          adminLimit: 1,
          currentCount: adminCount,
          incrementBy,
        });
        throw new PlanAdminLimitExceededError(1);
      }
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
  PrimaryAdminActionError,
  isPrimaryAdmin,
  assertCanDeactivateUser,
  assertCanDeleteUser,
  PlanLimitExceededError,
  PlanAdminLimitExceededError,
  assertFirmPlanCapacity,
};
