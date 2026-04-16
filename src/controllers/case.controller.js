const mongoose = require('mongoose');
const { randomUUID, createHash } = require('crypto');
const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const Attachment = require('../models/Attachment.model');
const CaseHistory = require('../models/CaseHistory.model');
const CaseAudit = require('../models/CaseAudit.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const Team = require('../models/Team.model');
const WorkType = require('../models/WorkType.model');
const SubWorkType = require('../models/SubWorkType.model');
const CrmClient = require('../models/CrmClient.model');
const Deal = require('../models/Deal.model');
const Invoice = require('../models/Invoice.model');
const { CaseRepository, ClientRepository, AttachmentRepository } = require('../repositories');
const categoryRepository = require('../repositories/category.repository');
const { detectDuplicates, generateDuplicateOverrideComment } = require('../services/clientDuplicateDetector');
const { CASE_CATEGORIES, CASE_LOCK_CONFIG, COMMENT_PREVIEW_LENGTH, CLIENT_STATUS } = require('../config/constants');
const CaseStatus = require('../domain/case/caseStatus');
const { DocketLifecycle, toLifecycleFromStatus, normalizeLifecycle, isValidState } = require('../domain/docketLifecycle');
const { isValidTransition } = require('./docketWorkflow.controller');
const { isProduction } = require('../config/config');
const { logCaseListViewed, logAdminAction } = require('../services/auditLog.service');
const caseActionService = require('../services/caseAction.service');
const CaseService = require('../services/case.service');
const caseSlaService = require('../services/caseSla.service');
const slaService = require('../services/sla.service');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { getMimeType, sanitizeFilename } = require('../utils/fileUtils');
const { cleanupTempFile } = require('../utils/tempFile');
const { resolveCaseIdentifier } = require('../utils/caseIdentifier');
const { buildErrorResult, mapErrorToResult } = require('../utils/error.util');
const { getValidationDetails } = require('../utils/validation.util');
const { StorageProviderFactory } = require('../services/storage/StorageProviderFactory');
const { areFileUploadsDisabled } = require('../services/featureFlags.service');
const { enqueueStorageJob, JOB_TYPES } = require('../queues/storage.queue');
const { assertFirmContext } = require('../utils/tenantGuard');
const { enforceTenantScope } = require('../utils/tenantScope');
const CaseFile = require('../models/CaseFile.model');
const { incrementTenantMetric } = require('../services/tenantMetrics.service');
const { getSession } = require('../utils/getSession');
const { getOrCreateDefaultClient } = require('../services/defaultClient.guard');
const { normalizeCreateInput, validateStructuredInput, resolveAssigneeFromWorkbasketRules } = require('../services/docket.service');
const { createNotification, NotificationTypes } = require('../domain/notifications');
const fs = require('fs').promises;
const fsSync = require('fs');
const { logActivitySafe } = require('../services/docketActivity.service');
const buildCaseCreateService = require('../services/caseCreate.service');
const buildCaseUpdateService = require('../services/caseUpdate.service');
const buildCaseQueryService = require('../services/caseQuery.service');
const buildCaseActivityService = require('../services/caseActivity.service');
const buildCaseBulkService = require('../services/caseBulk.service');

const inFlightCaseRecordLoads = new Map();

const loadCaseRecordCoalesced = async ({ firmId, caseId, role }) => {
  const key = `${firmId}:${String(caseId || '').trim()}`;
  if (inFlightCaseRecordLoads.has(key)) {
    return inFlightCaseRecordLoads.get(key);
  }

  const promise = (async () => {
    let caseData = await CaseRepository.findByCaseId(firmId, caseId, role, { includeClient: true });
    if (!caseData) {
      caseData = await CaseRepository.findByCaseId(firmId, caseId, role);
    }

    if (caseData) return caseData;

    const internalId = await resolveCaseIdentifier(firmId, caseId, role);
    let resolvedCaseData = await CaseRepository.findByInternalId(firmId, internalId, role, { includeClient: true });
    if (!resolvedCaseData) {
      resolvedCaseData = await CaseRepository.findByInternalId(firmId, internalId, role);
    }
    return resolvedCaseData;
  })().finally(() => {
    inFlightCaseRecordLoads.delete(key);
  });

  inFlightCaseRecordLoads.set(key, promise);
  return promise;
};
const path = require('path');
const PDFDocument = require('pdfkit');

/**
 * Case Controller for Core Case APIs
 * Handles case creation, comments, attachments, cloning, unpending, and status updates
 * PART F - Duplicate client detection for "Client – New" cases
 * PR #44 - xID ownership guardrails
 * PR #45 - View-only mode with audit logging
 */

/**
 * Build case query with firmId scoping
 * 
 * Ensures all case queries are scoped to the user's firm for multi-tenancy.
 * SUPER_ADMIN (no firmId) can see all cases across all firms.
 * 
 * @param {Object} req - Express request object with authenticated user
 * @param {string} caseId - Optional caseId to include in query
 * @returns {Object} Query object with firmId scoping
 */
const buildCaseQuery = (req, caseId = null) => {
  const userFirmId = req.user?.firmId;
  const query = {};
  
  // Add firmId scoping if user has a firmId (not SUPER_ADMIN)
  if (userFirmId) {
    query.firmId = userFirmId;
  }
  
  // Add caseId if provided
  if (caseId) {
    query.caseId = caseId;
  }
  
  return query;
};

/**
 * Sanitize text for logging
 * Removes control characters, newlines, and limits length
 * PR #45: Security - prevent log injection
 */
const sanitizeForLog = (text, maxLength = 100) => {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]/g, ' ')  // Replace newlines and tabs with spaces
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
    .substring(0, maxLength)
    .trim();
};

