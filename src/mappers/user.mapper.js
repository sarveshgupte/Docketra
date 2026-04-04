const { normalizeRole } = require('../utils/role.utils');

const derivePasswordConfigured = (user) => {
  const passwordHash = user?.passwordHash || user?.authProviders?.local?.passwordHash || null;
  return Boolean(passwordHash) && user?.mustSetPassword === false;
};

const mapUserResponse = (user) => {
  if (!user) return null;

  const resolvedFirmId = user?.firmId?._id?.toString?.() || user?.firmId?.toString?.() || user?.firmId || null;

  return {
    _id: user._id,
    id: user._id?.toString?.() || user.id || null,
    xID: user.xID,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    legacyRole: user.role,
    status: user.status,
    isActive: user.isActive,
    isSystem: Boolean(user.isSystem),
    lockUntil: user.lockUntil ?? null,
    mustSetPassword: Boolean(user.mustSetPassword),
    passwordSet: Boolean(user.passwordSet),
    passwordSetAt: user.passwordSetAt ?? null,
    passwordConfigured: derivePasswordConfigured(user),
    allowedCategories: Array.isArray(user.allowedCategories) ? user.allowedCategories : [],
    restrictedClientIds: Array.isArray(user.restrictedClientIds) ? user.restrictedClientIds : [],
    defaultClientId: user.defaultClientId ?? null,
    firmId: resolvedFirmId,
    firm: user?.firmId && typeof user.firmId === 'object'
      ? {
          id: user.firmId._id?.toString?.() || resolvedFirmId,
          firmId: user.firmId.firmId || null,
          name: user.firmId.name || null,
        }
      : null,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
  };
};

module.exports = {
  derivePasswordConfigured,
  mapUserResponse,
};
