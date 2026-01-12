const isSuperAdminRole = (role) => role === 'SuperAdmin' || role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

module.exports = {
  isSuperAdminRole,
};
