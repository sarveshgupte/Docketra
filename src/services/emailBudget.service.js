const { getRedisClient, isRedisReady } = require('../config/redis');
const log = require('../utils/log');

const DEFAULT_DAILY_CAP = 250;
const REDIS_TTL_SECONDS = 172800; // 48 hours to cleanly roll over UTC days

// In-memory fallback when Redis is unavailable (e.g. local dev or tests)
const inMemoryBudgetStore = new Map();

const getDailyCap = () => {
  const parsed = parseInt(process.env.EMAIL_DAILY_BUDGET_CAP, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_CAP;
};

const getCurrentDateKey = () => new Date().toISOString().slice(0, 10);

const getRedisKey = (dateStr) => `docketra:email:daily_budget:${dateStr}`;

/**
 * Get current daily email budget status
 * @returns {Promise<{ date: string, count: number, cap: number, remaining: number, isCapped: boolean }>}
 */
const getDailyEmailBudgetStatus = async () => {
  const dateStr = getCurrentDateKey();
  const cap = getDailyCap();
  let count = 0;

  if (isRedisReady()) {
    try {
      const redis = getRedisClient();
      const val = await redis.get(getRedisKey(dateStr));
      count = parseInt(val, 10) || 0;
    } catch (err) {
      log.warn('[EMAIL_BUDGET] Redis read failed, checking in-memory fallback:', err.message);
      count = inMemoryBudgetStore.get(dateStr) || 0;
    }
  } else {
    count = inMemoryBudgetStore.get(dateStr) || 0;
  }

  const remaining = Math.max(0, cap - count);
  return {
    date: dateStr,
    count,
    cap,
    remaining,
    isCapped: count >= cap,
  };
};

/**
 * Atomically check and reserve 1 email quota for today.
 * Blocks if cap is reached.
 * @returns {Promise<{ allowed: boolean, count: number, cap: number, remaining: number, date: string }>}
 */
const checkAndIncrementEmailBudget = async () => {
  const dateStr = getCurrentDateKey();
  const cap = getDailyCap();

  if (isRedisReady()) {
    try {
      const redis = getRedisClient();
      const key = getRedisKey(dateStr);
      const newCount = await redis.incr(key);

      // Set expiry on first touch of the day
      if (newCount === 1) {
        await redis.expire(key, REDIS_TTL_SECONDS);
      }

      if (newCount > cap) {
        // Roll back the reservation so count does not artificially balloon
        await redis.decr(key);
        log.warn('EMAIL_DAILY_BUDGET_EXCEEDED', { date: dateStr, count: cap, cap });
        return {
          allowed: false,
          count: cap,
          cap,
          remaining: 0,
          date: dateStr,
        };
      }

      return {
        allowed: true,
        count: newCount,
        cap,
        remaining: Math.max(0, cap - newCount),
        date: dateStr,
      };
    } catch (err) {
      log.warn('[EMAIL_BUDGET] Redis incr failed, using in-memory fallback:', err.message);
    }
  }

  // In-memory fallback
  const currentCount = inMemoryBudgetStore.get(dateStr) || 0;
  if (currentCount >= cap) {
    log.warn('EMAIL_DAILY_BUDGET_EXCEEDED', { date: dateStr, count: currentCount, cap });
    return {
      allowed: false,
      count: currentCount,
      cap,
      remaining: 0,
      date: dateStr,
    };
  }

  const newCount = currentCount + 1;
  inMemoryBudgetStore.set(dateStr, newCount);
  return {
    allowed: true,
    count: newCount,
    cap,
    remaining: Math.max(0, cap - newCount),
    date: dateStr,
  };
};

/**
 * Rollback 1 reservation if email delivery completely failed before transmission
 */
const rollbackEmailBudget = async () => {
  const dateStr = getCurrentDateKey();

  if (isRedisReady()) {
    try {
      const redis = getRedisClient();
      const key = getRedisKey(dateStr);
      const val = await redis.decr(key);
      if (val < 0) await redis.set(key, 0);
      return;
    } catch (err) {
      log.warn('[EMAIL_BUDGET] Redis decr failed:', err.message);
    }
  }

  const currentCount = inMemoryBudgetStore.get(dateStr) || 0;
  if (currentCount > 0) {
    inMemoryBudgetStore.set(dateStr, currentCount - 1);
  }
};

/**
 * Reset budget for testing
 */
const resetDailyEmailBudget = async (dateStr = getCurrentDateKey()) => {
  inMemoryBudgetStore.delete(dateStr);
  if (isRedisReady()) {
    try {
      const redis = getRedisClient();
      await redis.del(getRedisKey(dateStr));
    } catch (_) {}
  }
};

module.exports = {
  DEFAULT_DAILY_CAP,
  getDailyCap,
  getDailyEmailBudgetStatus,
  checkAndIncrementEmailBudget,
  rollbackEmailBudget,
  resetDailyEmailBudget,
};
