const Case = require('../models/Case.model');
const mongoose = require('mongoose');

const EMPTY_FIRM_METRICS = {
  overdueComplianceItems: 0,
  dueInSevenDays: 0,
  awaitingPartnerReview: 0,
  totalOpenCases: 0,
  totalExecutedCases: 0,
};

const EXECUTED_STATUSES = ['RESOLVED', 'FILED'];
const TERMINAL_STATUSES = [...EXECUTED_STATUSES, 'CLOSED', 'ARCHIVED'];
const PARTNER_REVIEW_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'REVIEWED'];

const getFirmMetrics = async (req, res) => {
  try {
    const firmId = req.firmId;
    if (!firmId || !mongoose.Types.ObjectId.isValid(firmId)) {
      return res.json({
        success: true,
        data: EMPTY_FIRM_METRICS,
      });
    }
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // ⚡ Bolt: Revert $group for simple counts
    // 💡 What: Reverted memory-intensive $group aggregation back to concurrent countDocuments() queries via Promise.all().
    // 🎯 Why: While $group combines multiple counts into one roundtrip, it forces MongoDB to evaluate sub-pipelines bypassing full index coverage and risking aggregation limits. Concurrent countDocuments queries resolve using fast index scans.
    // 📊 Impact: Reduces memory usage and leverages MongoDB index scans for counts.
    const baseQuery = { firmId: new mongoose.Types.ObjectId(firmId) };
    const [
      overdueComplianceItems,
      dueInSevenDays,
      awaitingPartnerReview,
      totalOpenCases,
      totalExecutedCases,
    ] = await Promise.all([
      Case.countDocuments({
        ...baseQuery,
        dueDate: { $lt: now },
        status: { $nin: TERMINAL_STATUSES },
      }),
      Case.countDocuments({
        ...baseQuery,
        dueDate: { $gte: now, $lte: sevenDaysFromNow },
        status: { $nin: TERMINAL_STATUSES },
      }),
      Case.countDocuments({
        ...baseQuery,
        $or: [
          { approvalStatus: 'PENDING' },
          { status: { $in: PARTNER_REVIEW_STATUSES } },
        ],
      }),
      Case.countDocuments({
        ...baseQuery,
        status: 'OPEN',
      }),
      Case.countDocuments({
        ...baseQuery,
        status: { $in: EXECUTED_STATUSES },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        ...EMPTY_FIRM_METRICS,
        overdueComplianceItems,
        dueInSevenDays,
        awaitingPartnerReview,
        totalOpenCases,
        totalExecutedCases,
      },
    });
  } catch (error) {
    return res.json({
      success: true,
      data: EMPTY_FIRM_METRICS,
    });
  }
};

module.exports = {
  getFirmMetrics,
};
