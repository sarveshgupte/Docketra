const userRepository = require('../repositories/user.repository');
const clientRepository = require('../repositories/client.repository');
const caseRepository = require('../repositories/case.repository');
const categoryRepository = require('../repositories/category.repository');
const { assertFirmContext } = require('../utils/tenantGuard');
const { getRedisClient } = require('../config/redis');
const { getTenantMetrics, upsertTenantMetrics } = require('../services/tenantMetrics.service');

const DASHBOARD_CACHE_TTL_SECONDS = 30;

const getDashboardSummary = async (req, res) => {
  try {
    assertFirmContext(req);
    const firmId = req.user.firmId;
    const cacheKey = `dashboard:${firmId}`;
    let redisClient = null;

    try {
      redisClient = getRedisClient();
      if (redisClient) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      }
    } catch (_error) {
      // Non-fatal: Redis failures should not affect request flow
    }

    const cachedMetrics = await getTenantMetrics(firmId).catch(() => null);
    let users = cachedMetrics?.users;
    let clients = cachedMetrics?.clients;
    let cases = cachedMetrics?.cases;
    let categories = cachedMetrics?.categories;

    if (users === undefined || clients === undefined || cases === undefined || categories === undefined) {
      [users, clients, cases, categories] = await Promise.all([
        userRepository.countUsers(firmId, { isActive: true }),
        clientRepository.countClients(firmId),
        caseRepository.countCases(firmId),
        categoryRepository.countCategories(firmId),
      ]);
      await upsertTenantMetrics(firmId, { users, clients, cases, categories }).catch(() => null);
    } else if (categories === undefined || categories === null) {
      categories = await categoryRepository.countCategories(firmId);
      await upsertTenantMetrics(firmId, { users, clients, cases, categories }).catch(() => null);
    }

    const data = {
      users: users || 0,
      clients: clients || 0,
      cases: cases || 0,
      categories: categories || 0,
    };

    const response = {
      success: true,
      data,
      count: Object.values(data).reduce((sum, value) => sum + value, 0),
    };

    if (redisClient) {
      await redisClient
        .set(cacheKey, JSON.stringify(response), 'EX', DASHBOARD_CACHE_TTL_SECONDS)
        .catch(() => null);
    }

    return res.json(response);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Error fetching dashboard summary',
      data: {},
      count: 0,
    });
  }
};

module.exports = {
  getDashboardSummary,
};
