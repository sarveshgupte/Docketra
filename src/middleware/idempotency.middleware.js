const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENCY_TTL_SECONDS = 60;

const {
  getRedisClient,
  isRedisReady,
  isRedisUrlConfigured,
} = require('../config/redis');
const log = require('../utils/log');

let idempotencyFallbackLogged = false;

const now = () => Date.now();

class MemoryIdempotencyStore {
  constructor({ clock = now } = {}) {
    this.clock = clock;
    this.entries = new Map();
  }

  purgeExpired() {
    const currentTime = this.clock();
    for (const [key, entry] of this.entries.entries()) {
      if (!entry || entry.expiresAt <= currentTime) {
        this.entries.delete(key);
      }
    }
  }

  async start(key, ttlSeconds) {
    this.purgeExpired();
    const existing = this.entries.get(key);
    if (existing) {
      if (existing.state === 'completed' && existing.response) {
        return { status: 'completed', response: existing.response };
      }
      return { status: existing.state === 'completed' ? 'completed' : 'in_progress' };
    }

    this.entries.set(key, {
      state: 'in_progress',
      startedAt: this.clock(),
      expiresAt: this.clock() + (ttlSeconds * 1000),
    });
    return { status: 'started' };
  }

  async complete(key, response, ttlSeconds) {
    this.purgeExpired();
    const current = this.entries.get(key);
    if (!current) return;
    this.entries.set(key, {
      ...current,
      state: 'completed',
      response,
      completedAt: this.clock(),
      expiresAt: this.clock() + (ttlSeconds * 1000),
    });
  }

  async fail(key) {
    this.entries.delete(key);
  }

  async reset() {
    this.entries.clear();
  }

  async size() {
    this.purgeExpired();
    return this.entries.size;
  }
}

class RedisIdempotencyStore {
  constructor(redis) {
    this.redis = redis;
  }

  async start(key, ttlSeconds) {
    const payload = JSON.stringify({
      state: 'in_progress',
      startedAt: new Date().toISOString(),
    });
    const result = await this.redis.set(key, payload, 'EX', ttlSeconds, 'NX');
    if (result === 'OK') {
      return { status: 'started' };
    }

    const raw = await this.redis.get(key);
    if (!raw) {
      return { status: 'in_progress' };
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.state === 'completed' && parsed.response) {
        return { status: 'completed', response: parsed.response };
      }
      return { status: parsed?.state === 'completed' ? 'completed' : 'in_progress' };
    } catch (_) {
      return { status: 'in_progress' };
    }
  }

  async complete(key, response, ttlSeconds) {
    const payload = JSON.stringify({
      state: 'completed',
      completedAt: new Date().toISOString(),
      response,
    });
    await this.redis.set(key, payload, 'EX', ttlSeconds);
  }

  async fail(key) {
    await this.redis.del(key);
  }

  async reset() {
    const keys = await this.redis.keys('idempotency:*');
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }

  async size() {
    const keys = await this.redis.keys('idempotency:*');
    return keys.length;
  }
}

const memoryStore = new MemoryIdempotencyStore();

const isNonProduction = () => process.env.NODE_ENV !== 'production';

const getStore = () => {
  const redis = getRedisClient();
  if (redis && (isRedisReady() || process.env.NODE_ENV === 'production')) {
    return { store: new RedisIdempotencyStore(redis), type: 'redis' };
  }

  if (process.env.NODE_ENV === 'production') {
    const error = new Error('Idempotency storage is unavailable');
    error.code = 'IDEMPOTENCY_STORE_UNAVAILABLE';
    error.statusCode = 503;
    throw error;
  }

  if (isRedisUrlConfigured() && !idempotencyFallbackLogged) {
    idempotencyFallbackLogged = true;
    log.warn('[IDEMPOTENCY] Redis not ready locally - using in-memory idempotency store');
  }

  return { store: memoryStore, type: 'memory' };
};

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

const buildDistributedKey = (req, idempotencyKey) => {
  const route = resolveRouteSegment(req);
  const firmSlug = resolveFirmSlug(req);
  return `idempotency:${route}:${firmSlug}:${String(idempotencyKey).trim()}`;
};

