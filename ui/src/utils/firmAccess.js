import { isFirmAdminOrAbove, isFirmManagerOrAbove } from './roleHierarchy.js';

export const isFirmAdminUser = (user) => isFirmAdminOrAbove(user);

export const canManageClientsByRoleOrPermission = (user) => {
  if (isFirmManagerOrAbove(user)) return true;
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes('CLIENT_MANAGE') || permissions.includes('CLIENT_CREATE');
};
