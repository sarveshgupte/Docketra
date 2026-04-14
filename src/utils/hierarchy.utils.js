const { normalizeRole } = require('./role.utils');

const INVITABLE_ROLE_MAP = {
  PRIMARY_ADMIN: ['ADMIN', 'MANAGER', 'USER'],
  ADMIN: ['MANAGER', 'USER'],
  MANAGER: ['USER'],
  USER: [],
};

const normalizeId = (value) => {
  if (!value) return null;
  return value.toString();
};

const canInviteRole = (inviterRole, targetRole) => {
  const normalizedInviterRole = normalizeRole(inviterRole);
  const normalizedTargetRole = normalizeRole(targetRole);
  return Boolean(INVITABLE_ROLE_MAP[normalizedInviterRole]?.includes(normalizedTargetRole));
};

const getTagValidationError = ({ role, primaryAdminId, adminId, managerId }) => {
  const normalizedRole = normalizeRole(role);
  const normalizedPrimaryAdminId = normalizeId(primaryAdminId);
  const normalizedAdminId = normalizeId(adminId);
  const normalizedManagerId = normalizeId(managerId);

  if (normalizedRole !== 'PRIMARY_ADMIN' && !normalizedPrimaryAdminId) {
    return 'primaryAdminId is required for non-primary-admin users';
  }

  if (normalizedRole === 'PRIMARY_ADMIN') {
    if (normalizedAdminId || normalizedManagerId) {
      return 'PRIMARY_ADMIN cannot have adminId or managerId';
    }
  }

  if (normalizedRole === 'ADMIN') {
    if (normalizedAdminId || normalizedManagerId) {
      return 'ADMIN cannot have adminId or managerId';
    }
  }

  if (normalizedRole === 'MANAGER' && normalizedManagerId) {
    return 'MANAGER cannot have managerId';
  }

  return null;
};

const assertPrimaryAdmin = (user) => {
  if (normalizeRole(user?.role) !== 'PRIMARY_ADMIN') {
    throw new Error('Only PRIMARY_ADMIN can perform this action');
  }
};

const coercePrimaryAdminCreationFields = (payload = {}) => {
  const normalizedRole = normalizeRole(payload.role);
  const coercedRole = normalizedRole === 'ADMIN' ? 'PRIMARY_ADMIN' : normalizedRole;
  return {
    ...payload,
    role: coercedRole || 'PRIMARY_ADMIN',
    primaryAdminId: null,
    isPrimaryAdmin: true,
  };
};

module.exports = {
  assertPrimaryAdmin,
  canInviteRole,
  coercePrimaryAdminCreationFields,
  getTagValidationError,
  normalizeId,
};
