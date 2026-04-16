const { sendSuccessResponse, sendErrorResponse, sendServiceResponse } = require('../utils/response.util');
const { validateRequiredFields } = require('../utils/validation.util');
const { mapErrorToServiceResponse } = require('../utils/error.util');

module.exports = (deps) => {
  const {
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
  } = deps;

  const findCaseByIdentifierOrSendNotFound = async (req, res, caseId) => {
    try {
      const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
      const caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);
      if (!caseData) {
        sendErrorResponse(res, { statusCode: 404, message: 'Case not found' });
        return null;
      }
      return caseData;
    } catch (error) {
      sendErrorResponse(res, { statusCode: 404, message: 'Case not found' });
      return null;
    }
  };

  const unpendCase = async (req, res) => {
    try {
      const { caseId } = req.params;
      const { comment } = req.body;
      
      // Validate user authentication
      if (!req.user || !req.user.xID) {
        return sendErrorResponse(res, { statusCode: 401, message: 'Authentication required' });
      }
      
      // Call service to unpend case - with firm scoping
      const caseData = await caseActionService.unpendCase(req.user.firmId, caseId, comment, req.user, req);
      
      return sendSuccessResponse(res, {
        body: {
          data: caseData,
          message: 'Case unpended successfully',
        },
      });
    } catch (error) {
      const serviceResponse = mapErrorToServiceResponse(error, {
        mappings: [
          {
            matches: (err) => err?.message === 'Comment is mandatory for this action',
            result: (err) => ({ status: 400, body: { success: false, message: err.message } }),
          },
          {
            matches: (err) => err?.message === 'Case not found',
            result: (err) => ({ status: 404, body: { success: false, message: err.message } }),
          },
          {
            matches: (err) => err?.message === 'Permission denied',
            result: (err) => ({ status: 403, body: { success: false, message: err.message } }),
          },
          {
            matches: (err) => err?.message?.startsWith('Cannot change case from') || err?.message === 'Invalid lifecycle transition',
            result: (err) => ({ status: 400, body: { success: false, message: err.message } }),
          },
        ],
        fallback: (err) => ({
          status: 500,
          body: {
            success: false,
            message: 'Error unpending case',
            error: err?.message,
          },
        }),
      });
      return sendServiceResponse(res, serviceResponse);
    }
  };

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
      if (!validateRequiredFields({ status }, ['status']).isValid) {
        return sendErrorResponse(res, { statusCode: 400, message: 'Status is required' });
      }
      
      if (!validateRequiredFields({ performedBy }, ['performedBy']).isValid) {
        return sendErrorResponse(res, { statusCode: 400, message: 'Performed by email is required' });
      }
      
      // PR: Case Identifier Semantics - Resolve identifier to internal ID
      let caseData = await findCaseByIdentifierOrSendNotFound(req, res, caseId);
      if (!caseData) return;
      
      const normalizedStatus = String(status || '').toUpperCase();
      const docketStatuses = new Set(['OPEN', 'PENDING', 'RESOLVED', 'FILED']);

      if (normalizedStatus === 'PENDING' && !reason) {
         return sendErrorResponse(res, { statusCode: 400, message: 'pendingReason is required when status is PENDING' });
       }

      if (docketStatuses.has(String(caseData.status || '').toUpperCase()) && docketStatuses.has(normalizedStatus)) {
        if (!isValidTransition(
          toLifecycleFromStatus(caseData.status),
          toLifecycleFromStatus(normalizedStatus),
        )) {
           return sendErrorResponse(res, { statusCode: 400, message: 'Invalid transition' });
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

      logActivitySafe({
        docketId: caseData.caseInternalId,
        firmId: req.user.firmId,
        type: 'STATUS_CHANGED',
        description: `Status changed to ${normalizedStatus}`,
        metadata: { status: normalizedStatus },
        performedByXID: req.user?.xID,
      });

      const statusRecipients = new Set([
        caseData?.assignedToXID,
        caseData?.createdByXID,
      ].filter(Boolean).map((id) => String(id).toUpperCase()));
      statusRecipients.delete(String(req.user?.xID || '').toUpperCase());

      await Promise.all(
        [...statusRecipients].map((recipient) => createNotification({
          firmId: req.user.firmId,
          userId: recipient,
          type: NotificationTypes.STATUS_CHANGED,
          docketId: caseData.caseId,
          actor: { xID: req.user.xID, role: req.user.role },
          title: 'Docket status changed',
          message: `${req.user.name || req.user.xID} changed docket ${caseData.caseId} to ${normalizedStatus}.`,
        })),
      );
      
      return sendSuccessResponse(res, {
        body: {
          data: caseData,
          message: 'Case status updated successfully',
        },
      });
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      return sendErrorResponse(res, {
        statusCode,
        message: 'Error updating case status',
        error: error.message,
      });
    }
  };

  const lockCaseEndpoint = async (req, res) => {
    try {
      const { caseId } = req.params;
      const { userEmail } = req.body;
      
      if (!validateRequiredFields({ userEmail }, ['userEmail']).isValid) {
        return sendErrorResponse(res, { statusCode: 400, message: 'User email is required' });
      }
      
      // PR: Case Identifier Semantics - Resolve identifier to internal ID
      let caseData = await findCaseByIdentifierOrSendNotFound(req, res, caseId);
      if (!caseData) return;
      
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
      
      return sendSuccessResponse(res, {
        body: {
          data: caseData,
          message: 'Case locked successfully',
        },
      });
    } catch (error) {
      return sendErrorResponse(res, {
        statusCode: 500,
        message: 'Error locking case',
        error: error.message,
      });
    }
  };

  const unlockCaseEndpoint = async (req, res) => {
    try {
      const { caseId } = req.params;
      const { userEmail } = req.body;
      
      if (!validateRequiredFields({ userEmail }, ['userEmail']).isValid) {
        return sendErrorResponse(res, { statusCode: 400, message: 'User email is required' });
      }
      
      // PR: Case Identifier Semantics - Resolve identifier to internal ID
      let caseData = await findCaseByIdentifierOrSendNotFound(req, res, caseId);
      if (!caseData) return;
      
      // Check if locked by this user
      if (caseData.lockStatus.isLocked && 
          caseData.lockStatus.activeUserEmail !== userEmail.toLowerCase()) {
        return sendErrorResponse(res, { statusCode: 403, message: 'You can only unlock cases that you have locked' });
      }
      
      // Unlock the case
      caseData.lockStatus = {
        isLocked: false,
        activeUserEmail: null,
        lockedAt: null,
        lastActivityAt: null,
      };
      
      await caseData.save();
      
      return sendSuccessResponse(res, {
        body: {
          data: caseData,
          message: 'Case unlocked successfully',
        },
      });
    } catch (error) {
      return sendErrorResponse(res, {
        statusCode: 500,
        message: 'Error unlocking case',
        error: error.message,
      });
    }
  };

  const unassignCase = async (req, res) => {
    try {
      const { caseId } = req.params;
      
      // Get authenticated user from req.user (set by auth middleware)
      const user = req.user;
      
      if (!user || !user.xID) {
        return sendErrorResponse(res, { statusCode: 401, message: 'Authentication required - user identity not found' });
      }
      
      // PR: Case Identifier Semantics - Resolve identifier to internal ID
      let caseData = await findCaseByIdentifierOrSendNotFound(req, res, caseId);
      if (!caseData) return;

      const lockStatus = caseData.lockStatus || {};
      const lockOwnerXID = String(lockStatus.activeUserXID || '').trim().toUpperCase();
      const actorXID = String(user.xID || '').trim().toUpperCase();
      const lockTs = new Date(lockStatus.lastActivityAt || lockStatus.lockedAt || 0).getTime();
      const isActiveLock = Boolean(lockStatus.isLocked)
        && Number.isFinite(lockTs)
        && lockTs > 0
        && (Date.now() - lockTs) < CASE_LOCK_CONFIG.INACTIVITY_TIMEOUT_MS;
      if (isActiveLock && lockOwnerXID && lockOwnerXID !== actorXID) {
        const lockOwnerLabel = lockStatus.activeUserDisplayName && lockOwnerXID
          ? `${lockStatus.activeUserDisplayName} (${lockOwnerXID})`
          : lockOwnerXID;
        return res.status(409).json({
          success: false,
          message: `Docket is locked by ${lockOwnerLabel || 'another user'}. Ask them to exit or close the docket before moving it.`,
          code: 'DOCKET_LOCKED_ACTIVE',
          lockStatus: {
            activeUserXID: lockOwnerXID || null,
            activeUserDisplayName: lockStatus.activeUserDisplayName || null,
            lastActivityAt: lockStatus.lastActivityAt || lockStatus.lockedAt || null,
          },
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
          queueType: 'GLOBAL',
          lifecycle: DocketLifecycle.CREATED,
        },
      });
      caseData = await CaseRepository.findByInternalId(req.user.firmId, caseData.caseInternalId, req.user.role);

      const statusAfterUnassign = CaseStatus.UNASSIGNED;

      logActivitySafe({
        docketId: caseData.caseInternalId,
        firmId: req.user.firmId,
        type: 'STATUS_CHANGED',
        description: `Status changed to ${statusAfterUnassign}`,
        metadata: { status: statusAfterUnassign },
        performedByXID: req.user?.xID,
      });
      
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
      
       return sendSuccessResponse(res, {
         body: {
           data: caseData,
           message: 'Case moved to Global Worklist successfully',
         },
       });
     } catch (error) {
       console.error('[unassignCase] Error:', error);
       return sendErrorResponse(res, {
         statusCode: 500,
         message: 'Error moving case to global worklist',
       });
     }
   };

  return {
    unpendCase,
    updateCaseStatus,
    lockCaseEndpoint,
    unlockCaseEndpoint,
    unassignCase,
  };
};
