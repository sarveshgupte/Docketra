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
  
  const redisUrl = process.env.REDIS_URL;
  
  // No Redis URL configured - use in-memory store
  if (!redisUrl) {
    log.info('[REDIS] No REDIS_URL configured - using in-memory rate limiting (single instance only)');
    log.info('[REDIS] For production, set REDIS_URL for distributed rate limiting');
    return null;
  }
  
  try {
    // Create Redis client from URL
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Allow unlimited retries per request
      enableReadyCheck: true,
      connectTimeout: 10000,
      lazyConnect: false,
      retryStrategy: (times) => {
        if (process.env.NODE_ENV === 'production') {
          log.warn('[REDIS] Retry disabled in production for predictability');
          return null;
        }
        // Retry with exponential backoff, max 30 seconds
        const delay = Math.min(times * 100, 30000);
        log.info(`[REDIS] Retry attempt ${times}, waiting ${delay}ms`);
        return delay;
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
      log.error('[REDIS] Redis connection error:', err.message);
      recordFailure('redis');
    });
    
    redisClient.on('close', () => {
      log.warn('[REDIS] Redis connection closed');
      recordFailure('redis');
    });
    
    return redisClient;
  } catch (error) {
    log.error('[REDIS] Failed to initialize Redis client:', error.message);
    log.warn('[REDIS] Falling back to in-memory rate limiting');
    redisClient = null;
    return null;
  }
};

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

module.exports = {
  getRedisClient,
  closeRedisConnection,
};
