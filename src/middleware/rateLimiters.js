const rateLimit = require('express-rate-limit');
const { createHash } = require('crypto');
const { RedisStore } = require('rate-limit-redis');
const config = require('../config/config');
const { getRedisClient } = require('../config/redis');
const metricsService = require('../services/metrics.service');
const jwtService = require('../services/jwt.service');
const { getCookieValue } = require('../utils/requestCookies');
const { logSecurityEvent } = require('./securityAudit.middleware');

const DEFAULT_RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment before trying again.';
const FORGOT_PASSWORD_RATE_LIMIT_MESSAGE = 'Too many password reset requests. Please wait a few minutes before trying again.';
const FORGOT_PASSWORD_PATH_PATTERN = /\bforgot[-_]password\b/i;
let hasWarnedRedisRateLimitFallback = false;

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
    if (process.env.NODE_ENV === 'production' && !hasWarnedRedisRateLimitFallback) {
      hasWarnedRedisRateLimitFallback = true;
      console.warn('[RATE_LIMIT] Redis unavailable in production; falling back to in-memory rate limiting for this instance.');
    }
    return null;
  }

  return new RedisStore({
    sendCommand: (...args) => {
      if (typeof redis.call === 'function') {
        return redis.call(...args);
      }
      const [command, ...commandArgs] = args;
      const normalizedCommand = String(command || '').toLowerCase();
      if (normalizedCommand && typeof redis[normalizedCommand] === 'function') {
        return redis[normalizedCommand](...commandArgs);
      }
      throw new Error(`Redis client does not support command: ${command}`);
    },
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

const normalizeIp = (value) => String(value || '')
  .split(',')[0]
  .trim()
  .replace(/^::ffff:/i, '') || 'unknown';

const hashKeyPart = (value) => createHash('sha256').update(String(value)).digest('hex');

const resolveClientIp = (req) => normalizeIp(
  req.headers?.['x-forwarded-for']
  || req.headers?.['x-real-ip']
  || req.ip
  || req.ips?.[0]
  || req.socket?.remoteAddress
  || req.connection?.remoteAddress
  || 'unknown',
);

const ipKeyGenerator = (req) => resolveClientIp(req);

const globalApiKeyGenerator = (req) => {
  if (req.user?.xID || req.user?._id) {
    return userOrIpKeyGenerator(req);
  }

  const authHeader = req.headers?.authorization;
  const bearerToken = typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (bearerToken) {
    try {
      const decoded = jwtService.verifyAccessToken(bearerToken);
      if (decoded?.userId) {
        return `user:${decoded.userId}`;
      }
      if (decoded?.xID) {
        return `xid:${decoded.xID}`;
      }
    } catch (_) {
      // Fall back to IP throttling for missing/expired/invalid bearer tokens.
    }
  }

  return `ip:${resolveClientIp(req)}`;
};

const userOrIpKeyGenerator = (req) => req.user?.xID || req.user?._id || `ip:${ipKeyGenerator(req)}`;
const otpVerifyKeyGenerator = (req) => {
  if (req.user?.xID || req.user?._id) {
    return userOrIpKeyGenerator(req);
  }

  if (req.body?.xID) {
    return `xid:${req.body.xID}`;
  }

  if (req.body?.email) {
    return `email:${hashKeyPart(String(req.body.email).toLowerCase().trim())}`;
  }

  if (req.body?.preAuthToken) {
    return `token:${hashKeyPart(req.body.preAuthToken)}`;
  }

  return `ip:${ipKeyGenerator(req)}`;
};

const otpResendKeyGenerator = (req) => {
  if (req.body?.email) {
    return `email:${hashKeyPart(String(req.body.email).toLowerCase().trim())}`;
  }

  return `ip:${ipKeyGenerator(req)}`;
};
const refreshUserKeyGenerator = (req) => {
  const accessToken = req.body?.accessToken || getCookieValue(req.headers?.cookie, 'accessToken');
  if (accessToken) {
    try {
      const decoded = jwtService.verifyAccessToken(accessToken);
      if (decoded?.userId) {
        return `user:${decoded.userId}`;
      }
    } catch (_) {
      // Fallback below for invalid/expired/missing access tokens.
    }
  }

  const refreshToken = req.body?.refreshToken || getCookieValue(req.headers?.cookie, 'refreshToken');
  if (refreshToken) {
    return `token:${createHash('sha256').update(refreshToken).digest('hex')}`;
  }

  return `ip:${ipKeyGenerator(req)}`;
};

const globalApiLimiter = createLimiter({
  name: 'globalApiLimiter',
  windowMs: config.security.rateLimit.globalWindowSeconds * 1000,
  max: config.security.rateLimit.global,
  keyGenerator: globalApiKeyGenerator,
});

const authLimiter = createLimiter({
  name: 'authLimiter',
  windowMs: config.security.rateLimit.authWindowSeconds * 1000,
  max: config.security.rateLimit.auth,
  keyGenerator: ipKeyGenerator,
});

const loginLimiter = createLimiter({
  name: 'loginLimiter',
  windowMs: config.security.rateLimit.loginWindowSeconds * 1000,
  max: config.security.rateLimit.loginPerMinute,
  keyGenerator: ipKeyGenerator,
});

const forgotPasswordLimiter = createLimiter({
  name: 'forgotPasswordLimiter',
  windowMs: config.security.rateLimit.forgotPasswordWindowSeconds * 1000,
  max: config.security.rateLimit.forgotPasswordPerMinute,
  keyGenerator: ipKeyGenerator,
});

const publicLimiter = createLimiter({
  name: 'publicLimiter',
  windowMs: config.security.rateLimit.publicWindowSeconds * 1000,
  max: config.security.rateLimit.publicPerMinute,
  keyGenerator: ipKeyGenerator,
});


const publicUploadLimiter = createLimiter({
  name: 'publicUploadLimiter',
  windowMs: config.security.rateLimit.publicWindowSeconds * 1000,
  max: Math.max(1, Math.floor(config.security.rateLimit.publicPerMinute / 2)),
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
  keyGenerator: userOrIpKeyGenerator,
});

const otpVerifyLimiter = createLimiter({
  name: 'otpVerifyLimiter',
  windowMs: config.security.rateLimit.otpVerifyWindowSeconds * 1000,
  max: config.security.rateLimit.otpVerifyPerMinute,
  keyGenerator: otpVerifyKeyGenerator,
});

const otpResendLimiter = createLimiter({
  name: 'otpResendLimiter',
  windowMs: config.security.rateLimit.otpResendWindowSeconds * 1000,
  max: config.security.rateLimit.otpResendPerMinute,
  keyGenerator: otpResendKeyGenerator,
});

const userReadLimiter = createLimiter({
  name: 'userReadLimiter',
  windowMs: config.security.rateLimit.userReadWindowSeconds * 1000,
  max: config.security.rateLimit.userReadPerMinute,
  keyGenerator: userOrIpKeyGenerator,
});

const userWriteLimiter = createLimiter({
  name: 'userWriteLimiter',
  windowMs: config.security.rateLimit.userWriteWindowSeconds * 1000,
  max: config.security.rateLimit.userWritePerMinute,
  keyGenerator: userOrIpKeyGenerator,
});

const attachmentLimiter = sensitiveLimiter;
const searchLimiter = createLimiter({
  name: 'searchLimiter',
  windowMs: config.security.rateLimit.searchWindowSeconds * 1000,
  max: config.security.rateLimit.searchPerMinute,
  keyGenerator: userOrIpKeyGenerator,
});

const superadminLimiter = createLimiter({
  name: 'superadminLimiter',
  windowMs: config.security.rateLimit.superadminWindowSeconds * 1000,
  max: config.security.rateLimit.superadminPerMinute,
  keyGenerator: userOrIpKeyGenerator,
});

const profileLimiter = createLimiter({
  name: 'profileLimiter',
  windowMs: config.security.rateLimit.profileWindowSeconds * 1000,
  max: config.security.rateLimit.profilePerMinute,
  keyGenerator: userOrIpKeyGenerator,
  skip: (req) => !req.user,
});

const refreshIpLimiter = createLimiter({
  name: 'refreshIpLimiter',
  windowMs: config.security.rateLimit.refreshIpWindowSeconds * 1000,
  max: config.security.rateLimit.refreshIpPerMinute,
  keyGenerator: ipKeyGenerator,
});

const refreshUserLimiter = createLimiter({
  name: 'refreshUserLimiter',
  windowMs: config.security.rateLimit.refreshUserWindowSeconds * 1000,
  max: config.security.rateLimit.refreshUserPerWindow,
  keyGenerator: refreshUserKeyGenerator,
});

const internalMetricsLimiter = createLimiter({
  name: 'internalMetricsLimiter',
  windowMs: config.security.rateLimit.internalMetricsWindowSeconds * 1000,
  max: config.security.rateLimit.internalMetricsPerMinute,
  keyGenerator: userOrIpKeyGenerator,
});

const contactLimiter = createLimiter({
  name: 'contactLimiter',
  windowMs: config.security.rateLimit.contactWindowSeconds * 1000,
  max: config.security.rateLimit.contactPerWindow,
  keyGenerator: ipKeyGenerator,
});

const commentLimiter = createLimiter({
  name: 'commentLimiter',
  windowMs: config.security.rateLimit.commentWindowSeconds * 1000,
  max: config.security.rateLimit.commentPerMinute,
  keyGenerator: userOrIpKeyGenerator,
});

const fileUploadLimiter = createLimiter({
  name: 'fileUploadLimiter',
  windowMs: config.security.rateLimit.fileUploadWindowSeconds * 1000,
  max: config.security.rateLimit.fileUploadPerMinute,
  keyGenerator: userOrIpKeyGenerator,
});

const debugLimiter = createLimiter({
  name: 'debugLimiter',
  windowMs: config.security.rateLimit.debugWindowSeconds * 1000,
  max: config.security.rateLimit.debugPerMinute,
  keyGenerator: userOrIpKeyGenerator,
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
  publicUploadLimiter,
  authBlockEnforcer,
  sensitiveLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
  userReadLimiter,
  userWriteLimiter,
  attachmentLimiter,
  searchLimiter,
  superadminLimiter,
  profileLimiter,
  refreshIpLimiter,
  refreshUserLimiter,
  internalMetricsLimiter,
  contactLimiter,
  commentLimiter,
  fileUploadLimiter,
  debugLimiter,
  superadminAdminResendLimiter,
  superadminAdminLifecycleLimiter,
  superadminAdminManagementLimiter,
};
