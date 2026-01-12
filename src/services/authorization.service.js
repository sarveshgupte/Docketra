const User = require('../models/User.model');
const { isSuperAdminRole } = require('../utils/role.utils');

const ROLE_PERMISSIONS = {
  Admin: [
    'CASE_VIEW',
    'CASE_CREATE',
    'CASE_UPDATE',
    'CASE_ACTION',
    'CASE_ASSIGN',
    'CASE_ADMIN_VIEW',
    'USER_VIEW',
    'USER_MANAGE',
    'CLIENT_VIEW',
    'CLIENT_MANAGE',
    'CLIENT_APPROVE',
    'CATEGORY_VIEW',
    'CATEGORY_MANAGE',
    'REPORT_VIEW',
    'TASK_VIEW',
    'TASK_MANAGE',
    'ADMIN_STATS',
    'STORAGE_MANAGE',
  ],
  Employee: [
    'CASE_VIEW',
    'CASE_CREATE',
    'CASE_UPDATE',
    'CASE_ACTION',
    'USER_VIEW',
    'CLIENT_VIEW',
    'CATEGORY_VIEW',
    'TASK_VIEW',
    'TASK_MANAGE',
  ],
};

/**
 * Resolve firm-scoped role and permissions for a user.
 * Uses firm membership (firmId) as the source of truth.
 * Returns null if the user is not part of the firm or inactive.
 */
const resolveFirmRole = async (userId, firmId) => {
  if (!userId || !firmId) {
    return null;
  }

  const membership = await User.findOne({
    _id: userId,
    firmId,
    isActive: true,
  });

  if (!membership) {
    return null;
  }

  if (isSuperAdminRole(membership.role)) {
    // Defensive: firm membership must never authorize SuperAdmin (platform-scoped)
    return null;
  }

  const permissions = ROLE_PERMISSIONS[membership.role];
  if (!permissions) {
    return null;
  }

  return {
    role: membership.role,
    permissions,
  };
};

module.exports = {
  ROLE_PERMISSIONS,
  resolveFirmRole,
};
