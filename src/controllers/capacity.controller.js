const Team = require('../models/Team.model');
const User = require('../models/User.model');
const Case = require('../models/Case.model');
const CaseStatus = require('../domain/case/caseStatus');
const { COMPLIANCE_STATES } = require('../domain/compliance/complianceStateMachine');
const { reassignCase } = require('../services/caseAssignment.service');
const mongoose = require('mongoose');

const getWorkbasketCapacity = async (req, res) => {
  try {
    const { workbasketId } = req.params;
    const firmId = req.user?.firmId;

    if (!mongoose.Types.ObjectId.isValid(workbasketId)) {
      return res.status(400).json({ success: false, message: 'Invalid workbasketId' });
    }

    const workbasket = await Team.findOne({ _id: workbasketId, firmId }).lean();
    if (!workbasket) {
      return res.status(404).json({ success: false, message: 'Workbasket not found' });
    }

    // Resolve all active users in this workbasket
    const members = await User.find({
      firmId,
      status: 'active',
      isActive: true,
      teamIds: new mongoose.Types.ObjectId(workbasketId),
    }).select('_id xID name role').lean();

    // Include the manager if not already in the list
    if (workbasket.managerId) {
      const isManagerInMembers = members.some(m => String(m._id) === String(workbasket.managerId));
      if (!isManagerInMembers) {
        const manager = await User.findOne({
          _id: workbasket.managerId,
          firmId,
          status: 'active',
        }).select('_id xID name role').lean();
        if (manager) {
          members.push(manager);
        }
      }
    }

    const memberXIDs = members.map(m => m.xID).filter(Boolean);

    const now = new Date();
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const aggregates = await Case.aggregate([
      {
        $match: {
          firmId: { $in: [String(firmId), new mongoose.Types.ObjectId(firmId)] },
          assignedToXID: { $in: memberXIDs },
          status: { $nin: ['RESOLVED', 'FILED'] },
        },
      },
      {
        $project: {
          assignedToXID: 1,
          status: 1,
          compliance_state: 1,
          dueDate: 1,
          slaDueAt: 1,
          pendingReason: 1,
          blockerType: 1,
          blockedAt: 1,
          approvalStage: '$approval_stage',
          isOverdue: {
            $cond: {
              if: {
                $or: [
                  { $and: [{ $gt: ['$dueDate', null] }, { $lt: ['$dueDate', now] }] },
                  { $and: [{ $gt: ['$slaDueAt', null] }, { $lt: ['$slaDueAt', now] }] }
                ]
              },
              then: true,
              else: false
            }
          },
          isDueThisWeek: {
            $cond: {
              if: {
                $or: [
                  { $and: [{ $gte: ['$dueDate', now] }, { $lte: ['$dueDate', endOfWeek] }] },
                  { $and: [{ $gte: ['$slaDueAt', now] }, { $lte: ['$slaDueAt', endOfWeek] }] }
                ]
              },
              then: true,
              else: false
            }
          },
          isPended: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$status', 'PENDING'] },
                  { $eq: ['$compliance_state', COMPLIANCE_STATES.AWAITING_CLIENT] },
                  { $eq: ['$compliance_state', COMPLIANCE_STATES.AWAITING_PARTNER] },
                  { $eq: ['$pendingReason', 'waiting_client'] }
                ]
              },
              then: true,
              else: false
            }
          },
          isBlocked: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$compliance_state', COMPLIANCE_STATES.BLOCKED] },
                  { $eq: ['$pendingReason', 'blocked'] },
                  { $ne: ['$blockerType', null] }
                ]
              },
              then: true,
              else: false
            }
          },
          isReadyForReview: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$status', 'QC_PENDING'] },
                  { $eq: ['$approvalStage.status', 'pending'] }
                ]
              },
              then: true,
              else: false
            }
          }
        }
      },
      {
        $group: {
          _id: '$assignedToXID',
          totalActiveDockets: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ['$isPended', false] },
                    { $eq: ['$isBlocked', false] }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          },
          dueThisWeek: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ['$isDueThisWeek', true] },
                    { $eq: ['$isPended', false] },
                    { $eq: ['$isBlocked', false] }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          },
          overdue: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ['$isOverdue', true] },
                    { $eq: ['$isPended', false] },
                    { $eq: ['$isBlocked', false] }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          },
          awaitingExternalInput: {
            $sum: {
              $cond: {
                if: { $eq: ['$isPended', true] },
                then: 1,
                else: 0
              }
            }
          },
          blocked: {
            $sum: {
              $cond: {
                if: { $eq: ['$isBlocked', true] },
                then: 1,
                else: 0
              }
            }
          },
          readyForReview: {
            $sum: {
              $cond: {
                if: { $eq: ['$isReadyForReview', true] },
                then: 1,
                else: 0
              }
            }
          }
        }
      }
    ]);

    const aggregateMap = new Map(aggregates.map(a => [a._id, a]));

    const data = members.map(m => {
      const metrics = aggregateMap.get(m.xID) || {
        totalActiveDockets: 0,
        dueThisWeek: 0,
        overdue: 0,
        awaitingExternalInput: 0,
        blocked: 0,
        readyForReview: 0,
      };

      const loadScore = (metrics.totalActiveDockets * 3) + (metrics.overdue * 2) + metrics.dueThisWeek;

      return {
        _id: m._id,
        xID: m.xID,
        name: m.name,
        role: m.role,
        loadSummary: {
          totalActiveDockets: metrics.totalActiveDockets,
          dueThisWeek: metrics.dueThisWeek,
          overdue: metrics.overdue,
          awaitingExternalInput: metrics.awaitingExternalInput,
          blocked: metrics.blocked,
          readyForReview: metrics.readyForReview,
        },
        loadScore,
        loadScoreExplanation: 'Load Score = (Active Dockets * 3) + (Overdue * 2) + (Due This Week * 1). Excludes pended and blocked work.',
      };
    });

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch workbasket capacity' });
  }
};

