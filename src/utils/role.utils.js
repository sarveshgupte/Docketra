const normalizeRole = (role) => {
  if (!role) return null;

  const normalized = String(role).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'SUPERADMIN' || normalized === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (normalized === 'ADMIN') return 'ADMIN';
  if (normalized === 'EMPLOYEE' || normalized === 'STAFF' || normalized === 'USER') return 'STAFF';
  return normalized;
};

const isSuperAdminRole = (role) => normalizeRole(role) === 'SUPER_ADMIN';
const isAdminRole = (role) => normalizeRole(role) === 'ADMIN';
const isStaffRole = (role) => normalizeRole(role) === 'STAFF';

const toLegacyUserRole = (role) => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (normalizedRole === 'ADMIN') return 'Admin';
  if (normalizedRole === 'STAFF') return 'Employee';
  return role;
};

module.exports = {
  normalizeRole,
  isSuperAdminRole,
  isAdminRole,
  isStaffRole,
  toLegacyUserRole,
};
