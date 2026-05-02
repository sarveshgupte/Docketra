const { isAdminRole, isSuperAdminRole, normalizeRole } = require('../utils/role.utils');

const CLIENT_VIEW_ROLES = new Set(['PRIMARY_ADMIN', 'ADMIN', 'MANAGER']);

const canView = (user) => Boolean(user) && !isSuperAdminRole(user.role) && CLIENT_VIEW_ROLES.has(normalizeRole(user.role));
const canCreate = (user) => Boolean(user) && !isSuperAdminRole(user.role) && isAdminRole(user.role);
const canUpdate = canCreate;
const canDelete = canCreate;
const canManageStatus = canCreate;

module.exports = { canView, canCreate, canUpdate, canDelete, canManageStatus };