const sanitizeOutput = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const enforceDocketLifecycleDefault = (docket) => {
  if (!docket || typeof docket !== 'object') return docket;
  docket.lifecycle = normalizeLifecycle(docket.lifecycle);
  if (!isValidState(docket.lifecycle)) {
    docket.lifecycle = DocketLifecycle.WL;
  }
  return docket;
};

const buildAddCommentErrorResponse = (error, context = {}) => {
  console.error('[ADD_COMMENT_ERROR]', {
    error,
    message: error?.message,
    name: error?.name,
    stack: error?.stack,
    caseId: context.caseId,
    resolvedCaseId: context.resolvedCaseId,
    userId: context.userId,
    firmId: context.firmId,
    lockStatus: context.lockStatus,
    requestBody: context.requestBody,
    validationDetails: getValidationDetails(error),
  });

  return mapErrorToResult(error, {
    mappings: [
      {
        matches: (err) => err?.message?.includes('Case is locked'),
        result: (err) => buildErrorResult({
          status: 423,
          message: 'Case is locked',
          details: err.message,
          code: 'CASE_LOCKED',
        }),
      },
      {
        matches: (err) => err?.message?.includes('Case not found'),
        result: (err) => buildErrorResult({
          status: 404,
          message: 'Case not found',
          details: err.message,
          code: 'CASE_NOT_FOUND',
        }),
      },
      {
        matches: (err) => err?.name === 'ValidationError',
        result: (err) => {
          const validationDetails = getValidationDetails(err);
          return buildErrorResult({
            status: 400,
            message: 'Comment validation failed',
            details: validationDetails || err.message,
            code: 'COMMENT_VALIDATION_ERROR',
          });
        },
      },
    ],
    fallback: (err) => buildErrorResult({
      status: 500,
      message: 'Unexpected error while adding comment',
      details: err?.message || 'Unknown server error',
      code: 'ADD_COMMENT_ERROR',
    }),
  });
};

const computeDeadlineFromTatDays = (tatDays) => {
  const days = Number(tatDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);
  return deadline;
};

const findScopedCaseAttachment = ({ attachmentId, caseData, req }) => {
  const displayCaseId = caseData?.caseId || caseData?.caseNumber;
  if (!displayCaseId || !attachmentId) {
    return null;
  }
  return Attachment.findOne(enforceTenantScope({
    _id: attachmentId,
    caseId: displayCaseId,
  }, req, { source: 'case.findScopedCaseAttachment' }));
};

/**
 * Check if user has access to a case
 * PR: Fix Case Visibility - Unified access control logic
 * 
 * Returns true if user can access the case:
 * - Admin or SuperAdmin: Can access any case in their firm
 * - Creator: Can access cases they created
 * - Assignee: Can access cases assigned to them
 * 
 * @param {Object} caseData - Case document from database
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if user has access, false otherwise
 */
