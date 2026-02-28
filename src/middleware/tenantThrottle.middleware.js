const config = require('../config/config');
const { getRedisClient } = require('../config/redis');
const metricsService = require('../services/metrics.service');
const { logSecurityEvent } = require('./securityAudit.middleware');

const WINDOW_SECONDS = 60;

const tenantThrottle = async (req, res, next) => {
  const tenantId = req?.tenant?.id || req?.context?.tenantId || req?.firmId;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: 'TENANT_CONTEXT_REQUIRED',
    });
  }

  const redis = getRedisClient();
  if (!redis) {
    return res.status(503).json({
      success: false,
      error: 'THROTTLE_BACKEND_UNAVAILABLE',
    });
  }

  const nowWindow = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `tenant:${tenantId}:rate:${nowWindow}`;
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, WINDOW_SECONDS + 1);
  }

  if (current > config.security.rateLimit.tenantPerMinute) {
    res.setHeader('Retry-After', WINDOW_SECONDS.toString());
    metricsService.recordTenantThrottleExceeded();
    await logSecurityEvent(req, {
      action: 'TENANT_THROTTLE_EXCEEDED',
      metadata: { tenantId, key, current },
      entityId: String(tenantId),
    });
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: WINDOW_SECONDS,
    });
  }

  return next();
};

module.exports = {
  tenantThrottle,
};
