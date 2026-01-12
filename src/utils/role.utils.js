// Legacy tokens and database values have used multiple casings for SuperAdmin.
// Normalize to handle all observed variants defensively.
const isSuperAdminRole = (role) => role === 'SuperAdmin' || role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

module.exports = {
  isSuperAdminRole,
};
