const mongoose = require('mongoose');
const EmailCapture = require('../models/EmailCapture.model');
const log = require('../utils/log');
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

const createEmailCapture = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;

    const {
      sender,
      recipients,
      subject,
      receivedAt,
      bodyExcerpt,
      attachments,
      linkedClientId,
      linkedCaseInternalId,
      classification,
      followUpDueDate,
      ownerXID,
    } = req.body;

    // Enforce client restrictions at capture time
    if (linkedClientId) {
      const client = await Client.findOne({ _id: linkedClientId, firmId }).lean();
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }
      if (isClientRestricted(req.user, client.clientId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to link to this client',
          code: 'CLIENT_ACCESS_RESTRICTED',
        });
      }
    }

    let resolvedCaseId = null;
    if (linkedCaseInternalId) {
      const targetCase = await Case.findOne({ caseInternalId: linkedCaseInternalId, firmId }).lean();
      if (!targetCase) {
        return res.status(404).json({ success: false, message: 'Case not found' });
      }
      if (isClientRestricted(req.user, targetCase.clientId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to link to this case client',
          code: 'CLIENT_ACCESS_RESTRICTED',
        });
      }
      resolvedCaseId = targetCase.caseId || targetCase.caseNumber;
    }

    const capture = new EmailCapture({
      firmId,
      tenantId: String(firmId),
      sender,
      recipients,
      subject,
      receivedAt: receivedAt ? new Date(receivedAt) : undefined,
      bodyExcerpt,
      attachments,
      linkedClientId: linkedClientId || null,
      linkedCaseInternalId: linkedCaseInternalId || null,
      linkedCaseId: resolvedCaseId,
      classification: classification || 'actionable',
      followUpDueDate: followUpDueDate ? new Date(followUpDueDate) : null,
      ownerXID: ownerXID || null,
      createdByXID: userXID,
    });

    await capture.save();

    return res.status(201).json({
      success: true,
      message: 'Email content captured successfully',
      data: capture,
    });
  } catch (error) {
    log.error('Failed to capture email content:', error);
    return res.status(500).json({ success: false, message: 'Failed to capture email content' });
  }
};

const getEmailCaptures = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { page = 1, limit = 20, classification, ownerXID, ageing } = req.query;

    const query = { firmId };

    // Strict client access boundary: exclude restricted client email content
    const restrictedIds = await getRestrictedClientIds(firmId, req.user?.restrictedClientIds);
    if (restrictedIds.length > 0) {
      query.linkedClientId = { $nin: restrictedIds };
    }

    if (classification) {
      query.classification = classification;
    }

    if (ownerXID) {
      query.ownerXID = ownerXID.toUpperCase();
    }

    let sort = { receivedAt: -1, createdAt: -1 };

    // Ageing dashboard filters
    if (ageing === 'true') {
      const now = new Date();
      query.$or = [
        { followUpDueDate: { $lt: now } },
        { classification: { $in: ['actionable', 'awaiting_reply'] } },
      ];
      sort = { followUpDueDate: 1, receivedAt: 1 };
    }

    const skip = (Number(page) - 1) * Number(limit);
    // 💡 What: Replaced sequential execution of countDocuments and find with concurrent execution using Promise.all().
    // 🎯 Why: This halves the database latency for pagination operations by running independent queries simultaneously.
    const [total, captures] = await Promise.all([
      EmailCapture.countDocuments(query),
      EmailCapture.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean()
    ]);

    return res.json({
      success: true,
      data: captures,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    log.error('Failed to fetch email captures:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch email captures' });
  }
};

const getEmailCaptureById = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { id } = req.params;

    const capture = await EmailCapture.findOne({ _id: id, firmId }).lean();
    if (!capture) {
      return res.status(404).json({ success: false, message: 'Email capture not found' });
    }

    // Expose only if client is not restricted
    if (capture.linkedClientId) {
      const client = await Client.findOne({ _id: capture.linkedClientId, firmId }).lean();
      if (client && isClientRestricted(req.user, client.clientId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to view this client email content',
          code: 'CLIENT_ACCESS_RESTRICTED',
        });
      }
    }

    return res.json({ success: true, data: capture });
  } catch (error) {
    log.error('Failed to fetch email capture:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch email capture' });
  }
};

const updateEmailCapture = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { id } = req.params;
    const { classification, followUpDueDate, ownerXID, linkedClientId, linkedCaseInternalId } = req.body;

    const capture = await EmailCapture.findOne({ _id: id, firmId });
    if (!capture) {
      return res.status(404).json({ success: false, message: 'Email capture not found' });
    }

    // Verify existing linkage restrictions
    if (capture.linkedClientId) {
      const client = await Client.findOne({ _id: capture.linkedClientId, firmId }).lean();
      if (client && isClientRestricted(req.user, client.clientId)) {
        return res.status(403).json({ success: false, message: 'Access denied to current client' });
      }
    }

    // Verify new client restrictions
    if (linkedClientId) {
      const client = await Client.findOne({ _id: linkedClientId, firmId }).lean();
      if (!client) {
        return res.status(404).json({ success: false, message: 'New linked client not found' });
      }
      if (isClientRestricted(req.user, client.clientId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: New client is restricted',
          code: 'CLIENT_ACCESS_RESTRICTED',
        });
      }
      capture.linkedClientId = linkedClientId;
    } else if (linkedClientId === null) {
      capture.linkedClientId = null;
    }

    // Verify new case restrictions
    if (linkedCaseInternalId) {
      const targetCase = await Case.findOne({ caseInternalId: linkedCaseInternalId, firmId }).lean();
      if (!targetCase) {
        return res.status(404).json({ success: false, message: 'New linked case not found' });
      }
      if (isClientRestricted(req.user, targetCase.clientId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Case client is restricted',
          code: 'CLIENT_ACCESS_RESTRICTED',
        });
      }
      capture.linkedCaseInternalId = linkedCaseInternalId;
      capture.linkedCaseId = targetCase.caseId || targetCase.caseNumber;
    } else if (linkedCaseInternalId === null) {
      capture.linkedCaseInternalId = null;
      capture.linkedCaseId = null;
    }

    if (classification) capture.classification = classification;
    if (followUpDueDate !== undefined) capture.followUpDueDate = followUpDueDate ? new Date(followUpDueDate) : null;
    if (ownerXID !== undefined) capture.ownerXID = ownerXID ? ownerXID.toUpperCase() : null;

    await capture.save();

    return res.json({ success: true, message: 'Email capture updated successfully', data: capture });
  } catch (error) {
    log.error('Failed to update email capture:', error);
    return res.status(500).json({ success: false, message: 'Failed to update email capture' });
  }
};

