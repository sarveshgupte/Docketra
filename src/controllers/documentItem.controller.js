const { escapeRegExp } = require('../utils/regexp.utils');
const mongoose = require('mongoose');
const DocumentItem = require('../models/DocumentItem.model');
const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const Attachment = require('../models/Attachment.model');
const Comment = require('../models/Comment.model');
const CaseHistory = require('../models/CaseHistory.model');
const { escapeRegExp } = require('../utils/regexp.utils');

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

const createDocumentItem = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const { caseInternalId, name, category, fileReference, notes, changeNote } = req.body;

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

    // Validate the underlying Attachment reference exists
    const attachment = await Attachment.findOne({ _id: fileReference, firmId });
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment file reference not found' });
    }

    // Prevent duplicate name confusion in the same docket
    const duplicate = await DocumentItem.findOne({ caseInternalId, name: { $regex: new RegExp(`^${escapeRegExp(name)}$`, 'i') } });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `A document with the name "${name}" already exists in this docket. Upload a new version instead.`,
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

    const documentItem = new DocumentItem({
      firmId,
      tenantId: String(firmId),
      caseInternalId,
      caseId: targetCase.caseId || targetCase.caseNumber,
      clientId: resolvedClientId,
      name,
      category,
      currentVersionNumber: 1,
      status: 'draft',
      uploadedByXID: userXID,
      notes: notes || '',
      versions: [
        {
          versionNumber: 1,
          fileReference,
          uploadedByXID: userXID,
          uploadedAt: new Date(),
          changeNote: changeNote || 'Initial upload',
          docketStageAtUpload: targetCase.status || targetCase.state || 'OPEN',
        },
      ],
    });

    await documentItem.save();

    // 1. Post linked comment to the case
    await Comment.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      text: `Added new version controlled document: "${name}" (Version 1, Category: ${category})`,
      createdBy: req.user.email,
      createdByXID: userXID,
      createdByName: req.user.name,
    });

    // 2. Add append-only CaseHistory audit log
    await CaseHistory.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      actionType: 'DocumentAttached',
      description: `Ingested document: "${name}" (Version 1, Category: ${category})`,
      performedBy: req.user.email,
      performedByXID: userXID,
      actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      actionLabel: 'Document Pack Ingestion',
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Document item created successfully',
      data: documentItem,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to create document item' });
  }
};

const addDocumentVersion = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const { id } = req.params;
    const { fileReference, changeNote } = req.body;

    const documentItem = await DocumentItem.findOne({ _id: id, firmId });
    if (!documentItem) {
      return res.status(404).json({ success: false, message: 'Document item not found' });
    }

    // Verify Case / Client restrictions
    const targetCase = await Case.findOne({ caseInternalId: documentItem.caseInternalId, firmId });
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Associated docket not found' });
    }
    if (isClientRestricted(req.user, targetCase.clientId)) {
      return res.status(403).json({ success: false, message: 'Access denied: client is restricted' });
    }

    // Validate the new Attachment reference
    const attachment = await Attachment.findOne({ _id: fileReference, firmId });
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment file reference not found' });
    }

    const nextVersionNumber = documentItem.versions.length + 1;

    // Push the new version and update the pointer
    documentItem.versions.push({
      versionNumber: nextVersionNumber,
      fileReference,
      uploadedByXID: userXID,
      uploadedAt: new Date(),
      changeNote,
      docketStageAtUpload: targetCase.status || targetCase.state || 'OPEN',
    });

    documentItem.currentVersionNumber = nextVersionNumber;
    await documentItem.save();

    // 1. Post Comment
    await Comment.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      text: `Uploaded new version for document "${documentItem.name}": Version ${nextVersionNumber} - "${changeNote}"`,
      createdBy: req.user.email,
      createdByXID: userXID,
      createdByName: req.user.name,
    });

    // 2. Add CaseHistory log
    await CaseHistory.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      actionType: 'DocumentAttached',
      description: `Uploaded document version: "${documentItem.name}" (Version ${nextVersionNumber}, Note: "${changeNote}")`,
      performedBy: req.user.email,
      performedByXID: userXID,
      actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      actionLabel: 'Document Version Uploaded',
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'New document version uploaded successfully',
      data: documentItem,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to upload document version' });
  }
};

const getDocumentItems = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { page = 1, limit = 20, caseInternalId, status, category } = req.query;

    const query = { firmId };

    // Apply Client Restrictions Filter
    const restrictedIds = await getRestrictedClientIds(firmId, req.user?.restrictedClientIds);
    if (restrictedIds.length > 0) {
      query.clientId = { $nin: restrictedIds };
    }

    if (caseInternalId) {
      query.caseInternalId = new mongoose.Types.ObjectId(caseInternalId);
    }

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    // 💡 What: Replaced sequential execution of countDocuments and find with concurrent execution using Promise.all().
    // 🎯 Why: This halves the database latency for pagination operations by running independent queries simultaneously.
    const [total, items] = await Promise.all([
      DocumentItem.countDocuments(query),
      DocumentItem.find(query)
        .populate('versions.fileReference', 'fileName size fileUrl uploadedBy createdAt')
        .sort({ updatedAt: -1 })
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
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch document items' });
  }
};

