const Redis = require('ioredis');
const { recordFailure, recordSuccess } = require('../services/circuitBreaker.service');
const { validateRedisEvictionPolicy } = require('./redisPolicyCheck');
const log = require('../utils/log');

let redisClient = null;
let redisConnectionAttempted = false;
let redisConnectPromise = null;
let redisErrorLogged = false;
let redisFallbackLogged = false;

const normalizeRedisUrl = () => String(process.env.REDIS_URL || '').trim();
const isProduction = () => process.env.NODE_ENV === 'production';
const isRedisUrlConfigured = () => Boolean(normalizeRedisUrl());
const isRedisUrlValid = (value = normalizeRedisUrl()) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return ['redis:', 'rediss:'].includes(parsed.protocol);
  } catch (_) {
    return false;
  }
};

const isRedisFallbackAllowed = () => String(process.env.ALLOW_REDIS_FALLBACK || '').trim().toLowerCase() === 'true';

const logLocalFallbackOnce = (message) => {
  if (redisFallbackLogged) return;
  redisFallbackLogged = true;
  log.warn(message);
};

const CONNECTING_STATUSES = new Set(['connecting', 'connect', 'ready']);

const connectRedisOnce = () => {
  if (!redisClient) return null;
  if (redisConnectPromise) return redisConnectPromise;
  if (CONNECTING_STATUSES.has(String(redisClient.status || '').toLowerCase())) return null;
  redisConnectPromise = redisClient.connect()
    .catch((error) => {
      logLocalFallbackOnce(`[REDIS] Redis connect attempt failed; continuing startup without Redis-backed features: ${error.message}`);
      recordFailure('redis');
      return null;
    })
    .finally(() => {
      if (redisClient?.status !== 'ready') redisConnectPromise = null;
    });
  return redisConnectPromise;
};

const getRedisClient = () => {
  if (redisConnectionAttempted) {
    connectRedisOnce();
    return redisClient;
  }

  redisConnectionAttempted = true;
  const redisUrl = normalizeRedisUrl();
  log.info(`[REDIS] REDIS_CONFIGURED=${Boolean(redisUrl)}`);

  if (!redisUrl) {
    logLocalFallbackOnce('[REDIS] REDIS_URL is not configured; Redis-backed features are disabled and in-memory fallbacks will be used where supported');
    if (isProduction() && !isRedisFallbackAllowed()) {
      log.error('[REDIS] Production is missing REDIS_URL and ALLOW_REDIS_FALLBACK is not true');
    }
    return null;
  }

  if (!isRedisUrlValid(redisUrl)) {
    throw new Error('Invalid REDIS_URL: must use redis:// or rediss://');
  }

  redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: isProduction() ? 3000 : 1000,
      commandTimeout: isProduction() ? 3000 : 1000,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (isProduction()) return null;
        if (times > 1) {
          logLocalFallbackOnce('[REDIS] Redis unavailable locally - using in-memory fallbacks where supported');
          return null;
        }
        return 250;
      },
    });

    redisClient.on('connect', () => {
      log.info('[REDIS] Connected to Redis for rate limiting');
      recordSuccess('redis');
    });

    redisClient.on('ready', async () => {
      log.info('[REDIS] Redis client ready');
      log.info('[REDIS] REDIS_READY=true');
      recordSuccess('redis');
      try { await validateRedisEvictionPolicy(redisClient); } catch (err) {
        log.warn(`[REDIS] Eviction policy validation failed; continuing without hard failure: ${err.message}`);
      }
    });

    redisClient.on('error', (err) => {
      if (!redisErrorLogged) {
        redisErrorLogged = true;
        log.error('[REDIS] Redis connection error:', err.message);
      }
      log.info('[REDIS] REDIS_READY=false');
      recordFailure('redis');
    });

    redisClient.on('close', () => {
      log.info('[REDIS] REDIS_READY=false');
      if (isProduction()) log.warn('[REDIS] Redis connection closed');
      else logLocalFallbackOnce('[REDIS] Redis connection closed - using in-memory fallbacks where supported');
      recordFailure('redis');
    });

  connectRedisOnce();
  return redisClient;
};

const isRedisReady = () => Boolean(redisClient && redisClient.status === 'ready');

const closeRedisConnection = async () => {
  if (redisClient) {
    try { await redisClient.quit(); log.info('[REDIS] Redis connection closed gracefully'); } catch (error) { log.error('[REDIS] Error closing Redis connection:', error.message); }
  }
};

const resetRedisClientForTests = async () => {
  const client = redisClient;
  redisClient = null;
  redisConnectionAttempted = false;
  redisConnectPromise = null;
  redisErrorLogged = false;
  redisFallbackLogged = false;
  if (client) {
    client.removeAllListeners();
    try { await client.disconnect(); } catch (_) {}
  }
};

module.exports = { getRedisClient, isRedisReady, isRedisUrlConfigured, isRedisUrlValid, closeRedisConnection, _resetRedisClientForTests: resetRedisClientForTests };
