const mongoose = require('mongoose');
const DocketEffort = require('../models/DocketEffort.model');
const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const Comment = require('../models/Comment.model');
const CaseHistory = require('../models/CaseHistory.model');

// Helper to check if a client is restricted for the current user
const isClientRestricted = (user, clientDisplayId) => {
  return Array.isArray(user?.restrictedClientIds) && user.restrictedClientIds.includes(clientDisplayId);
};

// Helper to resolve restricted client ObjectIds for filters
const getRestrictedClientIds = async (firmId, userRestrictedDisplayIds) => {
  if (!Array.isArray(userRestrictedDisplayIds) || userRestrictedDisplayIds.length === 0) {
    return [];
  }
  const restrictedClients = await Client.find({
    firmId,
    clientId: { $in: userRestrictedDisplayIds },
  }).select('_id').lean();
  return restrictedClients.map((c) => c._id);
};

const createDocketEffort = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const userEmail = req.user?.email;
    const { caseInternalId, minutes, activityType, date, note } = req.body;

    // 1. Fetch case and enforce tenant isolation
    const targetCase = await Case.findOne({ _id: caseInternalId, firmId });
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }

    // 2. Check client access bounds
    if (isClientRestricted(req.user, targetCase.clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Client is restricted',
        code: 'CLIENT_ACCESS_RESTRICTED',
      });
    }

    // 3. Resolve client ObjectId
    let resolvedClientId = null;
    if (targetCase.clientId) {
      const clientObj = await Client.findOne({ clientId: targetCase.clientId, firmId }).lean();
      if (clientObj) {
        resolvedClientId = clientObj._id;
      }
    }

    // 4. Ingest effort entry
    const effort = new DocketEffort({
      firmId,
      tenantId: String(firmId),
      caseInternalId,
      caseId: targetCase.caseId || targetCase.caseNumber,
      clientId: resolvedClientId,
      userXID,
      userEmail,
      date: date ? new Date(date) : new Date(),
      minutes,
      activityType,
      note: note || '',
      createdByXID: userXID,
    });

    await effort.save();

    // 5. Increment Case actualMinutes (and dynamically adjust estimated cost if desired)
    targetCase.actualMinutes = (targetCase.actualMinutes || 0) + minutes;
    await targetCase.save();

    // 6. Log comment to Case
    await Comment.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      text: `Logged ${minutes} minutes of effort [Activity: ${activityType}]${note ? ` - "${note}"` : ''}`,
      createdBy: userEmail,
      createdByXID: userXID,
      createdByName: req.user.name,
    });

    // 7. Post CaseHistory log
    await CaseHistory.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      actionType: 'EffortLogged',
      description: `Logged time effort: ${minutes} minutes for ${activityType}`,
      performedBy: userEmail,
      performedByXID: userXID,
      actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      actionLabel: 'Effort Entry Added',
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Effort entry logged successfully',
      data: effort,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to create effort log' });
  }
};

const getDocketEfforts = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { page = 1, limit = 50, caseInternalId, clientId, userXID, activityType } = req.query;

    const query = { firmId };

    // Apply client restriction filter boundaries
    const restrictedIds = await getRestrictedClientIds(firmId, req.user?.restrictedClientIds);
    if (restrictedIds.length > 0) {
      query.clientId = { $nin: restrictedIds };
    }

    if (caseInternalId) {
      query.caseInternalId = new mongoose.Types.ObjectId(caseInternalId);
    }
    if (clientId) {
      query.clientId = new mongoose.Types.ObjectId(clientId);
    }
    if (userXID) {
      query.userXID = userXID.toUpperCase();
    }
    if (activityType) {
      query.activityType = activityType;
    }

    const skip = (Number(page) - 1) * Number(limit);
    // 💡 What: Replaced sequential execution of countDocuments and find with concurrent execution using Promise.all().
    // 🎯 Why: This halves the database latency for pagination operations by running independent queries simultaneously.
    const [total, items] = await Promise.all([
      DocketEffort.countDocuments(query),
      DocketEffort.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to list effort entries' });
  }
};