const getDocumentItemById = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { id } = req.params;

    const documentItem = await DocumentItem.findOne({ _id: id, firmId })
      .populate('versions.fileReference')
      .lean();

    if (!documentItem) {
      return res.status(404).json({ success: false, message: 'Document item not found' });
    }

    // Client access boundary
    const targetCase = await Case.findOne({ caseInternalId: documentItem.caseInternalId, firmId }).lean();
    if (targetCase && isClientRestricted(req.user, targetCase.clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view documents for this client',
        code: 'CLIENT_ACCESS_RESTRICTED',
      });
    }

    return res.json({ success: true, data: documentItem });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch document item' });
  }
};

const updateDocumentStatus = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const { id } = req.params;
    const { status } = req.body;

    const documentItem = await DocumentItem.findOne({ _id: id, firmId });
    if (!documentItem) {
      return res.status(404).json({ success: false, message: 'Document item not found' });
    }

    // Client visibility verification
    const targetCase = await Case.findOne({ caseInternalId: documentItem.caseInternalId, firmId });
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Associated docket not found' });
    }
    if (isClientRestricted(req.user, targetCase.clientId)) {
      return res.status(403).json({ success: false, message: 'Access denied: client is restricted' });
    }

    const previousStatus = documentItem.status;
    documentItem.status = status;
    await documentItem.save();

    // 1. Post Comment
    await Comment.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      text: `Document "${documentItem.name}" status changed from "${previousStatus}" to "${status}" (Current Version: ${documentItem.currentVersionNumber})`,
      createdBy: req.user.email,
      createdByXID: userXID,
      createdByName: req.user.name,
    });

    // 2. Add CaseHistory Audit Log (Preserving audit history on approval/filed states)
    await CaseHistory.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      actionType: status === 'approved' ? 'Approved' : 'StatusChanged',
      description: `Document status transitioned: "${documentItem.name}" transitioned from "${previousStatus}" to "${status}" (Version: ${documentItem.currentVersionNumber})`,
      performedBy: req.user.email,
      performedByXID: userXID,
      actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      actionLabel: `Document ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      timestamp: new Date(),
    });

    return res.json({
      success: true,
      message: `Document status successfully transitioned to ${status}`,
      data: documentItem,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to update document status' });
  }
};

const selectCurrentVersion = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const { id } = req.params;
    const { versionNumber } = req.body;

    const documentItem = await DocumentItem.findOne({ _id: id, firmId });
    if (!documentItem) {
      return res.status(404).json({ success: false, message: 'Document item not found' });
    }

    // Access control
    const targetCase = await Case.findOne({ caseInternalId: documentItem.caseInternalId, firmId });
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Associated docket not found' });
    }
    if (isClientRestricted(req.user, targetCase.clientId)) {
      return res.status(403).json({ success: false, message: 'Access denied: client is restricted' });
    }

    // Verify requested version number exists
    const versionExists = documentItem.versions.some((v) => v.versionNumber === versionNumber);
    if (!versionExists) {
      return res.status(400).json({
        success: false,
        message: `Version ${versionNumber} does not exist in the version history for this document.`,
      });
    }

    const previousVersion = documentItem.currentVersionNumber;
    documentItem.currentVersionNumber = versionNumber;
    await documentItem.save();

    // 1. Post Comment
    await Comment.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      text: `Document "${documentItem.name}" active version changed from Version ${previousVersion} to Version ${versionNumber}`,
      createdBy: req.user.email,
      createdByXID: userXID,
      createdByName: req.user.name,
    });

    // 2. Add CaseHistory log
    await CaseHistory.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(firmId),
      actionType: 'StatusChanged',
      description: `Switched active version for "${documentItem.name}": Active version is now Version ${versionNumber} (was Version ${previousVersion})`,
      performedBy: req.user.email,
      performedByXID: userXID,
      actorRole: req.user.role === 'PRIMARY_ADMIN' || req.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      actionLabel: 'Document Active Version Changed',
      timestamp: new Date(),
    });

    return res.json({
      success: true,
      message: `Active version successfully switched to Version ${versionNumber}`,
      data: documentItem,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to select current version' });
  }
};

module.exports = {
  createDocumentItem,
  addDocumentVersion,
  getDocumentItems,
  getDocumentItemById,
  updateDocumentStatus,
  selectCurrentVersion,
};
