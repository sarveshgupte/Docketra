const mongoose = require('mongoose');
const { randomUUID, createHash } = require('crypto');
const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const Attachment = require('../models/Attachment.model');
const CaseHistory = require('../models/CaseHistory.model');
const CaseAudit = require('../models/CaseAudit.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const WorkType = require('../models/WorkType.model');
const SubWorkType = require('../models/SubWorkType.model');
const { CaseRepository, ClientRepository, AttachmentRepository } = require('../repositories');
const categoryRepository = require('../repositories/category.repository');
const { detectDuplicates, generateDuplicateOverrideComment } = require('../services/clientDuplicateDetector');
const { CASE_CATEGORIES, CASE_LOCK_CONFIG, COMMENT_PREVIEW_LENGTH, CLIENT_STATUS } = require('../config/constants');
const CaseStatus = require('../domain/case/caseStatus');
const { isValidTransition } = require('./docketWorkflow.controller');
const { isProduction } = require('../config/config');
const { logCaseListViewed, logAdminAction } = require('../services/auditLog.service');
const caseActionService = require('../services/caseAction.service');
const CaseService = require('../services/case.service');
const caseSlaService = require('../services/caseSla.service');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { getMimeType, sanitizeFilename } = require('../utils/fileUtils');
const { cleanupTempFile } = require('../utils/tempFile');
const { resolveCaseIdentifier, resolveCaseDocument } = require('../utils/caseIdentifier');
const { StorageProviderFactory } = require('../services/storage/StorageProviderFactory');
const { areFileUploadsDisabled } = require('../services/featureFlags.service');
const { enqueueStorageJob, JOB_TYPES } = require('../queues/storage.queue');
const { assertFirmContext } = require('../utils/tenantGuard');
const { enforceTenantScope } = require('../utils/tenantScope');
const CaseFile = require('../models/CaseFile.model');
const { incrementTenantMetric } = require('../services/tenantMetrics.service');
const { getSession } = require('../utils/getSession');
const { getOrCreateDefaultClient } = require('../services/defaultClient.guard');
const fs = require('fs').promises;
const fsSync = require('fs');
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

const buildAddCommentErrorResponse = (error, context = {}) => {
  const validationDetails = error?.errors
    ? Object.values(error.errors)
      .map((validationError) => validationError.message)
      .join('; ')
    : undefined;

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
    validationDetails,
  });

  if (error?.message?.includes('Case is locked')) {
    return {
      status: 423,
      body: {
        success: false,
        message: 'Case is locked',
        details: error.message,
        code: 'CASE_LOCKED',
      },
    };
  }

  if (error?.message?.includes('Case not found')) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Case not found',
        details: error.message,
        code: 'CASE_NOT_FOUND',
      },
    };
  }

  if (error?.name === 'ValidationError') {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Comment validation failed',
        details: validationDetails || error.message,
        code: 'COMMENT_VALIDATION_ERROR',
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      message: 'Unexpected error while adding comment',
      details: error?.message || 'Unknown server error',
      code: 'ADD_COMMENT_ERROR',
    },
  };
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
const createCase = async (req, res) => {
  const requestId = req.requestId || randomUUID();
  req.requestId = requestId;
  const step = (label) => {
    console.log(`[CASE_CREATE][${requestId}] STEP -> ${label}`);
  };
  let responseMeta = { requestId, firmId: req.user?.firmId || null };

  try {
    assertFirmContext(req);
    const {
      title,
      description,
      categoryId,
      subcategoryId,
      category, // Legacy field for backward compatibility
      caseCategory,
      caseSubCategory,
      clientId,
      priority,
      assignedTo,
      slaDueDate,
      forceCreate, // Flag to override duplicate warning
      clientData, // Client data for duplicate detection (for "Client – New" cases)
      payload, // Payload for client governance cases
      workTypeId,
      subWorkTypeId,
    } = req.body;
    
    // Get creator xID from authenticated user (req.user is set by auth middleware)
    const createdByXID = req.user.xID;
    
    if (!createdByXID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user identity not found',
        ...responseMeta,
      });
    }

    const firmId = req.user.firmId;
    responseMeta = { requestId, firmId };
    if (!firmId) {
      return res.status(403).json({
        success: false,
        message: 'User must be assigned to a firm to create cases',
        ...responseMeta,
      });
    }
    
    // Verify category exists and is active
    const categoryDoc = await categoryRepository.findActiveCategory(categoryId, firmId);
    
    if (!categoryDoc) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or inactive',
        ...responseMeta,
      });
    }
    
    // Resolve selected subcategory from category document and validate if provided
    const subcategoryDoc = categoryDoc.subcategories?.find(
      (sub) => String(sub.id) === String(subcategoryId)
    );

    if (subcategoryId && (!subcategoryDoc || !subcategoryDoc.isActive)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subcategory selected.',
        ...responseMeta,
      });
    }
    
    // Default to the tenant's default client when caller does not specify clientId
    let finalClientId = clientId || null;
    if (!finalClientId) {
      const defaultClient = await getOrCreateDefaultClient(firmId, {
        requestId,
        userId: req.user?._id || req.user?.id || null,
      });
      finalClientId = defaultClient?.clientId || 'C000001';
    }
    
    // Verify client exists and validate status - with firm scoping
    // PR: Client Lifecycle Enforcement - only ACTIVE clients can be used for new cases
    const client = await ClientRepository.findByClientId(firmId, finalClientId, req.user.role);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: `Client ${finalClientId} not found`,
        ...responseMeta,
      });
    }

    if (String(client.firmId) !== String(firmId)) {
      return res.status(403).json({
        success: false,
        message: 'Client firm mismatch detected',
        ...responseMeta,
      });
    }
    
    // Check client status
    if (client.status !== CLIENT_STATUS.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: 'This client is no longer active. Please contact your administrator to proceed.',
        ...responseMeta,
      });
    }
    
    // Determine the actual category name to use (for backward compatibility)
    const actualCategory = caseCategory || category || categoryDoc.name;
    const isAdminUser = ['ADMIN', 'Admin'].includes(req.user?.role);

    // Optional: resolve firm-scoped work type and sub-work type.
    // This keeps case creation backward compatible while enabling deadline auto-calculation.
    let selectedWorkType = null;
    let selectedSubWorkType = null;
    let tatDaysSnapshot = 0;

    if (workTypeId) {
      selectedWorkType = await WorkType.findOne({ _id: workTypeId, firmId, isActive: true });
      if (!selectedWorkType) {
        return res.status(404).json({
          success: false,
          message: 'Work type not found or inactive',
          ...responseMeta,
        });
      }
      tatDaysSnapshot = Number(selectedWorkType.tatDays || 0);
    }

    if (subWorkTypeId) {
      if (!selectedWorkType) {
        return res.status(400).json({
          success: false,
          message: 'workTypeId is required when subWorkTypeId is provided',
          ...responseMeta,
        });
      }

      selectedSubWorkType = await SubWorkType.findOne({
        _id: subWorkTypeId,
        firmId,
        parentWorkTypeId: selectedWorkType._id,
        isActive: true,
      });

      if (!selectedSubWorkType) {
        return res.status(404).json({
          success: false,
          message: 'Sub work type not found, inactive, or not linked to selected work type',
          ...responseMeta,
        });
      }

      tatDaysSnapshot = Number(selectedSubWorkType.tatDays || tatDaysSnapshot);
    }
    
    // PART F: Duplicate detection for "Client – New" category
    let duplicateMatches = null;
    let systemComment = null;
    
    if (actualCategory === CASE_CATEGORIES.CLIENT_NEW) {
      // Detect duplicates using client data
      const dataToCheck = clientData || (payload && payload.clientData) || {
        businessName: client.businessName,
        businessAddress: client.businessAddress,
        primaryContactNumber: client.primaryContactNumber,
        businessEmail: client.businessEmail,
        PAN: client.PAN,
        GST: client.GST,
        CIN: client.CIN,
      };
      
      const duplicateResult = await detectDuplicates(dataToCheck);
      
      if (duplicateResult.hasDuplicates) {
        // Filter out the current client from matches (if checking against existing client)
        duplicateMatches = duplicateResult.matches.filter(
          match => match.clientId !== finalClientId
        );
        
        if (duplicateMatches.length > 0) {
          // If forceCreate is not set, return 409 with match details
          if (!forceCreate) {
            return res.status(409).json({
              success: false,
              message: 'Possible duplicate client detected',
              duplicates: {
                matchCount: duplicateMatches.length,
                matches: duplicateMatches,
              },
              hint: 'Set forceCreate=true to proceed anyway',
              ...responseMeta,
            });
          }
          
          // If forceCreate is set, generate system comment
          systemComment = generateDuplicateOverrideComment(duplicateMatches);
        }
      }
    }
    
    if (!isAdminUser && Object.prototype.hasOwnProperty.call(req.body, 'slaDueDate')) {
      delete req.body.slaDueDate;
    }

    const idempotencyKeyRaw = req.headers['idempotency-key'] || req.body.idempotencyKey;
    const idempotencyKey = idempotencyKeyRaw ? idempotencyKeyRaw.toString().trim().toLowerCase() : null;

    if (idempotencyKey) {
      const existingCase = await CaseRepository.findOne(firmId, { idempotencyKey }, req.user.role);
      if (existingCase) {
        console.warn(`[CASE_CREATE][${requestId}] Idempotent replay detected`, { firmId, caseId: existingCase.caseId });
        return res.status(200).json({
          success: true,
          data: existingCase,
          message: 'Case already exists for this idempotency key',
          idempotent: true,
          ...responseMeta,
        });
      }
    }

    const session = getSession(req);
    try {
      // Create new case with defaults
      let defaultSlaDays = Number(
        subcategoryDoc?.defaultSlaDays ?? categoryDoc?.defaultSlaDays ?? 0
      );
      if (!Number.isFinite(defaultSlaDays)) {
        defaultSlaDays = 0;
      }
      const requestedSlaDueDate = isAdminUser && slaDueDate ? new Date(slaDueDate) : null;
      const hasValidRequestedSla = requestedSlaDueDate && !Number.isNaN(requestedSlaDueDate.getTime());

      step('before SLA initialization');
      const slaState = await caseSlaService.initializeCaseSla({
        tenantId: firmId,
        caseType: actualCategory,
        now: new Date(),
        session,
      });
      step('after SLA initialization');

      if (defaultSlaDays > 0 && !hasValidRequestedSla) {
        const computedDefault = new Date();
        computedDefault.setDate(computedDefault.getDate() + defaultSlaDays);
        slaState.slaDueAt = computedDefault;
      }

      if (hasValidRequestedSla) {
        slaState.slaDueAt = requestedSlaDueDate;
      }

      const normalizedTitle = typeof title === 'string' && title.trim().length > 0
        ? title.trim()
        : 'Untitled Docket';
      const normalizedDescription = typeof description === 'string' ? description.trim() : '';
      if (!normalizedDescription) {
        return res.status(400).json({
          success: false,
          message: 'Description is required',
          ...responseMeta,
        });
      }

      const normalizedPriority = typeof priority === 'string' && priority.trim().length > 0
        ? priority.trim().toLowerCase()
        : 'medium';

      const newCase = new Case({
        title: normalizedTitle,
        description: normalizedDescription,
        categoryId,
        subcategoryId,
        category: actualCategory, // Legacy field
        caseCategory: actualCategory,
        caseSubCategory: subcategoryDoc?.name || caseSubCategory || '',
        clientId: finalClientId,
        firmId, // PR 2: Explicitly set firmId for atomic counter scoping
        createdByXID, // Set from authenticated user context
        createdBy: req.user.email || req.user.xID, // Legacy field - use email or xID as fallback
        priority: normalizedPriority,
        status: 'UNASSIGNED', // New cases default to UNASSIGNED for global worklist
        assignedToXID: assignedTo ? assignedTo.toUpperCase() : null, // PR: xID Canonicalization - Store in assignedToXID
        assignedTo: null,
        assignedBy: null,
        slaDueAt: slaState.slaDueAt,
        tatPaused: slaState.tatPaused,
        tatLastStartedAt: slaState.tatLastStartedAt,
        tatAccumulatedMinutes: slaState.tatAccumulatedMinutes,
        tatTotalMinutes: slaState.tatTotalMinutes,
        slaConfigSnapshot: slaState.slaConfigSnapshot,
        payload, // Store client case payload if provided
        idempotencyKey: idempotencyKey || undefined,
        workTypeId: selectedWorkType?._id || null,
        subWorkTypeId: selectedSubWorkType?._id || null,
        tatDaysSnapshot,
        dueDate: computeDeadlineFromTatDays(tatDaysSnapshot) || undefined,
      });
      
      step('before case create');
      await newCase.saveWithRetry({ session });
      step('after case create');

      step('before counter increment');
      await incrementTenantMetric(firmId, 'cases', 1, { session });
      step('after counter increment');
      
      // Create case history entry with enhanced audit logging
      const { logCaseHistory } = require('../services/auditLog.service');
      const { CASE_ACTION_TYPES } = require('../config/constants');
      
      step('before history insert');
      await logCaseHistory({
        caseId: newCase.caseId,
        firmId: newCase.firmId,
        actionType: CASE_ACTION_TYPES.CASE_CREATED,
        actionLabel: `Case created by ${req.user.name || req.user.xID}`,
        description: `Case created with status: UNASSIGNED, Client: ${finalClientId}, Category: ${actualCategory}`,
        performedBy: req.user.email,
        performedByXID: createdByXID,
        actorRole: req.user.role === 'Admin' ? 'ADMIN' : 'USER',
        metadata: {
            category: actualCategory,
            clientId: finalClientId,
            priority: normalizedPriority,
            slaDueAt: newCase.slaDueAt,
            assignedToXID: newCase.assignedToXID,
            duplicateOverridden: !!systemComment,
          },
        req,
        session,
      });
      step('after history insert');
      
      // Add system comment if duplicate was overridden
      if (systemComment) {
        step('before duplicate override comment insert');
        await Comment.create([{
          caseId: newCase.caseId,
          firmId: newCase.firmId,
          text: systemComment,
          createdBy: 'system',
          note: 'Automated duplicate detection notice',
        }], { session });
        step('after duplicate override comment insert');
      }

      return res.status(201).json({
        success: true,
        data: newCase,
        message: 'Case created successfully',
        duplicateWarning: systemComment ? {
          message: 'Case created with duplicate warning',
          matchCount: duplicateMatches.length,
        } : null,
        ...responseMeta,
      });
    } catch (error) {
      if (error?.code === 11000) {
        console.error(`[CASE_CREATE][${requestId}] Duplicate key detected during case creation`, { firmId, error: error.message });
        let existingCase = null;
        if (idempotencyKey) {
          existingCase = await CaseRepository.findOne(firmId, { idempotencyKey }, req.user.role);
          if (!existingCase) {
            // Brief retry to handle concurrent commit visibility before responding idempotently
            await new Promise((resolve) => setTimeout(resolve, 25));
            existingCase = await CaseRepository.findOne(firmId, { idempotencyKey }, req.user.role);
          }
        }
        if (existingCase) {
          return res.status(200).json({
            success: true,
            data: existingCase,
            message: 'Case already exists for this idempotency key',
            idempotent: true,
            ...responseMeta,
          });
        }
        return res.status(409).json({
          success: false,
          message: 'Duplicate case detected. No changes were applied.',
          ...responseMeta,
        });
      }

      console.error(`[CASE_CREATE][${requestId}] Create docket failed`, {
        firmId: firmId?.toString(),
        error: error.message,
        stack: error.stack,
      });
      return res.status(400).json({
        success: false,
        message: 'Failed to create docket.',
        ...responseMeta,
      });
    }
  } catch (error) {
    const statusCode = error?.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: 'Error creating case',
      error: error.message,
      ...responseMeta,
    });
  }
};

