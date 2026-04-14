const { assertFirmContext } = require('../utils/tenantGuard');
const dashboardService = require('../services/dashboard.service');

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
    const page = parsePagination(req.query.page, 1);
    const limit = parsePagination(req.query.limit, 10);

    const [myDockets, overdueDockets, recentDockets, workbasketLoad] = await Promise.all([
      dashboardService.getMyDockets(userId, firmId, { filter, page, limit }),
      dashboardService.getOverdueDockets(firmId, { page, limit }),
      dashboardService.getRecentDockets(firmId, { page, limit }),
      dashboardService.getWorkbasketLoad(firmId),
    ]);

    return res.json({
      success: true,
      data: {
        myDockets,
        overdueDockets,
        recentDockets,
        workbasketLoad,
      },
    });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message || 'Error fetching dashboard summary',
        data: {},
      });
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

module.exports = {
  getDashboardSummary,
};
