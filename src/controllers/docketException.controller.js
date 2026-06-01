const mongoose = require('mongoose');
const DocketException = require('../models/DocketException.model');
const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const Comment = require('../models/Comment.model');
const CaseHistory = require('../models/CaseHistory.model');

// Helper to check if a client display ID is restricted for the current user
const isClientRestricted = (user, clientDisplayId) => {
  return Array.isArray(user?.restrictedClientIds) && user.restrictedClientIds.includes(clientDisplayId);
};

// Helper to fetch restricted client ObjectIds for filter queries
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

const createDocketException = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const {
      caseInternalId,
      exceptionType,
      description,
      occurredAt,
      owner,
      status,
      evidenceAttachmentId,
      ticketNumber,
      revisedEta,
    } = req.body;

    // Fetch docket and enforce firm isolation
    const targetCase = await Case.findOne({ caseInternalId, firmId });
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }

    // Check client restrictions
    if (isClientRestricted(req.user, targetCase.clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Client is restricted',
        code: 'CLIENT_ACCESS_RESTRICTED',
      });
    }

    // Resolve client ObjectId reference
    let resolvedClientId = null;
    if (targetCase.clientId) {
      const clientObj = await Client.findOne({ clientId: targetCase.clientId, firmId }).lean();
      if (clientObj) {
        resolvedClientId = clientObj._id;
      }
    }

    const docketException = new DocketException({
      firmId,
      tenantId: String(firmId),
      caseInternalId,
      caseId: targetCase.caseId || targetCase.caseNumber,
      clientId: resolvedClientId,
      exceptionType,
      description,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      owner: owner || userXID,
      status: status || 'open',
      evidenceAttachmentId: evidenceAttachmentId || null,
      ticketNumber: ticketNumber || null,
      revisedEta: revisedEta ? new Date(revisedEta) : null,
      createdByXID: userXID,
    });

    await docketException.save();

    // 1. Post linked comment to the case
    await Comment.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      text: `Logged new regulatory exception: [Type: ${exceptionType}] - "${description}"${ticketNumber ? ` (Ticket: ${ticketNumber})` : ''}`,
      createdBy: req.user.email,
      createdByXID: userXID,
      createdByName: req.user.name,
    });

    // 2. Add append-only CaseHistory audit log
    await CaseHistory.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      actionType: 'ExceptionLogged',
      description: `Logged exception: "${description}" (Type: ${exceptionType}, Status: ${status || 'open'})`,
      performedBy: req.user.email,
      performedByXID: userXID,
      actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      actionLabel: 'Regulatory Exception Logged',
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Docket exception created successfully',
      data: docketException,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to create exception log' });
  }
};

const getDocketExceptions = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { page = 1, limit = 20, caseInternalId, exceptionType, status } = req.query;

    const query = { firmId };

    // Apply Client Restrictions Filter
    const restrictedIds = await getRestrictedClientIds(firmId, req.user?.restrictedClientIds);
    if (restrictedIds.length > 0) {
      query.clientId = { $nin: restrictedIds };
    }

    if (caseInternalId) {
      query.caseInternalId = new mongoose.Types.ObjectId(caseInternalId);
    }

    if (exceptionType) {
      query.exceptionType = exceptionType;
    }

    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await DocketException.countDocuments(query);
    const items = await DocketException.find(query)
      .populate('caseInternalId', 'title status dueDate statutory_due_date')
      .populate('clientId', 'businessName clientId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch exception logs' });
  }
};

