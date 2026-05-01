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
 * Production: REDIS_URL is optional; unavailable Redis degrades to in-memory fallbacks.
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
    redisClient.connect().catch((error) => {
      logLocalFallbackOnce(`[REDIS] Redis connect attempt failed; continuing startup without Redis-backed features: ${error.message}`);
      recordFailure('redis');
    });

    return redisClient;
  }
  
  redisConnectionAttempted = true;
  
  const redisUrl = normalizeRedisUrl();
  
  // No Redis URL configured - use in-memory store
  if (!redisUrl) {
    logLocalFallbackOnce('[REDIS] REDIS_URL is not configured; Redis-backed features are disabled and in-memory fallbacks will be used where supported');
    return null;
  }

  if (!isRedisUrlValid(redisUrl)) {
    logLocalFallbackOnce('[REDIS] REDIS_URL is invalid; Redis-backed features are disabled and in-memory fallbacks will be used where supported');
    return null;
  }
  
  try {
    // Create Redis client from URL
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: isProduction() ? 3000 : 1000,
      commandTimeout: isProduction() ? 3000 : 1000,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (isProduction()) {
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
        const errorMessage = `[REDIS] Eviction policy validation failed; continuing without hard failure: ${err.message}`;
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
    
    redisClient.connect().catch((error) => {
      logLocalFallbackOnce(`[REDIS] Redis connect attempt failed; continuing startup without Redis-backed features: ${error.message}`);
      recordFailure('redis');
    });

    return redisClient;
  } catch (error) {
    log.error('[REDIS] Failed to initialize Redis client:', error.message);
    redisClient = null;
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
