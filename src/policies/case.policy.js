const { isAdminRole, isSuperAdminRole, normalizeRole } = require('../utils/role.utils');

/**
 * Case Authorization Policies
 */
const canView = (user) => Boolean(user) && !isSuperAdminRole(user.role) && ['PRIMARY_ADMIN','ADMIN','MANAGER','USER'].includes(normalizeRole(user.role));
const canCreate = canView;
const canUpdate = canView;
const canDelete = (user) => Boolean(user) && !isSuperAdminRole(user.role) && isAdminRole(user.role);
const canAssign = canDelete;
const canPerformActions = canView;

module.exports = { canView, canCreate, canUpdate, canDelete, canAssign, canPerformActions };