const checkCaseAccess = (caseData, user) => {
  if (!caseData || !user) {
    return false;
  }
  
  const isAdmin = user.role === 'Admin';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isCreator = caseData.createdByXID === user.xID;
  const isAssignee = caseData.assignedToXID === user.xID;
  
  return isAdmin || isSuperAdmin || isCreator || isAssignee;
};

/**
 * Create a new case
 * POST /api/cases
 * PART F - Duplicate detection for "Client – New" category
 * 
 * Requirements:
 * - title is now OPTIONAL
 * - caseCategory is MANDATORY
 * - caseSubCategory is optional
 * - clientId defaults to C000001 if not provided
 * - Case ID auto-generated as CASE-YYYYMMDD-XXXXX
 * - Client case data stored in payload field
 */
const caseServiceDependencies = {
  mongoose,
  randomUUID,
  createHash,
  Case,
  Comment,
  Attachment,
  CaseHistory,
  CaseAudit,
  Client,
  User,
  Team,
  WorkType,
  SubWorkType,
  CrmClient,
  Deal,
  Invoice,
  CaseRepository,
  ClientRepository,
  AttachmentRepository,
  categoryRepository,
  detectDuplicates,
  generateDuplicateOverrideComment,
  CASE_CATEGORIES,
  CASE_LOCK_CONFIG,
  COMMENT_PREVIEW_LENGTH,
  CLIENT_STATUS,
  CaseStatus,
  DocketLifecycle,
  toLifecycleFromStatus,
  normalizeLifecycle,
  isValidState,
  isValidTransition,
  isProduction,
  logCaseListViewed,
  logAdminAction,
  caseActionService,
  CaseService,
  caseSlaService,
  slaService,
  getMimeType,
  sanitizeFilename,
  cleanupTempFile,
  resolveCaseIdentifier,
  StorageProviderFactory,
  areFileUploadsDisabled,
  enqueueStorageJob,
  JOB_TYPES,
  assertFirmContext,
  enforceTenantScope,
  CaseFile,
  incrementTenantMetric,
  getSession,
  getOrCreateDefaultClient,
  normalizeCreateInput,
  validateStructuredInput,
  resolveAssigneeFromWorkbasketRules,
  createNotification,
  NotificationTypes,
  fs,
  fsSync,
  logActivitySafe,
  path,
  PDFDocument,
  loadCaseRecordCoalesced,
  buildCaseQuery,
  sanitizeForLog,
  sanitizeOutput,
  enforceDocketLifecycleDefault,
  buildAddCommentErrorResponse,
  computeDeadlineFromTatDays,
  findScopedCaseAttachment,
  checkCaseAccess,
};

const caseCreateService = buildCaseCreateService(caseServiceDependencies);
const caseUpdateService = buildCaseUpdateService(caseServiceDependencies);
const caseQueryService = buildCaseQueryService(caseServiceDependencies);
const caseActivityService = buildCaseActivityService(caseServiceDependencies);
const caseBulkService = buildCaseBulkService(caseServiceDependencies);

const createCase = async (req, res) => caseCreateService.createCase(req, res);

