const { isDegraded, getState } = require('../services/systemState.service');
const metricsService = require('../services/metrics.service');

const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const degradedGuard = (req, res, next) => {
  if (!isDegraded()) return next();
  if (READ_ONLY_METHODS.includes(req.method)) return next();

  const state = getState();
  metricsService.recordError(503);
  return res.status(503).json({
    success: false,
    error: 'system_degraded',
    message: 'System is in degraded mode. Write operations are temporarily blocked.',
    systemState: state,
  });
};

module.exports = degradedGuard;
