const normalizeRole = (role) => {
  if (!role) return null;

  const normalized = String(role).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'SUPERADMIN' || normalized === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (normalized === 'PRIMARY_ADMIN') return 'PRIMARY_ADMIN';
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
const isPrimaryAdmin = (user) => normalizeFirmRole(user?.role) === 'PRIMARY_ADMIN';
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
  isPrimaryAdmin,
  isFirmAdminOrAbove,
  isFirmManagerOrAbove,
};