const deleteDocketEffort = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const role = String(req.user?.role || '').toUpperCase();
    const { id } = req.params;

    const effort = await DocketEffort.findOne({ _id: id, firmId });
    if (!effort) {
      return res.status(404).json({ success: false, message: 'Effort entry not found' });
    }

    // Only allow creator of entry OR admins to delete
    const isOwner = effort.userXID === userXID;
    const isAdmin = role === 'ADMIN' || role === 'PRIMARY_ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only delete your own effort logs' });
    }

    // Fetch docket Case and update actualMinutes
    const targetCase = await Case.findOne({ _id: effort.caseInternalId, firmId });
    if (targetCase) {
      targetCase.actualMinutes = Math.max(0, (targetCase.actualMinutes || 0) - effort.minutes);
      await targetCase.save();

      // Comment on the Case
      await Comment.create({
        caseId: targetCase.caseId || targetCase.caseNumber,
        firmId: String(firmId),
        text: `Deleted time effort entry of ${effort.minutes} minutes [Activity: ${effort.activityType}]`,
        createdBy: req.user.email,
        createdByXID: userXID,
        createdByName: req.user.name,
      });

      // Audit History log
      await CaseHistory.create({
        caseId: targetCase.caseId || targetCase.caseNumber,
        firmId: String(firmId),
        actionType: 'EffortDeleted',
        description: `Deleted effort log of ${effort.minutes} minutes`,
        performedBy: req.user.email,
        performedByXID: userXID,
        actorRole: isAdmin ? 'ADMIN' : 'USER',
        actionLabel: 'Effort Entry Deleted',
        timestamp: new Date(),
      });
    }

    await DocketEffort.deleteOne({ _id: id });

    return res.json({ success: true, message: 'Effort entry deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete effort entry' });
  }
};

const updateDocketBudget = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const { caseId } = req.params;
    const { expectedMinutes, estimatedBudget } = req.body;

    const targetCase = await Case.findOne({
      $or: [{ caseId }, { caseNumber: caseId }],
      firmId,
    });
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }

    if (isClientRestricted(req.user, targetCase.clientId)) {
      return res.status(403).json({ success: false, message: 'Access denied: Client is restricted' });
    }

    const changes = [];
    if (expectedMinutes !== undefined && expectedMinutes !== targetCase.expectedMinutes) {
      changes.push(`Expected minutes adjusted from ${targetCase.expectedMinutes || 0} to ${expectedMinutes}`);
      targetCase.expectedMinutes = expectedMinutes;
    }
    if (estimatedBudget !== undefined && estimatedBudget !== targetCase.estimatedBudget) {
      changes.push(`Budget adjusted from ${targetCase.estimatedBudget || 0} to ${estimatedBudget}`);
      targetCase.estimatedBudget = estimatedBudget;
    }

    if (changes.length > 0) {
      await targetCase.save();

      const changeStr = changes.join(', ');

      await Comment.create({
        caseId: targetCase.caseId || targetCase.caseNumber,
        firmId: String(firmId),
        text: `Updated docket budget profiles: ${changeStr}`,
        createdBy: req.user.email,
        createdByXID: userXID,
        createdByName: req.user.name,
      });

      await CaseHistory.create({
        caseId: targetCase.caseId || targetCase.caseNumber,
        firmId: String(firmId),
        actionType: 'BudgetUpdated',
        description: `Budget guidelines updated: ${changeStr}`,
        performedBy: req.user.email,
        performedByXID: userXID,
        actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
        actionLabel: 'Budget Profile Updated',
        timestamp: new Date(),
      });
    }

    return res.json({
      success: true,
      message: 'Docket budget profile updated successfully',
      data: targetCase,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to update docket budget profile' });
  }
};