/**
 * Add a comment to a case
 * POST /api/cases/:caseId/comments
 * PR #41: Allow comments in view mode (no assignment check)
 * PR #45: Add CaseAudit logging with xID attribution
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const addComment = async (req, res) => {
  const { caseId } = req.params;
  const tenantFirmId = req.firmId || req.user?.firmId;
  let caseData = null;

  try {
    const { text, note } = req.body;
    
    // PR #45: Require authenticated user with xID for security and audit
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!tenantFirmId) {
      return res.status(400).json({
        success: false,
        message: 'Firm context is required',
      });
    }
    
    // PR: Case Identifier Semantics - Resolve identifier to internal ID
    // This handles both ObjectId and CASE-YYYYMMDD-XXXXX formats
    try {
      const internalId = await resolveCaseIdentifier(tenantFirmId, caseId, req.user.role);
      caseData = await CaseRepository.findByInternalId(tenantFirmId, internalId, req.user.role);
    } catch (error) {
      if (!error.message) {
        error.message = 'Case not found during identifier resolution';
      }
      throw error;
    }
    
    if (!caseData) {
      throw new Error('Case not found');
    }
    
    // PR #45: Allow comments in view mode - no assignment/ownership check
    // Only check if case is locked by someone else - use authenticated user for security
    if (caseData.lockStatus?.isLocked && 
        caseData.lockStatus.activeUserEmail !== req.user.email.toLowerCase()) {
      throw new Error(`Case is locked by ${caseData.lockStatus.activeUserEmail}`);
    }
    
    // Create comment - use caseId from database (caseNumber for display)
    const comment = await Comment.create({
      caseId: caseData.caseId,
      firmId: tenantFirmId,
      text,
      createdBy: req.user.email.toLowerCase(),
      createdByXID: req.user.xID,
      createdByName: req.user.name,
      note,
    });
    
    // PR #45: Add CaseAudit entry with xID attribution
    // Sanitize comment text for logging to prevent log injection
    const sanitizedText = sanitizeForLog(text, COMMENT_PREVIEW_LENGTH);
    await CaseAudit.create({
      caseId: caseData.caseId,
      firmId: tenantFirmId,
      actionType: 'CASE_COMMENT_ADDED',
      description: `Comment added by ${req.user.xID}: ${sanitizedText}${text.length > COMMENT_PREVIEW_LENGTH ? '...' : ''}`,
      performedByXID: req.user.xID,
      metadata: {
        commentLength: text.length,
        hasNote: !!note,
      },
    });
    
    // Also add to CaseHistory for backward compatibility
    await CaseHistory.create({
      caseId: caseData.caseId,
      firmId: tenantFirmId,
      actionType: 'CASE_COMMENT_ADDED',
      description: `Comment added by ${req.user.email}: ${text.substring(0, COMMENT_PREVIEW_LENGTH)}${text.length > COMMENT_PREVIEW_LENGTH ? '...' : ''}`,
      performedBy: req.user.email.toLowerCase(),
      performedByXID: req.user.xID.toUpperCase(), // Canonical identifier (uppercase)
    });
    
    res.status(201).json({
      success: true,
      data: comment,
      message: 'Comment added successfully',
    });
  } catch (error) {
    const { status, body } = buildAddCommentErrorResponse(error, {
      caseId,
      resolvedCaseId: caseData?.caseId || null,
      userId: req.user?.xID,
      firmId: tenantFirmId,
      lockStatus: caseData?.lockStatus || null,
      requestBody: {
        textLength: typeof req.body?.text === 'string' ? req.body.text.length : null,
        hasNote: Boolean(req.body?.note),
        createdBy: req.body?.createdBy || null,
      },
    });
    return res.status(status).json(body);
  }
};

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
const cloneCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { newCategory, assignedTo, clonedBy } = req.body;
    
    // Validate required fields
    if (!newCategory) {
      return res.status(400).json({
        success: false,
        message: 'New category is required',
      });
    }
    
    if (!clonedBy) {
      return res.status(400).json({
        success: false,
        message: 'Cloned by email is required',
      });
    }
    
    // PR: Case Identifier Semantics - Resolve identifier to internal ID
    let originalCase;
    try {
      const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
      originalCase = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Original case not found',
      });
    }
    
    if (!originalCase) {
      return res.status(404).json({
        success: false,
        message: 'Original case not found',
      });
    }
    
    // Check if case can be cloned
    if (originalCase.status === 'Archived') {
      return res.status(400).json({
        success: false,
        message: 'Archived cases cannot be cloned',
      });
    }
    
    // PR: Client Lifecycle Enforcement - validate client is ACTIVE before cloning
    const client = await ClientRepository.findByClientId(req.user.firmId, originalCase.clientId, req.user.role);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: `Client ${originalCase.clientId} not found`,
      });
    }
    
    // Check client status
    if (client.status !== CLIENT_STATUS.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: 'This client is no longer active. Please contact your administrator to proceed.',
      });
    }
    
    // Create new case
    const newCase = new Case({
      title: originalCase.title,
      description: originalCase.description,
      category: newCategory,
      clientId: originalCase.clientId,
      priority: originalCase.priority,
      status: 'Open',
      pendingUntil: null,
      slaDueAt: originalCase.slaDueAt || new Date(),
      tatPaused: originalCase.tatPaused || false,
      tatLastStartedAt: originalCase.tatLastStartedAt || new Date(),
      tatAccumulatedMinutes: originalCase.tatAccumulatedMinutes || 0,
      tatTotalMinutes: originalCase.tatTotalMinutes || 0,
      slaConfigSnapshot: originalCase.slaConfigSnapshot || undefined,
      createdBy: clonedBy.toLowerCase(),
      assignedToXID: assignedTo ? assignedTo.toUpperCase() : null, // PR: xID Canonicalization - Store in assignedToXID
    });
    
    await newCase.saveWithRetry();
    
    // Copy comments
    const originalComments = await Comment.find(enforceTenantScope({ caseId: originalCase.caseId }, req, { source: 'case.clone.originalComments' }));
    const copiedComments = [];
    
    for (const comment of originalComments) {
      const newComment = await Comment.create({
        caseId: newCase.caseId,
        firmId: req.user.firmId,
        text: comment.text,
        createdBy: comment.createdBy,
        note: `Cloned from Docket ${originalCase.caseId}`,
      });
      copiedComments.push(newComment);
    }
    
    // Copy attachments (including actual files)
    const originalAttachments = await Attachment.find(enforceTenantScope({ caseId: originalCase.caseId }, req, { source: 'case.clone.originalAttachments' }));
    const copiedAttachments = [];
    const provider = await StorageProviderFactory.getProvider(req.user.firmId);
    
    for (const attachment of originalAttachments) {
      try {
        let newDriveFileId = null;
        let fileSize = attachment.size;
        let fileMimeType = attachment.mimeType;
        
        // Handle Google Drive attachments
        if (attachment.driveFileId) {
          // Ensure new case has Drive folder structure
          if (!newCase.drive?.attachmentsFolderId) {
            throw new Error('New case Drive folder structure not initialized');
          }
          
          const cfsDriveService = require('../services/cfsDrive.service');
          
          // Note: This loads the entire file into memory
          // For very large files (>100MB), consider implementing streaming or skipping clone
          const MAX_CLONE_SIZE = 100 * 1024 * 1024; // 100MB limit
          
          if (attachment.size && attachment.size > MAX_CLONE_SIZE) {
            console.warn(`[cloneCase] Skipping large file ${attachment.fileName} (${attachment.size} bytes)`);
            continue;
          }
          
          // Download file from original location
          const fileStream = await provider.downloadFile(attachment.driveFileId);
          
          // Convert stream to buffer
          const chunks = [];
          for await (const chunk of fileStream) {
            chunks.push(chunk);
          }
          const fileBuffer = Buffer.concat(chunks);
          
          // Upload to new case's folder
          const targetFolderId = cfsDriveService.getFolderIdForFileType(
            newCase.drive,
            'attachment'
          );
          
          const driveFile = await provider.uploadFile(
            fileBuffer,
            attachment.fileName,
            fileMimeType || getMimeType(attachment.fileName),
            targetFolderId
          );
          
          newDriveFileId = driveFile.id;
          fileSize = driveFile.size || fileSize;
          fileMimeType = driveFile.mimeType || fileMimeType;
        } else if (attachment.filePath) {
          // Legacy: Handle old attachments stored locally
          const fileExt = path.extname(attachment.fileName);
          const newFileName = `${Date.now()}-${require('crypto').randomBytes(4).toString('hex')}${fileExt}`;
          const newFilePath = path.join(__dirname, '../../uploads', newFileName);
          
          // Copy the actual file
          await fs.copyFile(attachment.filePath, newFilePath);
          
          // Create new attachment record with local path (legacy)
          const newAttachment = await Attachment.create({
            caseId: newCase.caseId,
            firmId: newCase.firmId,
            fileName: attachment.fileName,
            filePath: newFilePath,
            description: attachment.description,
            createdBy: attachment.createdBy,
            createdByXID: attachment.createdByXID,
            createdByName: attachment.createdByName,
            type: attachment.type,
            source: attachment.source,
            visibility: attachment.visibility,
            mimeType: attachment.mimeType,
            note: `Cloned from Docket ${originalCase.caseId}`,
          });
          copiedAttachments.push(newAttachment);
          continue;
        } else {
          console.error(`Attachment ${attachment._id} has no file location`);
          continue;
        }
        
        // Create new attachment record with Google Drive metadata
        const newAttachment = await Attachment.create({
          caseId: newCase.caseId,
          firmId: newCase.firmId,
          fileName: attachment.fileName,
          driveFileId: newDriveFileId,
          storageProvider: 'google-drive',
          storageFileId: newDriveFileId,
          size: fileSize,
          mimeType: fileMimeType,
          description: attachment.description,
          createdBy: attachment.createdBy,
          createdByXID: attachment.createdByXID,
          createdByName: attachment.createdByName,
          type: attachment.type,
          source: attachment.source,
          visibility: attachment.visibility,
          note: `Cloned from Docket ${originalCase.caseId}`,
        });
        copiedAttachments.push(newAttachment);
      } catch (fileError) {
        console.error(`Error copying file for attachment: ${fileError.message}`);
        // Continue with other attachments even if one fails
      }
    }
    
    // Create history entries
    // For original case
    await CaseHistory.create({
      caseId: originalCase.caseId,
      firmId: req.user.firmId,
      actionType: 'Cloned',
      description: `Cloned to ${newCase.caseId}`,
      performedBy: clonedBy.toLowerCase(),
    });
    
    // For new case
    await CaseHistory.create({
      caseId: newCase.caseId,
      firmId: req.user.firmId,
      actionType: 'Created (Cloned)',
      description: `Cloned from Docket ${originalCase.caseId}`,
      performedBy: clonedBy.toLowerCase(),
    });
    
    res.status(201).json({
      success: true,
      data: {
        originalCaseId: originalCase.caseId,
        newCase,
        copiedComments: copiedComments.length,
        copiedAttachments: copiedAttachments.length,
      },
      message: 'Case cloned successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error cloning case',
      error: error.message,
    });
  }
};

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
const unpendCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comment } = req.body;
    
    // Validate user authentication
    if (!req.user || !req.user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Call service to unpend case - with firm scoping
    const caseData = await caseActionService.unpendCase(req.user.firmId, caseId, comment, req.user, req);
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case unpended successfully',
    });
  } catch (error) {
    // Handle specific errors
    if (error.message === 'Comment is mandatory for this action') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message === 'Case not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message.startsWith('Cannot change case from')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error unpending case',
      error: error.message,
    });
  }
};

/**
 * Update case status
 * PUT /api/cases/:caseId/status
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const updateCaseStatus = async (req, res) => {
  try {
    const { caseId } = req.params;
    const {
      status,
      performedBy,
      pendingUntil,
      version,
      reason,
      notes,
    } = req.body;
    
    // Validate required fields
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }
    
    if (!performedBy) {
      return res.status(400).json({
        success: false,
        message: 'Performed by email is required',
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
    
    const normalizedStatus = String(status || '').toUpperCase();
    const docketStatuses = new Set(['OPEN', 'PENDING', 'RESOLVED', 'FILED']);

    if (normalizedStatus === 'PENDING' && !reason) {
      return res.status(400).json({
        success: false,
        message: 'pendingReason is required when status is PENDING',
      });
    }

    if (docketStatuses.has(String(caseData.status || '').toUpperCase()) && docketStatuses.has(normalizedStatus)) {
      const isAssigned = Boolean(caseData.assignedToXID);
      if (!isValidTransition(String(caseData.status || '').toUpperCase(), normalizedStatus, isAssigned)) {
        return res.status(400).json({ success: false, message: 'Invalid transition' });
      }
    }

    await CaseService.updateStatus(caseData.caseId, normalizedStatus, {
      tenantId: req.user.firmId,
      role: req.user.role,
      userId: req.user.xID,
      performedByXID: req.user.xID,
      performedBy: performedBy.toLowerCase(),
      actorRole: req.user.role === 'Admin' ? 'ADMIN' : 'USER',
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent'),
      req,
      expectedVersion: Number.isInteger(version) ? version : caseData.version,
      reason,
      notes,
      statusPatch: normalizedStatus === 'PENDING'
        ? { pendingUntil, pendingReason: reason || null }
        : { pendingUntil: null, pendingReason: null },
    });

    caseData = await CaseRepository.findByInternalId(req.user.firmId, caseData.caseInternalId, req.user.role);
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case status updated successfully',
    });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
    res.status(statusCode).json({
      success: false,
      message: 'Error updating case status',
      error: error.message,
    });
  }
};

/**
 * Get case by caseId
 * GET /api/cases/:caseId
 * PR #41: Add CASE_VIEWED audit log
 * PR #44: Runtime assertion for xID context
 * PR #45: Enhanced audit logging with CaseAudit and view mode detection
 * PR: Fix Case Visibility - Added authorization logic (Admin/Creator/Assignee)
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const getCaseByCaseId = async (req, res) => {
  try {
    console.time('[GET_CASE]');
    const { caseId } = req.params;
    
    // PR: Fix Case Visibility - Enhanced logging for debugging
    console.log(`[GET_CASE] Attempting to fetch case: caseId=${caseId}, firmId=${req.user.firmId}, userXID=${req.user.xID}`);
    
    // Prefer repository-backed lookup for docket deep-links so encrypted fields
    // are decrypted before reaching the UI. Fallback to identifier resolution
    // for backward compatibility with internal IDs.
    // Refactor: Use MongoDB aggregation with $lookup to join client data in a single query
    let caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId, req.user.role, { includeClient: true });

    if (!caseData) {
      try {
        const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
        console.log(`[GET_CASE] Resolved identifier: ${caseId} -> ${internalId}`);
        caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role, { includeClient: true });
      } catch (error) {
        console.error(`[GET_CASE] Case not found or identifier resolution failed: caseId=${caseId}, error=${error.message}`);
        return res.status(404).json({
          success: false,
          message: 'Case not found',
        });
      }
    }
    
    if (!caseData) {
      console.error(`[GET_CASE] Case not found in database: caseId=${caseId}, firmId=${req.user.firmId}`);
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    console.log(`[GET_CASE] Case found: caseInternalId=${caseData.caseInternalId}, caseNumber=${caseData.caseNumber}, caseId=${caseData.caseId}`);
    
    // Step 2: Apply authorization AFTER fetch
    // Allow access if user is:
    // - Admin or SuperAdmin
    // - Case creator (createdByXID matches user xID)
    // - Assigned employee (assignedToXID matches user xID)
    if (!checkCaseAccess(caseData, req.user)) {
      console.error(`[GET_CASE] Access denied: userXID=${req.user.xID}, createdByXID=${caseData.createdByXID}, assignedToXID=${caseData.assignedToXID}, role=${req.user.role}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view this case',
        code: 'CASE_ACCESS_DENIED',
      });
    }
    
    console.log(`[GET_CASE] Authorization passed for userXID=${req.user.xID}`);
    
    // Get related data - use caseId from database (display number)
    const displayCaseId = caseData.caseId;
    const scopedCaseId = caseData.caseId;
    const scopedFirmId = String(caseData.firmId || req.user.firmId);
    const commentsPage = Number(req.query.commentsPage || 1);
    const commentsLimit = Math.min(100, Number(req.query.commentsLimit || 25));
    const commentsSkip = (commentsPage - 1) * commentsLimit;
    const activityPage = Number(req.query.activityPage || 1);
    const activityLimit = Math.min(100, Number(req.query.activityLimit || 25));
    const activitySkip = (activityPage - 1) * activityLimit;
    const runPaginatedFacet = async ({
      model,
      match,
      sort,
      skip,
      limit,
      project,
    }) => {
      const facetResult = await model.aggregate([
        { $match: match },
        {
          $facet: {
            data: [
              { $sort: sort },
              { $skip: skip },
              { $limit: limit + 1 },
              { $project: project },
            ],
            totalCount: [{ $count: 'count' }],
          },
        },
      ], { role: req.user.role });
      const first = Array.isArray(facetResult) ? facetResult[0] || {} : {};
      const rows = Array.isArray(first.data) ? first.data : [];
      const totalCount = first.totalCount?.[0]?.count || 0;
      return {
        rows: rows.slice(0, limit),
        hasMore: rows.length > limit,
        totalCount,
      };
    };

    const [commentsResult, attachmentsResult, historyResult, auditResult] = await Promise.allSettled([
      runPaginatedFacet({
        model: Comment,
        match: enforceTenantScope({ caseId: scopedCaseId }, req, { source: 'case.getCase.comments' }),
        sort: { createdAt: 1 },
        skip: commentsSkip,
        limit: commentsLimit,
        project: {
          _id: 1,
          caseId: 1,
          text: 1,
          note: 1,
          createdBy: 1,
          createdByXID: 1,
          createdByName: 1,
          createdAt: 1,
        },
      }),
      Attachment.find(enforceTenantScope({ caseId: scopedCaseId }, req, { source: 'case.getCase.attachments' }))
        .select('_id fileName description createdAt uploadedAt uploadedBy createdByXID isAvailable uploadStatus')
        .sort({ createdAt: 1 })
        .lean(),
      runPaginatedFacet({
        model: CaseHistory,
        match: enforceTenantScope({ caseId: scopedCaseId }, req, { source: 'case.getCase.history' }),
        sort: { timestamp: -1 },
        skip: activitySkip,
        limit: activityLimit,
        project: {
          _id: 1,
          actionType: 1,
          description: 1,
          timestamp: 1,
          performedBy: 1,
          performedByXID: 1,
        },
      }),
      runPaginatedFacet({
        model: CaseAudit,
        match: enforceTenantScope({ caseId: scopedCaseId }, req, { source: 'case.getCase.audit' }),
        sort: { timestamp: -1 },
        skip: activitySkip,
        limit: activityLimit,
        project: {
          _id: 1,
          actionType: 1,
          description: 1,
          timestamp: 1,
          performedByXID: 1,
          metadata: 1,
        },
      }),
    ]);

    if (commentsResult.status === 'rejected' || attachmentsResult.status === 'rejected' || historyResult.status === 'rejected' || auditResult.status === 'rejected') {
      console.error('[GET_CASE] Related data load failed', {
        comments: commentsResult.status,
        attachments: attachmentsResult.status,
        history: historyResult.status,
        audit: auditResult.status,
      });
    }
    const commentsPayload = commentsResult.status === 'fulfilled' ? commentsResult.value : { rows: [], hasMore: false, totalCount: 0 };
    const historyPayload = historyResult.status === 'fulfilled' ? historyResult.value : { rows: [], hasMore: false, totalCount: 0 };
    const auditPayload = auditResult.status === 'fulfilled' ? auditResult.value : { rows: [], hasMore: false, totalCount: 0 };
    const comments = (commentsPayload.rows || []).map((comment) => ({
      ...comment,
      text: sanitizeOutput(comment.text),
      note: comment.note ? sanitizeOutput(comment.note) : comment.note,
    }));
    const attachments = (attachmentsResult.status === 'fulfilled' ? attachmentsResult.value : []).map((attachment) => ({
      ...attachment,
      description: attachment.description ? sanitizeOutput(attachment.description) : attachment.description,
    }));
    const history = historyPayload.rows || [];
    let auditLog = auditPayload.rows || [];
    if (auditLog.length > 0) {
      const auditXids = [...new Set(auditLog.map((entry) => entry.performedByXID).filter(Boolean))];
      if (auditXids.length > 0) {
        const users = await User.find({
          xID: { $in: auditXids },
          firmId: scopedFirmId,
        }).select('xID name').lean();
        const namesByXid = new Map(users.map((user) => [user.xID, user.name]));
        auditLog = auditLog.map((entry) => ({
          ...entry,
          performedByName: namesByXid.get(entry.performedByXID) || undefined,
        }));
      }
    }
    
    // Fetch current client details - with firm scoping
    // PR: Client Lifecycle - fetch client regardless of status to display existing cases with inactive clients
    // (Note: resolved via CaseRepository aggregation pipeline with $lookup)
    const client = caseData.client || null;
    
    // PR #45: Require authenticated user with xID for audit logging
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // PR #44: Runtime assertion - warn if xID is missing from auth context
    if (!req.user.xID && !isProduction()) {
      console.warn(`[xID Guardrail] Case accessed without xID in auth context`);
      console.warn(`[xID Guardrail] Case: ${displayCaseId}, User email: ${req.user.email}`);
      console.warn(`[xID Guardrail] This should not happen - auth middleware should always provide xID`);
    }
    
    // PR #45: Determine if user is viewing in view-only mode
    // View-only mode: case is not assigned to the current user
    const isViewOnlyMode = caseData.assignedToXID !== req.user.xID;
    const isOwner = caseData.createdByXID === req.user.xID;
    
    // PR #45: Add CaseAudit and CaseHistory entries with xID attribution
    await Promise.allSettled([
      CaseAudit.create({
        caseId: displayCaseId,
        actionType: 'CASE_VIEWED',
        description: `Case viewed by ${req.user.xID}${isViewOnlyMode ? ' (view-only mode)' : ' (assigned mode)'}`,
        performedByXID: req.user.xID,
        metadata: {
          isViewOnlyMode,
          isOwner,
          isAssigned: !isViewOnlyMode,
        },
      }),

      CaseHistory.create({
        caseId: displayCaseId,
        actionType: 'CASE_VIEWED',
        description: `Case viewed by ${req.user.email}`,
        performedBy: req.user.email.toLowerCase(),
        performedByXID: req.user.xID.toUpperCase(), // Canonical identifier (uppercase)
      }),
    ]);

    const caseObject =
      typeof caseData.toObject === 'function'
        ? caseData.toObject()
        : caseData;

    return res.status(200).json({
      success: true,
      data: {
        ...caseObject,
        client: client ? {
          clientId: client.clientId,
          businessName: client.businessName,
          primaryContactNumber: client.primaryContactNumber,
          businessEmail: client.businessEmail,
          status: client.status, // Include status for inactive label display
          isActive: client.isActive, // Legacy field for backward compatibility
        } : null,
        comments,
        attachments,
        history,
        auditLog, // PR #45: Include audit log for UI
        // PR #45: Include access mode information for UI
        accessMode: {
          isViewOnlyMode,
          isOwner,
          isAssigned: !isViewOnlyMode,
          canEdit: !isViewOnlyMode,
          canComment: true, // Always allowed
          canAttach: true, // Always allowed
        },
        pagination: {
          comments: {
            page: commentsPage,
            limit: commentsLimit,
            hasMore: commentsPayload.hasMore,
            totalCount: commentsPayload.totalCount,
          },
          activity: {
            page: activityPage,
            limit: activityLimit,
            hasMore: historyPayload.hasMore || auditPayload.hasMore,
            totalCount: (historyPayload.totalCount || 0) + (auditPayload.totalCount || 0),
          },
        },
      },
    });
  } catch (error) {
    console.error('[GET_CASE] Unexpected error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error fetching case',
      error: error.message,
    });
  } finally {
    console.timeEnd('[GET_CASE]');
  }
};

/**
 * Get all cases with filtering
 * GET /api/cases
 * PR #42: Handle assignedTo as xID (or email for backward compatibility)
 * PR #44: Added runtime assertions for xID ownership guardrails
 */