/**
 * Add a comment to a case
 * POST /api/cases/:caseId/comments
 * PR #41: Allow comments in view mode (no assignment check)
 * PR #45: Add CaseAudit logging with xID attribution
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const addComment = async (req, res) => caseActivityService.addComment(req, res);

const getCaseComments = async (req, res) => caseActivityService.getCaseComments(req, res);

/**
 * Upload an attachment to a case
 * POST /api/cases/:caseId/attachments
 * Uses multer middleware for file upload
 * PR #41: Allow attachments in view mode (no assignment check)
 * PR #45: Add CaseAudit logging with xID attribution
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const addAttachment = async (req, res) => {
  try {
    if (!req.storageContext?.rootFolderId) {
      console.warn('[STORAGE] blocked_operation: upload_attempt_without_storage');
      return res.status(400).json({ code: 'STORAGE_NOT_CONNECTED', message: 'Cloud storage must be connected' });
    }
    if (areFileUploadsDisabled()) {
      return res.status(503).json({
        success: false,
        message: 'File uploads are temporarily disabled',
      });
    }
    const { caseId } = req.params;
    const { description, note } = req.body;
    
    // PR #45: Require authenticated user with xID for security and audit
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      });
    }
    
    // Validate required fields
    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Description is required',
      });
    }
    
    // PR: Case Identifier Semantics - Resolve identifier to internal ID
    try {
      const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
      var caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // PR #45: Allow attachments in view mode - no assignment/ownership check
    // Only check if case is locked by someone else - use authenticated user for security
    if (caseData.lockStatus?.isLocked && 
        caseData.lockStatus.activeUserEmail !== req.user.email.toLowerCase()) {
      return res.status(423).json({
        success: false,
        message: `Case is currently locked by ${caseData.lockStatus.activeUserEmail}`,
      });
    }
    
    // Queue file upload to Google Drive asynchronously
    const firmId = req.user.firmId.toString();
    const fileMimeType = req.file.mimetype || getMimeType(req.file.originalname);
    const fileSize = req.file.size;

    // Move uploaded file to a firm-scoped temp directory so the worker can read it
    const tmpDir = path.join(__dirname, '../../uploads/tmp', firmId);
    await fs.mkdir(tmpDir, { recursive: true });
    const destPath = path.join(tmpDir, path.basename(req.file.path));
    await fs.rename(req.file.path, destPath);

    // Compute checksum via streaming to avoid loading the full file into memory
    const checksum = await new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = fsSync.createReadStream(destPath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });

    // Resolve the Drive folder for this case's attachments
    const cfsDriveService = require('../services/cfsDrive.service');
    const targetFolderId = cfsDriveService.getFolderIdForFileType(
      caseData.drive,
      'attachment'
    );

    if (!targetFolderId) {
      await cleanupTempFile(destPath);
      return res.status(500).json({
        success: false,
        message: 'Case Drive folder structure not initialized',
      });
    }

    // Create staging record — upload is processed asynchronously by the worker
    const caseFile = await CaseFile.create({
      firmId: req.user.firmId,
      caseId: caseData.caseId,
      localPath: destPath,
      originalName: req.file.originalname,
      mimeType: fileMimeType,
      size: fileSize,
      uploadStatus: 'pending',
      description,
      checksum,
      createdBy: req.user.email.toLowerCase(),
      createdByXID: req.user.xID,
      createdByName: req.user.name,
      note,
      source: 'upload',
    });

    await enqueueStorageJob(JOB_TYPES.UPLOAD_FILE, {
      firmId,
      provider: 'google',
      caseId: caseData.caseId,
      folderId: targetFolderId,
      fileId: caseFile._id,
    });

    return res.status(202).json({
      success: true,
      data: caseFile,
      message: 'File upload queued for processing',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error uploading attachment',
      error: error.message,
    });
  }
};

/**
 * Clone a case with all comments and attachments
 * POST /api/cases/:caseId/clone
 */
const cloneCase = async (req, res) => caseCreateService.cloneCase(req, res);

/**
 * Unpend a case
 * POST /api/cases/:caseId/unpend
 */
/**
 * Unpend a case (manual unpend)
 * POST /api/cases/:caseId/unpend
 * 
 * Changes case status from PENDED/PENDING back to OPEN with mandatory comment.
 * Allows users to manually unpend a case before the auto-reopen date.
 * 
 * PR: Fix Case Lifecycle - Updated to use centralized service
 */
const unpendCase = async (req, res) => caseUpdateService.unpendCase(req, res);

/**
 * Update case status
 * PUT /api/cases/:caseId/status
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const updateCaseStatus = async (req, res) => caseUpdateService.updateCaseStatus(req, res);

/**
 * Get case by caseId
 * GET /api/cases/:caseId
 * PR #41: Add CASE_VIEWED audit log
 * PR #44: Runtime assertion for xID context
 * PR #45: Enhanced audit logging with CaseAudit and view mode detection
 * PR: Fix Case Visibility - Added authorization logic (Admin/Creator/Assignee)
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const getCaseByCaseId = async (req, res) => caseQueryService.getCaseByCaseId(req, res);

/**
 * Get all cases with filtering
 * GET /api/cases
 * PR #42: Handle assignedTo as xID (or email for backward compatibility)
 * PR #44: Added runtime assertions for xID ownership guardrails
 */
const getCases = async (req, res) => caseQueryService.getCases(req, res);

/**
 * Lock a case
 * POST /api/cases/:caseId/lock
 * 
 * Implements soft locking with 2-hour inactivity auto-unlock
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const lockCaseEndpoint = async (req, res) => caseUpdateService.lockCaseEndpoint(req, res);

/**
 * Unlock a case
 * POST /api/cases/:caseId/unlock
 */
