const config = require('../config/config');
const redisConfig = require('../config/redis');
const { logSecurityEvent } = require('./securityAudit.middleware');
const { hashIdentifier } = require('../utils/hashIdentifier');

const rateLimitScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = redis.call("INCR", key)

if current == 1 then
  redis.call("EXPIRE", key, ttl)
end

if current > limit then
  return 0
end

return 1
`;

const failedAttemptsMap = new Map();
const lockoutsMap = new Map();

const pruneExpiredEntries = () => {
  const now = Date.now();
  for (const [key, value] of failedAttemptsMap.entries()) {
    if (value.expiresAt <= now) {
      failedAttemptsMap.delete(key);
    }
  }
  for (const [key, value] of lockoutsMap.entries()) {
    if (value.lockedUntil <= now) {
      lockoutsMap.delete(key);
    }
  }
};

const getAccountKey = (identifier) => `docketra:ratelimit:login:attempts:${hashIdentifier(identifier)}`;
const getAccountLockKey = (identifier) => `docketra:ratelimit:login:block:${hashIdentifier(identifier)}`;

const getAccountLockoutRedis = () => {
  const redis = redisConfig.getRedisClient();
  if (!redis) return null;
  if (process.env.NODE_ENV === 'production') return redis;
  return redisConfig.isRedisReady() ? redis : null;
};

const getAuthIdentifier = (req) => {
  const email = req.body?.email;
  const xid = req.body?.xid || req.body?.xID || req.body?.XID;
  return (email || xid || '').trim().toLowerCase();
};

const enforceAccountLockout = async (req, res, next) => {
  const identifier = getAuthIdentifier(req);
  if (!identifier) return next();
  const redis = getAccountLockoutRedis();
  
  if (!redis) {
    pruneExpiredEntries();
    const hashed = hashIdentifier(identifier);
    const lock = lockoutsMap.get(hashed);
    if (lock && lock.lockedUntil > Date.now()) {
      const ttl = Math.ceil((lock.lockedUntil - Date.now()) / 1000);
      res.setHeader('Retry-After', String(ttl));
      return res.status(429).json({
        success: false,
        error: 'ACCOUNT_TEMP_LOCKED',
        retryAfter: ttl,
      });
    }
    return next();
  }

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
  const redis = getAccountLockoutRedis();
  
  if (!redis) {
    pruneExpiredEntries();
    const hashed = hashIdentifier(identifier);
    const now = Date.now();
    const windowMs = config.security.rateLimit.authWindowSeconds * 1000;
    const lockSeconds = config.security.rateLimit.accountLockSeconds;
    const maxAttempts = config.security.rateLimit.accountLockAttempts;
    
    let entry = failedAttemptsMap.get(hashed);
    if (!entry || entry.expiresAt <= now) {
      entry = { count: 0, expiresAt: now + windowMs };
    }
    
    entry.count += 1;
    failedAttemptsMap.set(hashed, entry);
    
    if (entry.count > maxAttempts) {
      lockoutsMap.set(hashed, { lockedUntil: now + (lockSeconds * 1000) });
      await logSecurityEvent(req, {
        action: 'ACCOUNT_TEMP_LOCKED',
        metadata: { identifier },
      });
    }
    return;
  }

  const accountKey = getAccountKey(identifier);
  const lockKey = getAccountLockKey(identifier);
  const allowed = Number(await redis.eval(
    rateLimitScript,
    1,
    accountKey,
    config.security.rateLimit.accountLockAttempts,
    config.security.rateLimit.authWindowSeconds,
  )) === 1;

  if (!allowed) {
    await redis.set(lockKey, '1', 'EX', config.security.rateLimit.accountLockSeconds, 'NX');
    await logSecurityEvent(req, {
      action: 'ACCOUNT_TEMP_LOCKED',
      metadata: { identifier },
    });
  }
};

const clearFailedLoginAttempts = async (req) => {
  const identifier = getAuthIdentifier(req);
  if (!identifier) return;
  const redis = getAccountLockoutRedis();
  
  if (!redis) {
    const hashed = hashIdentifier(identifier);
    failedAttemptsMap.delete(hashed);
    lockoutsMap.delete(hashed);
    return;
  }

  await redis.del(getAccountKey(identifier));
  await redis.del(getAccountLockKey(identifier));
};

module.exports = {
  enforceAccountLockout,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  __private: {
    failedAttemptsMap,
    lockoutsMap,
    pruneExpiredEntries,
  },
};
