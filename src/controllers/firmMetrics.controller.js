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

    // 💡 What: Replaced 5 sequential countDocuments queries with a single aggregation pipeline using $group, $sum, and $cond.
    // 🎯 Why: Avoid multiple database round-trips to count simple metrics, reducing latency and scaling better on large collections.
    const result = await Case.aggregate([
      { $match: { firmId } },
      {
        $group: {
          _id: null,
          overdueComplianceItems: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $ne: [{ $type: '$dueDate' }, 'missing'] },
                    { $ne: [{ $type: '$dueDate' }, 'null'] },
                    { $lt: ['$dueDate', now] },
                    { $not: { $in: ['$status', TERMINAL_STATUSES] } }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          },
          dueInSevenDays: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $ne: [{ $type: '$dueDate' }, 'missing'] },
                    { $ne: [{ $type: '$dueDate' }, 'null'] },
                    { $gte: ['$dueDate', now] },
                    { $lte: ['$dueDate', sevenDaysFromNow] },
                    { $not: { $in: ['$status', TERMINAL_STATUSES] } }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          },
          awaitingPartnerReview: {
            $sum: {
              $cond: {
                if: {
                  $or: [
                    { $eq: ['$approvalStatus', 'PENDING'] },
                    { $in: ['$status', PARTNER_REVIEW_STATUSES] }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          },
          totalOpenCases: {
            $sum: {
              $cond: {
                if: { $eq: ['$status', 'OPEN'] },
                then: 1,
                else: 0
              }
            }
          },
          totalExecutedCases: {
            $sum: {
              $cond: {
                if: { $in: ['$status', EXECUTED_STATUSES] },
                then: 1,
                else: 0
              }
            }
          }
        }
      }
    ]);

    const metrics = result.length > 0 ? result[0] : EMPTY_FIRM_METRICS;

    return res.json({
      success: true,
      data: {
        overdueComplianceItems: metrics.overdueComplianceItems || 0,
        dueInSevenDays: metrics.dueInSevenDays || 0,
        awaitingPartnerReview: metrics.awaitingPartnerReview || 0,
        totalOpenCases: metrics.totalOpenCases || 0,
        totalExecutedCases: metrics.totalExecutedCases || 0,
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
