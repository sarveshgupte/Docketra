/**
 * SuperAdmin Authorization Policies
 *
 * Centralized authorization logic for SuperAdmin operations.
 */
const { isSuperAdminRole } = require('../utils/role.utils');

const isSuperAdmin = (user) => {
  if (!user) return false;
  return isSuperAdminRole(user.role);
};

const canAccessPlatform = (user) => isSuperAdmin(user);
const canManageFirms = (user) => isSuperAdmin(user);
const canViewPlatformStats = (user) => isSuperAdmin(user);

/**
 * Explicitly indicate if user is blocked from firm-scoped business data.
 * Contract: returns true for SuperAdmin variants, false for firm users.
 */
const cannotAccessFirmData = (user) => isSuperAdmin(user);

module.exports = {
  isSuperAdmin,
  canAccessPlatform,
  canManageFirms,
  canViewPlatformStats,
  cannotAccessFirmData,
};
