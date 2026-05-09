/**
 * Permission Utilities
 */

import { USER_ROLES } from './constants.js';

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

export const isSuperadmin = (user) => {
  return user?.role === USER_ROLES.SUPER_ADMIN;
};

export const isAdmin = (user) => {
  return user?.role === USER_ROLES.ADMIN || isFirmAdminOrAbove(user);
};

export const isEmployee = (user) => {
  return user?.role === USER_ROLES.EMPLOYEE;
};

export const canEditCase = (user, caseData) => {
  // Check if user has permission to edit case
  if (isAdmin(user)) return true;
  
  // Check if case is assigned to user
  if (caseData?.assignedTo === user?.xID) return true;
  
  return false;
};

export const canApproveCase = (user) => {
  return isAdmin(user);
};

export const canUnpendCase = (user) => {
  return isAdmin(user);
};

export const canManageUsers = (user) => {
  return isAdmin(user);
};

export const canViewCategoryWorklist = (user, categoryId) => {
  // For now, all authenticated users can view worklists
  // Backend will enforce actual permission checks
  return true;
};

export const canAddComment = (user, caseData) => {
  // All authenticated users can add comments
  return true;
};

export const canAddAttachment = (user, caseData) => {
  // All authenticated users can add attachments
  return true;
};

export const canUpdateStatus = (user, caseData) => {
  // Check if user can update case status
  if (isAdmin(user)) return true;
  
  // Check if case is assigned to user
  if (caseData?.assignedTo === user?.xID) return true;
  
  return false;
};

export const canCloneCase = (user) => {
  // All authenticated users can clone cases
  return true;
};

export const canManageClients = (user) => {
  if (isFirmManagerOrAbove(user)) return true;
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes('CLIENT_MANAGE') || permissions.includes('CLIENT_CREATE');
};
