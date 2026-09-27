const Firm = require('../models/Firm.model');
const Plan = require('../models/Plan.model');
const User = require('../models/User.model');
const log = require('../utils/log');

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

class PrimaryAdminActionError extends Error {
  constructor() {
    super('Primary admin cannot be deactivated');
    this.name = 'PrimaryAdminActionError';
    this.code = 'PRIMARY_ADMIN_PROTECTED';
    this.statusCode = 403;
  }
}

/**
 * Assert that a user can be deactivated.
 * Throws PrimaryAdminActionError if the user is the primary admin or a system user.
 * @param {object} user - User document
 */
const assertCanDeactivateUser = (user) => {
  const normalizedRole = String(user?.role || '').toUpperCase();
  const isFirmDefaultAdmin = ['ADMIN', 'PRIMARY_ADMIN'].includes(normalizedRole)
    && user?.defaultClientId
    && user?.firmId
    && String(user.defaultClientId) === String(user.firmId);

  if (user.isPrimaryAdmin === true || user.isSystem === true || isFirmDefaultAdmin) {
    throw new PrimaryAdminActionError();
  }
};

/**
 * Assert that a user can be deleted.
 * Throws PrimaryAdminActionError if the user is the primary admin or a system user.
 * @param {object} user - User document
 */
const assertCanDeleteUser = (user) => {
  if (user.isPrimaryAdmin === true || user.isSystem === true) {
    throw new PrimaryAdminActionError();
  }
};

const assertFirmPlanCapacity = async ({ firmId, session, incrementBy = 1, role = null }) => {
  const attachSession = (query) => (session ? query.session(session) : query);

  const firm = await attachSession(Firm.findById(firmId));
  if (!firm) {
    throw new Error('Firm not found');
  }

  const normalizedPlan = String(firm.plan || 'starter').toLowerCase();
  const isAdminRole = ['ADMIN', 'PRIMARY_ADMIN'].includes(String(role || '').toUpperCase());
  const needsAdminCount = normalizedPlan === 'starter' && isAdminRole && incrementBy > 0;

  // ⚡ Bolt Performance Optimization:
  // 💡 What: Grouped sequential `User.countDocuments()` queries into a concurrent `Promise.all`.
  // 🎯 Why: Previously, the total user count and admin user count were awaited sequentially, creating unnecessary network latency. Fetching them concurrently reduces database latency bottlenecks.
  // 📊 Impact: Eliminates sequential database network round-trip overhead when evaluating firm plan capacity for admin roles on the starter plan.
  const countPromises = [
    attachSession(User.countDocuments({
      firmId,
      status: { $in: ['active', 'invited'] },
    }))
  ];

  if (needsAdminCount) {
    countPromises.push(
      attachSession(User.countDocuments({
        firmId,
        role: { $in: ['ADMIN', 'PRIMARY_ADMIN'] },
        status: { $in: ['active', 'invited'] },
      }))
    );
  }

  const [count, adminCount] = await Promise.all(countPromises);

  const firmMaxUsers = Number.isFinite(Number(firm.maxUsers)) ? Number(firm.maxUsers) : null;

  if (firmMaxUsers != null && firmMaxUsers > 0) {
    if ((count + incrementBy) > firmMaxUsers) {
      log.warn('[PLAN_LIMIT] firm capacity exceeded', {
        firmId: firmId?.toString?.() || firmId,
        plan: normalizedPlan,
        maxUsers: firmMaxUsers,
        currentCount: count,
        incrementBy,
      });
      throw new PlanLimitExceededError(firmMaxUsers);
    }
  }

  if (normalizedPlan === 'starter') {
    if (needsAdminCount) {
      if ((adminCount + incrementBy) > 1) {
        log.warn('[PLAN_LIMIT] starter admin capacity exceeded', {
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
    log.warn('[PLAN_LIMIT] capacity exceeded', { firmId: firmId?.toString?.() || firmId, planId: plan._id?.toString?.() || plan._id, maxUsers: plan.maxUsers, currentCount: count, incrementBy });
    throw new PlanLimitExceededError(plan.maxUsers);
  }
};

module.exports = {
  PlanLimitExceededError,
  PlanAdminLimitExceededError,
  PrimaryAdminActionError,
  assertCanDeactivateUser,
  assertCanDeleteUser,
  assertFirmPlanCapacity,
};
