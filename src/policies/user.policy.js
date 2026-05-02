const { isAdminRole, isSuperAdminRole, normalizeRole } = require('../utils/role.utils');

/**
 * User Authorization Policies
 */
const canView = (user) => Boolean(user) && !isSuperAdminRole(user.role) && ['PRIMARY_ADMIN','ADMIN','MANAGER','USER'].includes(normalizeRole(user.role));
const canCreate = (user) => Boolean(user) && !isSuperAdminRole(user.role) && isAdminRole(user.role);
const canUpdate = canCreate;
const canDelete = canCreate;
const canManagePermissions = canCreate;

module.exports = { canView, canCreate, canUpdate, canDelete, canManagePermissions };
