const FIRM_ROLE_RANK = Object.freeze({
  USER: 1,
  MANAGER: 2,
  ADMIN: 3,
  PRIMARY_ADMIN: 4,
});

export const normalizeFirmRole = (role) => {
  const normalized = String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'EMPLOYEE' || normalized === 'STAFF' || normalized === 'USER') return 'USER';
  if (normalized === 'PRIMARY_ADMIN') return 'PRIMARY_ADMIN';
  if (normalized === 'ADMIN') return 'ADMIN';
  if (normalized === 'MANAGER') return 'MANAGER';
  return 'USER';
};

export const getFirmRoleRank = (userOrRole) => {
  const role = typeof userOrRole === 'object' ? userOrRole?.role : userOrRole;
  return FIRM_ROLE_RANK[normalizeFirmRole(role)] || 0;
};

export const hasFirmRoleAtLeast = (userOrRole, minimumRole) => (
  getFirmRoleRank(userOrRole) >= getFirmRoleRank(minimumRole)
);

export const isPrimaryAdmin = (user) => normalizeFirmRole(user?.role) === 'PRIMARY_ADMIN';
export const isFirmAdminOrAbove = (user) => hasFirmRoleAtLeast(user, 'ADMIN');
export const isFirmManagerOrAbove = (user) => hasFirmRoleAtLeast(user, 'MANAGER');
