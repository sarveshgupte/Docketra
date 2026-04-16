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

      logActivitySafe({
        docketId: caseData.caseInternalId,
        firmId: tenantFirmId,
        type: 'COMMENT_ADDED',
        description: `Comment added`,
        performedByXID: req.user?.xID,
      });

      const participantXIDs = new Set();
      if (caseData.assignedToXID) participantXIDs.add(String(caseData.assignedToXID).toUpperCase());
      if (caseData.createdByXID) participantXIDs.add(String(caseData.createdByXID).toUpperCase());
      const commenterXIDs = await Comment.distinct('createdByXID', {
        caseId: caseData.caseId,
        firmId: tenantFirmId,
      });
      commenterXIDs.forEach((xid) => {
        if (xid) participantXIDs.add(String(xid).toUpperCase());
      });
      participantXIDs.delete(String(req.user.xID || '').toUpperCase());

      await Promise.all(
        [...participantXIDs].map((participantXID) => createNotification({
          firmId: tenantFirmId,
          userId: participantXID,
          type: NotificationTypes.COMMENT_ADDED,
          docketId: caseData.caseId,
          actor: { xID: req.user.xID, role: req.user.role },
          title: 'Comment added',
          message: `${req.user.name || req.user.xID} commented on docket ${caseData.caseId}.`,
        })),
      );
      
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
