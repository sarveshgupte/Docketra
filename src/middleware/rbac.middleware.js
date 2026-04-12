const { normalizeRole } = require('../utils/role.utils');

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  req.auth = {
    userId: req.user._id,
    role: normalizeRole(req.user.role),
    firmId: req.user.firmId || null,
    teamId: req.user.teamId || null,
  };

  return next();
};

const requireRole = (roles = []) => (req, res, next) => {
  const currentRole = normalizeRole(req.user?.role);
  if (!currentRole || !roles.map((entry) => normalizeRole(entry)).includes(currentRole)) {
    return res.status(403).json({ success: false, message: 'Insufficient role permissions' });
  }
  return next();
};

const requireFirmScope = (resourceResolver) => (req, res, next) => {
  const resource = typeof resourceResolver === 'function' ? resourceResolver(req) : req.resource;
  if (!resource?.firmId || !req.user?.firmId || String(resource.firmId) !== String(req.user.firmId)) {
    return res.status(403).json({ success: false, message: 'Firm scope mismatch' });
  }
  return next();
};

const requireTeamScope = (resourceResolver) => (req, res, next) => {
  const resource = typeof resourceResolver === 'function' ? resourceResolver(req) : req.resource;
  if (!resource?.teamId || !req.user?.teamId || String(resource.teamId) !== String(req.user.teamId)) {
    return res.status(403).json({ success: false, message: 'Team scope mismatch' });
  }
  return next();
};

module.exports = {
  requireAuth,
  requireRole,
  requireFirmScope,
  requireTeamScope,
};
