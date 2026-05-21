const normalizeRole = (role) => {
  if (!role) return null;

  const normalized = String(role).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'SUPERADMIN' || normalized === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (normalized === 'PRIMARY_ADMIN' || normalized === 'PRIMARYADMIN') return 'PRIMARY_ADMIN';
  if (normalized === 'ADMIN') return 'ADMIN';
  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'EMPLOYEE' || normalized === 'STAFF' || normalized === 'USER') return 'USER';
  return normalized;
};

const isSuperAdminRole = (role) => normalizeRole(role) === 'SUPER_ADMIN';
const isPrimaryAdminRole = (role) => normalizeRole(role) === 'PRIMARY_ADMIN';
const isAdminRole = (role) => ['PRIMARY_ADMIN', 'ADMIN'].includes(normalizeRole(role));
const isManagerRole = (role) => normalizeRole(role) === 'MANAGER';
const isStaffRole = (role) => normalizeRole(role) === 'USER';
const FIRM_ROLE_RANK = Object.freeze({ USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 });

const normalizeFirmRole = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === 'PRIMARY_ADMIN' || normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'USER') {
    return normalized;
  }
  return 'USER';
};

const getFirmRoleRank = (userOrRole) => {
  const role = userOrRole && typeof userOrRole === 'object' ? userOrRole.role : userOrRole;
  return FIRM_ROLE_RANK[normalizeFirmRole(role)] || 0;
};

const hasFirmRoleAtLeast = (userOrRole, minimumRole) => getFirmRoleRank(userOrRole) >= getFirmRoleRank(minimumRole);
const isPrimaryAdminActor = (user) => {
  if (!user || typeof user !== 'object') return false;
  if (user.isPrimaryAdmin === true) return true;
  if (user.isSystem === true) return true;
  const normalizedRole = normalizeRole(user.role);
  if (normalizedRole === 'PRIMARY_ADMIN') return true;

  const primaryAdminId = user.primaryAdminId && String(user.primaryAdminId);
  const userId = user._id || user.id;
  if (primaryAdminId && userId && String(primaryAdminId) == String(userId)) return true;

  const defaultClientId = user.defaultClientId && String(user.defaultClientId);
  const firmId = user.firmId && String(user.firmId);
  if (
    ['PRIMARY_ADMIN', 'ADMIN', 'FIRM_ADMIN'].includes(normalizedRole)
    && defaultClientId
    && firmId
    && defaultClientId === firmId
  ) return true;

  return false;
};
const isPrimaryAdmin = (user) => isPrimaryAdminActor(user);
const isFirmAdminOrAbove = (user) => hasFirmRoleAtLeast(user, 'ADMIN');
const isFirmManagerOrAbove = (user) => hasFirmRoleAtLeast(user, 'MANAGER');

const toLegacyUserRole = (role) => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (normalizedRole === 'PRIMARY_ADMIN' || normalizedRole === 'ADMIN') return 'Admin';
  if (normalizedRole === 'MANAGER' || normalizedRole === 'USER') return 'Employee';
  return role;
};

module.exports = {
  normalizeRole,
  isSuperAdminRole,
  isPrimaryAdminRole,
  isAdminRole,
  isManagerRole,
  isStaffRole,
  toLegacyUserRole,
  normalizeFirmRole,
  getFirmRoleRank,
  hasFirmRoleAtLeast,
  isPrimaryAdminActor,
  isPrimaryAdmin,
  isFirmAdminOrAbove,
  isFirmManagerOrAbove,
};
