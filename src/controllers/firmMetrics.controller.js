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

    // ⚡ Bolt: Optimize dashboard metrics with $facet aggregation
    // 💡 What: Replaced 5 concurrent countDocuments() queries with a single aggregate pipeline.
    // 🎯 Why: Reduces DB network round-trips from 5 to 1 and avoids redundant index scans for the same firmId.
    // 📊 Impact: Decreases database query latency and overhead. Expected load time improvement for the metrics endpoint.
    const aggregationResult = await Case.aggregate([
      { $match: { firmId } },
      {
        $facet: {
          overdueComplianceItems: [
            { $match: { dueDate: { $lt: now }, status: { $nin: TERMINAL_STATUSES } } },
            { $count: "count" }
          ],
          dueInSevenDays: [
            { $match: { dueDate: { $gte: now, $lte: sevenDaysFromNow }, status: { $nin: TERMINAL_STATUSES } } },
            { $count: "count" }
          ],
          awaitingPartnerReview: [
            { $match: { $or: [{ approvalStatus: 'PENDING' }, { status: { $in: PARTNER_REVIEW_STATUSES } }] } },
            { $count: "count" }
          ],
          totalOpenCases: [
            { $match: { status: 'OPEN' } },
            { $count: "count" }
          ],
          totalExecutedCases: [
            { $match: { status: { $in: EXECUTED_STATUSES } } },
            { $count: "count" }
          ]
        }
      }
    ]);

    const resultDoc = aggregationResult[0] || {};
    const overdueComplianceItems = resultDoc.overdueComplianceItems?.[0]?.count || 0;
    const dueInSevenDays = resultDoc.dueInSevenDays?.[0]?.count || 0;
    const awaitingPartnerReview = resultDoc.awaitingPartnerReview?.[0]?.count || 0;
    const totalOpenCases = resultDoc.totalOpenCases?.[0]?.count || 0;
    const totalExecutedCases = resultDoc.totalExecutedCases?.[0]?.count || 0;

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
