const User = require('../models/User.model');
const { isSuperAdminRole, normalizeRole } = require('../utils/role.utils');

// Action-level permissions for API endpoint authorization checks.
const ROLE_PERMISSIONS = {
  PRIMARY_ADMIN: [
    'CASE_VIEW','CASE_CREATE','CASE_UPDATE','CASE_ACTION','CASE_ASSIGN','CASE_ADMIN_VIEW','USER_VIEW','USER_MANAGE','CLIENT_VIEW','CLIENT_MANAGE','CLIENT_APPROVE','CATEGORY_VIEW','CATEGORY_MANAGE','WORKTYPE_VIEW','WORKTYPE_MANAGE','REPORT_VIEW','TASK_VIEW','TASK_MANAGE','ADMIN_STATS','STORAGE_MANAGE','TEAM_MANAGE','FIRM_SETTINGS','WORK_SETTINGS','WORKBASKET_MANAGE'
  ],
  ADMIN: [
    'CASE_VIEW','CASE_CREATE','CASE_UPDATE','CASE_ACTION','CASE_ASSIGN','CASE_ADMIN_VIEW','USER_VIEW','USER_MANAGE','CLIENT_VIEW','CLIENT_MANAGE','CLIENT_APPROVE','CATEGORY_VIEW','CATEGORY_MANAGE','WORKTYPE_VIEW','WORKTYPE_MANAGE','REPORT_VIEW','TASK_VIEW','TASK_MANAGE','ADMIN_STATS','TEAM_MANAGE','FIRM_SETTINGS','WORK_SETTINGS'
  ],
  MANAGER: [
    'CASE_VIEW','CASE_ACTION','USER_VIEW','TEAM_MEMBER_MANAGE','WORKBASKET_MANAGE'
  ],
  USER: [
    'CASE_VIEW','CASE_CREATE','CASE_UPDATE','CASE_ACTION','USER_VIEW','CLIENT_VIEW','CATEGORY_VIEW','WORKTYPE_VIEW','TASK_VIEW'
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

  const normalizedRole = normalizeRole(membership.role);
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) {
    return null;
  }

  return {
    role: membership.role,
    canonicalRole: normalizedRole,
    permissions,
  };
};

module.exports = {
  ROLE_PERMISSIONS,
  resolveFirmRole,
};
