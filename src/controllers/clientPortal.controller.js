const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const DocketException = require('../models/DocketException.model');

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

// State mapping: Internal docket detailed states to client-safe statuses
const mapToClientSafeStatus = (caseItem) => {
  // If there are active exceptions, they override standard status mapping
  if (Array.isArray(caseItem.activeExceptions) && caseItem.activeExceptions.length > 0) {
    const hasPortalIssue = caseItem.activeExceptions.some((ex) => ex.exceptionType === 'portal_issue');
    if (hasPortalIssue) {
      return 'portal_issue';
    }
    const hasClientDelay = caseItem.activeExceptions.some((ex) =>
      [
        'query_raised',
        'DSC_authorisation_pending',
        'client_delay',
        'payment_pending',
        'data_mismatch',
      ].includes(ex.exceptionType)
    );
    if (hasClientDelay) {
      return 'requested_from_client';
    }
  }

  const status = String(caseItem.status || '').toUpperCase();
  const complianceState = String(caseItem.compliance_state || caseItem.complianceState || '');
  const pendingReason = String(caseItem.pendingReason || '');
  const approvalStatus = caseItem.approval_stage?.status || caseItem.approvalStage?.status;

  if (status === 'FILED') {
    return 'filed';
  }
  if (['RESOLVED', 'CLOSED'].includes(status)) {
    return 'closed';
  }
  if (
    complianceState === 'blocked' ||
    pendingReason === 'blocked' ||
    caseItem.blockerType ||
    status === 'QC_FAILED'
  ) {
    return 'portal_issue';
  }
  if (
    complianceState === 'awaiting_client' ||
    pendingReason === 'waiting_client' ||
    status === 'PENDING'
  ) {
    return 'requested_from_client';
  }
  if (
    ['QC_PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(status) ||
    approvalStatus === 'pending'
  ) {
    return 'awaiting_approval';
  }
  return 'under_preparation';
};

// Next action detection based on pended states and checklist requests
const getNextActionFromClient = (caseItem, clientSafeStatus) => {
  if (clientSafeStatus === 'requested_from_client') {
    if (Array.isArray(caseItem.checklist) && caseItem.checklist.length > 0) {
      const pendingItem = caseItem.checklist.find(
        (item) => !item.completed && item.status === 'requested'
      );
      if (pendingItem) {
        return `Please upload: ${pendingItem.title}`;
      }
    }
    return 'Please provide requested information or documents';
  }
  return 'None (Awaiting firm action)';
};

// Generate direct upload request links for document intakes
const getDocumentRequestLink = (caseItem, clientSafeStatus) => {
  const displayId = caseItem.caseId || caseItem.caseNumber;
  if (clientSafeStatus === 'requested_from_client') {
    return `/clients/upload/${displayId}`;
  }
  return null;
};

// Sanitize case record into a lightweight client-safe view (removes staff, budgets, and internal notes)
const transformToClientSafeView = (caseItem) => {
  const clientSafeStatus = mapToClientSafeStatus(caseItem);
  const nextAction = getNextActionFromClient(caseItem, clientSafeStatus);
  const documentRequestLink = getDocumentRequestLink(caseItem, clientSafeStatus);

  return {
    caseId: caseItem.caseId || caseItem.caseNumber,
    serviceName: caseItem.title,
    period: caseItem.obligation_period || caseItem.obligationPeriod || 'N/A',
    status: clientSafeStatus,
    nextAction,
    dueDate: caseItem.dueDate || caseItem.statutory_due_date || null,
    documentRequestLink,
  };
};

const getClientStatusView = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { page = 1, limit = 20, clientId, status } = req.query;

    const query = {
      firmId,
      status: { $nin: ['DRAFT', 'SUBMITTED', 'REJECTED'] }, // Hide early draft or rejected dockets from client portal
    };

    // 1. Resolve restricted client ObjectIds
    const restrictedIds = await getRestrictedClientIds(firmId, req.user?.restrictedClientIds);

    // 2. Resolve allowed client ObjectIds (for client users)
    if (req.user?.role === 'USER' && (req.user?.clientAccess?.length > 0 || req.user?.defaultClientId)) {
      const allowedIds = [];
      if (req.user.defaultClientId) {
        allowedIds.push(new mongoose.Types.ObjectId(req.user.defaultClientId));
      }
      if (Array.isArray(req.user.clientAccess)) {
        req.user.clientAccess.forEach((id) => allowedIds.push(new mongoose.Types.ObjectId(id)));
      }

      // Intersect allowed client IDs with restricted ones
      const filteredAllowed = allowedIds.filter(
        (id) => !restrictedIds.some((rid) => String(rid) === String(id))
      );
      query.clientId = { $in: filteredAllowed };
    } else if (restrictedIds.length > 0) {
      query.clientId = { $nin: restrictedIds };
    }

    // Specific Client filter (if requested in query)
    if (clientId) {
      if (restrictedIds.some((rid) => String(rid) === String(clientId))) {
        return res.status(403).json({ success: false, message: 'Access denied to this client' });
      }
      query.clientId = new mongoose.Types.ObjectId(clientId);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const cases = await Case.find(query)
      .select('caseId caseNumber title status compliance_state pendingReason blockerType dueDate statutory_due_date obligation_period obligationPeriod checklist')
      .sort({ dueDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Query active exceptions for all cases retrieved
    if (cases.length > 0) {
      const caseInternalIds = cases.map((c) => c._id);
      const activeExceptions = await DocketException.find({
        firmId,
        caseInternalId: { $in: caseInternalIds },
        status: { $in: ['open', 'monitoring'] },
      }).lean();

      cases.forEach((c) => {
        c.activeExceptions = activeExceptions.filter(
          (ex) => String(ex.caseInternalId) === String(c._id)
        );
      });
    }

    const mappedViews = cases.map(transformToClientSafeView);

    // Apply optional client-safe status filter post-mapping
    let finalData = mappedViews;
    if (status) {
      finalData = mappedViews.filter((item) => item.status === status);
    }

    const total = finalData.length;

    return res.json({
      success: true,
      data: finalData,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch client status view' });
  }
};

const getClientStatusViewByCaseId = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { caseId } = req.params;

    const caseItem = await Case.findOne({
      firmId,
      $or: [{ caseId }, { caseNumber: caseId }],
      status: { $nin: ['DRAFT', 'SUBMITTED', 'REJECTED'] },
    }).lean();

    if (!caseItem) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }

    // Enforce visibility bounds
    if (isClientRestricted(req.user, caseItem.clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Client is restricted',
        code: 'CLIENT_ACCESS_RESTRICTED',
      });
    }

    // If client user, verify they have permission to access the docket's client
    if (req.user?.role === 'USER' && (req.user?.clientAccess?.length > 0 || req.user?.defaultClientId)) {
      const allowedClientIds = [];
      if (req.user.defaultClientId) allowedClientIds.push(String(req.user.defaultClientId));
      if (Array.isArray(req.user.clientAccess)) {
        req.user.clientAccess.forEach((id) => allowedClientIds.push(String(id)));
      }

      // Fetch client ObjectId corresponding to docket clientId display ID
      const client = await Client.findOne({ clientId: caseItem.clientId, firmId }).lean();
      if (!client || !allowedClientIds.includes(String(client._id))) {
        return res.status(403).json({ success: false, message: 'Access denied to this docket' });
      }
    }

    // Query active exceptions for this specific case
    const activeExceptions = await DocketException.find({
      firmId,
      caseInternalId: caseItem._id,
      status: { $in: ['open', 'monitoring'] },
    }).lean();
    caseItem.activeExceptions = activeExceptions;

    const safeView = transformToClientSafeView(caseItem);

    return res.json({
      success: true,
      data: safeView,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch docket client status' });
  }
};

module.exports = {
  getClientStatusView,
  getClientStatusViewByCaseId,
};
