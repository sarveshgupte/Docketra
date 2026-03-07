const { getRedisClient } = require('../config/redis');
const config = require('../config/config');
const { hashIdentifier } = require('../utils/hashIdentifier');

const WINDOW_SECONDS = config.security.rateLimit.signupWindowSeconds;
const INITIATE_PER_IP_LIMIT = config.security.rateLimit.signupPerHour;
const INITIATE_PER_EMAIL_LIMIT = config.security.rateLimit.signupPerEmailPerWindow;
const VERIFY_MAX_ATTEMPTS = config.security.rateLimit.otpVerifyPerMinute;
const OTP_BLOCK_SECONDS = config.security.rateLimit.otpVerifyBlockSeconds;
const RESEND_WINDOW_SECONDS = config.security.rateLimit.otpResendWindowSeconds;
const RESEND_PER_IP_LIMIT = config.security.rateLimit.otpResendPerMinute;
const RESEND_PER_EMAIL_LIMIT = config.security.rateLimit.otpResendPerEmailPerWindow;

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
local attemptsKey = KEYS[1]
local blockKey = KEYS[2]
local maxAttempts = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

if redis.call("EXISTS", blockKey) == 1 then
  return -2
end

local attempts = redis.call("INCR", attemptsKey)

if attempts == 1 then
  redis.call("EXPIRE", attemptsKey, ttl)
end

if attempts > maxAttempts then
  redis.call("SET", blockKey, "1", "EX", ttl, "NX")
  return -1
end

return attempts
`;

const getSignupIpRateLimitKey = (ip) => `docketra:ratelimit:signup:ip:${hashIdentifier(ip)}`;
const getSignupEmailRateLimitKey = (email) => `docketra:ratelimit:signup:email:${hashIdentifier(email)}`;
/**
 * OTP verification counters are namespaced by scope so the same logic can enforce
 * independent limits for both email identifiers and client IP addresses.
 * @param {'email'|'ip'} scope
 * @param {string} identifier
 * @returns {string}
 */
const getOtpAttemptKey = (scope, identifier) => `docketra:otp:attempts:${scope}:${hashIdentifier(identifier)}`;
/**
 * @param {'email'|'ip'} scope
 * @param {string} identifier
 * @returns {string}
 */
const getOtpBlockKey = (scope, identifier) => `docketra:otp:block:${scope}:${hashIdentifier(identifier)}`;
/**
 * @param {'email'|'ip'} scope
 * @param {string} identifier
 * @returns {string}
 */
const getOtpResendRateLimitKey = (scope, identifier) => `docketra:otp:resend:${scope}:${hashIdentifier(identifier)}`;

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

const consumeOtpAttemptCounter = async ({ scope, identifier }) => {
  const key = getOtpAttemptKey(scope, identifier);
  const blockKey = getOtpBlockKey(scope, identifier);
  const redis = getRedisClient();

  if (!redis) {
    const counter = await incrementMemoryCounter(key, OTP_BLOCK_SECONDS);
    if (counter.count > VERIFY_MAX_ATTEMPTS) {
      return { allowed: false, retryAfter: counter.retryAfter, attempts: counter.count };
    }
    return { allowed: true, attempts: counter.count };
  }

  const attempts = Number(await redis.eval(
    otpAttemptScript,
    2,
    key,
    blockKey,
    VERIFY_MAX_ATTEMPTS,
    OTP_BLOCK_SECONDS,
  ));

  if (attempts === -1 || attempts === -2) {
    throw new Error('Too many OTP attempts. Try again later.');
  }

  return { allowed: true, attempts };
};

const consumeOtpAttempt = async ({ email, ip }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const normalizedIp = String(ip || 'unknown').trim();
  const [emailAttempt, ipAttempt] = await Promise.all([
    consumeOtpAttemptCounter({ scope: 'email', identifier: normalizedEmail }),
    consumeOtpAttemptCounter({ scope: 'ip', identifier: normalizedIp }),
  ]);
  return {
    allowed: emailAttempt.allowed && ipAttempt.allowed,
    attempts: Math.max(emailAttempt.attempts || 0, ipAttempt.attempts || 0),
  };
};

const consumeOtpResendQuota = async ({ email, ip }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const normalizedIp = String(ip || 'unknown').trim();

  const [ipCounter, emailCounter] = await Promise.all([
    applyRedisRateLimit(getOtpResendRateLimitKey('ip', normalizedIp), RESEND_PER_IP_LIMIT, RESEND_WINDOW_SECONDS),
    applyRedisRateLimit(getOtpResendRateLimitKey('email', normalizedEmail), RESEND_PER_EMAIL_LIMIT, RESEND_WINDOW_SECONDS),
  ]);

  if (!ipCounter.allowed || !emailCounter.allowed) {
    return {
      allowed: false,
      retryAfter: Math.max(ipCounter.retryAfter, emailCounter.retryAfter),
    };
  }
  return { allowed: true };
};

const clearOtpAttempts = async ({ email, ip }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const normalizedIp = String(ip || 'unknown').trim();
  const keys = [
    getOtpAttemptKey('email', normalizedEmail),
    getOtpBlockKey('email', normalizedEmail),
    getOtpAttemptKey('ip', normalizedIp),
    getOtpBlockKey('ip', normalizedIp),
  ];
  const redis = getRedisClient();
  if (!redis) {
    keys.forEach((key) => inMemoryCounters.delete(key));
    return;
  }
  await redis.del(...keys);
};

module.exports = {
  consumeSignupQuota,
  consumeOtpAttempt,
  consumeOtpResendQuota,
  clearOtpAttempts,
  INITIATE_PER_IP_LIMIT,
  INITIATE_PER_EMAIL_LIMIT,
  VERIFY_MAX_ATTEMPTS,
  OTP_BLOCK_SECONDS,
  RESEND_PER_IP_LIMIT,
  RESEND_PER_EMAIL_LIMIT,
};
