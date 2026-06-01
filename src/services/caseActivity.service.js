const { buildWorkflowMeta, logWorkflowEvent } = require('../utils/workflowDiagnostics');
const commentHistoryNarrativeStorage = require('./commentHistoryNarrativeStorage.service');
const { logCaseHistory } = require('./auditLog.service');
const log = require('../utils/log');
const CLOUD_NARRATIVE_TIMEOUT_MS = 1800;
const DEFAULT_RUNTIME_TENANT = 'default-client-runtime-tenant';

const withTimeout = (promise, timeoutMs, label) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  }),
]);

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
  const resolveTenantFirmId = (req) => {
    const routeFirmId = req?.firmId;
    if (routeFirmId && routeFirmId !== DEFAULT_RUNTIME_TENANT) return routeFirmId;
    return req?.user?.firmId || routeFirmId;
  };
  const resolveTenantFirmCandidates = (req) => {
    const routeFirmId = req?.firmId ? String(req.firmId) : null;
    const userFirmId = req?.user?.firmId ? String(req.user.firmId) : null;
    const candidates = [routeFirmId, userFirmId].filter(Boolean);
    const filtered = candidates.filter((value) => value !== DEFAULT_RUNTIME_TENANT);
    return [...new Set(filtered.length ? filtered : candidates)];
  };

  const addComment = async (req, res) => {
    const startedAt = Date.now();
    const { caseId } = req.params;
    const tenantFirmId = resolveTenantFirmId(req);
    const tenantFirmCandidates = resolveTenantFirmCandidates(req);
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

      if (!tenantFirmId || tenantFirmCandidates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Firm context is required',
        });
      }
      
      // PR: Case Identifier Semantics - Resolve identifier to internal ID
      // This handles both ObjectId and CASE-YYYYMMDD-XXXXX formats
      let resolvedFirmId = tenantFirmId;
      let lastResolutionError = null;
      for (const candidateFirmId of tenantFirmCandidates) {
        try {
          const internalId = await resolveCaseIdentifier(candidateFirmId, caseId, req.user.role);
          caseData = await CaseRepository.findByInternalId(candidateFirmId, internalId, req.user.role);
          if (caseData) {
            resolvedFirmId = candidateFirmId;
            break;
          }
        } catch (error) {
          lastResolutionError = error;
        }
      }
      if (!caseData && lastResolutionError && !lastResolutionError.message) {
        lastResolutionError.message = 'Case not found during identifier resolution';
      }
      
      if (!caseData) {
        throw new Error('Case not found');
      }
      const effectiveFirmId = String(caseData.firmId || resolvedFirmId);
      req.firmId = effectiveFirmId;
      
      // PR #45: Allow comments in view mode - no assignment/ownership check
      // Only check if case is locked by someone else - use authenticated user for security
      if (caseData.lockStatus?.isLocked && 
          caseData.lockStatus.activeUserEmail !== req.user.email.toLowerCase()) {
        throw new Error(`Case is locked by ${caseData.lockStatus.activeUserEmail}`);
      }
      
      // Create comment - use caseId from database (caseNumber for display)
      let commentRef = null;
      let storageMode = 'local_fallback';
      try {
        commentRef = await withTimeout(
          commentHistoryNarrativeStorage.uploadComment({
            firmId: effectiveFirmId,
            docketId: caseData.caseId,
            commentId: String(randomUUID()),
            payload: { text, note: note || null },
          }),
          CLOUD_NARRATIVE_TIMEOUT_MS,
          'comment narrative upload'
        );
        storageMode = 'cloud_first';
      } catch (uploadError) {
        log.warn(`[ADD_COMMENT] Cloud-first comment narrative storage failed to upload: ${uploadError.message}. Falling back to local MongoDB storage.`);
      }

      const commentPayload = {
        caseId: caseData.caseId,
        firmId: effectiveFirmId,
        text,
        createdBy: req.user.email.toLowerCase(),
        createdByXID: req.user.xID,
        createdByName: req.user.name,
        note,
        storageMode,
      };

      if (commentRef) {
        commentPayload.commentRef = {
          provider: commentRef.provider,
          mode: commentRef.mode,
          fileId: commentRef.fileId || null,
          objectKey: commentRef.objectKey,
          checksum: commentRef.checksum || null,
          version: 1,
          updatedAt: new Date(),
          updatedBy: req.user.xID,
        };
      }

      const comment = await Comment.create(commentPayload);
      
      // PR #45: Add CaseAudit entry with xID attribution
      // Sanitize comment text for logging to prevent log injection
      const sanitizedText = sanitizeForLog(text, COMMENT_PREVIEW_LENGTH);
      await CaseAudit.create({
        caseId: caseData.caseId,
        firmId: effectiveFirmId,
        actionType: 'CASE_COMMENT_ADDED',
        description: `Comment added by ${req.user.xID}: ${sanitizedText}${text.length > COMMENT_PREVIEW_LENGTH ? '...' : ''}`,
        performedByXID: req.user.xID,
        metadata: {
          commentLength: text.length,
          hasNote: !!note,
        },
      });
      
      // Also add to CaseHistory via unified logger
      await logCaseHistory({
        caseId: caseData.caseId,
        firmId: effectiveFirmId,
        actionType: 'CASE_COMMENT_ADDED',
        actionLabel: `Comment added by ${req.user.email}`,
        description: `Comment added by ${req.user.email}: ${text.substring(0, COMMENT_PREVIEW_LENGTH)}${text.length > COMMENT_PREVIEW_LENGTH ? '...' : ''}`,
        performedBy: req.user.email.toLowerCase(),
        performedByXID: req.user.xID.toUpperCase(),
        actorRole: req.user.role || 'USER',
        metadata: {
          commentLength: text.length,
          hasNote: !!note,
        },
        req
      });

      logActivitySafe({
        docketId: caseData.caseInternalId,
        firmId: effectiveFirmId,
        type: 'COMMENT_ADDED',
        description: `Comment added`,
        performedByXID: req.user?.xID,
      });

      // Parse mentions from the comment text
      const mentionedXIDs = new Set();
      if (text) {
        // 1. Match `@Name (xID)` pattern (e.g. `@John Doe (JOHN_DOE)`)
        const parenthesizedRegex = /@(?:[^(]+?)\s*\(([^)]+)\)/g;
        let match;
        while ((match = parenthesizedRegex.exec(text)) !== null) {
          if (match[1]) mentionedXIDs.add(match[1].trim().toUpperCase());
        }
        
        // 2. Match simple `@xID` pattern (e.g. `@JOHN_DOE`)
        const simpleRegex = /@([a-zA-Z0-9_-]+)/g;
        while ((match = simpleRegex.exec(text)) !== null) {
          if (match[1]) mentionedXIDs.add(match[1].trim().toUpperCase());
        }
      }

      // Query database to ensure mentioned xIDs correspond to real active users in the firm
      const validatedMentions = mentionedXIDs.size > 0
        ? await User.find({
            firmId: effectiveFirmId,
            xID: { $in: [...mentionedXIDs] },
            status: { $ne: 'deleted' },
          }).select('xID name').lean()
        : [];
      
      const validatedMentionedXIDs = new Set(validatedMentions.map(u => String(u.xID).toUpperCase()));

      // Construct distinct lists to avoid duplicate spamming
      const participantXIDs = new Set();
      if (caseData.assignedToXID) participantXIDs.add(String(caseData.assignedToXID).toUpperCase());
      if (caseData.createdByXID) participantXIDs.add(String(caseData.createdByXID).toUpperCase());
      const commenterXIDs = await Comment.distinct('createdByXID', {
        caseId: caseData.caseId,
        firmId: effectiveFirmId,
      });
      commenterXIDs.forEach((xid) => {
        if (xid) participantXIDs.add(String(xid).toUpperCase());
      });

      // Remove self and mentioned users from generic comment notification
      participantXIDs.delete(String(req.user.xID || '').toUpperCase());
      validatedMentionedXIDs.forEach((xid) => participantXIDs.delete(xid));

      // Trigger notifications
      await Promise.all([
        // 1. Mentions Notifications (Targeted message)
        ...[...validatedMentionedXIDs].map((mentionXID) => createNotification({
          firmId: effectiveFirmId,
          userId: mentionXID,
          type: NotificationTypes.COMMENT_ADDED,
          docketId: caseData.caseId,
          actor: { xID: req.user.xID, role: req.user.role },
          title: 'Mentioned in comment',
          message: `${req.user.name || req.user.xID} tagged you in a comment on docket ${caseData.caseId}.`,
        })),
        // 2. Generic Comments Notifications (Rest of active participants)
        ...[...participantXIDs].map((participantXID) => createNotification({
          firmId: effectiveFirmId,
          userId: participantXID,
          type: NotificationTypes.COMMENT_ADDED,
          docketId: caseData.caseId,
          actor: { xID: req.user.xID, role: req.user.role },
          title: 'Comment added',
          message: `${req.user.name || req.user.xID} commented on docket ${caseData.caseId}.`,
        })),
      ]);
      
      const comments = await Comment.find(
        enforceTenantScope({ caseId: caseData.caseId }, req, { source: 'case.addComment.comments' })
      )
        .select('_id caseId text note createdBy createdByXID createdByName createdAt')
        .sort({ createdAt: 1 })
        .lean();

      res.status(201).json({
        success: true,
        data: {
          comment,
          comments,
        },
        message: 'Comment added successfully',
      });
      logWorkflowEvent('DOCKET_COMMENT_MUTATION', buildWorkflowMeta({
        req,
        workflow: 'docket_comment_add',
        entity: { caseId: caseData.caseId },
        durationMs: Date.now() - startedAt,
        outcome: 'success',
      }));
    } catch (error) {
      logWorkflowEvent('DOCKET_COMMENT_MUTATION', buildWorkflowMeta({
        req,
        workflow: 'docket_comment_add',
        entity: { caseId: caseData?.caseId || req.params?.caseId || null },
        durationMs: Date.now() - startedAt,
        outcome: 'failed',
        error,
      }));
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

  const getCaseComments = async (req, res) => {
    try {
      const { caseId } = req.params;
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
      const skip = (page - 1) * limit;
      const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
      const caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);
      if (!caseData) {
        return res.status(404).json({ success: false, message: 'Case not found' });
      }

      const scopedQuery = enforceTenantScope({ caseId: caseData.caseId }, req, { source: 'case.getCaseComments' });
      const [comments, total] = await Promise.all([
        Comment.find(scopedQuery)
          .select('_id caseId text note createdBy createdByXID createdByName createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Comment.countDocuments(scopedQuery),
      ]);

      return res.status(200).json({
        success: true,
        data: comments.reverse(),
        pagination: {
          page,
          limit,
          totalCount: total,
          hasMore: skip + comments.length < total,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to load comments', error: error.message });
    }
  };

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

  return {
    addComment,
    getCaseComments,
    updateCaseActivity,
  };
};
