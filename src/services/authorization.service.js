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
    'CASE_VIEW','CASE_ACTION','USER_VIEW','TEAM_MEMBER_MANAGE','WORKBASKET_MANAGE','CLIENT_VIEW'
  ],
  USER: [
    'CASE_VIEW','CASE_CREATE','CASE_UPDATE','CASE_ACTION','USER_VIEW','CLIENT_VIEW','CATEGORY_VIEW','WORKTYPE_VIEW','TASK_VIEW'
  ],
};


const normalizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((permission) => typeof permission === 'string' && permission.trim()).map((permission) => permission.trim().toUpperCase()))];
};

const toIdString = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return String(value);
};

const buildRoleContext = (role) => {
  if (!role || isSuperAdminRole(role)) {
    return null;
  }

  const normalizedRole = normalizeRole(role);
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) {
    return null;
  }

  return {
    role,
    canonicalRole: normalizedRole,
    permissions: normalizePermissions(permissions),
  };
};

/**
 * Resolve firm-scoped role and permissions for a user.
 * Uses firm membership (firmId) as the source of truth.
 * Returns null if the user is not part of the firm or inactive.
 */
const resolveFirmRole = async (userId, firmId, identity = {}) => {
  if (!firmId) {
    return null;
  }

  const normalizedUserId = toIdString(userId);
  const normalizedXid = typeof identity?.xID === 'string' ? identity.xID.trim() : null;
  const query = { firmId, isActive: true };

  if (normalizedUserId) query._id = normalizedUserId;
  else if (normalizedXid) query.xID = normalizedXid;
  else return null;

  const membership = await User.findOne(query);

  if (!membership) {
    return null;
  }

  if (isSuperAdminRole(membership.role)) {
    // Defensive: firm membership must never authorize SuperAdmin (platform-scoped)
    return null;
  }

  const roleContext = buildRoleContext(membership.role);
  if (!roleContext) return null;

  const explicitPermissions = normalizePermissions(membership.permissions || membership.firmPermissions);
  return {
    ...roleContext,
    permissions: normalizePermissions([...roleContext.permissions, ...explicitPermissions]),
  };
};

const resolveRequestFirmRole = async (req, firmId) => {
  const requestedFirmId = toIdString(firmId);
  const cachedRole = req?.user?.role || req?.jwt?.role || null;
  const cachedFirmId = toIdString(req?.identity?.firmId || req?.user?.firmId || req?.jwt?.firmId || null);
  const cachedRoleContext = buildRoleContext(cachedRole);

  if (cachedRoleContext && requestedFirmId && cachedFirmId && requestedFirmId === cachedFirmId) {
    const explicitPermissions = normalizePermissions(req?.user?.permissions || req?.jwt?.permissions);
    return {
      ...cachedRoleContext,
      permissions: normalizePermissions([...cachedRoleContext.permissions, ...explicitPermissions]),
    }; 
  }

  const userId = toIdString(req?.userId || req?.user?._id || req?.user?.id || req?.jwt?.userId || null);
  if (!requestedFirmId) {
    return null;
  }

  const cachedXid = typeof req?.user?.xID === 'string' ? req.user.xID : (typeof req?.jwt?.xID === 'string' ? req.jwt.xID : null);
  return resolveFirmRole(userId, requestedFirmId, { xID: cachedXid });
};

module.exports = {
  ROLE_PERMISSIONS,
  buildRoleContext,
  resolveFirmRole,
  resolveRequestFirmRole,
};
