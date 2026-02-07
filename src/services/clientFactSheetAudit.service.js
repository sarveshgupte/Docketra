const ClientAudit = require('../models/ClientAudit.model');
const { CLIENT_FACT_SHEET_ACTION_TYPES } = require('../config/constants');

/**
 * Client Fact Sheet Audit Service
 * 
 * PR: Client Fact Sheet Foundation
 * Provides audit logging for client fact sheet operations
 */

/**
 * Log a client fact sheet action to ClientAudit
 * 
 * @param {Object} options
 * @param {string} options.clientId - Client identifier
 * @param {string} options.firmId - Firm identifier
 * @param {string} options.actionType - Type of action (from CLIENT_FACT_SHEET_ACTION_TYPES)
 * @param {string} options.description - Human-readable description
 * @param {string} options.performedByXID - xID of user performing action
 * @param {Object} options.metadata - Additional context (optional)
 * @param {Object} options.req - Express request object (optional, for impersonation context)
 * @returns {Promise<Object>} Created audit entry
 */
const logClientFactSheetAction = async ({ 
  clientId, 
  firmId,
  actionType, 
  description, 
  performedByXID, 
  metadata = {},
  req
}) => {
  try {
    // Validate required fields
    if (!clientId || !firmId || !actionType || !description || !performedByXID) {
      console.error('[CLIENT_AUDIT] Missing required fields for audit log:', { 
        clientId, 
        firmId, 
        actionType, 
        performedByXID 
      });
      throw new Error('Missing required fields for client audit log');
    }

    // Extract impersonation context if available
    const impersonationActive = req?.context?.isSuperAdmin && req?.context?.impersonationSessionId ? true : false;
    const impersonationSessionId = req?.context?.impersonationSessionId || null;

    // Create audit entry
    const auditEntry = await ClientAudit.create({
      clientId,
      firmId,
      actionType,
      description,
      performedByXID: performedByXID.toUpperCase(),
      metadata,
      impersonationActive,
      impersonationSessionId,
    });

    return auditEntry;
  } catch (error) {
    console.error('[CLIENT_AUDIT] Failed to create audit log:', error.message);
    throw error;
  }
};

/**
 * Log fact sheet creation
 */
const logFactSheetCreated = async ({ clientId, firmId, performedByXID, metadata = {}, req }) => {
  return logClientFactSheetAction({
    clientId,
    firmId,
    actionType: CLIENT_FACT_SHEET_ACTION_TYPES.CLIENT_FACT_SHEET_CREATED,
    description: `Client Fact Sheet created for client ${clientId}`,
    performedByXID,
    metadata,
    req,
  });
};

/**
 * Log fact sheet update
 */
const logFactSheetUpdated = async ({ clientId, firmId, performedByXID, metadata = {}, req }) => {
  return logClientFactSheetAction({
    clientId,
    firmId,
    actionType: CLIENT_FACT_SHEET_ACTION_TYPES.CLIENT_FACT_SHEET_UPDATED,
    description: `Client Fact Sheet updated for client ${clientId}`,
    performedByXID,
    metadata,
    req,
  });
};

/**
 * Log file added to fact sheet
 */
const logFactSheetFileAdded = async ({ clientId, firmId, performedByXID, fileName, metadata = {}, req }) => {
  return logClientFactSheetAction({
    clientId,
    firmId,
    actionType: CLIENT_FACT_SHEET_ACTION_TYPES.CLIENT_FACT_SHEET_FILE_ADDED,
    description: `File "${fileName}" added to Client Fact Sheet for client ${clientId}`,
    performedByXID,
    metadata: { ...metadata, fileName },
    req,
  });
};

/**
 * Log file removed from fact sheet
 */
const logFactSheetFileRemoved = async ({ clientId, firmId, performedByXID, fileName, metadata = {}, req }) => {
  return logClientFactSheetAction({
    clientId,
    firmId,
    actionType: CLIENT_FACT_SHEET_ACTION_TYPES.CLIENT_FACT_SHEET_FILE_REMOVED,
    description: `File "${fileName}" removed from Client Fact Sheet for client ${clientId}`,
    performedByXID,
    metadata: { ...metadata, fileName },
    req,
  });
};

/**
 * Log fact sheet viewed
 */
const logFactSheetViewed = async ({ clientId, firmId, performedByXID, caseId, metadata = {}, req }) => {
  return logClientFactSheetAction({
    clientId,
    firmId,
    actionType: CLIENT_FACT_SHEET_ACTION_TYPES.CLIENT_FACT_SHEET_VIEWED,
    description: `Client Fact Sheet viewed for client ${clientId} from case ${caseId}`,
    performedByXID,
    metadata: { ...metadata, caseId },
    req,
  });
};

module.exports = {
  logClientFactSheetAction,
  logFactSheetCreated,
  logFactSheetUpdated,
  logFactSheetFileAdded,
  logFactSheetFileRemoved,
  logFactSheetViewed,
};