const getWorkbasketDockets = async (req, res) => {
  try {
    const { workbasketId } = req.params;
    const firmId = req.user?.firmId;

    if (!mongoose.Types.ObjectId.isValid(workbasketId)) {
      return res.status(400).json({ success: false, message: 'Invalid workbasketId' });
    }

    const { category, priority, status, assignedToXID } = req.query;
    const scopedWorkbasketId = new mongoose.Types.ObjectId(workbasketId);

    const query = {
      firmId: { $in: [String(firmId), new mongoose.Types.ObjectId(firmId)] },
      $or: [
        { routedToTeamId: scopedWorkbasketId },
        {
          routedToTeamId: null,
          $or: [
            { workbasketId: scopedWorkbasketId },
            { ownerTeamId: scopedWorkbasketId },
          ],
        },
      ],
      status: { $nin: ['RESOLVED', 'FILED'] },
    };

    if (category) query.category = category;
    if (priority) query.priority = priority.toLowerCase();
    if (status) query.status = status.toUpperCase();
    if (assignedToXID) {
      query.assignedToXID = assignedToXID === 'unassigned' ? null : assignedToXID.toUpperCase();
    }

    const dockets = await Case.find(query)
      .select('caseId caseNumber title clientId status priority dueDate assignedToXID compliance_state category subcategory updatedAt')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: dockets.map(d => ({
        ...d,
        caseId: d.caseId || d.caseNumber,
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch workbasket dockets' });
  }
};

const bulkReassignDockets = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { caseIds, assignedToXID } = req.body;

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res.status(400).json({ success: false, message: 'caseIds must be a non-empty array' });
    }

    if (!assignedToXID) {
      return res.status(400).json({ success: false, message: 'assignedToXID is required' });
    }

    // Resolve target user
    const targetUser = await User.findOne({
      xID: assignedToXID.toUpperCase(),
      firmId,
      status: 'active',
    }).lean();

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found or inactive' });
    }

    const successCases = [];
    const failedCases = [];

    // Reassign each case atomically
    for (const caseId of caseIds) {
      try {
        await reassignCase(String(firmId), caseId, assignedToXID, req.user);
        successCases.push(caseId);
      } catch (err) {
        failedCases.push({ caseId, error: err.message });
      }
    }

    return res.json({
      success: true,
      message: `Successfully reassigned ${successCases.length} of ${caseIds.length} dockets`,
      data: {
        successCases,
        failedCases,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to reassign dockets' });
  }
};

module.exports = {
  getWorkbasketCapacity,
  getWorkbasketDockets,
  bulkReassignDockets,
};
