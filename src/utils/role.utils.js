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
};
