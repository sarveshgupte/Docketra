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

    // Bolt Optimization: Replaced 5 concurrent `Case.countDocuments` queries with a single MongoDB `$facet` aggregation.
    // This reduces the number of database queries from 5 to 1, improving overall database latency.
    const [aggregationResult] = await Case.aggregate([
      { $match: { firmId } },
      {
        $facet: {
          overdue: [
            { $match: { dueDate: { $lt: now }, status: { $nin: TERMINAL_STATUSES } } },
            { $count: 'count' }
          ],
          dueInSeven: [
            { $match: { dueDate: { $gte: now, $lte: sevenDaysFromNow }, status: { $nin: TERMINAL_STATUSES } } },
            { $count: 'count' }
          ],
          awaitingReview: [
            {
              $match: {
                $or: [
                  { approvalStatus: 'PENDING' },
                  { status: { $in: PARTNER_REVIEW_STATUSES } }
                ]
              }
            },
            { $count: 'count' }
          ],
          openCases: [
            { $match: { status: 'OPEN' } },
            { $count: 'count' }
          ],
          executedCases: [
            { $match: { status: { $in: EXECUTED_STATUSES } } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const getCount = (facetArray) => (facetArray && facetArray.length > 0 ? facetArray[0].count : 0);

    return res.json({
      success: true,
      data: {
        ...EMPTY_FIRM_METRICS,
        overdueComplianceItems: getCount(aggregationResult?.overdue),
        dueInSevenDays: getCount(aggregationResult?.dueInSeven),
        awaitingPartnerReview: getCount(aggregationResult?.awaitingReview),
        totalOpenCases: getCount(aggregationResult?.openCases),
        totalExecutedCases: getCount(aggregationResult?.executedCases),
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
