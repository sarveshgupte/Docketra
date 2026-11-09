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

    // ⚡ Bolt: Replace multiple countDocuments with a single aggregation pipeline
    // 💡 What: Replaced single Case.aggregate() pipeline using conditional sums with concurrent Case.countDocuments() queries.
    // 🎯 Why: While $group grouping multiple metrics evaluates counts in a single pass, it is an anti-pattern because the pipeline cannot use indexes and risks hitting MongoDB's 100MB aggregation memory limit for large datasets. Individual countDocuments queries can be resolved using fast index scans.
    // 📊 Impact: Utilizes index scans for better DB performance and memory limits on scale.

    const baseQuery = { firmId: new mongoose.Types.ObjectId(firmId) };

    const [
      overdueComplianceItems,
      dueInSevenDays,
      awaitingPartnerReview,
      totalOpenCases,
      totalExecutedCases
    ] = await Promise.all([
      Case.countDocuments({
        ...baseQuery,
        dueDate: { $lt: now },
        status: { $nin: TERMINAL_STATUSES }
      }),
      Case.countDocuments({
        ...baseQuery,
        dueDate: { $gte: now, $lte: sevenDaysFromNow },
        status: { $nin: TERMINAL_STATUSES }
      }),
      Case.countDocuments({
        ...baseQuery,
        $or: [
          { approvalStatus: 'PENDING' },
          { status: { $in: PARTNER_REVIEW_STATUSES } }
        ]
      }),
      Case.countDocuments({
        ...baseQuery,
        status: 'OPEN'
      }),
      Case.countDocuments({
        ...baseQuery,
        status: { $in: EXECUTED_STATUSES }
      })
    ]);

    return res.json({
      success: true,
      data: {
        overdueComplianceItems,
        dueInSevenDays,
        awaitingPartnerReview,
        totalOpenCases,
        totalExecutedCases
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
