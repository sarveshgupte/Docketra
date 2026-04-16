const log = require('../utils/log');

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
    docketAuditService,
  } = deps;

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
      
      if (error.message === 'Permission denied') {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.startsWith('Cannot change case from') || error.message === 'Invalid lifecycle transition') {
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

  const updateCaseStatus = async (req, res) => {
    try {
      log.info('CASE_UPDATE_SERVICE_START', {
        req,
        caseId: req.params?.caseId || null,
        tenantId: req.user?.firmId || null,
      });
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
        if (!isValidTransition(
          toLifecycleFromStatus(caseData.status),
          toLifecycleFromStatus(normalizedStatus),
        )) {
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
      log.info('CASE_UPDATED', {
        req,
        tenantId: req.user?.firmId || null,
        caseId: caseData.caseId,
        status: normalizedStatus,
        userXID: req.user?.xID || null,
      });
      
      res.json({
        success: true,
        data: caseData,
        message: 'Case status updated successfully',
      });
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      log.error('CASE_UPDATE_FAILED', { req, caseId: req.params?.caseId || null, error });
      res.status(statusCode).json({
        success: false,
        message: 'Error updating case status',
        error: error.message,
      });
    }
  };

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
          log.info('CASE_AUTO_UNLOCKED', {
            req,
            tenantId: req.user?.firmId || null,
            caseId,
            inactivityHours: CASE_LOCK_CONFIG.INACTIVITY_TIMEOUT_HOURS,
          });
          
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
      const previousLockSnapshot = {
        isLocked: Boolean(caseData.lockStatus?.isLocked),
        activeUserEmail: caseData.lockStatus?.activeUserEmail || null,
        activeUserXID: caseData.lockStatus?.activeUserXID || null,
      };
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

      await docketAuditService.logUpdate({
        firmId: req.user.firmId,
        docketId: caseData.caseId,
        performedBy: req.user?.xID || userEmail,
        performedByRole: req.user?.role,
        action: 'LOCK_UPDATED',
        before: {
          status: caseData.status,
          ...previousLockSnapshot,
        },
        after: {
          status: caseData.status,
          isLocked: true,
          activeUserEmail: userEmail.toLowerCase(),
          activeUserXID: req.user?.xID || null,
        },
        fields: ['isLocked', 'activeUserEmail', 'activeUserXID'],
        metadata: {
          source: 'caseUpdate.service.lockCaseEndpoint',
        },
      });
      
      res.json({
        success: true,
        data: caseData,
        message: 'Case locked successfully',
      });
    } catch (error) {
      log.error('CASE_LOCK_FAILED', { req, caseId: req.params?.caseId || null, error });
      res.status(500).json({
        success: false,
        message: 'Error locking case',
        error: error.message,
      });
    }
  };

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
      const previousLockSnapshot = {
        isLocked: Boolean(caseData.lockStatus?.isLocked),
        activeUserEmail: caseData.lockStatus?.activeUserEmail || null,
        activeUserXID: caseData.lockStatus?.activeUserXID || null,
      };
      caseData.lockStatus = {
        isLocked: false,
        activeUserEmail: null,
        lockedAt: null,
        lastActivityAt: null,
      };
      
      await caseData.save();

      await docketAuditService.logUpdate({
        firmId: req.user.firmId,
        docketId: caseData.caseId,
        performedBy: req.user?.xID || userEmail,
        performedByRole: req.user?.role,
        action: 'LOCK_UPDATED',
        before: {
          status: caseData.status,
          ...previousLockSnapshot,
        },
        after: {
          status: caseData.status,
          isLocked: false,
          activeUserEmail: null,
          activeUserXID: null,
        },
        fields: ['isLocked', 'activeUserEmail', 'activeUserXID'],
        metadata: {
          source: 'caseUpdate.service.unlockCaseEndpoint',
        },
      });
      
      res.json({
        success: true,
        data: caseData,
        message: 'Case unlocked successfully',
      });
    } catch (error) {
      log.error('CASE_UNLOCK_FAILED', { req, caseId: req.params?.caseId || null, error });
      res.status(500).json({
        success: false,
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

      await docketAuditService.logAssignment({
        firmId: req.user.firmId,
        docketId: displayCaseId,
        performedBy: user.xID,
        performedByRole: user.role,
        fromAssignee: previousAssignedToXID || null,
        toAssignee: null,
        fromStatus: previousStatus || null,
        toStatus: statusAfterUnassign,
        action: 'UNASSIGNED',
        metadata: {
          source: 'caseUpdate.service.unassignCase',
          actionReason: 'Admin moved case to global worklist',
        },
      });

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
      
      res.json({
        success: true,
        data: caseData,
        message: 'Case moved to Global Worklist successfully',
      });
    } catch (error) {
      log.error('CASE_UNASSIGN_FAILED', { req, caseId: req.params?.caseId || null, error });
      res.status(500).json({
        success: false,
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
