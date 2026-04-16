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
    writeDocketAudit,
    docketAuditService,
  } = deps;

  const createCase = async (req, res) => {
    const requestId = req.requestId || randomUUID();
    req.requestId = requestId;
    const step = (label) => {
      if (process.env.LOG_LEVEL === 'debug') {
        log.info('CASE_CREATE_STEP', {
          req,
          step: label,
          requestId,
          tenantId: req.user?.firmId || null,
        });
      }
    };
    let responseMeta = { requestId, firmId: req.user?.firmId || null };

    try {
      assertFirmContext(req);
      log.info('CASE_CREATE_SERVICE_START', {
        req,
        requestId,
        tenantId: req.user?.firmId || null,
      });
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
      const guidedInput = normalizeCreateInput(req.body);
      
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
      
      const resolvedWorkbasketId = guidedInput.workbasketId || req.user?.teamId || null;
      const resolvedTitle = guidedInput.title || (typeof title === 'string' ? title.trim() : '');
      const resolvedCategoryId = guidedInput.categoryId || categoryId;
      const resolvedSubcategoryId = guidedInput.subcategoryId || subcategoryId;

      validateStructuredInput({
        title: resolvedTitle || 'Untitled Docket',
        workbasketId: resolvedWorkbasketId,
        categoryId: resolvedCategoryId,
        subcategoryId: resolvedSubcategoryId,
      });

      let categoryDoc = null;
      if (resolvedCategoryId) {
        categoryDoc = await categoryRepository.findActiveCategory(resolvedCategoryId, firmId);
        if (!categoryDoc) {
          return res.status(404).json({
            success: false,
            message: 'Category not found or inactive',
            ...responseMeta,
          });
        }
      }
      
      // Resolve selected subcategory from category document and validate if provided
      const subcategoryDoc = categoryDoc?.subcategories?.find(
        (sub) => String(sub.id) === String(resolvedSubcategoryId)
      );

      if (resolvedSubcategoryId && (!subcategoryDoc || !subcategoryDoc.isActive)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid subcategory selected.',
          ...responseMeta,
        });
      }

      let routedWorkbasketId = subcategoryDoc?.workbasketId ? String(subcategoryDoc.workbasketId) : null;
      if (resolvedSubcategoryId && !routedWorkbasketId) {
        return res.status(400).json({
          success: false,
          message: 'Selected subcategory is missing a workbasket mapping',
          ...responseMeta,
        });
      }

      if (!routedWorkbasketId) {
        routedWorkbasketId = resolvedWorkbasketId ? String(resolvedWorkbasketId) : null;
      }
      if (!routedWorkbasketId) {
        const fallbackWorkbasket = await Team.findOne({
          firmId,
          isActive: true,
          type: 'PRIMARY',
        }).sort({ created_at: 1 }).select('_id').lean();
        routedWorkbasketId = fallbackWorkbasket?._id ? String(fallbackWorkbasket._id) : null;
      }
      
      // Backward compatibility:
      // - legacy clientId (String, e.g., C123456) continues to map to core clientId
      // - ObjectId-shaped clientId is treated as CRM client linkage (crmClientId)
      let crmClientId = null;
      let finalClientId = clientId || null;
      if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
        crmClientId = String(clientId);
        finalClientId = null;
      }

      const requestedDealId = req.body?.dealId;
      let dealId = null;
      if (requestedDealId != null) {
        if (!mongoose.Types.ObjectId.isValid(requestedDealId)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid dealId',
            ...responseMeta,
          });
        }
        dealId = String(requestedDealId);
      }

      if (crmClientId) {
        const crmClient = await CrmClient.findOne({ _id: crmClientId, firmId }).select('_id').lean();
        if (!crmClient) {
          return res.status(400).json({
            success: false,
            message: 'Invalid clientId',
            ...responseMeta,
          });
        }
      }

      if (dealId) {
        const deal = await Deal.findOne({ _id: dealId, firmId }).select('_id').lean();
        if (!deal) {
          return res.status(400).json({
            success: false,
            message: 'Invalid dealId',
            ...responseMeta,
          });
        }
      }

      // Default to the tenant's default client when caller does not specify legacy clientId
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
      const actualCategory = caseCategory || category || categoryDoc?.name || 'General';
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
          log.warn('CASE_CREATE_IDEMPOTENT_REPLAY', {
            req,
            requestId,
            tenantId: firmId,
            caseId: existingCase.caseId,
          });
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
        const createdAt = new Date();

        step('before SLA initialization');
        const slaState = await caseSlaService.initializeCaseSla({
          tenantId: firmId,
          caseType: actualCategory,
          now: createdAt,
          session,
        });
        step('after SLA initialization');

        const resolvedSlaDueAt = await slaService.calculateSlaDueDate({
          firmId,
          category: actualCategory,
          subcategory: subcategoryDoc?.name || caseSubCategory || '',
          workbasketId: routedWorkbasketId,
          createdAt,
        });

        if (resolvedSlaDueAt && !hasValidRequestedSla) {
          slaState.slaDueAt = resolvedSlaDueAt;
        }

        if (!resolvedSlaDueAt && defaultSlaDays > 0 && !hasValidRequestedSla) {
          slaState.slaDueAt = slaService.calculateFallbackDueDateFromDays(createdAt, defaultSlaDays);
        }

        if (hasValidRequestedSla) {
          slaState.slaDueAt = requestedSlaDueDate;
        }

        const normalizedTitle = resolvedTitle || 'Untitled Docket';
        const normalizedDescription = typeof description === 'string' ? description.trim() : '';

        const normalizedPriority = guidedInput.priority || (typeof priority === 'string' && priority.trim().length > 0
          ? priority.trim().toLowerCase()
          : 'medium');
        const resolvedAssignee = await resolveAssigneeFromWorkbasketRules({
          firmId,
          workbasketId: routedWorkbasketId,
          assignedTo: guidedInput.assignedTo || assignedTo,
        });

        const newCase = new Case({
          title: normalizedTitle,
          description: normalizedDescription,
          categoryId: resolvedCategoryId,
          subcategoryId: resolvedSubcategoryId,
          category: actualCategory, // Legacy field
          caseCategory: actualCategory,
          caseSubCategory: subcategoryDoc?.name || caseSubCategory || '',
          subcategory: subcategoryDoc?.name || caseSubCategory || '',
          clientId: finalClientId,
          crmClientId: crmClientId || null,
          dealId: dealId || null,
          firmId, // PR 2: Explicitly set firmId for atomic counter scoping
          createdByXID, // Set from authenticated user context
          createdBy: req.user.email || req.user.xID, // Legacy field - use email or xID as fallback
          priority: normalizedPriority,
          status: 'OPEN',
          lifecycle: resolvedAssignee ? DocketLifecycle.IN_WORKLIST : DocketLifecycle.CREATED,
          assignedToXID: resolvedAssignee || null, // PR: xID Canonicalization - Store in assignedToXID
          assignedTo: null,
          assignedBy: null,
          queueType: resolvedAssignee ? 'PERSONAL' : 'GLOBAL',
          ownerTeamId: routedWorkbasketId || null,
          routedToTeamId: routedWorkbasketId || null,
          routedByUserId: null,
          routedAt: null,
          routingNote: null,
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
          slaDays: Math.max(0, Number(tatDaysSnapshot || defaultSlaDays || 0)),
          dueDate: computeDeadlineFromTatDays(tatDaysSnapshot) || (defaultSlaDays > 0 ? (() => {
            const due = new Date();
            due.setUTCDate(due.getUTCDate() + defaultSlaDays);
            return due;
          })() : undefined),
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
          description: `Case created with status: OPEN, Client: ${finalClientId}, Category: ${actualCategory}`,
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

        logActivitySafe({
          docketId: newCase.caseInternalId,
          firmId: newCase.firmId,
          type: 'DOCKET_CREATED',
          description: `Docket created: ${newCase.caseNumber || newCase.caseId || 'Unknown'}`,
          performedByXID: req.user?.xID,
        });
        await writeDocketAudit({
          req,
          session,
          docketId: newCase.caseId,
          action: 'CREATED',
          toState: 'OPEN',
          metadata: {
            category: actualCategory,
            clientId: finalClientId,
            priority: normalizedPriority,
            assignedToXID: newCase.assignedToXID || null,
          },
          oldDoc: {},
          newDoc: {
            status: 'OPEN',
            category: actualCategory,
            clientId: finalClientId,
            priority: normalizedPriority,
            assignedToXID: newCase.assignedToXID || null,
          },
          dedupeKey: `case-create:${newCase.caseId}`,
        });
        log.info('CASE_CREATED', {
          req,
          requestId,
          tenantId: newCase.firmId,
          caseId: newCase.caseId,
          userXID: req.user?.xID || null,
        });

        await docketAuditService.logCreation({
          firmId: newCase.firmId,
          docketId: newCase.caseId,
          performedBy: req.user?.xID || createdByXID,
          performedByRole: req.user?.role,
          initialData: {
            status: newCase.status,
            priority: newCase.priority,
            category: newCase.caseCategory || newCase.category || null,
            subcategory: newCase.caseSubCategory || newCase.subcategory || null,
            queueType: newCase.queueType || null,
            lifecycle: newCase.lifecycle || null,
            assignedToXID: newCase.assignedToXID || null,
            ownerTeamId: newCase.ownerTeamId ? String(newCase.ownerTeamId) : null,
          },
          metadata: {
            source: 'caseCreate.service.createCase',
            createdByXID,
          },
          session,
        });

        return res.status(201).json({
          success: true,
          data: { ...newCase.toObject(), docketId: newCase.caseId },
          message: 'Docket created successfully',
          duplicateWarning: systemComment ? {
            message: 'Case created with duplicate warning',
            matchCount: duplicateMatches.length,
          } : null,
          ...responseMeta,
        });
      } catch (error) {
        if (error?.code === 11000) {
          log.error('CASE_CREATE_DUPLICATE_KEY', {
            req,
            requestId,
            tenantId: firmId,
            error,
          });
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

        log.error('CASE_CREATE_FAILED', {
          req,
          requestId,
          tenantId: firmId?.toString(),
          error,
        });
        return res.status(400).json({
          success: false,
          message: 'Failed to create docket.',
          ...responseMeta,
        });
      }
    } catch (error) {
      const statusCode = error?.statusCode || 400;
      log.error('CASE_CREATE_SERVICE_FAILED', { req, requestId, error });
      res.status(statusCode).json({
        success: false,
        message: 'Error creating docket',
        error: error.message,
        ...responseMeta,
      });
    }
  };

  const cloneCase = async (req, res) => {
    let session;
    try {
      const { caseId } = req.params;
      const { categoryId, subcategoryId } = req.body;

      if (!categoryId) {
        return res.status(400).json({
          success: false,
          message: 'Category is required for clone.',
          code: 'CLONE_CATEGORY_REQUIRED',
        });
      }

      if (!subcategoryId) {
        return res.status(400).json({
          success: false,
          message: 'Subcategory is required for clone.',
          code: 'CLONE_SUBCATEGORY_REQUIRED',
        });
      }

      const categoryDoc = await categoryRepository.findActiveCategory(categoryId, req.user.firmId);
      if (!categoryDoc) {
        return res.status(404).json({
          success: false,
          message: 'Category not found or inactive.',
          code: 'CLONE_CATEGORY_INVALID',
        });
      }
      const subcategoryDoc = categoryDoc.subcategories?.find(
        (sub) => String(sub.id) === String(subcategoryId)
      );
      if (!subcategoryDoc || subcategoryDoc.isActive === false) {
        return res.status(400).json({
          success: false,
          message: 'Invalid subcategory selected.',
          code: 'CLONE_SUBCATEGORY_INVALID',
        });
      }

      let originalCase;
      try {
        const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
        originalCase = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);
      } catch (_error) {
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

      session = await mongoose.startSession();
      let clonedCase = null;
      let copiedComments = 0;
      let copiedAttachments = 0;

      await session.withTransaction(async () => {
        const now = new Date();
        const normalizedPriority = typeof originalCase.priority === 'string'
          ? originalCase.priority.toLowerCase()
          : 'medium';

        const clonedSlaDueAt = await slaService.calculateSlaDueDate({
          firmId: req.user.firmId,
          category: categoryDoc?.name || originalCase.category || '',
          subcategory: subcategoryDoc?.name || originalCase.subcategory || '',
          workbasketId: originalCase.ownerTeamId || req.user.teamId || null,
          createdAt: now,
        });

        clonedCase = new Case({
          title: originalCase.title,
          description: originalCase.description,
          category: categoryDoc?.name || originalCase.category || '',
          caseCategory: categoryDoc?.name || originalCase.caseCategory || '',
          caseSubCategory: subcategoryDoc?.name || '',
          subcategory: subcategoryDoc?.name || '',
          categoryId: categoryDoc._id,
          subcategoryId: String(subcategoryId),
          clientId: originalCase.clientId,
          firmId: req.user.firmId,
          priority: normalizedPriority,
          status: 'UNASSIGNED',
          lifecycle: DocketLifecycle.CREATED,
          assignedTo: null,
          assignedToXID: null,
          queueType: 'GLOBAL',
          ownerTeamId: originalCase.ownerTeamId || req.user.teamId || null,
          routedToTeamId: null,
          routedByUserId: null,
          routedAt: null,
          routingNote: null,
          pendingUntil: null,
          reopenAt: null,
          duplicateOf: originalCase.duplicateOf || null,
          slaDueAt: clonedSlaDueAt || originalCase.slaDueAt || now,
          slaDays: Number(originalCase.slaDays || originalCase.tatDaysSnapshot || 0),
          dueDate: originalCase.dueDate || null,
          tatPaused: false,
          tatLastStartedAt: now,
          tatAccumulatedMinutes: 0,
          tatTotalMinutes: originalCase.tatTotalMinutes || 0,
          slaConfigSnapshot: originalCase.slaConfigSnapshot || undefined,
          createdBy: (req.user.email || originalCase.createdBy || req.user.xID || '').toLowerCase(),
          createdByXID: req.user.xID,
          workTypeId: originalCase.workTypeId || null,
          subWorkTypeId: originalCase.subWorkTypeId || null,
          tatDaysSnapshot: Number(originalCase.tatDaysSnapshot || originalCase.slaDays || 0),
        });
        await clonedCase.saveWithRetry({ session });

        const originalComments = await Comment.find(
          enforceTenantScope({ caseId: originalCase.caseId }, req, { source: 'case.clone.originalComments' })
        ).session(session);
        if (originalComments.length) {
          await Comment.insertMany(
            originalComments.map((comment) => ({
              caseId: clonedCase.caseId,
              firmId: req.user.firmId,
              text: comment.text,
              createdBy: comment.createdBy,
              createdByXID: comment.createdByXID,
              note: `Cloned from Docket ${originalCase.caseId}`,
            })),
            { session }
          );
          copiedComments = originalComments.length;
        }

        const originalAttachments = await Attachment.find(
          enforceTenantScope({ caseId: originalCase.caseId }, req, { source: 'case.clone.originalAttachments' })
        ).session(session);
        if (originalAttachments.length) {
          const attachmentPayload = originalAttachments.map((attachment) => ({
            caseId: clonedCase.caseId,
            firmId: req.user.firmId,
            clientId: attachment.clientId || originalCase.clientId || null,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl,
            uploadedBy: attachment.uploadedBy,
            filePath: attachment.filePath,
            driveFileId: attachment.driveFileId,
            storageProvider: attachment.storageProvider,
            storageFileId: attachment.storageFileId,
            checksum: attachment.checksum,
            contentHash: attachment.contentHash,
            isDuplicate: attachment.isDuplicate,
            size: attachment.size,
            description: attachment.description,
            createdBy: attachment.createdBy,
            createdByXID: attachment.createdByXID,
            createdByName: attachment.createdByName,
            type: attachment.type,
            source: attachment.source,
            visibility: attachment.visibility,
            mimeType: attachment.mimeType,
            emailThreadId: attachment.emailThreadId,
            compressed: attachment.compressed,
            note: `Cloned from Docket ${originalCase.caseId}`,
          }));
          await Attachment.insertMany(attachmentPayload, { session });
          copiedAttachments = attachmentPayload.length;
        }

        await CaseHistory.create([{
          caseId: originalCase.caseId,
          firmId: req.user.firmId,
          actionType: 'CLONED_TO_NEW_DOCKET',
          description: `Cloned to ${clonedCase.caseId}`,
          performedBy: (req.user.email || '').toLowerCase(),
          performedByXID: req.user.xID,
        }], { session });

        await CaseHistory.create([{
          caseId: clonedCase.caseId,
          firmId: req.user.firmId,
          actionType: 'CREATED_FROM_CLONE',
          description: `Created from clone of ${originalCase.caseId}`,
          performedBy: (req.user.email || '').toLowerCase(),
          performedByXID: req.user.xID,
          metadata: {
            sourceDocketId: originalCase.caseId,
            timestamp: now.toISOString(),
          },
        }], { session });
      });

      res.status(201).json({
        success: true,
        docketId: clonedCase.caseId,
        data: {
          docketId: clonedCase.caseId,
          originalCaseId: originalCase.caseId,
          copiedComments,
          copiedAttachments,
        },
        message: 'Docket cloned successfully',
      });
    } catch (error) {
      res.status(error?.status || 400).json({
        success: false,
        message: typeof error?.message === 'string' && error.message.trim()
          ? error.message
          : 'Failed to clone docket',
      });
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  };

  return {
    createCase,
    cloneCase,
  };
};
