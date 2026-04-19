const { assertFirmContext } = require('../utils/tenantGuard');
const dashboardService = require('../services/dashboard.service');
const { getRedisClient } = require('../config/redis');
const log = require('../utils/log');
const onboardingProgressService = require('../services/onboardingProgress.service');
const onboardingAnalyticsService = require('../services/onboardingAnalytics.service');

const DASHBOARD_TTL_SECONDS = 30;

const parsePagination = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
};

const getDashboardSummary = async (req, res) => {
  try {
    assertFirmContext(req);

    const firmId = req.user.firmId;
    const userId = req.user.xID || req.user.xid || req.user.userId;
    const filter = String(req.query.filter || 'MY').toUpperCase();
    const sort = String(req.query.sort || 'NEWEST').toUpperCase();
    const workbasketId = req.query.workbasketId ? String(req.query.workbasketId) : null;
    const page = parsePagination(req.query.page, 1);
    const limit = parsePagination(req.query.limit, 10);
    const only = new Set(String(req.query.only || '').split(',').map((v) => v.trim()).filter(Boolean));

    const cacheKey = `dashboard:${firmId}:${userId}:${filter}:${sort}:${workbasketId || 'ALL'}:${page}:${limit}:${[...only].sort().join('|') || 'all'}`;
    const redis = getRedisClient();

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (error) {
        log.warn('[Dashboard] Cache read failed', { message: error?.message });
      }
    }

    const getOrEmpty = (key, fn, fallback) => (only.size && !only.has(key) ? Promise.resolve(fallback) : fn());

    const [myDockets, overdueDockets, recentDockets, workbasketLoad] = await Promise.all([
      getOrEmpty('myDockets', () => dashboardService.getMyDockets(userId, firmId, { filter, sort, workbasketId, page, limit }), { items: [], page, limit, total: 0, hasNextPage: false, filter, sort }),
      getOrEmpty('overdueDockets', () => dashboardService.getOverdueDockets(firmId, { sort, workbasketId, page, limit }), { items: [], page, limit, total: 0, hasNextPage: false, sort }),
      getOrEmpty('recentDockets', () => dashboardService.getRecentDockets(firmId, { sort, workbasketId, page, limit }), { items: [], page, limit, total: 0, hasNextPage: false, sort }),
      getOrEmpty('workbasketLoad', () => dashboardService.getWorkbasketLoad(firmId), []),
    ]);

    const payload = {
      success: true,
      data: { myDockets, overdueDockets, recentDockets, workbasketLoad },
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(payload), 'EX', DASHBOARD_TTL_SECONDS);
      } catch (error) {
        log.warn('[Dashboard] Cache write failed', { message: error?.message });
      }
    }

    return res.json(payload);
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({ success: false, message: error.message || 'Error fetching dashboard summary', data: {} });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to load dashboard summary',
      data: {
        myDockets: { items: [], page: 1, limit: 10, total: 0, hasNextPage: false, filter: 'MY' },
        overdueDockets: { items: [], page: 1, limit: 10, total: 0, hasNextPage: false },
        recentDockets: { items: [], page: 1, limit: 10, total: 0, hasNextPage: false },
        workbasketLoad: [],
      },
    });
  }
};


const getOnboardingProgress = async (req, res) => {
  try {
    assertFirmContext(req);

    const progress = await onboardingProgressService.getOnboardingProgress({
      firmId: req.user.firmId,
      user: req.user,
    });
    try {
      await onboardingAnalyticsService.recordProgressIfChanged({
        user: req.user,
        firmId: req.user.firmId,
        role: progress.role,
        steps: progress.steps,
      });
    } catch (analyticsError) {
      log.warn('[Dashboard] Non-blocking onboarding analytics write failed', {
        message: analyticsError?.message,
      });
    }

    return res.json({ success: true, data: progress });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({ success: false, message: error.message || 'Error fetching onboarding progress', data: {} });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to load onboarding progress',
      data: { role: 'USER', completed: 0, total: 0, steps: [] },
    });
  }
};

const trackOnboardingEvent = async (req, res) => {
  try {
    assertFirmContext(req);
    const { eventName, stepId = null, source = null, metadata = null } = req.body || {};

    await onboardingAnalyticsService.createEvent({
      user: req.user,
      firmId: req.user.firmId,
      role: req.user?.role,
      eventName,
      stepId,
      source,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to record onboarding event',
    });
  }
};

module.exports = { getDashboardSummary, getOnboardingProgress, trackOnboardingEvent };
