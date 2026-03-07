const config = require('../config/config');
const { getRedisClient } = require('../config/redis');
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

const getAccountKey = (identifier) => `docketra:ratelimit:login:attempts:${hashIdentifier(identifier)}`;
const getAccountLockKey = (identifier) => `docketra:ratelimit:login:block:${hashIdentifier(identifier)}`;

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
