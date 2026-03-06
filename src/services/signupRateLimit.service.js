const { getRedisClient } = require('../config/redis');

const WINDOW_SECONDS = 60 * 60;
const INITIATE_PER_IP_LIMIT = 5;
const INITIATE_PER_EMAIL_LIMIT = 3;
const VERIFY_MAX_ATTEMPTS = 5;

const inMemoryCounters = new Map();

const resolveEntry = (key, ttlSeconds) => {
  const now = Date.now();
  const existing = inMemoryCounters.get(key);
  if (existing && existing.expiresAt > now) {
    return existing;
  }
  const entry = {
    count: 0,
    expiresAt: now + (ttlSeconds * 1000),
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

const incrementRedisCounter = async (key, ttlSeconds) => {
  const redis = getRedisClient();
  if (!redis) {
    return incrementMemoryCounter(key, ttlSeconds);
  }

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  const ttl = await redis.ttl(key);
  return {
    count,
    retryAfter: ttl > 0 ? ttl : ttlSeconds,
  };
};

const consumeSignupQuota = async ({ email, ip }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const normalizedIp = String(ip || 'unknown').trim();

  const [ipCounter, emailCounter] = await Promise.all([
    incrementRedisCounter(`signup:ip:${normalizedIp}`, WINDOW_SECONDS),
    incrementRedisCounter(`signup:email:${normalizedEmail}`, WINDOW_SECONDS),
  ]);

  if (ipCounter.count > INITIATE_PER_IP_LIMIT || emailCounter.count > INITIATE_PER_EMAIL_LIMIT) {
    return {
      allowed: false,
      retryAfter: Math.max(ipCounter.retryAfter, emailCounter.retryAfter),
    };
  }
  return { allowed: true };
};

const consumeOtpAttempt = async ({ email }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const counter = await incrementRedisCounter(`otp_attempts:${normalizedEmail}`, WINDOW_SECONDS);
  if (counter.count > VERIFY_MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: counter.retryAfter, attempts: counter.count };
  }
  return { allowed: true, attempts: counter.count };
};

const clearOtpAttempts = async ({ email }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const key = `otp_attempts:${normalizedEmail}`;
  const redis = getRedisClient();
  if (!redis) {
    inMemoryCounters.delete(key);
    return;
  }
  await redis.del(key);
};

module.exports = {
  consumeSignupQuota,
  consumeOtpAttempt,
  clearOtpAttempts,
  INITIATE_PER_IP_LIMIT,
  INITIATE_PER_EMAIL_LIMIT,
  VERIFY_MAX_ATTEMPTS,
};