/**
 * Unlock a case
 * POST /api/cases/:caseId/unlock
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const unlockCaseEndpoint = async (req, res) => caseUpdateService.unlockCaseEndpoint(req, res);

/**
 * Update case activity (heartbeat)
 * POST /api/cases/:caseId/activity
 * 
 * Updates lastActivityAt to prevent auto-unlock
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const updateCaseActivity = async (req, res) => caseActivityService.updateCaseActivity(req, res);

/**
 * Unified Pull Endpoint - Pull one or multiple cases from global worklist
 * POST /api/cases/pull
 * 
 * Atomically assigns cases to the authenticated user using the assignment service.
 * User identity is obtained from authentication token (req.user), not from request body.
 * 
 * Replaces the legacy endpoints:
 * - POST /api/cases/:caseId/pull (removed)
 * - POST /api/cases/bulk-pull (removed)
 * 
 * Required payload:
 * {
 *   "caseIds": ["CASE-20260109-00001"] // single case
 * }
 * OR
 * {
 *   "caseIds": ["CASE-20260109-00001", "CASE-20260109-00002"] // multiple cases
 * }
 * 
 * 🚫 REJECTED payloads:
 * - Contains userEmail
 * - Contains userXID (must come from req.user only)
 * 
 * Authentication: User identity is obtained from req.user (set by auth middleware)
 * Authorization: Cases are assigned to the authenticated user's xID
 * 
 * PR: Hard Cutover to xID - Unified single and bulk pull into one endpoint
 */
const pullCases = async (req, res) => caseBulkService.pullCases(req, res);

/**
 * Move case to global worklist (unassign)
 * POST /api/cases/:caseId/unassign
 * Admin only - moves case back to global worklist
 * 
 * Authorization: Handled by CasePolicy.canAssign guard at route level
 * 
 * This endpoint:
 * - Sets assignedToXID = null
 * - Sets status = UNASSIGNED
 * - Creates audit log entry
 * 
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const unassignCase = async (req, res) => caseUpdateService.unassignCase(req, res);


/**
 * View attachment (inline in browser)
 * GET /api/cases/:caseId/attachments/:attachmentId/view
 * 
 * Security:
 * - Validates authenticated user
 * - Validates case exists and user has access to it
 * 
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const viewAttachment = async (req, res) => {
  try {
    if (!req.storageContext?.rootFolderId) {
      console.warn('[STORAGE] blocked_operation: view_attempt_without_storage');
      return res.status(400).json({ code: 'STORAGE_NOT_CONNECTED', message: 'Cloud storage must be connected' });
    }
    const { caseId, attachmentId } = req.params;
    
    // Validate authentication
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // PR: Case Identifier Semantics - Resolve identifier to internal ID
    let caseData;
    try {
      const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
      caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    const attachment = await findScopedCaseAttachment({
      attachmentId,
      caseData,
      req,
    });
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found',
      });
    }
    
    if (!attachment.driveFileId) {
      return res.status(404).json({
        code: 'STORAGE_NOT_CONNECTED',
        message: 'Cloud storage must be connected',
      });
    }
    
    // Determine MIME type and sanitize filename
    const mimeType = getMimeType(attachment.fileName);
    const safeFilename = sanitizeFilename(attachment.fileName);
    
    // Set headers for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    
    const provider = await StorageProviderFactory.getProvider(req.user.firmId);
    const fileStream = await provider.downloadFile(attachment.driveFileId);
    return fileStream.pipe(res);
  } catch (error) {
    console.error('[viewAttachment] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error viewing attachment',
      error: error.message,
    });
  }
};

/**
 * Download attachment (force download)
 * GET /api/cases/:caseId/attachments/:attachmentId/download
 * 
 * Security:
 * - Validates authenticated user
 * - Validates case exists and user has access to it
 * 
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const downloadAttachment = async (req, res) => {
  try {
    if (!req.storageContext?.rootFolderId) {
      console.warn('[STORAGE] blocked_operation: download_attempt_without_storage');
      return res.status(400).json({ code: 'STORAGE_NOT_CONNECTED', message: 'Cloud storage must be connected' });
    }
    const { caseId, attachmentId } = req.params;
    
    // Validate authentication
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // PR: Case Identifier Semantics - Resolve identifier to internal ID
    let caseData;
    try {
      const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
      caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    const attachment = await findScopedCaseAttachment({
      attachmentId,
      caseData,
      req,
    });
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found',
      });
    }
    
    // Determine MIME type and sanitize filename
    const mimeType = attachment.mimeType || getMimeType(attachment.fileName);
    const safeFilename = sanitizeFilename(attachment.fileName);
    
    // Download from firm-connected cloud storage only
    if (attachment.driveFileId) {
      try {
        const provider = await StorageProviderFactory.getProvider(req.user.firmId);

        // Get file stream from Google Drive
        const fileStream = await provider.downloadFile(attachment.driveFileId);
        
        // Set headers for download
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        
        // Pipe the stream to response
        fileStream.pipe(res);
      } catch (error) {
        console.error('[downloadAttachment] Error downloading from Google Drive:', error);
        return res.status(500).json({
          success: false,
          message: 'Error downloading file from Google Drive',
          error: error.message,
        });
      }
    } else {
      return res.status(400).json({
        code: 'STORAGE_NOT_CONNECTED',
        message: 'Cloud storage must be connected',
      });
    }
  } catch (error) {
    console.error('[downloadAttachment] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading attachment',
      error: error.message,
    });
  }
};

/**
 * Get Client Fact Sheet for a Case (Read-Only)
 * GET /api/cases/:caseId/client-fact-sheet
 * 
 * Allows any case-accessible user to view the client fact sheet
 * Returns sanitized, read-only data
 * No download of files - view-only access
 * 
 * PR: Client Fact Sheet Foundation
 */
const getClientFactSheetForCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Validate authentication
    if (!req.user?.xID || !req.user?.firmId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // PR: Case Identifier Semantics - Resolve identifier to internal ID
    let caseData;
    try {
      const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
      caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check if user has access to this case
    if (!checkCaseAccess(caseData, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this case',
      });
    }
    
    // Get client for this case.
    // Prefer snapshot ObjectId when available to avoid firmId type-cast mismatches
    // (legacy tenants may carry firm identifiers that are not ObjectId-castable).
    const snapshotClientObjectId = caseData?.clientSnapshot?.clientObjectId || null;
    let client = null;
    if (snapshotClientObjectId) {
      client = await Client.findById(snapshotClientObjectId);
    }
    if (!client) {
      try {
        client = await Client.findOne({
          clientId: caseData.clientId,
          firmId: req.user.firmId,
        });
      } catch (lookupError) {
        // Legacy tenants can carry non-ObjectId firm IDs on the auth/case side.
        // Client.firmId is ObjectId, so this query can CastError and break CFS view.
        // Fallback: resolve by clientId with strict ambiguity checks to avoid cross-tenant leakage.
        if (lookupError?.name === 'CastError') {
          const candidates = await Client.find({ clientId: caseData.clientId }).limit(5);
          const snapshotBusinessName = (caseData?.clientSnapshot?.businessName || '').trim().toLowerCase();
          const snapshotEmail = (caseData?.clientSnapshot?.businessEmail || '').trim().toLowerCase();

          if (candidates.length === 1) {
            [client] = candidates;
          } else if (snapshotBusinessName || snapshotEmail) {
            const scopedMatches = candidates.filter((doc) => {
              const businessNameMatches = snapshotBusinessName
                && String(doc.businessName || '').trim().toLowerCase() === snapshotBusinessName;
              const emailMatches = snapshotEmail
                && String(doc.businessEmail || '').trim().toLowerCase() === snapshotEmail;
              return businessNameMatches || emailMatches;
            });
            if (scopedMatches.length === 1) {
              [client] = scopedMatches;
            }
          }

          if (!client) {
            console.warn('[getClientFactSheetForCase] Client lookup fallback was ambiguous', {
              caseId: caseData.caseId,
              clientId: caseData.clientId,
              candidateCount: candidates.length,
            });
          }
        } else {
          throw lookupError;
        }
      }
    }
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found for this case',
      });
    }
    
    const attachments = await AttachmentRepository.findByClientSource(req.user.firmId, client.clientId, 'client_cfs');
    const rawBasicInfo = client.clientFactSheet?.basicInfo || {};
    const normalizedBasicInfo = {
      clientName: rawBasicInfo.clientName || client.businessName || '',
      entityType: rawBasicInfo.entityType || '',
      PAN: rawBasicInfo.PAN || client.PAN || '',
      CIN: rawBasicInfo.CIN || client.CIN || '',
      GSTIN: rawBasicInfo.GSTIN || client.GST || '',
      address: rawBasicInfo.address || client.businessAddress || '',
      contactPerson: rawBasicInfo.contactPerson || '',
      email: rawBasicInfo.email || client.businessEmail || '',
      phone: rawBasicInfo.phone || client.primaryContactNumber || '',
    };
    const documents = (client.clientFactSheet?.documents || []).map((doc) => ({
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      uploadedBy: doc.uploadedBy,
      uploadedAt: doc.uploadedAt,
    }));
    const hasFactSheetContent = Boolean(
      (client.clientFactSheet?.description || '').trim()
      || (client.clientFactSheet?.notes || '').trim()
      || documents.length > 0
      || Object.values(normalizedBasicInfo).some((value) => String(value || '').trim())
    );

    if (!hasFactSheetContent && attachments.length === 0) {
      return res.json({
        success: true,
        data: {
          clientId: client.clientId,
          businessName: client.businessName,
          basicInfo: normalizedBasicInfo,
          description: '',
          notes: '',
          updatedAt: null,
          files: [],
          attachments: [],
          documents: [],
        },
        message: 'No fact sheet available for this client',
      });
    }
    
    // Return read-only fact sheet data (exclude internal file paths)
    const factSheetData = {
      clientId: client.clientId,
      businessName: client.businessName,
      basicInfo: normalizedBasicInfo,
      description: client.clientFactSheet?.description || '',
      notes: client.clientFactSheet?.notes || '',
      updatedAt: client.clientFactSheet?.updatedAt || null,
      files: [],
      attachments: [],
      documents,
    };
    factSheetData.attachments = attachments.map((file) => ({
      fileId: file._id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      uploadedAt: file.createdAt,
      size: file.size || 0,
    }));
    factSheetData.files = factSheetData.attachments;
    
    // Log audit event for viewing.
    // NOTE: Read-only CFS fetch from dockets must not fail if audit logging has a transient issue.
    // CFS updates are intentionally restricted to Client Management flows only.
    try {
      const { logFactSheetViewed } = require('../services/clientFactSheetAudit.service');
      await logFactSheetViewed({
        clientId: client.clientId,
        firmId: req.user.firmId,
        performedByXID: req.user.xID,
        caseId: caseData.caseId, // Use display caseId
        metadata: {
          fileCount: factSheetData.files.length,
        },
        req,
      });
    } catch (auditError) {
      console.warn('[getClientFactSheetForCase] Non-blocking audit log failure:', auditError?.message || auditError);
    }
    
    res.json({
      success: true,
      data: factSheetData,
    });
  } catch (error) {
    console.error('[getClientFactSheetForCase] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving client fact sheet',
      error: error.message,
    });
  }
};

