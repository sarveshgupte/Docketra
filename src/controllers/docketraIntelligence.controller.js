const { assertFirmContext } = require('../utils/tenantGuard');
const { hasFirmRoleAtLeast } = require('../utils/role.utils');
const docketraIntelligenceService = require('../services/docketraIntelligence.service');

const getWorkloadIntelligence = async (req, res) => {
  try {
    assertFirmContext(req);

    if (!hasFirmRoleAtLeast(req.user, 'MANAGER')) {
      return res.status(403).json({
        success: false,
        message: 'Workload intelligence is available for manager and above roles only',
        data: {},
      });
    }

    const data = await docketraIntelligenceService.getWorkloadIntelligence({
      firmId: req.user.firmId,
      workbasketId: req.query.workbasketId || null,
      candidateXIDs: req.query.assigneeXID ? [req.query.assigneeXID] : null,
    });

    return res.json({ success: true, data });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to load workload intelligence',
      data: {
        summary: { totalMembers: 0, available: 0, moderate: 0, busy: 0, overloaded: 0 },
        recommendations: { recommendedAssignee: null, bestAssignees: [], avoidAssigning: [] },
        members: [],
      },
    });
  }
};

const getWorkbasketCapacityIntelligence = async (req, res) => {
  try {
    assertFirmContext(req);

    if (!hasFirmRoleAtLeast(req.user, 'MANAGER')) {
      return res.status(403).json({
        success: false,
        message: 'Workbasket capacity intelligence is available for manager and above roles only',
        data: {},
      });
    }

    const data = await docketraIntelligenceService.getWorkbasketCapacityIntelligence({
      firmId: req.user.firmId,
      includeQc: req.query.includeQc === true,
      thresholds: {
        busy: req.query.busyThreshold,
        overloaded: req.query.overloadedThreshold,
      },
    });

    return res.json({ success: true, data });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to load workbasket capacity intelligence',
      data: {
        thresholds: docketraIntelligenceService.normalizeCapacityThresholds(),
        summary: { totalWorkbaskets: 0, healthy: 0, busy: 0, overloaded: 0 },
        workbaskets: [],
      },
    });
  }
};

const getDeadlineRiskIntelligence = async (req, res) => {
  try {
    assertFirmContext(req);

    if (!hasFirmRoleAtLeast(req.user, 'MANAGER')) {
      return res.status(403).json({
        success: false,
        message: 'Deadline risk intelligence is available for manager and above roles only',
        data: {},
      });
    }

    const data = await docketraIntelligenceService.getDeadlineRiskIntelligence({
      firmId: req.user.firmId,
    });

    return res.json({ success: true, data });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to load deadline risk intelligence',
      data: {
        riskLevel: 'Low Risk',
        recommendedAction: 'No immediate action required.',
        affectedDocketCount: 0,
        counts: {
          overdueDockets: 0,
          dueToday: 0,
          dueThisWeek: 0,
          highPriorityDueThisWeek: 0,
          reviewBottlenecks: 0,
        },
        affectedDockets: [],
        radar: [],
      },
    });
  }
};

const getExecutiveBrief = async (req, res) => {
  try {
    assertFirmContext(req);
    const data = await docketraIntelligenceService.generateExecutiveAiBrief({ firmId: req.user.firmId });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load executive brief' });
  }
};

const getClientRiskScores = async (req, res) => {
  try {
    assertFirmContext(req);
    const data = await docketraIntelligenceService.getClientComplianceRiskScores({ firmId: req.user.firmId });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load client risk scores' });
  }
};

const rebalanceWorkloadAction = async (req, res) => {
  try {
    assertFirmContext(req);
    if (!hasFirmRoleAtLeast(req.user, 'MANAGER')) {
      return res.status(403).json({ success: false, message: 'Rebalance action is available for manager and above roles only' });
    }
    const execute = req.body?.execute === true;
    const data = await docketraIntelligenceService.rebalanceWorkload({ firmId: req.user.firmId, execute });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to execute workload rebalance' });
  }
};

module.exports = {
  getWorkloadIntelligence,
  getWorkbasketCapacityIntelligence,
  getDeadlineRiskIntelligence,
  getExecutiveBrief,
  getClientRiskScores,
  rebalanceWorkloadAction,
};
