/**
 * Permission Utilities
 */

import { USER_ROLES } from './constants.js';
export {
  normalizeFirmRole,
  getFirmRoleRank,
  hasFirmRoleAtLeast,
  isPrimaryAdmin,
  isFirmAdminOrAbove,
  isFirmManagerOrAbove,
} from './roleHierarchy.js';
import { canManageClientsByRoleOrPermission, isFirmAdminUser } from './firmAccess.js';

export const isSuperadmin = (user) => {
  if (!user) return false;
  if (user.isSuperAdmin === true) return true;
  const role = String(user.role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
};

export const isAdmin = (user) => {
  return user?.role === USER_ROLES.ADMIN || isFirmAdminUser(user);
};

export const isEmployee = (user) => {
  if (!user) return false;
  const role = String(user.role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return role === 'USER' || role === 'EMPLOYEE' || role === 'STAFF';
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
  return canManageClientsByRoleOrPermission(user);
};
