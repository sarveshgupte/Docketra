const Case = require('../models/Case.model');

const EXECUTED_STATUSES = ['RESOLVED', 'FILED'];
const TERMINAL_STATUSES = [...EXECUTED_STATUSES, 'CLOSED', 'ARCHIVED'];
const PARTNER_REVIEW_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'REVIEWED'];

const getFirmMetrics = async (req, res) => {
  try {
    const firmId = req.firmId;
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [overdueComplianceItems, dueInSevenDays, awaitingPartnerReview, totalOpenCases, totalExecutedCases] = await Promise.all([
      Case.countDocuments({
        firmId,
        dueDate: { $lt: now },
        status: { $nin: TERMINAL_STATUSES },
      }),
      Case.countDocuments({
        firmId,
        dueDate: { $gte: now, $lte: sevenDaysFromNow },
        status: { $nin: TERMINAL_STATUSES },
      }),
      Case.countDocuments({
        firmId,
        $or: [
          { approvalStatus: 'PENDING' },
          { status: { $in: PARTNER_REVIEW_STATUSES } },
        ],
      }),
      Case.countDocuments({
        firmId,
        status: 'OPEN',
      }),
      Case.countDocuments({
        firmId,
        status: { $in: EXECUTED_STATUSES },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        overdueComplianceItems,
        dueInSevenDays,
        awaitingPartnerReview,
        totalOpenCases,
        totalExecutedCases,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch firm metrics',
      error: error.message,
    });
  }
};

module.exports = {
  getFirmMetrics,
};
