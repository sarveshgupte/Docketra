const isSuperAdminRole = (role) => role === 'SuperAdmin' || role === 'SUPER_ADMIN';

module.exports = {
  isSuperAdminRole,
};
