const config = require('../config/config');
const { getRedisClient } = require('../config/redis');
const { logSecurityEvent } = require('./securityAudit.middleware');

const getAccountKey = (identifier) => `user:${String(identifier || 'unknown').toLowerCase()}:loginAttempts`;
const getAccountLockKey = (identifier) => `user:${String(identifier || 'unknown').toLowerCase()}:lock`;

const getAuthIdentifier = (req) => {
  const email = req.body?.email;
  const xid = req.body?.xID || req.body?.XID;
  return (email || xid || '').trim().toLowerCase();
};

const enforceAccountLockout = async (req, res, next) => {
  const identifier = getAuthIdentifier(req);
  if (!identifier) return next();
  const redis = getRedisClient();
  if (!redis) return next();

  const ttl = await redis.ttl(getAccountLockKey(identifier));
  if (ttl > 0) {
    res.setHeader('Retry-After', String(ttl));
    return res.status(429).json({
      success: false,
      error: 'ACCOUNT_TEMP_LOCKED',
      retryAfter: ttl,
    });
  }
  return next();
};

const recordFailedLoginAttempt = async (req) => {
  const identifier = getAuthIdentifier(req);
  if (!identifier) return;
  const redis = getRedisClient();
  if (!redis) return;

  const attempts = await redis.incr(getAccountKey(identifier));
  if (attempts === 1) {
    await redis.expire(getAccountKey(identifier), config.security.rateLimit.authWindowSeconds);
  }

  if (attempts >= config.security.rateLimit.accountLockAttempts) {
    await redis.set(getAccountLockKey(identifier), '1', 'EX', config.security.rateLimit.accountLockSeconds);
    await logSecurityEvent(req, {
      action: 'ACCOUNT_TEMP_LOCKED',
      metadata: { identifier },
    });
  }
};

const clearFailedLoginAttempts = async (req) => {
  const identifier = getAuthIdentifier(req);
  if (!identifier) return;
  const redis = getRedisClient();
  if (!redis) return;

  await redis.del(getAccountKey(identifier));
  await redis.del(getAccountLockKey(identifier));
};

module.exports = {
  enforceAccountLockout,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
};
