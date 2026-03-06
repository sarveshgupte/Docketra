/**
 * Validate Redis eviction policy to avoid silent key loss for critical controls
 * like rate limiting state.
 */
const VALID_EVICTION_POLICIES = new Set(['noeviction']);

const normalizeConfigResponse = (raw) => {
  if (Array.isArray(raw)) {
    if (raw.length === 2 && typeof raw[1] === 'string') {
      return raw[1].trim();
    }
    if (raw.length > 0 && typeof raw[0] === 'string') {
      return raw[0].trim();
    }
  }

  if (raw && typeof raw === 'object') {
    const value = raw['maxmemory-policy'];
    if (typeof value === 'string') {
      return value.trim();
    }
  }

  return '';
};

const validateRedisEvictionPolicy = async (redisClient, logger = console) => {
  if (!redisClient) {
    return { ok: false, skipped: true, reason: 'REDIS_CLIENT_UNAVAILABLE' };
  }

  const raw = await redisClient.config('GET', 'maxmemory-policy');
  const policy = normalizeConfigResponse(raw);

  if (!VALID_EVICTION_POLICIES.has(policy)) {
    throw new Error(`Invalid Redis eviction policy: ${policy || 'UNKNOWN'} (expected: noeviction)`);
  }

  logger.log('✓ Redis eviction policy validated');
  return { ok: true, policy };
};

module.exports = {
  validateRedisEvictionPolicy,
};