const linkToDocket = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { id } = req.params;
    const { caseInternalId } = req.body;

    const capture = await EmailCapture.findOne({ _id: id, firmId });
    if (!capture) {
      return res.status(404).json({ success: false, message: 'Email capture not found' });
    }

    const targetCase = await Case.findOne({ caseInternalId, firmId });
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Target docket not found' });
    }

    // Enforce client level access control
    if (isClientRestricted(req.user, targetCase.clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Case client is restricted',
        code: 'CLIENT_ACCESS_RESTRICTED',
      });
    }

    // Update capture
    capture.linkedCaseInternalId = targetCase.caseInternalId;
    capture.linkedCaseId = targetCase.caseId || targetCase.caseNumber;

    // Resolve client if target case has clientId
    if (targetCase.clientId) {
      const client = await Client.findOne({ clientId: targetCase.clientId, firmId }).lean();
      if (client) {
        capture.linkedClientId = client._id;
      }
    }

    await capture.save();

    // 1. Post a new Comment to the docket
    await Comment.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      text: `Linked manually captured email: "${capture.subject}" from ${capture.sender.email}`,
      createdBy: req.user.email,
      createdByXID: req.user.xID,
      createdByName: req.user.name,
    });

    // 2. Append a CaseHistory audit record
    await CaseHistory.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      actionType: 'EmailLinked',
      description: `Manually linked captured email: "${capture.subject}" (Sender: ${capture.sender.email})`,
      performedBy: req.user.email,
      performedByXID: req.user.xID,
      actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      actionLabel: 'Email Manually Linked',
      timestamp: new Date(),
    });

    return res.json({
      success: true,
      message: 'Email capture successfully linked to docket, comment and audit logs posted',
      data: capture,
    });
  } catch (error) {
    log.error('Failed to link email capture to docket:', error);
    return res.status(500).json({ success: false, message: 'Failed to link email capture to docket' });
  }
};

const createDocketFromEmail = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { id } = req.params;
    const { title, categoryId, subcategoryId, priority } = req.body;

    const capture = await EmailCapture.findOne({ _id: id, firmId });
    if (!capture) {
      return res.status(404).json({ success: false, message: 'Email capture not found' });
    }

    if (!capture.linkedClientId) {
      return res.status(400).json({ success: false, message: 'Email capture must be linked to a client before creating a docket' });
    }

    const client = await Client.findOne({ _id: capture.linkedClientId, firmId });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Linked client not found' });
    }

    if (isClientRestricted(req.user, client.clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Client is restricted',
        code: 'CLIENT_ACCESS_RESTRICTED',
      });
    }

    // Spawn a brand new Case document
    const newCase = new Case({
      firmId: String(firmId),
      title: title || capture.subject,
      description: capture.bodyExcerpt || 'Created from manual email capture.',
      clientId: client.clientId,
      categoryId: new mongoose.Types.ObjectId(categoryId),
      subcategoryId,
      priority: priority || 'medium',
      createdByXID: req.user.xID,
      slaDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Standard SLA due in 7 days
    });

    await newCase.save();

    // Link the capture to our newly generated Case
    capture.linkedCaseInternalId = newCase.caseInternalId;
    capture.linkedCaseId = newCase.caseId || newCase.caseNumber;
    await capture.save();

    // 1. Post initial linking comment
    await Comment.create({
      caseId: newCase.caseId || newCase.caseNumber,
      firmId: String(firmId),
      text: `Docket spawned from manually captured email: "${capture.subject}" from ${capture.sender.email}`,
      createdBy: req.user.email,
      createdByXID: req.user.xID,
      createdByName: req.user.name,
    });

    // 2. Write initial audit log in CaseHistory
    await CaseHistory.create({
      caseId: newCase.caseId || newCase.caseNumber,
      firmId: String(firmId),
      actionType: 'Created',
      description: `Docket created from manually captured email "${capture.subject}"`,
      performedBy: req.user.email,
      performedByXID: req.user.xID,
      actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      actionLabel: 'Docket Created From Capture',
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'New docket successfully spawned and linked to email capture',
      data: {
        case: newCase,
        capture,
      },
    });
  } catch (error) {
    log.error('Failed to spawn docket from email capture:', error);
    return res.status(500).json({ success: false, message: 'Failed to spawn docket from email capture' });
  }
};

module.exports = {
  createEmailCapture,
  getEmailCaptures,
  getEmailCaptureById,
  updateEmailCapture,
  linkToDocket,
  createDocketFromEmail,
};
