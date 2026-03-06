const crypto = require('crypto');
const { getRedisClient } = require('../config/redis');

const inMemoryLocks = new Map();

const acquireLock = async ({ key, ttlSeconds = 30 }) => {
  const token = crypto.randomUUID();
  const redis = getRedisClient();

  if (!redis) {
    const current = inMemoryLocks.get(key);
    if (current && current.expiresAt > Date.now()) {
      return { acquired: false };
    }
    inMemoryLocks.set(key, { token, expiresAt: Date.now() + ttlSeconds * 1000 });
    return { acquired: true, key, token };
  }

  const response = await redis.set(key, token, 'NX', 'EX', ttlSeconds);
  if (response !== 'OK') {
    return { acquired: false };
  }
  return { acquired: true, key, token };
};

const releaseLock = async ({ key, token }) => {
  if (!key || !token) {
    return;
  }

  const redis = getRedisClient();
  if (!redis) {
    const current = inMemoryLocks.get(key);
    if (current?.token === token) {
      inMemoryLocks.delete(key);
    }
    return;
  }

  await redis.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `,
    1,
    key,
    token
  );
};

module.exports = {
  acquireLock,
  releaseLock,
};
