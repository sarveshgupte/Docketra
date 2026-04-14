const { resolveCaseIdentifier } = require('../utils/caseIdentifier');
const { getDocketTimeline } = require('../services/docketActivity.service');

const getTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, page = 1, limit = 20 } = req.query;

    const internalId = await resolveCaseIdentifier(req.user.firmId, id, req.user.role);
    const timeline = await getDocketTimeline(internalId, req.user.firmId, { type, page, limit });

    return res.json({
      success: true,
      data: timeline.items,
      pagination: {
        page: timeline.page,
        limit: timeline.limit,
        total: timeline.total,
        hasNextPage: timeline.hasNextPage,
      },
    });
  } catch (error) {
    const status = /not found/i.test(error?.message || '') ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: status === 404 ? 'Docket not found' : 'Failed to load docket timeline',
      data: [],
    });
  }
};

module.exports = {
  getTimeline,
};
