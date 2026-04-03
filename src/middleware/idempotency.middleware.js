const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENCY_TTL_SECONDS = 60;

const { getRedisClient } = require('../config/redis');

const resolveKey = (req) => {
  const headerVal = req.get?.('Idempotency-Key');
  if (headerVal) return headerVal;
  const headers = req.headers || {};
  return headers['idempotency-key'] || headers['Idempotency-Key'];
};

const resolveRouteSegment = (req) => {
  const route = req.route?.path || req.baseUrl || req.path || req.originalUrl || 'unknown-route';
  return String(route).replace(/\s+/g, '').replace(/\//g, ':');
};

const resolveFirmSlug = (req) => (
  req.firmSlug
  || req.firm?.firmSlug
  || req.params?.firmSlug
  || req.user?.firmSlug
  || req.user?.firmId
  || req.firmId
  || 'unknown-firm'
);

const resolveXid = (req) => (
  req.user?.xid
  || req.user?.xID
  || req.body?.xid
  || req.body?.xID
  || req.params?.xid
  || req.params?.xID
  || 'anonymous'
);

const buildDistributedKey = (req, xid) => {
  const route = resolveRouteSegment(req);
  const firmSlug = resolveFirmSlug(req);
  return `idempotency:${route}:${firmSlug}:${xid}`;
};

const idempotencyMiddleware = async (req, res, next) => {
  if (!mutatingMethods.has(req.method)) {
    return next();
  }

  const idempotencyKey = resolveKey(req);
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'idempotency_key_required' });
  }

  const redis = getRedisClient();
  if (!redis) {
    return next(new Error('Redis is required for idempotency middleware'));
  }

  const xid = String(idempotencyKey).trim();
  const distributedKey = buildDistributedKey(req, xid);

  try {
    const result = await redis.set(distributedKey, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');
    if (result !== 'OK') {
      return res.status(409).json({ error: 'duplicate_request' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const resetIdempotencyCache = async () => {
  const redis = getRedisClient();
  if (!redis) return;
  const keys = await redis.keys('idempotency:*');
  if (keys.length) {
    await redis.del(...keys);
  }
};

const getIdempotencyCacheSize = async () => {
  const redis = getRedisClient();
  if (!redis) return 0;
  const keys = await redis.keys('idempotency:*');
  return keys.length;
};

module.exports = {
  idempotencyMiddleware,
  resetIdempotencyCache,
  getIdempotencyCacheSize,
};
