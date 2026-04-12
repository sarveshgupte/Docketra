const { normalizeRole } = require('../utils/role.utils');

const ROLE = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  PRIMARY_ADMIN: 'PRIMARY_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
});

// Module-level permissions for UI/module visibility.
const PERMISSIONS = Object.freeze({
  TEAM_MANAGEMENT: [ROLE.PRIMARY_ADMIN, ROLE.ADMIN],
  CLIENT_MANAGEMENT: [ROLE.PRIMARY_ADMIN, ROLE.ADMIN],
  WORK_SETTINGS: [ROLE.PRIMARY_ADMIN, ROLE.ADMIN],
  FIRM_SETTINGS: [ROLE.PRIMARY_ADMIN, ROLE.ADMIN],
  STORAGE_SETTINGS: [ROLE.PRIMARY_ADMIN],
});

const hasPermission = (permissionKey, role) => {
  const allowed = PERMISSIONS[permissionKey] || [];
  return allowed.includes(normalizeRole(role));
};

module.exports = {
  ROLE,
  PERMISSIONS,
  hasPermission,
};
