const log = require('../utils/log');
const Case = require('../models/Case.model');
const { canPullFromWorkbasket, canAssignFromWorkbasket } = require('./workbasketAuthorization.service');
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
        log.info(`[CASE_PULL] ${user.xID} pulling case ${caseId}`);
      }

      const docketRecords = await Case.find({ firmId: req.user.firmId, caseId: { $in: caseIds } })
        .select('caseId assignedToXID status state ownerTeamId workbasketId')
        .lean();
      if (docketRecords.length !== caseIds.length) {
        return res.status(404).json({ success: false, message: 'One or more dockets were not found.' });
      }

      const assigneeCandidate = assignTo
        ? await User.findOne({ _id: assignTo, firmId: req.user.firmId, isActive: true }).select('_id xID role teamId teamIds isActive').lean()
        : { _id: user._id, xID: user.xID, role: user.role, teamId: user.teamId, teamIds: user.teamIds, isActive: true };

      if (!assigneeCandidate?.xID) {
        return res.status(404).json({ success: false, message: 'Selected assignee not found.' });
      }

      for (const docket of docketRecords) {
        const allowed = assignTo
          ? canAssignFromWorkbasket({ actor: user, docket, assignee: assigneeCandidate })
          : canPullFromWorkbasket({ user, docket });
        if (!allowed) {
          return res.status(403).json({ success: false, message: `Not allowed to pull/assign docket ${docket.caseId}` });
        }
      }

      const effectiveAssigneeXID = assigneeCandidate.xID;
      const effectiveAssigneeUserId = assigneeCandidate._id || null;

      log.info('[USER_DEBUG]', req.user);

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
