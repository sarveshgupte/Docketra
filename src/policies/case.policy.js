const { isAdminRole, isSuperAdminRole, normalizeRole } = require('../utils/role.utils');

const CASE_CONTRIBUTOR_ROLES = new Set(['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER']);

const canView = (user) => Boolean(user) && !isSuperAdminRole(user.role) && CASE_CONTRIBUTOR_ROLES.has(normalizeRole(user.role));
const canCreate = canView;
const canUpdate = canView;
const canDelete = (user) => Boolean(user) && !isSuperAdminRole(user.role) && isAdminRole(user.role);
const canAssign = canDelete;
const canPerformActions = canView;

module.exports = { canView, canCreate, canUpdate, canDelete, canAssign, canPerformActions };
