const TenantMetrics = require('../models/TenantMetrics.model');
const { getRedisClient } = require('../config/redis');

const DASHBOARD_CACHE_PREFIX = 'dashboard:';

const invalidateDashboardCache = async (firmId) => {
  if (!firmId) return;
  try {
    const redis = getRedisClient();
    if (!redis) return;
    await redis.del(`${DASHBOARD_CACHE_PREFIX}${firmId}`);
  } catch (_error) {
    // Non-fatal: cache invalidation should never break request flow
  }
};

const upsertTenantMetrics = async (firmId, metrics) => {
  if (!firmId || !metrics) return null;
  const update = {
    users: Number(metrics.users || 0),
    clients: Number(metrics.clients || 0),
    cases: Number(metrics.cases || 0),
    categories: Number(metrics.categories || 0),
    updatedAt: new Date(),
  };
  const result = await TenantMetrics.findOneAndUpdate(
    { firmId: String(firmId) },
    { $set: update, $setOnInsert: { firmId: String(firmId) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await invalidateDashboardCache(firmId);
  return result;
};

const incrementTenantMetric = async (firmId, field, amount = 1) => {
  if (!firmId || !['users', 'clients', 'cases', 'categories'].includes(field)) return null;
  const result = await TenantMetrics.findOneAndUpdate(
    { firmId: String(firmId) },
    {
      $inc: { [field]: Number(amount) || 1 },
      $set: { updatedAt: new Date() },
      $setOnInsert: { firmId: String(firmId), users: 0, clients: 0, cases: 0, categories: 0 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await invalidateDashboardCache(firmId);
  return result;
};

const getTenantMetrics = async (firmId) => {
  if (!firmId) return null;
  return TenantMetrics.findOne({ firmId: String(firmId) }).lean();
};

module.exports = {
  getTenantMetrics,
  incrementTenantMetric,
  upsertTenantMetrics,
  invalidateDashboardCache,
};
