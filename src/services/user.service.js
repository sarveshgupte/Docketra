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

  // 1. Resolve overall capacity threshold (firmMaxUsers or plan.maxUsers)
  let threshold = null;
  let planIdToLog = null;

  if (firmMaxUsers != null && firmMaxUsers > 0) {
    threshold = firmMaxUsers;
  } else if (normalizedPlan !== 'starter' && firm.planId) {
    const plan = await attachSession(Plan.findById(firm.planId));
    if (plan && plan.maxUsers != null) {
      threshold = plan.maxUsers;
      planIdToLog = plan._id?.toString?.() || plan._id;
    }
  }

  // 2. Enforce overall capacity threshold if resolved
  if (threshold != null) {
    if (incrementBy > threshold) {
      log.warn('[PLAN_LIMIT] capacity exceeded', {
        firmId: firmId?.toString?.() || firmId,
        planId: planIdToLog,
        plan: normalizedPlan,
        maxUsers: threshold,
        incrementBy,
      });
      throw new PlanLimitExceededError(threshold);
    }

    const limit = threshold - incrementBy + 1;
    const existingUsers = await attachSession(
      User.find({
        firmId,
        status: { $in: ['active', 'invited'] },
      })
        .select('_id')
        .limit(limit)
        .lean()
    );

    if (existingUsers.length >= limit) {
      log.warn('[PLAN_LIMIT] capacity exceeded', {
        firmId: firmId?.toString?.() || firmId,
        planId: planIdToLog,
        plan: normalizedPlan,
        maxUsers: threshold,
        currentCount: existingUsers.length,
        incrementBy,
      });
      throw new PlanLimitExceededError(threshold);
    }
  }

  // 3. Apply the same bounded query pattern to the starter plan admin capacity check
  if (normalizedPlan === 'starter') {
    if (['ADMIN', 'PRIMARY_ADMIN'].includes(String(role || '').toUpperCase()) && incrementBy > 0) {
      const adminThreshold = 1;
      if (incrementBy > adminThreshold) {
        log.warn('[PLAN_LIMIT] starter admin capacity exceeded', {
          firmId: firmId?.toString?.() || firmId,
          adminLimit: adminThreshold,
          incrementBy,
        });
        throw new PlanAdminLimitExceededError(adminThreshold);
      }

      const adminLimit = adminThreshold - incrementBy + 1;
      const existingAdmins = await attachSession(
        User.find({
          firmId,
          role: { $in: ['ADMIN', 'PRIMARY_ADMIN'] },
          status: { $in: ['active', 'invited'] },
        })
          .select('_id')
          .limit(adminLimit)
          .lean()
      );

      if (existingAdmins.length >= adminLimit) {
        log.warn('[PLAN_LIMIT] starter admin capacity exceeded', {
          firmId: firmId?.toString?.() || firmId,
          adminLimit: adminThreshold,
          currentCount: existingAdmins.length,
          incrementBy,
        });
        throw new PlanAdminLimitExceededError(adminThreshold);
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
