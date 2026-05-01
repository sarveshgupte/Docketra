const Redis = require('ioredis');
const { recordFailure, recordSuccess } = require('../services/circuitBreaker.service');
const { validateRedisEvictionPolicy } = require('./redisPolicyCheck');
const log = require('../utils/log');

/**
 * Redis Configuration for Rate Limiting
 * 
 * Provides Redis client for distributed rate limiting across multiple instances.
 * Falls back to null (in-memory store) for development when Redis is not configured.
 * 
 * Production: REDIS_URL must be set for horizontal scaling
 * Development: Optional - can use in-memory store for single instance
 */

let redisClient = null;
let redisConnectionAttempted = false;
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

const logLocalFallbackOnce = (message) => {
  if (redisFallbackLogged) return;
  redisFallbackLogged = true;
  log.warn(message);
};

/**
 * Get Redis client for rate limiting
 * Returns null if Redis is not configured (uses in-memory store)
 * Logs error and returns null if Redis connection fails
 * 
 * @returns {Redis|null} Redis client or null
 */
const getRedisClient = () => {
  // Return existing client if already created
  if (redisConnectionAttempted) {
    return redisClient;
  }
  
  redisConnectionAttempted = true;
  
  const redisUrl = normalizeRedisUrl();
  
  // No Redis URL configured - use in-memory store
  if (!redisUrl) {
    if (isProduction()) {
      throw new Error('REDIS_URL is required in production for Redis-backed idempotency and distributed abuse controls');
    }
    log.info('[REDIS] No REDIS_URL configured - using local in-memory fallbacks where supported');
    return null;
  }

  if (!isRedisUrlValid(redisUrl)) {
    if (isProduction()) {
      throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL in production');
    }
    logLocalFallbackOnce('[REDIS] Invalid REDIS_URL configured - using local in-memory fallbacks where supported');
    return null;
  }
  
  try {
    // Create Redis client from URL
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: isProduction() ? 10000 : 1000,
      commandTimeout: isProduction() ? 10000 : 1000,
      enableOfflineQueue: isProduction(),
      lazyConnect: false,
      retryStrategy: (times) => {
        if (isProduction()) {
          log.warn('[REDIS] Retry disabled in production for predictability');
          return null;
        }
        if (times > 1) {
          logLocalFallbackOnce('[REDIS] Redis unavailable locally - using in-memory fallbacks where supported');
          return null;
        }
        return 250;
      },
    });
    
    // Handle connection events
    redisClient.on('connect', () => {
      log.info('[REDIS] Connected to Redis for rate limiting');
      recordSuccess('redis');
    });
    
    redisClient.on('ready', async () => {
      log.info('[REDIS] Redis client ready');
      recordSuccess('redis');
      try {
        await validateRedisEvictionPolicy(redisClient);
      } catch (err) {
        const errorMessage = `[REDIS] Eviction policy validation failed: ${err.message}`;
        if (process.env.NODE_ENV === 'production') {
          log.error(errorMessage);
          process.exit(1);
        }
        log.warn(errorMessage);
      }
    });
    
    redisClient.on('error', (err) => {
      if (!redisErrorLogged) {
        redisErrorLogged = true;
        log.error('[REDIS] Redis connection error:', err.message);
      }
      recordFailure('redis');
    });
    
    redisClient.on('close', () => {
      if (isProduction()) {
        log.warn('[REDIS] Redis connection closed');
      } else {
        logLocalFallbackOnce('[REDIS] Redis connection closed - using in-memory fallbacks where supported');
      }
      recordFailure('redis');
    });
    
    return redisClient;
  } catch (error) {
    log.error('[REDIS] Failed to initialize Redis client:', error.message);
    redisClient = null;
    if (isProduction()) {
      throw error;
    }
    logLocalFallbackOnce('[REDIS] Falling back to local in-memory behavior where supported');
    return null;
  }
};

const isRedisReady = () => Boolean(redisClient && redisClient.status === 'ready');

/**
 * Close Redis connection gracefully
 * Used during application shutdown
 */
const closeRedisConnection = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      log.info('[REDIS] Redis connection closed gracefully');
    } catch (error) {
      log.error('[REDIS] Error closing Redis connection:', error.message);
    }
  }
};

const resetRedisClientForTests = async () => {
  const client = redisClient;
  redisClient = null;
  redisConnectionAttempted = false;
  redisErrorLogged = false;
  redisFallbackLogged = false;
  if (client) {
    client.removeAllListeners();
    try {
      await client.disconnect();
    } catch (_) {
      // ignore test cleanup failures
    }
  }
};

module.exports = {
  getRedisClient,
  isRedisReady,
  isRedisUrlConfigured,
  isRedisUrlValid,
  closeRedisConnection,
  _resetRedisClientForTests: resetRedisClientForTests,
};
