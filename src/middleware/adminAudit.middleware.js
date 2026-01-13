const { recordAdminAudit } = require('../services/adminAudit.service');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const resolveTarget = (req) => {
  if (!req || !req.params) return null;
  const priorityKeys = ['caseId', 'clientId', 'userId', 'id', 'xID'];
  for (const key of priorityKeys) {
    if (req.params[key]) return req.params[key];
  }
  const firstParamValue = Object.values(req.params)[0];
  return firstParamValue || null;
};

const adminAuditTrail = (scope = 'admin') => (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const start = Date.now();
  const target = resolveTarget(req);

  const finalize = () => {
    recordAdminAudit({
      actor: req.user?.xID || 'UNKNOWN',
      firmId: req.firm?.id || req.user?.firmId || null,
      userId: req.user?._id,
      action: `${req.method} ${req.originalUrl || req.url}`,
      target,
      scope,
      requestId: req.requestId,
      status: res.statusCode,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
      durationMs: Date.now() - start,
    });
  };

  res.once('finish', finalize);
  res.once('close', finalize);

  return next();
};

module.exports = {
  adminAuditTrail,
};