const getCases = async (req, res) => {
  try {
    if (typeof res.set === 'function') {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });
    } else if (typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    const {
      status,
      category,
      priority,
      assignedTo,
      slaDueDate,
      createdBy,
      clientId,
      page = 1,
      limit = 20,
    } = req.query;
    
    // Base query (tenant scope is enforced centrally via enforceTenantScope)
    const query = {};
    
    const requestedStatuses = Array.isArray(status)
      ? status.flatMap((value) => String(value).split(','))
      : (typeof status === 'string' ? status.split(',') : []);
    const normalizedStatuses = requestedStatuses.map((value) => value.trim()).filter(Boolean);

    if (normalizedStatuses.length === 1) {
      query.status = normalizedStatuses[0];
    } else if (normalizedStatuses.length > 1) {
      query.status = { $in: normalizedStatuses };
    }
    if (category) query.category = category;
    if (priority) query.priority = priority;
    
    // PR: xID Canonicalization - Use assignedToXID field
    // Reject email-based queries completely
    if (assignedTo) {
      const trimmedAssignedTo = assignedTo.trim();
      if (/^X\d{6}$/i.test(trimmedAssignedTo)) {
        query.assignedToXID = trimmedAssignedTo.toUpperCase();
      } else {
        // Reject email-based queries
        return res.status(400).json({
          success: false,
          message: 'Email-based assignedTo queries are not supported. Please use xID (format: X123456)',
        });
      }
    }
    
    // PR #44: Log warning if createdBy query is used (deprecated)
    if (createdBy) {
      if (!isProduction()) {
        console.warn(`[xID Guardrail] Email-based creator query detected: createdBy="${createdBy}"`);
        console.warn(`[xID Guardrail] This is deprecated. Please use createdByXID for ownership queries.`);
      }
      query.createdBy = createdBy.toLowerCase();
    }
    
    if (clientId) query.clientId = clientId;
    
    // Apply client access filter from middleware (restrictedClientIds)
    if (req.clientAccessFilter) {
      Object.assign(query, req.clientAccessFilter);
    }
    
    const scopedCaseQuery = enforceTenantScope(query, req, { source: 'case.getCases.list' });

    const cases = await Case.find(scopedCaseQuery)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    // Decrypt case documents
    // Note: CaseRepository.decryptDocs handles decryption and normalization
    const decryptedCases = await CaseRepository.decryptDocs(cases, req.user.firmId, { role: req.user.role });

    // Fetch client details for all cases in a single batch query to prevent N+1 queries
    // PR: Client Lifecycle - fetch clients regardless of status to display existing cases with inactive clients
    const uniqueClientIds = [...new Set(decryptedCases.map(c => c.clientId).filter(Boolean))];

    let clientsMap = new Map();
    if (uniqueClientIds.length > 0) {
      const clientDocs = await Client.find(enforceTenantScope({ clientId: { $in: uniqueClientIds } }, req, { source: 'case.getCases.clients' })).lean();

      if (clientDocs.length > 0) {
        const decryptedClients = await ClientRepository.decryptDocs(clientDocs, req.user.firmId, { role: req.user.role });
        decryptedClients.forEach(client => {
          if (client) {
            clientsMap.set(client.clientId, client);
          }
        });
      }
    }

    const casesWithClients = decryptedCases.map(caseItem => {
      const client = clientsMap.get(caseItem.clientId);
      return {
        ...caseItem,
        client: client ? {
          clientId: client.clientId,
          businessName: client.businessName,
          primaryContactNumber: client.primaryContactNumber,
          businessEmail: client.businessEmail,
          status: client.status,
          isActive: client.isActive,
        } : null,
      };
    });
    
    const total = await Case.countDocuments(scopedCaseQuery);
    
    // Log case list view for audit
    if (req.user?.xID) {
      // Determine if this is an admin viewing pending approvals
      const approvalStatuses = [
        CaseStatus.PENDING,
        CaseStatus.PENDING_LEGACY,
        CaseStatus.REVIEWED,
        CaseStatus.UNDER_REVIEW,
      ];
      const statusesForAudit = normalizedStatuses.length > 0 ? normalizedStatuses : (status ? [status] : []);
      const isPendingApprovalView = statusesForAudit.some((statusValue) => approvalStatuses.includes(statusValue));
      
      if (isPendingApprovalView && req.user.role === 'Admin') {
        // Log admin approval queue access
        await logAdminAction({
          adminXID: req.user.xID,
          actionType: 'ADMIN_APPROVAL_QUEUE_VIEWED',
          metadata: {
            filters: { status, category, priority, assignedTo, clientId },
            resultCount: casesWithClients.length,
            total,
          },
          req,
        });
      } else {
        // Log regular case list view
        await logCaseListViewed({
          viewerXID: req.user.xID,
          filters: { status, category, priority, assignedTo, clientId },
          listType: 'FILTERED_CASES',
          resultCount: casesWithClients.length,
          req,
        });
      }
    }
    
    res.json({
      success: true,
      cases: casesWithClients || [],
      data: casesWithClients,
      count: casesWithClients.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching cases',
      error: error.message,
    });
  }
};

