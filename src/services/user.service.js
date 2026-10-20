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
  const firmMaxUsers = Number.isFinite(Number(firm.maxUsers)) ? Number(firm.maxUsers) : null;

  let limitToCheck = null;
  let planIdToLog = null;

  if (firmMaxUsers != null && firmMaxUsers > 0) {
    limitToCheck = firmMaxUsers;
  } else if (normalizedPlan !== 'starter' && firm.planId) {
    const plan = await attachSession(Plan.findById(firm.planId));
    if (plan && plan.maxUsers != null) {
      limitToCheck = plan.maxUsers;
      planIdToLog = plan._id?.toString?.() || plan._id;
    }
  }

  if (limitToCheck != null) {
    // 💡 What: Replaced unconditional User.countDocuments() with conditional User.find().select('_id').limit(N).lean()
    // 🎯 Why: Avoids full index scans and only queries the database if a limit is enforced, returning O(1) when the limit is breached.
    const maxAllowedBeforeIncrement = limitToCheck - incrementBy;
    if (maxAllowedBeforeIncrement < 0) {
      log.warn('[PLAN_LIMIT] capacity exceeded', {
        firmId: firmId?.toString?.() || firmId,
        plan: normalizedPlan,
        maxUsers: limitToCheck,
        currentCount: 0,
        incrementBy,
      });
      throw new PlanLimitExceededError(limitToCheck);
    }

    const existingUsers = await attachSession(User.find({
      firmId,
      status: { $in: ['active', 'invited'] },
    }).select('_id').limit(maxAllowedBeforeIncrement + 1).lean());

    if (existingUsers.length > maxAllowedBeforeIncrement) {
      log.warn('[PLAN_LIMIT] capacity exceeded', {
        firmId: firmId?.toString?.() || firmId,
        planId: planIdToLog,
        plan: normalizedPlan,
        maxUsers: limitToCheck,
        currentCount: existingUsers.length,
        incrementBy,
      });
      throw new PlanLimitExceededError(limitToCheck);
    }
  }

  if (normalizedPlan === 'starter') {
    if (['ADMIN', 'PRIMARY_ADMIN'].includes(String(role || '').toUpperCase()) && incrementBy > 0) {
      // 💡 What: Replaced User.countDocuments() with User.find().select('_id').limit(N).lean()
      // 🎯 Why: countDocuments forces a full index scan. find().limit() provides an O(1) early return upon reaching the threshold.
      const maxAdminBeforeIncrement = 1 - incrementBy;
      if (maxAdminBeforeIncrement < 0) {
        log.warn('[PLAN_LIMIT] starter admin capacity exceeded', {
          firmId: firmId?.toString?.() || firmId,
          adminLimit: 1,
          currentCount: 0,
          incrementBy,
        });
        throw new PlanAdminLimitExceededError(1);
      }

      const existingAdmins = await attachSession(User.find({
        firmId,
        role: { $in: ['ADMIN', 'PRIMARY_ADMIN'] },
        status: { $in: ['active', 'invited'] },
      }).select('_id').limit(maxAdminBeforeIncrement + 1).lean());

      if (existingAdmins.length > maxAdminBeforeIncrement) {
        log.warn('[PLAN_LIMIT] starter admin capacity exceeded', {
          firmId: firmId?.toString?.() || firmId,
          adminLimit: 1,
          currentCount: existingAdmins.length,
          incrementBy,
        });
        throw new PlanAdminLimitExceededError(1);
      }
    }
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
