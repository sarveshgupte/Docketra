const { normalizeRole } = require('../utils/role.utils');

const FIRM_ROLES = new Set(['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER']);

const toCanonicalFirmRole = (role) => {
  const normalized = normalizeRole(role);
  if (!FIRM_ROLES.has(normalized)) {
    return normalized === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER';
  }
  return normalized;
};

const normalizeObjectIdString = (value) => (value ? String(value) : null);

const hasManagedRelationship = (viewer = {}, targetUser = {}, context = {}) => {
  const viewerId = normalizeObjectIdString(viewer._id);
  const targetManagerId = normalizeObjectIdString(targetUser.managerId || targetUser.reportsToUserId);
  if (viewerId && targetManagerId && viewerId === targetManagerId) {
    return true;
  }

  const managedUserXids = Array.isArray(context?.managedUserXids)
    ? new Set(context.managedUserXids.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))
    : null;
  if (managedUserXids && managedUserXids.has(String(targetUser?.xID || '').trim().toUpperCase())) {
    return true;
  }

  return false;
};

const canViewUserWorklist = (viewer, targetUserOrXid, context = {}) => {
  const targetUser = targetUserOrXid && typeof targetUserOrXid === 'object' ? targetUserOrXid : null;
  const targetXid = String(targetUser?.xID || targetUserOrXid || '').trim().toUpperCase();
  const viewerXid = String(viewer?.xID || '').trim().toUpperCase();

  const viewerRole = toCanonicalFirmRole(viewer?.role);
  if (viewerRole === 'SUPER_ADMIN') return false;

  const viewerFirmId = normalizeObjectIdString(viewer?.firmId);
  const targetFirmId = normalizeObjectIdString(targetUser?.firmId || context?.targetFirmId);
  if (!viewerFirmId || !targetFirmId || viewerFirmId !== targetFirmId) return false;

  if (viewerXid && targetXid && viewerXid === targetXid) return true;
  if (viewerRole === 'PRIMARY_ADMIN' || viewerRole === 'ADMIN') return true;
  if (viewerRole !== 'MANAGER' || !targetUser) return false;

  return hasManagedRelationship(viewer, targetUser, context);
};

module.exports = {
  canViewUserWorklist,
  toCanonicalFirmRole,
  hasManagedRelationship,
};