/**
 * Lock a case
 * POST /api/cases/:caseId/lock
 * 
 * Implements soft locking with 2-hour inactivity auto-unlock
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const lockCaseEndpoint = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required',
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
    
    // Check if already locked by another user
    if (caseData.lockStatus.isLocked && 
        caseData.lockStatus.activeUserEmail !== userEmail.toLowerCase()) {
      
      // Check for inactivity auto-unlock
      const inactivityTimeout = CASE_LOCK_CONFIG.INACTIVITY_TIMEOUT_MS;
      const lastActivity = caseData.lockStatus.lastActivityAt || caseData.lockStatus.lockedAt;
      const now = new Date();
      
      if (lastActivity && (now - lastActivity) > inactivityTimeout) {
        // Auto-unlock due to inactivity
        console.log(`Auto-unlocking case ${caseId} due to ${CASE_LOCK_CONFIG.INACTIVITY_TIMEOUT_HOURS}-hour inactivity`);
        
        // Log the auto-unlock in history
        await CaseHistory.create({
          caseId,
          actionType: 'AutoUnlocked',
          description: `Docket auto-unlocked due to 2 hours of inactivity. Previous lock holder: ${caseData.lockStatus.activeUserEmail}`,
          performedBy: 'system',
        });
        
        // Fall through to acquire new lock below
      } else {
        // Still within 2-hour window, deny lock
        const lockerDisplay = caseData.lockStatus.activeUserDisplayName && caseData.lockStatus.activeUserXID
          ? `${caseData.lockStatus.activeUserDisplayName} (${caseData.lockStatus.activeUserXID})`
          : caseData.lockStatus.activeUserEmail;
        const docketRef = caseData.caseNumber || caseData.caseId || caseId;
        return res.status(409).json({
          success: false,
          message: `Docket ${docketRef} is locked by ${lockerDisplay}`,
          lockedBy: caseData.lockStatus.activeUserEmail,
          lockedByXID: caseData.lockStatus.activeUserXID,
          lockedByDisplayName: caseData.lockStatus.activeUserDisplayName,
          lockedAt: caseData.lockStatus.lockedAt,
          lastActivityAt: lastActivity,
        });
      }
    }
    
    // Lock the case — store rich user identity for display
    const now = new Date();
    const lockerDisplayName = req.user?.name ||
      [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ') ||
      req.user?.email ||
      userEmail;
    caseData.lockStatus = {
      isLocked: true,
      activeUserEmail: userEmail.toLowerCase(),
      activeUserXID: req.user?.xID || null,
      activeUserDisplayName: lockerDisplayName || null,
      lockedAt: now,
      lastActivityAt: now,
    };
    
    await caseData.save();
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case locked successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error locking case',
      error: error.message,
    });
  }
};

/**
 * Unlock a case
 * POST /api/cases/:caseId/unlock
 */
