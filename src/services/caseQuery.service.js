const log = require('../utils/log');
const { buildWorkflowMeta, logWorkflowEvent } = require('../utils/workflowDiagnostics');
const { applyWorkModeFilter, normalizeWorkMode } = require('../utils/workType');
const CASE_LIST_PROJECTION = 'caseId caseNumber caseName title status category subcategory caseSubCategory priority clientId clientName assignedTo assignedToXID assignedToName createdBy createdByXID createdAt updatedAt dueDate slaDueAt isInternal workType lifecycle state pendingUntil ownerTeamId routedToTeamId';
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

  const getCaseByCaseId = async (req, res) => {
    const requestId = req.id || req.requestId || randomUUID().slice(0, 8);
    const getCaseTimerLabel = `[GET_CASE:${requestId}]`;
    const startedAt = Date.now();
    try {
      console.time(getCaseTimerLabel);
      log.info('STEP 1 start');
      const { caseId } = req.params;
      
      // PR: Fix Case Visibility - Enhanced logging for debugging
      log.info(`[GET_CASE] Attempting to fetch case: caseId=${caseId}, firmId=${req.user.firmId}, userXID=${req.user.xID}`);
      
      // Prefer repository-backed lookup for docket deep-links so encrypted fields
      // are decrypted before reaching the UI. Fallback to identifier resolution
      // for backward compatibility with internal IDs.
      // Refactor: Use MongoDB aggregation with $lookup to join client data in a single query
      let caseData = null;
      try {
        caseData = await loadCaseRecordCoalesced({
          firmId: req.user.firmId,
          caseId,
          role: req.user.role,
        });
      } catch (error) {
        log.error(`[GET_CASE] Case not found or identifier resolution failed: caseId=${caseId}, error=${error.message}`);
        return res.status(404).json({
          success: false,
          message: 'Case not found',
        });
      }
      
      if (!caseData) {
        log.error(`[GET_CASE] Case not found in database: caseId=${caseId}, firmId=${req.user.firmId}`);
        return res.status(404).json({
          success: false,
          message: 'Case not found',
        });
      }
      
      log.info(`[GET_CASE] Case found: caseInternalId=${caseData.caseInternalId}, caseNumber=${caseData.caseNumber}, caseId=${caseData.caseId}`);
      
      // Step 2: Apply authorization AFTER fetch
      // Allow access if user is:
      // - Admin or SuperAdmin
      // - Case creator (createdByXID matches user xID)
      // - Assigned employee (assignedToXID matches user xID)
      if (!checkCaseAccess(caseData, req.user)) {
        log.error(`[GET_CASE] Access denied: userXID=${req.user.xID}, createdByXID=${caseData.createdByXID}, assignedToXID=${caseData.assignedToXID}, role=${req.user.role}`);
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to view this case',
          code: 'CASE_ACCESS_DENIED',
        });
      }
      
      log.info(`[GET_CASE] Authorization passed for userXID=${req.user.xID}`);

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
        ], { role: req.user.role, maxTimeMS: 8000 });
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
          .maxTimeMS(8000)
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
        log.error('[GET_CASE] Related data load failed', {
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
          }).select('xID name').maxTimeMS(8000).lean();
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
      let client = caseData.client || null;
      if (!client && caseData.clientId) {
        try {
          client = await ClientRepository.findByClientId(scopedFirmId, caseData.clientId, req.user.role);
        } catch (error) {
          log.warn('[GET_CASE] Failed to load fallback client', {
            caseId: displayCaseId,
            clientId: caseData.clientId,
            message: error?.message,
          });
        }
      }
      
      // PR #45: Require authenticated user with xID for audit logging
      if (!req.user?.email || !req.user?.xID) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }
      
      // PR #44: Runtime assertion - warn if xID is missing from auth context
      if (!req.user.xID && !isProduction()) {
        log.warn(`[xID Guardrail] Case accessed without xID in auth context`);
        log.warn(`[xID Guardrail] Case: ${displayCaseId}, User email: ${req.user.email}`);
        log.warn(`[xID Guardrail] This should not happen - auth middleware should always provide xID`);
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
      enforceDocketLifecycleDefault(caseObject);
      caseObject.updatedAt = caseObject.updatedAt || new Date();

      let assignedUser = null;
      if (caseObject.assignedTo) {
        assignedUser = await User.findOne({ _id: caseObject.assignedTo, firmId: scopedFirmId })
          .select('_id name email xID')
          .maxTimeMS(8000)
          .lean();
      } else if (caseObject.assignedToXID) {
        assignedUser = await User.findOne({ xID: caseObject.assignedToXID, firmId: scopedFirmId })
          .select('_id name email xID')
          .maxTimeMS(8000)
          .lean();
      }
      log.info('STEP 2 after assignedUser');
      const canonicalAssignmentXID = caseObject.assignedToXID || assignedUser?.xID || null;
      const lifecycle = normalizeLifecycle(caseObject.lifecycle);
      const [ownerTeam, routedTeam, docketInvoices] = await Promise.all([
        caseObject.ownerTeamId
          ? Team.findOne({ _id: caseObject.ownerTeamId, firmId: scopedFirmId }).select('_id name').maxTimeMS(8000).lean()
          : null,
        caseObject.routedToTeamId
          ? Team.findOne({ _id: caseObject.routedToTeamId, firmId: scopedFirmId }).select('_id name').maxTimeMS(8000).lean()
          : null,
        Invoice.find(
          { firmId: scopedFirmId, docketId: caseData._id },
          { amount: 1, status: 1, issuedAt: 1, paidAt: 1, clientId: 1, dealId: 1, createdAt: 1 }
        ).sort({ createdAt: -1 }).maxTimeMS(8000).lean(),
      ]);

      log.info('DOCKET_STATE_DEBUG', {
        caseId: displayCaseId,
        lifecycle,
        assignedTo: canonicalAssignmentXID,
        responseSource: 'GET /api/cases/:id',
        timestamp: new Date().toISOString(),
      });

      // Prevent client/proxy caching and conditional GET short-circuit (304) for
      // dynamic docket detail payloads.
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
      });
      res.removeHeader('ETag');

      log.info('STEP 3 before response');
      const payload = {
        success: true,
        data: {
          ...caseObject,
          lifecycle,
          slaDueDate: caseObject.slaDueAt || null,
          slaStatus: slaService.getSlaStatus(caseObject),
          assignedToXID: canonicalAssignmentXID,
          assignedToName: assignedUser?.name || caseObject.assignedToName || null,
          assignedTo: assignedUser ? {
            _id: assignedUser._id,
            name: assignedUser.name,
            email: assignedUser.email,
            xID: assignedUser.xID,
          } : (canonicalAssignmentXID ? {
            _id: null,
            name: caseObject.assignedToName || canonicalAssignmentXID || 'Unknown',
            email: null,
            xID: canonicalAssignmentXID,
          } : (caseObject.assignedTo || caseObject.assignedToXID || caseObject.assignedToName ? {
            _id: null,
            name: 'Unknown',
            email: null,
            xID: null,
          } : null)),
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
          ownerTeamName: ownerTeam?.name || null,
          routedToTeamName: routedTeam?.name || null,
          invoices: docketInvoices,
          accessMode: {
            isViewOnlyMode,
            isOwner,
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
      };

      const response = res.status(200).json(payload);
      logWorkflowEvent('DOCKET_DETAIL_LOAD', buildWorkflowMeta({
        req,
        workflow: 'docket_detail_load',
        entity: { caseId: caseData.caseId },
        durationMs: Date.now() - startedAt,
        outcome: 'success',
      }));
      log.info('RESPONSE SENT');
      return response;
    } catch (error) {
      log.error('[GET_CASE] Unexpected error:', error);
      logWorkflowEvent('DOCKET_DETAIL_LOAD', buildWorkflowMeta({
        req,
        workflow: 'docket_detail_load',
        entity: { caseId: req.params?.caseId || null },
        durationMs: Date.now() - startedAt,
        outcome: 'failed',
        error,
      }));

      return res.status(500).json({
        success: false,
        message: 'Error fetching case',
        error: error.message,
      });
    } finally {
      console.timeEnd(getCaseTimerLabel);
    }
  };

  const getCases = async (req, res) => {
    try {
      const listStartedAt = Date.now();
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
        isInternal,
        workType,
        dealId,
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
          log.warn(`[xID Guardrail] Email-based creator query detected: createdBy="${createdBy}"`);
          log.warn(`[xID Guardrail] This is deprecated. Please use createdByXID for ownership queries.`);
        }
        query.createdBy = createdBy.toLowerCase();
      }
      
      if (clientId) {
        if (mongoose.Types.ObjectId.isValid(clientId)) {
          query.crmClientId = clientId;
        } else {
          query.clientId = clientId;
        }
      }
      Object.assign(query, applyWorkModeFilter({}, { isInternal, workType }));

      if (dealId) {
        if (!mongoose.Types.ObjectId.isValid(dealId)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid dealId',
          });
        }
        query.dealId = dealId;
      }
      
      // Apply client access filter from middleware (restrictedClientIds)
      if (req.clientAccessFilter) {
        Object.assign(query, req.clientAccessFilter);
      }
      
      const scopedCaseQuery = enforceTenantScope(query, req, { source: 'case.getCases.list' });

      // PERFORMANCE: Execute independent queries concurrently
      const [cases, total] = await Promise.all([
        Case.find(scopedCaseQuery)
          .select(CASE_LIST_PROJECTION)
          .limit(parseInt(limit))
          .skip((parseInt(page) - 1) * parseInt(limit))
          .sort({ createdAt: -1, _id: 1 })
          .lean(),
        Case.countDocuments(scopedCaseQuery)
      ]);

      // Decrypt case documents
      // Note: CaseRepository.decryptDocs handles decryption and normalization
      const decryptedCases = await CaseRepository.decryptDocs(cases, req.user.firmId, { role: req.user.role });

      // Fetch client details for all cases in a single batch query to prevent N+1 queries
      // PR: Client Lifecycle - fetch clients regardless of status to display existing cases with inactive clients
      const uniqueClientIds = [...new Set(decryptedCases.map(c => c.clientId).filter(Boolean))];

      let clientsMap = new Map();
      if (uniqueClientIds.length > 0) {
        const clientDocs = await Client.find(enforceTenantScope({ clientId: { $in: uniqueClientIds } }, req, { source: 'case.getCases.clients' }))
          .select('clientId businessName primaryContactNumber businessEmail status isActive')
          .lean();

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
        enforceDocketLifecycleDefault(caseItem);
        const client = clientsMap.get(caseItem.clientId);
        return {
          ...caseItem,
          ...normalizeWorkMode({ isInternal: caseItem.isInternal, workType: caseItem.workType }),
          slaDueDate: caseItem.slaDueAt || null,
          slaStatus: slaService.getSlaStatus(caseItem),
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
              filters: { status, category, priority, assignedTo, clientId, isInternal, workType },
              resultCount: casesWithClients.length,
              total,
            },
            req,
          });
        } else {
          // Log regular case list view
          await logCaseListViewed({
            viewerXID: req.user.xID,
            filters: { status, category, priority, assignedTo, clientId, isInternal, workType },
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
      const durationMs = Date.now() - listStartedAt;
      if (durationMs > 450) {
        log.warn('[CASE_LIST_SLOW]', {
          durationMs,
          thresholdMs: 450,
          firmId: req.user?.firmId || null,
          userXID: req.user?.xID || null,
          page: parseInt(page),
          limit: parseInt(limit),
          hasStatusFilter: Boolean(status),
          hasCategoryFilter: Boolean(category),
          hasClientFilter: Boolean(clientId),
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching cases',
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

  return {
    getCaseByCaseId,
    getCases,
    searchCases,
    getDocketSummaryPdf,
  };
};
