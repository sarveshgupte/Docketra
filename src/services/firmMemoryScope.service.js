const { isAdminRole, isSuperAdminRole, normalizeRole } = require('../utils/role.utils');

const normalizeId = (value) => {
  if (!value) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const toClientIdSet = (values = []) => new Set(
  (Array.isArray(values) ? values : [])
    .map((value) => normalizeId(value))
    .filter(Boolean)
);

const resolveFirmMemoryScope = (req) => {
  const role = normalizeRole(req?.firmRole || req?.user?.role);
  const firmId = normalizeId(req?.user?.firmId || req?.firmId || req?.firm?.id);

  if (!firmId) {
    return { errorStatus: 400, errorMessage: 'Firm context is required for this operation' };
  }

  if (isSuperAdminRole(role)) {
    return { errorStatus: 403, errorMessage: 'Superadmin cannot access firm-scoped permissions' };
  }

  if (isAdminRole(role)) {
    return { firmId, role, hasFirmWideAccess: true, scopedClientIds: null };
  }

  const allowedClientIds = toClientIdSet(req?.user?.clientAccess);
  const restrictedClientIds = toClientIdSet(req?.user?.restrictedClientIds);

  const scopedClientIds = [...allowedClientIds].filter((id) => !restrictedClientIds.has(id));

  return {
    firmId,
    role,
    hasFirmWideAccess: false,
    scopedClientIds,
  };
};

module.exports = {
  resolveFirmMemoryScope,
};