/**
 * Unlock a case
 * POST /api/cases/:caseId/unlock
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const unlockCaseEndpoint = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required',
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
    
    // Check if locked by this user
    if (caseData.lockStatus.isLocked && 
        caseData.lockStatus.activeUserEmail !== userEmail.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'You can only unlock cases that you have locked',
      });
    }
    
    // Unlock the case
    caseData.lockStatus = {
      isLocked: false,
      activeUserEmail: null,
      lockedAt: null,
      lastActivityAt: null,
    };
    
    await caseData.save();
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case unlocked successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unlocking case',
      error: error.message,
    });
  }
};

/**
 * Update case activity (heartbeat)
 * POST /api/cases/:caseId/activity
 * 
 * Updates lastActivityAt to prevent auto-unlock
 * PR: Case Identifier Semantics - Uses internal ID resolution
 */
const updateCaseActivity = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required',
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
    
    // Only update activity if locked by this user
    if (caseData.lockStatus.isLocked && 
        caseData.lockStatus.activeUserEmail === userEmail.toLowerCase()) {
      caseData.lockStatus.lastActivityAt = new Date();
      await caseData.save();
      
      res.json({
        success: true,
        message: 'Case activity updated',
        lastActivityAt: caseData.lockStatus.lastActivityAt,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Case is not locked by you',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating case activity',
      error: error.message,
    });
  }
};

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
const pullCases = async (req, res) => {
  try {
    const { caseIds, assignTo } = req.body;

    // Get authenticated user from req.user (set by auth middleware)
    const user = req.user;

    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user identity not found',
      });
    }

    // Reject if userEmail or userXID is in the payload
    if (req.body.userEmail || req.body.userXID) {
      return res.status(400).json({
        success: false,
        message: 'userEmail and userXID must not be provided in request body. User identity is obtained from authentication token.',
      });
    }

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'caseIds array is required and must not be empty',
      });
    }

    for (const caseId of caseIds) {
      console.log(`[CASE_PULL] ${user.xID} pulling case ${caseId}`);
    }

    let effectiveAssigneeXID = user.xID;
    let effectiveAssigneeUserId = user._id || null;
    if (assignTo) {
      if (!['ADMIN', 'Admin'].includes(user.role)) {
        return res.status(403).json({ success: false, message: 'Only admins can assign dockets to other employees.' });
      }
      const targetUser = await User.findOne({ _id: assignTo, firmId: req.user.firmId, role: { $in: ['Employee', 'ADMIN', 'Admin'] } }).select('_id xID');
      if (!targetUser?.xID) {
        return res.status(404).json({ success: false, message: 'Selected employee not found for assignment.' });
      }
      effectiveAssigneeXID = targetUser.xID;
      effectiveAssigneeUserId = targetUser._id;
    }

    console.log('[USER_DEBUG]', req.user);

    const normalizedUserContext = {
      ...(typeof user?.toObject === 'function' ? user.toObject() : user),
      xID: effectiveAssigneeXID,
      _id: effectiveAssigneeUserId,
      email: user.email,
      role: user.role,
      firmId: req.user.firmId,
    };

    // Use assignment service for canonical assignment logic
    const caseAssignmentService = require('../services/caseAssignment.service');
    const result = await caseAssignmentService.bulkAssignCasesToUser(
      req.user.firmId,
      caseIds,
      normalizedUserContext,
      user._id || null,
      getSession(req)
    );

    if (result.assigned === 0) {
      return res.status(409).json({
        success: false,
        message: 'No cases were pulled. All cases were already assigned to other users.',
        pulledCount: 0,
        cases: [],
      });
    }

    return res.status(200).json({
      success: true,
      pulledCount: result.assigned,
      cases: result.cases,
    });
  } catch (error) {
    // Handle specific errors
    if (error.message === 'Case not found') {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error pulling cases',
      error: error.message,
    });
  }
};

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
const unassignCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Get authenticated user from req.user (set by auth middleware)
    const user = req.user;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user identity not found',
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
    
    // Store previous assignment for audit log
    const previousAssignedToXID = caseData.assignedToXID;
    const previousStatus = caseData.status;
    const displayCaseId = caseData.caseId;
    
    // Prepare audit log entry (validate before mutating case)
    const auditEntry = {
      caseId: displayCaseId,
      actionType: CASE_ACTION_TYPES.CASE_MOVED_TO_WORKBASKET,
      description: `Case moved to Global Worklist by admin ${user.xID}${previousAssignedToXID ? ` (was assigned to ${previousAssignedToXID})` : ''}`,
      performedByXID: user.xID,
      metadata: {
        previousAssignedToXID,
        previousStatus,
        actionReason: 'Admin moved case to global worklist',
      },
    };
    
    // Validate audit entry can be created (this will throw if validation fails)
    const auditDoc = new CaseAudit(auditEntry);
    await auditDoc.validate();
    
    // Update case to move to global worklist through centralized status service
    await CaseService.updateStatus(displayCaseId, CaseStatus.UNASSIGNED, {
      tenantId: req.user.firmId,
      role: req.user.role,
      userId: user.xID,
      performedBy: user.email,
      actorRole: 'ADMIN',
      req,
      currentStatus: previousStatus,
      statusPatch: {
        assignedToXID: null,
        assignedTo: null,
        assignedBy: null,
        assignedAt: null,
      },
    });
    caseData = await CaseRepository.findByInternalId(req.user.firmId, caseData.caseInternalId, req.user.role);
    
    // Now create the audit log entry (validation already passed)
    await auditDoc.save();
    
    // Also add to CaseHistory with enhanced logging
    const { logCaseHistory } = require('../services/auditLog.service');
    const { CASE_ACTION_TYPES } = require('../config/constants');
    
    await logCaseHistory({
      caseId: displayCaseId,
      firmId: caseData.firmId,
      actionType: CASE_ACTION_TYPES.CASE_MOVED_TO_WORKBASKET,
      actionLabel: `Case moved to workbasket by ${user.name || user.xID}`,
      description: `Case moved to Global Worklist by admin ${user.xID}${previousAssignedToXID ? ` (was assigned to ${previousAssignedToXID})` : ''}`,
      performedBy: user.email,
      performedByXID: user.xID,
      actorRole: 'ADMIN',
      metadata: {
        previousAssignedToXID,
        previousStatus,
        actionReason: 'Admin moved case to global worklist',
      },
      req,
    });
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case moved to Global Worklist successfully',
    });
  } catch (error) {
    console.error('[unassignCase] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error moving case to global worklist',
    });
  }
};


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
    
    // Check if file exists
    try {
      await fs.access(attachment.filePath);
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
      });
    }
    
    // Determine MIME type and sanitize filename
    const mimeType = getMimeType(attachment.fileName);
    const safeFilename = sanitizeFilename(attachment.fileName);
    
    // Set headers for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    
    // Send file
    res.sendFile(path.resolve(attachment.filePath));
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
    
    // Download from Google Drive if driveFileId exists, otherwise fallback to local file
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
    } else if (attachment.filePath) {
      // Legacy: Handle old attachments stored locally
      try {
        await fs.access(attachment.filePath);
        
        // Set headers for download
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        
        // Send file
        res.sendFile(path.resolve(attachment.filePath));
      } catch (err) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }
    } else {
      return res.status(404).json({
        success: false,
        message: 'File location not found',
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
    
    // Get client for this case
    const client = await Client.findOne({ 
      clientId: caseData.clientId,
      firmId: req.user.firmId 
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found for this case',
      });
    }
    
    // Check if client has fact sheet
    if (!client.clientFactSheet) {
      const attachments = await AttachmentRepository.findByClientSource(req.user.firmId, client.clientId, 'client_cfs');
      return res.json({
        success: true,
        data: {
          clientId: client.clientId,
          businessName: client.businessName,
          basicInfo: {
            clientName: client.businessName,
            PAN: client.PAN || '',
            CIN: client.CIN || '',
            GSTIN: client.GST || '',
            address: client.businessAddress || '',
            email: client.businessEmail || '',
            phone: client.primaryContactNumber || '',
          },
          description: '',
          notes: '',
          updatedAt: null,
          files: [],
          attachments: attachments.map((file) => ({
            fileId: file._id,
            fileName: file.fileName,
            mimeType: file.mimeType,
            uploadedAt: file.createdAt,
            size: file.size || 0,
          })),
          documents: [],
        },
        message: 'No fact sheet available for this client',
      });
    }
    
    // Return read-only fact sheet data (exclude internal file paths)
    const factSheetData = {
      clientId: client.clientId,
      businessName: client.businessName,
      basicInfo: client.clientFactSheet.basicInfo || {
        clientName: client.businessName,
        PAN: client.PAN || '',
        CIN: client.CIN || '',
        GSTIN: client.GST || '',
        address: client.businessAddress || '',
        email: client.businessEmail || '',
        phone: client.primaryContactNumber || '',
      },
      description: client.clientFactSheet.description || '',
      notes: client.clientFactSheet.notes || '',
      updatedAt: client.clientFactSheet.updatedAt || null,
      files: [],
      attachments: [],
      documents: (client.clientFactSheet.documents || []).map((doc) => ({
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        uploadedBy: doc.uploadedBy,
        uploadedAt: doc.uploadedAt,
      })),
    };

    const attachments = await AttachmentRepository.findByClientSource(req.user.firmId, client.clientId, 'client_cfs');
    factSheetData.attachments = attachments.map((file) => ({
      fileId: file._id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      uploadedAt: file.createdAt,
      size: file.size || 0,
    }));
    factSheetData.files = factSheetData.attachments;
    
    // Log audit event for viewing
    const { logFactSheetViewed } = require('../services/clientFactSheetAudit.service');
    await logFactSheetViewed({
      clientId: client.clientId,
      firmId: req.user.firmId,
      performedByXID: req.user.xID,
      caseId: caseData.caseId, // Use display caseId
      metadata: {
        fileCount: factSheetData.files.length,
      },
    });
    
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

const searchCases = async (req, res) => {
  try {
    assertFirmContext(req);
    const firmId = req.user.firmId;
    const query = (req.query.q || '').trim();

    if (!query) {
      return res.json({ success: true, data: [], count: 0 });
    }

    const filters = {
      firmId,
      $text: { $search: query },
    };
    if (req.clientAccessFilter) {
      Object.assign(filters, req.clientAccessFilter);
    }

    const results = await Case.aggregate([
      { $match: filters },
      { $addFields: { score: { $meta: 'textScore' } } },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: 50 },
    ], { role: req.user.role });

    return res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error searching cases',
      data: [],
      count: 0,
    });
  }
};