const updateDocketException = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const { id } = req.params;
    const { description, owner, status, evidenceAttachmentId, ticketNumber, revisedEta } = req.body;

    const docketException = await DocketException.findOne({ _id: id, firmId });
    if (!docketException) {
      return res.status(404).json({ success: false, message: 'Exception log not found' });
    }

    // Verify Case / Client restrictions
    const targetCase = await Case.findOne({ caseInternalId: docketException.caseInternalId, firmId });
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Associated docket not found' });
    }
    if (isClientRestricted(req.user, targetCase.clientId)) {
      return res.status(403).json({ success: false, message: 'Access denied: client is restricted' });
    }

    const changes = [];
    if (description !== undefined && description !== docketException.description) {
      changes.push(`description changed from "${docketException.description}" to "${description}"`);
      docketException.description = description;
    }
    if (owner !== undefined && owner !== docketException.owner) {
      changes.push(`owner XID changed from "${docketException.owner}" to "${owner}"`);
      docketException.owner = owner;
    }
    if (status !== undefined && status !== docketException.status) {
      changes.push(`status transitioned from "${docketException.status}" to "${status}"`);
      docketException.status = status;
    }
    if (evidenceAttachmentId !== undefined && String(evidenceAttachmentId) !== String(docketException.evidenceAttachmentId)) {
      changes.push(`evidence reference updated`);
      docketException.evidenceAttachmentId = evidenceAttachmentId;
    }
    if (ticketNumber !== undefined && ticketNumber !== docketException.ticketNumber) {
      changes.push(`ticket reference updated to "${ticketNumber}"`);
      docketException.ticketNumber = ticketNumber;
    }
    if (revisedEta !== undefined) {
      const newEta = revisedEta ? new Date(revisedEta).toISOString().split('T')[0] : 'None';
      const oldEta = docketException.revisedEta ? docketException.revisedEta.toISOString().split('T')[0] : 'None';
      if (newEta !== oldEta) {
        changes.push(`revised ETA changed from "${oldEta}" to "${newEta}"`);
        docketException.revisedEta = revisedEta ? new Date(revisedEta) : null;
      }
    }

    if (changes.length > 0) {
      await docketException.save();

      const changeStr = changes.join(', ');

      // 1. Post Comment
      await Comment.create({
        caseId: targetCase.caseId || targetCase.caseNumber,
        firmId: String(firmId),
        text: `Updated exception [Type: ${docketException.exceptionType}]: ${changeStr}`,
        createdBy: req.user.email,
        createdByXID: userXID,
        createdByName: req.user.name,
      });

      // 2. Add CaseHistory log
      await CaseHistory.create({
        caseId: targetCase.caseId || targetCase.caseNumber,
        firmId: String(firmId),
        actionType: 'ExceptionUpdated',
        description: `Exception updated: ${changeStr}`,
        performedBy: req.user.email,
        performedByXID: userXID,
        actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
        actionLabel: 'Exception Tracking Updated',
        timestamp: new Date(),
      });
    }

    return res.json({
      success: true,
      message: 'Docket exception updated successfully',
      data: docketException,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to update docket exception' });
  }
};

const getExceptionDashboard = async (req, res) => {
  try {
    const firmId = req.user?.firmId;

    // Resolve restricted client ObjectIds
    const restrictedIds = await getRestrictedClientIds(firmId, req.user?.restrictedClientIds);

    const query = {
      firmId,
      status: { $in: ['open', 'monitoring'] },
    };

    if (restrictedIds.length > 0) {
      query.clientId = { $nin: restrictedIds };
    }

    // Load active exceptions
    const exceptions = await DocketException.find(query)
      .populate('caseInternalId', 'title status dueDate statutory_due_date')
      .populate('clientId', 'businessName clientId')
      .lean();

    // 1. Group By Type
    const byType = {
      portal_issue: 0,
      query_raised: 0,
      DSC_authorisation_pending: 0,
      client_delay: 0,
      payment_pending: 0,
      data_mismatch: 0,
      other: 0,
    };

    // 2. Group By Age
    const byAge = {
      under_3_days: 0,
      between_3_and_7_days: 0,
      over_7_days: 0,
    };

    // 3. Group By Client
    const byClient = {};

    // 4. Due Date Risk
    let overdueCount = 0;
    let closeDueCount = 0; // <= 2 days

    const now = new Date();

    exceptions.forEach((ex) => {
      // Group by type
      if (byType[ex.exceptionType] !== undefined) {
        byType[ex.exceptionType]++;
      }

      // Group by age
      const occurred = new Date(ex.occurredAt || ex.createdAt);
      const ageMs = now - occurred;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays < 3) {
        byAge.under_3_days++;
      } else if (ageDays <= 7) {
        byAge.between_3_and_7_days++;
      } else {
        byAge.over_7_days++;
      }

      // Group by Client
      const clientName = ex.clientId?.businessName || 'Internal / No Client';
      const clientIdStr = ex.clientId?.clientId || 'internal';
      const clientKey = `${clientName} (${clientIdStr})`;
      byClient[clientKey] = (byClient[clientKey] || 0) + 1;

      // Group by Due Date Risk
      const targetCase = ex.caseInternalId;
      if (targetCase) {
        const dueDateVal = targetCase.dueDate || targetCase.statutory_due_date;
        if (dueDateVal) {
          const dueDateObj = new Date(dueDateVal);
          const diffMs = dueDateObj - now;
          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (dueDateObj < now) {
            overdueCount++;
          } else if (diffDays <= 2) {
            closeDueCount++;
          }
        }
      }
    });

    return res.json({
      success: true,
      data: {
        byType,
        byAge,
        byClient,
        dueDateRisk: {
          overdue: overdueCount,
          closeDue: closeDueCount,
          atRisk: overdueCount + closeDueCount,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch exception dashboard' });
  }
};

module.exports = {
  createDocketException,
  getDocketExceptions,
  updateDocketException,
  getExceptionDashboard,
};