const replayResponse = (res, storedResponse) => {
  const statusCode = storedResponse?.statusCode || 200;
  const body = storedResponse?.body;
  res.setHeader('Idempotency-Replayed', 'true');
  return res.status(statusCode).json(body);
};

const isJsonResponse = (res) => {
  const contentType = res.getHeader?.('content-type') || res.getHeader?.('Content-Type') || '';
  return String(contentType).toLowerCase().includes('application/json');
};

const patchResponseCapture = (req, res, key, store) => {
  let capturedBody;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (body) => {
    capturedBody = body;
    return originalJson(body);
  };

  res.send = (body) => {
    if (capturedBody === undefined && isJsonResponse(res)) {
      if (Buffer.isBuffer(body)) {
        capturedBody = body.toString('utf8');
      } else {
        capturedBody = body;
      }
    }
    return originalSend(body);
  };

  res.once('finish', () => {
    const response = capturedBody === undefined
      ? null
      : { statusCode: res.statusCode, body: capturedBody };
    const completion = res.statusCode >= 500
      ? store.fail(key)
      : store.complete(key, response, IDEMPOTENCY_TTL_SECONDS);

    Promise.resolve(completion).catch((error) => {
      log.error('[IDEMPOTENCY] Failed to finalize idempotency entry', {
        req,
        error: error.message,
      });
    });
  });
};

const makeStoreUnavailableError = (error) => {
  const wrapped = new Error('Idempotency storage is unavailable');
  wrapped.code = 'IDEMPOTENCY_STORE_UNAVAILABLE';
  wrapped.statusCode = 503;
  wrapped.cause = error;
  return wrapped;
};

const idempotencyMiddleware = async (req, res, next) => {
  if (!mutatingMethods.has(req.method)) {
    return next();
  }

  const idempotencyKey = resolveKey(req);
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'idempotency_key_required' });
  }

  const distributedKey = buildDistributedKey(req, idempotencyKey);

  let resolved;
  try {
    resolved = getStore();
  } catch (error) {
    return next(makeStoreUnavailableError(error));
  }

  try {
    const result = await resolved.store.start(distributedKey, IDEMPOTENCY_TTL_SECONDS);
    req.idempotency = {
      key: distributedKey,
      storeType: resolved.type,
      state: result.status,
    };

    if (result.status === 'completed' && result.response) {
      return replayResponse(res, result.response);
    }
    if (result.status !== 'started') {
      return res.status(409).json({ error: 'duplicate_request' });
    }

    patchResponseCapture(req, res, distributedKey, resolved.store);
    return next();
  } catch (error) {
    if (resolved.type === 'redis' && isNonProduction()) {
      if (!idempotencyFallbackLogged) {
        idempotencyFallbackLogged = true;
        log.warn('[IDEMPOTENCY] Redis operation failed locally - using in-memory idempotency store', {
          error: error.message,
        });
      }
      try {
        const result = await memoryStore.start(distributedKey, IDEMPOTENCY_TTL_SECONDS);
        req.idempotency = {
          key: distributedKey,
          storeType: 'memory',
          state: result.status,
        };
        if (result.status === 'completed' && result.response) {
          return replayResponse(res, result.response);
        }
        if (result.status !== 'started') {
          return res.status(409).json({ error: 'duplicate_request' });
        }
        patchResponseCapture(req, res, distributedKey, memoryStore);
        return next();
      } catch (fallbackError) {
        return next(makeStoreUnavailableError(fallbackError));
      }
    }
    return next(makeStoreUnavailableError(error));
  }
};

const resetIdempotencyCache = async () => {
  await memoryStore.reset();
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) return;
  await new RedisIdempotencyStore(redis).reset();
};

const getIdempotencyCacheSize = async () => {
  const redis = getRedisClient();
  if (redis && isRedisReady()) {
    return new RedisIdempotencyStore(redis).size();
  }
  return memoryStore.size();
};

module.exports = {
  IDEMPOTENCY_TTL_SECONDS,
  MemoryIdempotencyStore,
  RedisIdempotencyStore,
  idempotencyMiddleware,
  resetIdempotencyCache,
  getIdempotencyCacheSize,
};