const getDocketSummaryPdf = async (req, res) => {
  try {
    const { caseId } = req.params;
    const caseData = await Case.findOne(enforceTenantScope({ caseId }, req, { source: 'case.getDocketSummaryPdf.case' })).lean();
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }

    const client = caseData.clientId
      ? await Client.findOne({ firmId: req.user.firmId, clientId: caseData.clientId }).lean()
      : null;
    const attachments = await Attachment.find(enforceTenantScope({ caseId }, req, { source: 'case.getDocketSummaryPdf.attachments' })).lean();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${caseId}-summary.pdf"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(18).text('Docket Summary');
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Docket ID: ${caseData.caseId}`);
    doc.text(`Docket details: ${caseData.caseName || '-'}`);
    doc.text(`Client information: ${client?.businessName || caseData.clientId || '-'}`);
    doc.text(`Category: ${caseData.category || '-'}`);
    doc.text(`Current stage: ${caseData.status || '-'}`);
    doc.text(`SLA: ${caseData.slaDueDate ? new Date(caseData.slaDueDate).toISOString() : '-'}`);
    doc.text(`Comments: ${(caseData.description || '').slice(0, 500) || '-'}`);
    doc.moveDown();
    doc.fontSize(13).text('Attachments list');
    attachments.forEach((a, i) => doc.fontSize(11).text(`${i + 1}. ${a.fileName || a.filename || 'Attachment'}`));
    doc.end();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error generating docket summary PDF' });
  }
};

module.exports = {
  createCase: wrapWriteHandler(createCase),
  addComment: wrapWriteHandler(addComment),
  addAttachment: wrapWriteHandler(addAttachment),
  cloneCase: wrapWriteHandler(cloneCase),
  unpendCase: wrapWriteHandler(unpendCase),
  updateCaseStatus: wrapWriteHandler(updateCaseStatus),
  getCaseByCaseId,
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
