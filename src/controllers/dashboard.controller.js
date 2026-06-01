const { assertFirmContext } = require('../utils/tenantGuard');
const dashboardService = require('../services/dashboard.service');
const { getRedisClient } = require('../config/redis');
const log = require('../utils/log');
const onboardingProgressService = require('../services/onboardingProgress.service');
const onboardingAnalyticsService = require('../services/onboardingAnalytics.service');
const { hasFirmRoleAtLeast } = require('../utils/role.utils');

const DASHBOARD_TTL_SECONDS = 30;

const parsePagination = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
};

const isManagerOrAbove = (user) => hasFirmRoleAtLeast(user, 'MANAGER');

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

const getRiskBrief = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!isManagerOrAbove(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Risk brief is available for manager and above roles only',
        data: {},
      });
    }
    const brief = await dashboardService.getRiskBrief(req.user.firmId);
    return res.json({ success: true, data: brief });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({ success: false, message: error.message || 'Error fetching risk brief', data: {} });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to load risk brief',
      data: {
        atRiskEntities: 0,
        waitingClient: 0,
        stalePending: 0,
        awaitingApproval: 0,
        overloadedAssignees: [],
        blockedByType: {},
      },
    });
  }
};

const getPartnerMorningDashboard = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!isManagerOrAbove(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Partner morning dashboard is available for manager and above roles only',
        data: {},
      });
    }
    const payload = await dashboardService.getPartnerMorningDashboard(req.user.firmId, {
      assigneeXID: req.query.assigneeXID,
      clientId: req.query.clientId,
      obligationType: req.query.obligationType,
      state: req.query.state,
      dueFrom: req.query.dueFrom,
      dueTo: req.query.dueTo,
      riskLevel: req.query.riskLevel,
      approverXID: req.query.approverXID,
      exceptionType: req.query.exceptionType,
    });
    return res.json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to load partner morning dashboard',
      data: { summary: {}, filtersApplied: {}, sections: {} },
    });
  }
};

const getComplianceControlRoom = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!isManagerOrAbove(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Compliance control room is available for manager and above roles only',
      });
    }
    const payload = await dashboardService.getComplianceControlRoom(req.user.firmId, {
      assigneeXID: req.query.assigneeXID,
      clientId: req.query.clientId,
      obligationType: req.query.obligationType,
      state: req.query.state,
      dueFrom: req.query.dueFrom,
      dueTo: req.query.dueTo,
      riskLevel: req.query.riskLevel,
      useDemo: String(req.query.useDemo || '').toLowerCase() === 'true',
    });
    return res.json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to load compliance control room',
      data: { summary: {}, items: [] },
    });
  }
};

const updateComplianceState = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!isManagerOrAbove(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Compliance state transitions are available for manager and above roles only',
      });
    }
    const updated = await dashboardService.updateComplianceState({
      firmId: req.user.firmId,
      caseId: req.params.caseId,
      nextState: req.body?.nextState,
      actorXID: req.user.xID || req.user.xid || null,
      blockedReason: req.body?.blockedReason,
      pendUntil: req.body?.pendUntil,
      filedAt: req.body?.filedAt,
    });
    return res.json({
      success: true,
      data: {
        caseId: updated.caseId,
        complianceState: updated.compliance_state,
        blockedReason: updated.blocked_reason || null,
        pendUntil: updated.pend_until || null,
        filedAt: updated.filed_at || null,
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to update compliance state',
    });
  }
};

const getApprovalQueues = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!isManagerOrAbove(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Approval queues are available for manager and above roles only',
      });
    }
    const payload = await dashboardService.getApprovalQueues(req.user.firmId, {
      viewerXID: req.user.xID || req.user.xid || null,
      view: req.query.view,
      assigneeXID: req.query.assigneeXID,
      clientId: req.query.clientId,
      approvalType: req.query.approvalType,
    });
    return res.json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to load approval queues',
      data: { summary: {}, items: [] },
    });
  }
};

const remindApproval = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!isManagerOrAbove(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Approval reminders are available for manager and above roles only',
      });
    }
    const data = await dashboardService.remindApproval({
      firmId: req.user.firmId,
      caseId: req.params.caseId,
      actorXID: req.user.xID || req.user.xid || null,
      escalate: Boolean(req.body?.escalate),
    });
    return res.json({ success: true, data, message: 'Reminder event queued' });
  } catch (error) {
    return res.status(Number(error?.statusCode || 400)).json({
      success: false,
      message: error?.message || 'Failed to queue reminder event',
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

module.exports = {
  getDashboardSummary,
  getOnboardingProgress,
  getRiskBrief,
  getPartnerMorningDashboard,
  getComplianceControlRoom,
  updateComplianceState,
  getApprovalQueues,
  remindApproval,
  trackOnboardingEvent,
};
