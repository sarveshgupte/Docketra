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

  return {
    pullCases,
  };
};