/**
 * View Client Fact Sheet File (View-Only, No Download)
 * GET /api/cases/:caseId/client-fact-sheet/files/:fileId/view
 * 
 * Allows case-accessible users to view client fact sheet files
 * Sets Content-Disposition to inline (no download)
 * 
 * PR: Client Fact Sheet Foundation
 */
const viewClientFactSheetFile = async (req, res) => {
  try {
    const { caseId, fileId } = req.params;
    
    // Validate authentication
    if (!req.user?.xID || !req.user?.firmId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // PR: Case Identifier Semantics - Resolve identifier to internal ID
    let caseData;
    try {
      const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
      caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check if user has access to this case
    if (!checkCaseAccess(caseData, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this case',
      });
    }
    
    const attachment = await Attachment.findOne(enforceTenantScope({
      _id: fileId,
      clientId: caseData.clientId,
      source: 'client_cfs',
    }, req, { source: 'case.viewClientFactSheetFile.attachment' }));

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    if (!attachment.driveFileId) {
      return res.status(404).json({
        success: false,
        message: 'File not available in Google Drive',
      });
    }

    const provider = await StorageProviderFactory.getProvider(req.user.firmId);
    const fileStream = await provider.downloadFile(attachment.driveFileId);
    const safeFilename = sanitizeFilename(attachment.fileName);

    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    fileStream.pipe(res);
  } catch (error) {
    console.error('[viewClientFactSheetFile] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error viewing file',
      error: error.message,
    });
  }
};

/**
 * List Client CFS files for a case (Read-only)
 * GET /api/cases/:caseId/client-cfs/files
 * 
 * Lists all files in the case's client CFS
 * Accessible by users with access to the case (read-only)
 */
const listClientCFSFilesForCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const userFirmId = req.user?.firmId;

    if (!userFirmId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Fetch case and validate access
    const Case = require('../models/Case.model');
    const caseDoc = await Case.findOne(enforceTenantScope({
      caseNumber: caseId,
    }, req, { source: 'case.listClientCFSFilesForCase.case' }));

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        message: 'Case not found or access denied',
      });
    }

    // Get client ID from case
    const clientId = caseDoc.clientId;
    if (!clientId) {
      return res.status(404).json({
        success: false,
        message: 'Case does not have an associated client',
      });
    }

    // Fetch all client CFS attachments
    const Attachment = require('../models/Attachment.model');
    const attachments = await Attachment.find(enforceTenantScope({
      clientId: clientId,
      source: 'client_cfs',
    }, req, { source: 'case.listClientCFSFilesForCase.attachments' })).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: attachments.map(att => ({
        attachmentId: att._id,
        fileName: att.fileName,
        size: att.size,
        mimeType: att.mimeType,
        description: att.description,
        createdAt: att.createdAt,
        createdByXID: att.createdByXID,
        createdByName: att.createdByName,
      })),
    });
  } catch (error) {
    console.error('Error listing client CFS files for case:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing client CFS files',
      error: error.message,
    });
  }
};

/**
 * Download Client CFS file from case context (Read-only)
 * GET /api/cases/:caseId/client-cfs/files/:attachmentId/download
 * 
 * Downloads a file from the case's client CFS
 * Accessible by users with access to the case
 */
const downloadClientCFSFileForCase = async (req, res) => {
  try {
    const { caseId, attachmentId } = req.params;
    const userFirmId = req.user?.firmId;

    if (!userFirmId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Fetch case and validate access
    const Case = require('../models/Case.model');
    const caseDoc = await Case.findOne(enforceTenantScope({
      caseNumber: caseId,
    }, req, { source: 'case.listClientCFSFilesForCase.case' }));

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        message: 'Case not found or access denied',
      });
    }

    // Get client ID from case
    const clientId = caseDoc.clientId;
    if (!clientId) {
      return res.status(404).json({
        success: false,
        message: 'Case does not have an associated client',
      });
    }

    // Find attachment
    const Attachment = require('../models/Attachment.model');
    const attachment = await Attachment.findOne(enforceTenantScope({
      _id: attachmentId,
      clientId: clientId,
      source: 'client_cfs',
    }, req, { source: 'case.downloadClientCFSFileForCase.attachment' }));

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'File not found or access denied',
      });
    }

    // Download from Google Drive
    if (!attachment.driveFileId) {
      return res.status(404).json({
        success: false,
        message: 'File not available in Google Drive',
      });
    }

    const provider = await StorageProviderFactory.getProvider(userFirmId);
    const fileStream = await provider.downloadFile(attachment.driveFileId);

    // Set response headers
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);

    // Stream file to response
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading client CFS file for case:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading file from client CFS',
      error: error.message,
    });
  }
};

const searchCases = async (req, res) => caseQueryService.searchCases(req, res);


const getDocketSummaryPdf = async (req, res) => caseQueryService.getDocketSummaryPdf(req, res);

module.exports = {
  createCase: wrapWriteHandler(createCase),
  addComment: wrapWriteHandler(addComment),
  addAttachment: wrapWriteHandler(addAttachment),
  cloneCase: wrapWriteHandler(cloneCase),
  unpendCase: wrapWriteHandler(unpendCase),
  updateCaseStatus: wrapWriteHandler(updateCaseStatus),
  getCaseByCaseId,
  getCaseComments,
  getDocketSummaryPdf,
  getCases,
  searchCases,
  lockCaseEndpoint: wrapWriteHandler(lockCaseEndpoint),
  unlockCaseEndpoint: wrapWriteHandler(unlockCaseEndpoint),
  updateCaseActivity: wrapWriteHandler(updateCaseActivity),
  pullCases: wrapWriteHandler(pullCases),
  unassignCase: wrapWriteHandler(unassignCase),
  viewAttachment,
  downloadAttachment,
  getClientFactSheetForCase,
  viewClientFactSheetFile,
  listClientCFSFilesForCase,
  downloadClientCFSFileForCase,
};