const getProfitabilityReports = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const role = String(req.user?.role || '').toUpperCase();

    // Verify Admin rights
    if (role !== 'ADMIN' && role !== 'PRIMARY_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Analytical reporting is restricted to admin roles' });
    }

    // Resolve restricted clients
    const restrictedIds = await getRestrictedClientIds(firmId, req.user?.restrictedClientIds);
    const filter = { firmId };
    if (restrictedIds.length > 0) {
      filter.clientId = { $nin: restrictedIds };
    }

    // Fetch cases and efforts
    const cases = await Case.find(filter).lean();
    const efforts = await DocketEffort.find(filter).lean();

    // 1. Budget vs Actual by Docket
    const budgetVsActual = cases
      .filter((c) => (c.estimatedBudget > 0 || c.expectedMinutes > 0 || c.actualMinutes > 0))
      .map((c) => {
        const timeVariance = (c.actualMinutes || 0) - (c.expectedMinutes || 0);
        const costVariance = (c.actualCost || 0) - (c.estimatedBudget || 0);
        return {
          caseId: c.caseId || c.caseNumber,
          title: c.title,
          clientId: c.clientId,
          expectedMinutes: c.expectedMinutes || 0,
          actualMinutes: c.actualMinutes || 0,
          timeVariance,
          estimatedBudget: c.estimatedBudget || 0,
          actualCost: c.actualCost || 0,
          costVariance,
        };
      });

    // 2. Client Effort Summary
    // We map effort minutes by client Display IDs (clientId).
    const clientEffortMap = {};
    efforts.forEach((eff) => {
      // Find client code from target Case
      const c = cases.find((item) => String(item._id) === String(eff.caseInternalId));
      const clientLabel = c?.clientId || 'Internal / General';
      if (!clientEffortMap[clientLabel]) {
        clientEffortMap[clientLabel] = { clientId: clientLabel, totalMinutes: 0, entriesCount: 0 };
      }
      clientEffortMap[clientLabel].totalMinutes += eff.minutes;
      clientEffortMap[clientLabel].entriesCount += 1;
    });
    const clientSummary = Object.values(clientEffortMap).sort((a, b) => b.totalMinutes - a.totalMinutes);

    // 3. Service-Line Effort Summary
    const serviceLineEffortMap = {};
    cases.forEach((c) => {
      const line = c.obligation_type || 'OTHER';
      if (!serviceLineEffortMap[line]) {
        serviceLineEffortMap[line] = { serviceLine: line, totalMinutes: 0, docketsCount: 0 };
      }
      serviceLineEffortMap[line].totalMinutes += c.actualMinutes || 0;
      serviceLineEffortMap[line].docketsCount += 1;
    });
    const serviceLineSummary = Object.values(serviceLineEffortMap).sort((a, b) => b.totalMinutes - a.totalMinutes);

    // 4. Recurring Obligation Variance
    // Groups variance by service line type
    const varianceByLine = {};
    cases.forEach((c) => {
      const line = c.obligation_type || 'OTHER';
      if (!varianceByLine[line]) {
        varianceByLine[line] = {
          serviceLine: line,
          totalExpected: 0,
          totalActual: 0,
          docketsCount: 0,
        };
      }
      varianceByLine[line].totalExpected += c.expectedMinutes || 0;
      varianceByLine[line].totalActual += c.actualMinutes || 0;
      varianceByLine[line].docketsCount += 1;
    });
    const obligationVariance = Object.values(varianceByLine).map((v) => {
      const variance = v.totalActual - v.totalExpected;
      return {
        ...v,
        varianceMinutes: variance,
        avgExpectedMinutes: v.docketsCount > 0 ? Math.round(v.totalExpected / v.docketsCount) : 0,
        avgActualMinutes: v.docketsCount > 0 ? Math.round(v.totalActual / v.docketsCount) : 0,
      };
    });

    return res.json({
      success: true,
      data: {
        budgetVsActual,
        clientSummary,
        serviceLineSummary,
        obligationVariance,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch profitability analytics reports' });
  }
};

module.exports = {
  createDocketEffort,
  getDocketEfforts,
  deleteDocketEffort,
  updateDocketBudget,
  getProfitabilityReports,
};
