const rateLimit = require('express-rate-limit');
const { createHash } = require('crypto');
const { RedisStore } = require('rate-limit-redis');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { getRedisClient } = require('../config/redis');
const metricsService = require('../services/metrics.service');
const { logSecurityEvent } = require('./securityAudit.middleware');

const DEFAULT_RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment before trying again.';
const FORGOT_PASSWORD_RATE_LIMIT_MESSAGE = 'Too many password reset requests. Please wait a few minutes before trying again.';
const FORGOT_PASSWORD_PATH_PATTERN = /\bforgot[-_]password\b/i;

const getRetryAfterSeconds = (req, windowMs) => {
  const reset = req.rateLimit?.resetTime;
  if (!reset) return Math.ceil(windowMs / 1000);
  return Math.max(1, Math.ceil((new Date(reset).getTime() - Date.now()) / 1000));
};

const getRateLimitMessage = (req, name) => {
  const requestPath = String(req.originalUrl || req.path || '');
  if (name === 'forgotPasswordLimiter' || FORGOT_PASSWORD_PATH_PATTERN.test(requestPath)) {
    return FORGOT_PASSWORD_RATE_LIMIT_MESSAGE;
  }
  return DEFAULT_RATE_LIMIT_MESSAGE;
};

const createRedisStore = () => {
  const redis = getRedisClient();
  if (!redis) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Redis is required for rate limiting in production');
    }
    return null;
  }

  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'ratelimit:',
  });
};

const createRateLimitHandler = (name, windowMs) => async (req, res) => {
  const retryAfter = getRetryAfterSeconds(req, windowMs);
  const message = getRateLimitMessage(req, name);
  if (name === 'authLimiter') {
    const redis = getRedisClient();
    if (redis) {
      const blockKey = `ratelimit:auth:block:${ipKeyGenerator(req)}`;
      await redis.set(blockKey, '1', 'EX', config.security.rateLimit.authBlockSeconds);
    }
  }
  res.setHeader('Retry-After', String(retryAfter));
  metricsService.recordRateLimitHit(name);
  metricsService.recordApiRateLimitExceeded();
  await logSecurityEvent(req, {
    action: 'RATE_LIMIT_EXCEEDED',
    metadata: { limiter: name, retryAfter, message },
  });
  res.status(429).json({
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message,
    retryAfter,
  });
};

const createLimiter = ({ name, windowMs, max, keyGenerator, skip }) => {
  const store = createRedisStore();
  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    store: store || undefined,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    handler: createRateLimitHandler(name, windowMs),
    validate: false,
  });
};

const ipKeyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
const parseCookieToken = (req, cookieName) => {
  const cookie = String(req.headers?.cookie || '');
  if (!cookie) return null;
  const cookiePart = cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`));
  if (!cookiePart) return null;
  return cookiePart.slice(cookieName.length + 1) || null;
};

const refreshUserKeyGenerator = (req) => {
  const accessToken = req.body?.accessToken || parseCookieToken(req, 'accessToken');
  if (accessToken) {
    try {
      const decoded = jwt.decode(accessToken);
      if (decoded?.userId) {
        return `user:${decoded.userId}`;
      }
    } catch (_) {
      // fallback below
    }
  }

  const refreshToken = req.body?.refreshToken || parseCookieToken(req, 'refreshToken');
  if (refreshToken) {
    return `token:${createHash('sha256').update(refreshToken).digest('hex')}`;
  }

  return `ip:${ipKeyGenerator(req)}`;
};

const globalApiLimiter = createLimiter({
  name: 'globalApiLimiter',
  windowMs: config.security.rateLimit.globalWindowSeconds * 1000,
  max: config.security.rateLimit.global,
  keyGenerator: ipKeyGenerator,
});

const authLimiter = createLimiter({
  name: 'authLimiter',
  windowMs: config.security.rateLimit.authWindowSeconds * 1000,
  max: config.security.rateLimit.auth,
  keyGenerator: ipKeyGenerator,
});

const loginLimiter = createLimiter({
  name: 'loginLimiter',
  windowMs: 60 * 1000,
  max: config.security.rateLimit.loginPerMinute,
  keyGenerator: ipKeyGenerator,
});

const forgotPasswordLimiter = createLimiter({
  name: 'forgotPasswordLimiter',
  windowMs: 60 * 1000,
  max: config.security.rateLimit.forgotPasswordPerMinute,
  keyGenerator: ipKeyGenerator,
});

const publicLimiter = createLimiter({
  name: 'publicLimiter',
  windowMs: 60 * 1000,
  max: config.security.rateLimit.publicPerMinute,
  keyGenerator: ipKeyGenerator,
});

const signupLimiter = createLimiter({
  name: 'signupLimiter',
  windowMs: config.security.rateLimit.signupWindowSeconds * 1000,
  max: config.security.rateLimit.signupPerHour,
  keyGenerator: ipKeyGenerator,
});

const authBlockEnforcer = async (req, res, next) => {
  const redis = getRedisClient();
  if (!redis) return next();
  const key = `ratelimit:auth:block:${ipKeyGenerator(req)}`;
  const ttl = await redis.ttl(key);
  if (ttl > 0) {
    const message = getRateLimitMessage(req, 'authBlockEnforcer');
    res.setHeader('Retry-After', String(ttl));
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message,
      retryAfter: ttl,
    });
  }
  return next();
};

const sensitiveLimiter = createLimiter({
  name: 'sensitiveLimiter',
  windowMs: config.security.rateLimit.sensitiveWindowSeconds * 1000,
  max: config.security.rateLimit.sensitivePerWindow,
  keyGenerator: ipKeyGenerator,
});

const userReadLimiter = createLimiter({
  name: 'userReadLimiter',
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.xID || req.user?._id || ipKeyGenerator(req),
});

const userWriteLimiter = createLimiter({
  name: 'userWriteLimiter',
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.xID || req.user?._id || ipKeyGenerator(req),
});

const attachmentLimiter = sensitiveLimiter;
const searchLimiter = createLimiter({
  name: 'searchLimiter',
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.xID || req.user?._id || ipKeyGenerator(req),
});

const superadminLimiter = createLimiter({
  name: 'superadminLimiter',
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.user?.xID || req.user?._id || ipKeyGenerator(req),
});

const profileLimiter = createLimiter({
  name: 'profileLimiter',
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.xID || req.user?._id || ipKeyGenerator(req),
  skip: (req) => !req.user,
});

const refreshIpLimiter = createLimiter({
  name: 'refreshIpLimiter',
  windowMs: 60 * 1000,
  max: Number(process.env.SECURITY_RATE_LIMIT_REFRESH_IP_PER_MINUTE || 20),
  keyGenerator: ipKeyGenerator,
});

const refreshUserLimiter = createLimiter({
  name: 'refreshUserLimiter',
  windowMs: 24 * 60 * 60 * 1000,
  max: Number(process.env.SECURITY_RATE_LIMIT_REFRESH_USER_PER_DAY || 100),
  keyGenerator: refreshUserKeyGenerator,
});

const internalMetricsLimiter = createLimiter({
  name: 'internalMetricsLimiter',
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.xID || req.user?._id || ipKeyGenerator(req),
});

const superadminAdminResendLimiter = superadminLimiter;
const superadminAdminLifecycleLimiter = superadminLimiter;
const superadminAdminManagementLimiter = superadminLimiter;

module.exports = {
  globalApiLimiter,
  authLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  publicLimiter,
  signupLimiter,
  authBlockEnforcer,
  sensitiveLimiter,
  userReadLimiter,
  userWriteLimiter,
  attachmentLimiter,
  searchLimiter,
  superadminLimiter,
  profileLimiter,
  refreshIpLimiter,
  refreshUserLimiter,
  internalMetricsLimiter,
  superadminAdminResendLimiter,
  superadminAdminLifecycleLimiter,
  superadminAdminManagementLimiter,
};
