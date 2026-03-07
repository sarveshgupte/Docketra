const { getRedisClient } = require('../config/redis');
const { hashIdentifier } = require('../utils/hashIdentifier');

const WINDOW_SECONDS = 60 * 60;
const INITIATE_PER_IP_LIMIT = 5;
const INITIATE_PER_EMAIL_LIMIT = 3;
const VERIFY_MAX_ATTEMPTS = 5;
const OTP_BLOCK_SECONDS = 15 * 60;

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

const otpAttemptScript = `
local key = KEYS[1]
local maxAttempts = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local attempts = redis.call("INCR", key)

if attempts == 1 then
  redis.call("EXPIRE", key, ttl)
end

if attempts > maxAttempts then
  return -1
end

return attempts
`;

const getSignupIpRateLimitKey = (ip) => `docketra:ratelimit:signup:ip:${hashIdentifier(ip)}`;
const getSignupEmailRateLimitKey = (email) => `docketra:ratelimit:signup:email:${hashIdentifier(email)}`;
const getOtpAttemptKey = (identifier) => `docketra:otp:attempts:${hashIdentifier(identifier)}`;
const getOtpBlockKey = (identifier) => `docketra:otp:block:${hashIdentifier(identifier)}`;

const inMemoryCounters = new Map();

const resolveEntry = (key, ttlSeconds) => {
  const now = Date.now();
  const existing = inMemoryCounters.get(key);
  if (existing && existing.expiresAt > now) {
    return existing;
  }
  const entry = {
    count: 0,
    expiresAt: now + ttlSeconds * 1000,
  };
  inMemoryCounters.set(key, entry);
  return entry;
};

const incrementMemoryCounter = async (key, ttlSeconds) => {
  const entry = resolveEntry(key, ttlSeconds);
  entry.count += 1;
  const retryAfter = Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  return { count: entry.count, retryAfter };
};

const applyRedisRateLimit = async (key, limit, ttlSeconds) => {
  const redis = getRedisClient();
  if (!redis) {
    const counter = await incrementMemoryCounter(key, ttlSeconds);
    return {
      allowed: counter.count <= limit,
      retryAfter: counter.retryAfter,
      count: counter.count,
    };
  }

  const allowed = Number(await redis.eval(rateLimitScript, 1, key, limit, ttlSeconds)) === 1;
  const ttl = await redis.ttl(key);
  return {
    allowed,
    retryAfter: ttl > 0 ? ttl : ttlSeconds,
  };
};

const consumeSignupQuota = async ({ email, ip }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const normalizedIp = String(ip || 'unknown').trim();

  const [ipCounter, emailCounter] = await Promise.all([
    applyRedisRateLimit(getSignupIpRateLimitKey(normalizedIp), INITIATE_PER_IP_LIMIT, WINDOW_SECONDS),
    applyRedisRateLimit(getSignupEmailRateLimitKey(normalizedEmail), INITIATE_PER_EMAIL_LIMIT, WINDOW_SECONDS),
  ]);

  if (!ipCounter.allowed || !emailCounter.allowed) {
    return {
      allowed: false,
      retryAfter: Math.max(ipCounter.retryAfter, emailCounter.retryAfter),
    };
  }
  return { allowed: true };
};

const consumeOtpAttempt = async ({ email }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const key = getOtpAttemptKey(normalizedEmail);
  const blockKey = getOtpBlockKey(normalizedEmail);
  const redis = getRedisClient();

  if (!redis) {
    const counter = await incrementMemoryCounter(key, WINDOW_SECONDS);
    if (counter.count > VERIFY_MAX_ATTEMPTS) {
      return { allowed: false, retryAfter: counter.retryAfter, attempts: counter.count };
    }
    return { allowed: true, attempts: counter.count };
  }

  if (await redis.exists(blockKey)) {
    throw new Error('Too many OTP attempts. Try again later.');
  }

  const attempts = Number(await redis.eval(
    otpAttemptScript,
    1,
    key,
    VERIFY_MAX_ATTEMPTS,
    OTP_BLOCK_SECONDS,
  ));

  if (attempts === -1) {
    await redis.set(blockKey, '1', 'EX', OTP_BLOCK_SECONDS);
    throw new Error('Too many OTP attempts. Try again later.');
  }

  return { allowed: true, attempts };
};

const clearOtpAttempts = async ({ email }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const key = getOtpAttemptKey(normalizedEmail);
  const blockKey = getOtpBlockKey(normalizedEmail);
  const redis = getRedisClient();
  if (!redis) {
    inMemoryCounters.delete(key);
    inMemoryCounters.delete(blockKey);
    return;
  }
  await redis.del(key, blockKey);
};

module.exports = {
  consumeSignupQuota,
  consumeOtpAttempt,
  clearOtpAttempts,
  INITIATE_PER_IP_LIMIT,
  INITIATE_PER_EMAIL_LIMIT,
  VERIFY_MAX_ATTEMPTS,
};
