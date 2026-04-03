/**
 * Validate Redis eviction policy to avoid silent key loss for critical controls
 * like rate limiting state.
 */
const VALID_EVICTION_POLICIES = new Set(['noeviction']);
const POLICY_OVERRIDE_ENV = 'REDIS_EVICTION_POLICY_OVERRIDE';

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

  let policy = '';
  try {
    const raw = await redisClient.config('GET', 'maxmemory-policy');
    policy = normalizeConfigResponse(raw);
  } catch (error) {
    const message = String(error?.message || '');
    const configGetBlocked = /unknown command|NOPERM|no permissions|disabled command|ACL/i.test(message);
    if (!configGetBlocked) {
      throw error;
    }

    const overridePolicy = String(process.env[POLICY_OVERRIDE_ENV] || '').trim();
    if (VALID_EVICTION_POLICIES.has(overridePolicy)) {
      logger.warn(`[REDIS] CONFIG GET blocked; using ${POLICY_OVERRIDE_ENV}=${overridePolicy}`);
      return { ok: true, policy: overridePolicy, source: 'env_override' };
    }

    const err = new Error(`Redis policy check blocked. Set ${POLICY_OVERRIDE_ENV}=noeviction to continue safely.`);
    err.code = 'REDIS_POLICY_CHECK_BLOCKED';
    throw err;
  }

  if (!VALID_EVICTION_POLICIES.has(policy)) {
    throw new Error(`Invalid Redis eviction policy: ${policy || 'UNKNOWN'} (expected: noeviction)`);
  }

  logger.log('✓ Redis eviction policy validated');
  return { ok: true, policy };
};

module.exports = {
  validateRedisEvictionPolicy,
  POLICY_OVERRIDE_ENV,
};
