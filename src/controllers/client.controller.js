const Case = require('../models/Case.model');
const ClientRepository = require('../repositories/ClientRepository');
const AttachmentRepository = require('../repositories/AttachmentRepository');
const { mapClientResponse } = require('../mappers/client.mapper');
const { generateNextClientId } = require('../services/clientIdGenerator');
const log = require('../utils/log');
const { 
  logFactSheetCreated, 
  logFactSheetUpdated, 
  logFactSheetFileAdded, 
  logFactSheetFileRemoved,
  logClientFactSheetAction
} = require('../services/clientFactSheetAudit.service');
const { getMimeType, sanitizeFilename } = require('../utils/fileUtils');
const { StorageProviderFactory } = require('../services/storage/StorageProviderFactory');
const { areFileUploadsDisabled } = require('../services/featureFlags.service');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { executeWrite } = require('../utils/executeWrite');
const { incrementTenantMetric } = require('../services/tenantMetrics.service');
const { CANONICAL_CLIENT_STATUSES } = require('../utils/clientStatus');
const Firm = require('../models/Firm.model');
const { ensureDefaultClientForFirm } = require('../services/defaultClient.service');
const { parseBooleanQuery } = require('../utils/query.utils');
const { sanitizePayload, enforceAllowedFields, PayloadValidationError } = require('../utils/payloadValidation');
const cfsDriveService = require('../services/cfsDrive.service');
const { clientProfileStorageService } = require('../services/clientProfileStorage.service');
const { persistClientProfileOrRollback } = require('../services/clientProfileWriteGuard.service');
const directUploadService = require('../services/directUpload.service');
const { buildWorkflowMeta, logWorkflowEvent } = require('../utils/workflowDiagnostics');

const getClientAccessContext = (req, res, message) => {
  const firmId = req.user?.firmId;
  if (!firmId) {
    res.status(403).json({
      success: false,
      message,
    });
    return null;
  }

  return {
    firmId,
    role: req.user?.role,
  };
};

const normalizeClientList = (clients) => (Array.isArray(clients) ? clients : []);

const normalizeString = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const hydrateClientFromProfileIfAvailable = async (firmId, client) => {
  if (!client) return client;
  try {
    const profile = await clientProfileStorageService.getClientProfile({ firmId, client });
    if (!profile) return client;
    return clientProfileStorageService.hydrateClientWithProfile(client, profile);
  } catch (error) {
    log.warn('CLIENT_PROFILE_HYDRATE_FAILED', {
      firmId: String(firmId || ''),
      clientId: client?.clientId || null,
      message: error.message,
    });
    return client;
  }
};

const setNoCacheHeaders = (res) => {
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
  if (typeof res.set === 'function') {
    res.set(headers);
    return;
  }
  if (typeof res.setHeader === 'function') {
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  }
};

const buildClientListResponse = (clients = []) => {
  const normalizedClients = normalizeClientList(clients);

  return {
    success: true,
    data: normalizedClients,
    clients: normalizedClients,
    total: normalizedClients.length,
  };
};

const parsePositiveInteger = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const buildClientLogContext = (req, extra = {}) => ({
  firmId: req.user?.firmId || req.firmId || null,
  requestId: req.requestId || req.headers?.['x-request-id'] || null,
  userId: req.user?._id || req.user?.id || null,
  route: req.originalUrl || req.url || null,
  ...extra,
});

const logClientError = (event, req, error, extra = {}) => {
  log.error(event, buildClientLogContext(req, {
    ...extra,
    error: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
  }));
};

const logClientWarn = (event, req, extra = {}) => {
  log.warn(event, buildClientLogContext(req, extra));
};

const isStorageDisabled = async (firmId) => {
  const firm = await Firm.findById(firmId).select('storage.mode').lean();
  return firm?.storage?.mode !== 'firm_connected';
};

const setupClientStorage = async ({ req, userFirmId, clientId, clientMongoId }) => {
  log.info('CLIENT_STORAGE_SETUP_STARTED', buildClientLogContext(req, {
    clientId,
    clientMongoId,
  }));

  if (await isStorageDisabled(userFirmId)) {
    logClientWarn('CLIENT_STORAGE_SETUP_SKIPPED', req, {
      clientId,
      clientMongoId,
      reason: 'Storage is only available when a firm has connected their own storage (firm_connected mode)',
    });
    // Keep legacy event name for existing dashboards/alerts.
    logClientWarn('CFS_FOLDER_CREATION_SKIPPED', req, {
      clientId,
      reason: 'Storage is only available when a firm has connected their own storage (firm_connected mode)',
    });
    return;
  }

  const cfsDriveService = require('../services/cfsDrive.service');
  const provider = await StorageProviderFactory.getProvider(userFirmId);
  const folderIds = await cfsDriveService.createClientCFSFolderStructure(
    userFirmId.toString(),
    clientId,
    provider
  );

  await ClientRepository.updateByClientId(userFirmId, clientId, {
    $set: { drive: folderIds },
  });
};

/**
 * Client Controller for Direct Client Management
 * 
 * PR #39: Admin can directly manage clients
 * Key Features:
 * - Auto-generated immutable clientId
 * - Create, edit, enable/disable operations
 * - No hard deletes - only soft delete via isActive flag
 * - Disabled clients cannot be used for new cases
 */

/**
 * Get all clients
 * GET /api/clients
 * Query param: activeOnly=true for only active clients
 * Query param: forCreateCase=true to get clients for case creation (always includes Default Client)
 */
const getClients = async (req, res) => {
  const accessContext = getClientAccessContext(req, res, 'User must belong to a firm to access clients');
  if (!accessContext) return;

  try {
    // Self-heal invariant: each firm must always have its own default/system client.
    // When older tenants are missing this record, admin client listing can fail
    // across related flows (case creation, permissions, and client management).
    const firm = await Firm.findById(accessContext.firmId).select('_id name defaultClientId');
    await ensureDefaultClientForFirm(firm || accessContext.firmId);

    setNoCacheHeaders(res);
    const { activeOnly, forCreateCase, search } = req.query;
    const page = parsePositiveInteger(req.query.page, 1, 100000);
    const limit = parsePositiveInteger(req.query.limit, 25, 200);
    const skip = (page - 1) * limit;
    const shouldFilterActiveOnly = parseBooleanQuery(activeOnly);
    const shouldLoadForCreateCase = parseBooleanQuery(forCreateCase);
    const normalizedSearch = normalizeString(search);

    const filter = shouldLoadForCreateCase || shouldFilterActiveOnly
      ? { isActive: true }
      : {};
    if (normalizedSearch) {
      const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { businessName: { $regex: escapedSearch, $options: 'i' } },
        { clientId: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [clients, total] = await Promise.all([
      ClientRepository.find(
        accessContext.firmId,
        filter,
        accessContext.role,
        {
          select: 'clientId businessName businessEmail primaryContactNumber status isSystemClient isInternal isDefaultClient createdAt profileRef',
          sort: { clientId: 1 },
          limit,
          skip,
          logContext: buildClientLogContext(req, { model: 'Client' }),
        }
      ),
      ClientRepository.count(accessContext.firmId, filter),
    ]);

    const normalizedClients = normalizeClientList(clients).map(mapClientResponse);
    return res.json({
      ...buildClientListResponse(normalizedClients),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    logClientError('CLIENT_LIST_ERROR', req, error, {
      query: req.query || {},
    });
    return res.status(500).json({
      success: false,
      message: 'Error fetching clients',
      error: error.message,
    });
  }
};

/**
 * Get client by clientId
 * GET /api/clients/:clientId
 */
const getClientById = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { clientId } = req.params;
    const accessContext = getClientAccessContext(req, res, 'User must belong to a firm to access clients');
    if (!accessContext) return;
    const client = await ClientRepository.findByClientId(accessContext.firmId, clientId, accessContext.role, {
      logContext: buildClientLogContext(req, { model: 'Client', clientId }),
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    const hydratedClient = await hydrateClientFromProfileIfAvailable(accessContext.firmId, client);
    const attachments = await AttachmentRepository.findByClientSource(accessContext.firmId, clientId, 'client_cfs');
    const payload = mapClientResponse(hydratedClient);
    payload.clientFactSheet = payload.clientFactSheet || {};
    payload.clientFactSheet.attachments = attachments.map((attachment) => ({
      fileId: attachment._id,
      fileName: attachment.fileName,
      size: attachment.size || 0,
      mimeType: attachment.mimeType,
      uploadedAt: attachment.createdAt,
      uploadedByXID: attachment.createdByXID,
      uploadedByName: attachment.createdByName,
    }));

    res.json({
      success: true,
      data: payload,
    });
    logWorkflowEvent('CLIENT_DETAIL_LOAD', buildWorkflowMeta({
      req,
      workflow: 'client_detail_load',
      entity: { clientId },
      durationMs: Date.now() - startedAt,
      outcome: 'success',
    }));
  } catch (error) {
    logClientError('CLIENT_GET_ERROR', req, error, {
      clientId: req.params?.clientId || null,
    });
    logWorkflowEvent('CLIENT_DETAIL_LOAD', buildWorkflowMeta({
      req,
      workflow: 'client_detail_load',
      entity: { clientId: req.params?.clientId || null },
      durationMs: Date.now() - startedAt,
      outcome: 'failed',
      error,
    }));
    res.status(500).json({
      success: false,
      message: 'Error fetching client',
      error: error.message,
    });
  }
};

/**
 * Create a new client (Admin only)
 * POST /api/clients
 * 
 * System-owned fields (auto-generated server-side):
 * - clientId: Auto-generated (e.g., C000002)
 * - createdByXid: Set from authenticated user (req.user.xID)
 * - status: Defaults to ACTIVE
 * 
 * Business fields (required from frontend):
 * - businessName, primaryContactNumber, businessEmail
 * 
 * Optional fields:
 * - secondaryContactNumber, PAN, GST, TAN, CIN, latitude, longitude
 */
const createClient = async (req, res) => {
  try {
    const allowedFields = [
      'businessName',
      'businessAddress',
      'businessEmail',
      'primaryContactNumber',
      'secondaryContactNumber',
      'PAN',
      'TAN',
      'GST',
      'CIN',
      'contactPersonName',
      'contactPersonDesignation',
      'contactPersonPhoneNumber',
      'contactPersonEmailAddress'
    ];
    
    let sanitizedBody;
    try {
      sanitizedBody = enforceAllowedFields(
        sanitizePayload(req.body),
        ['latitude', 'longitude', 'businessPhone'],
        allowedFields,
        'client payload'
      );
    } catch (validationErr) {
      if (validationErr instanceof PayloadValidationError) {
        return res.status(400).json({
          success: false,
          message: validationErr.message,
        });
      }
      throw validationErr;
    }
    
    // STEP 5: Extract and validate required business fields
    const {
      businessName,
      primaryContactNumber,
      businessEmail,
      businessAddress,
      secondaryContactNumber,
      PAN,
      GST,
      TAN,
      CIN,
      contactPersonName,
      contactPersonDesignation,
      contactPersonPhoneNumber,
      contactPersonEmailAddress,
    } = sanitizedBody;
    
    // Validate required business fields
    if (!businessName || !businessName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business name is required',
      });
    }
    
    if (!primaryContactNumber || !primaryContactNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Primary contact number is required',
      });
    }
    
    if (!businessEmail || !businessEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business email is required',
      });
    }
    
    // STEP 6: Get creator xID and firmId from authenticated user (server-side only)
    const createdByXid = req.user?.xID;
    const userFirmId = req.user?.firmId;
    
    if (!createdByXid) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user xID not found',
      });
    }
    
    // Ensure user has a firmId (required for creating clients)
    if (!userFirmId) {
      return res.status(403).json({
        success: false,
        message: 'User must belong to a firm to create clients',
      });
    }
    
    // STEP 7-9: Perform transactional writes only
    const client = await executeWrite(req, async () => {
      const clientId = await generateNextClientId(userFirmId);

      return ClientRepository.create({
        // System-generated ID (NEVER from client)
        clientId,
        // Business fields from sanitized request
        businessName: businessName.trim(),
        primaryContactNumber: primaryContactNumber.trim(),
        businessEmail: businessEmail.trim().toLowerCase(),
        // System-owned fields (injected server-side only, NEVER from client)
        firmId: userFirmId,
        createdByXid,
        createdBy: req.user?.email ? req.user.email.trim().toLowerCase() : undefined,
        isSystemClient: false,
        isActive: true,
        status: CANONICAL_CLIENT_STATUSES.ACTIVE,
        previousBusinessNames: [],
      }, req.user?.role);
    });

    await incrementTenantMetric(userFirmId, 'clients').catch(() => null);

    await persistClientProfileOrRollback({
      firmId: userFirmId,
      client,
      actorXID: createdByXid,
      profileInput: {
        legalName: businessName.trim(),
        businessAddress: businessAddress ? businessAddress.trim() : null,
        businessEmail: businessEmail.trim().toLowerCase(),
        primaryContactNumber: primaryContactNumber.trim(),
        secondaryContactNumber: secondaryContactNumber ? secondaryContactNumber.trim() : null,
        PAN: PAN ? PAN.trim().toUpperCase() : null,
        GST: GST ? GST.trim().toUpperCase() : null,
        TAN: TAN ? TAN.trim().toUpperCase() : null,
        CIN: CIN ? CIN.trim().toUpperCase() : null,
        contactPersonName: contactPersonName ? contactPersonName.trim() : null,
        contactPersonDesignation: contactPersonDesignation ? contactPersonDesignation.trim() : null,
        contactPersonPhoneNumber: contactPersonPhoneNumber ? contactPersonPhoneNumber.trim() : null,
        contactPersonEmailAddress: contactPersonEmailAddress ? contactPersonEmailAddress.trim().toLowerCase() : null,
      },
    });

    log.info('CLIENT_CREATED', buildClientLogContext(req, {
      clientId: client.clientId,
      clientMongoId: client._id,
    }));

    try {
      await setupClientStorage({
        req,
        userFirmId,
        clientId: client.clientId,
        clientMongoId: client._id,
      });
    } catch (storageError) {
      logClientWarn('CLIENT_STORAGE_SETUP_FAILED', req, {
        clientId: client.clientId,
        clientMongoId: client._id,
        reason: storageError.message,
      });
    }

    const createdClient = await ClientRepository.findByClientId(userFirmId, client.clientId, req.user?.role, {
      logContext: buildClientLogContext(req, { model: 'Client', clientId: client.clientId }),
    });

    return res.status(201).json({
      success: true,
      data: mapClientResponse(createdClient || client),
      message: 'Client created successfully',
    });
  } catch (error) {
    logClientError('CLIENT_CREATE_ERROR', req, error, {
      validationErrors: error.errors || null,
    });
    
    res.status(400).json({
      success: false,
      message: error.message || 'Error creating client',
      ...(error.errors && { validationErrors: error.errors }),
    });
  }
};

/**
 * Update client (Admin only)
 * PUT /api/clients/:clientId
 * 
 * Admin-managed editable fields include core business details,
 * tax identifiers (PAN/TAN/CIN/GST), and contact person details.
 *
 * Immutable/system fields (clientId, firmId, createdByXid, system flags)
 * remain server-controlled.
 */
const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      businessEmail,
      primaryContactNumber,
      secondaryContactNumber,
      businessName,
      businessAddress,
      PAN,
      TAN,
      CIN,
      GST,
      contactPersonName,
      contactPersonDesignation,
      contactPersonPhoneNumber,
      contactPersonEmailAddress,
    } = req.body;
    
    // Get firmId from authenticated user for query scoping
    const accessContext = getClientAccessContext(req, res, 'User must belong to a firm to update clients');
    if (!accessContext) return;
    const client = await ClientRepository.findByClientId(accessContext.firmId, clientId, accessContext.role, {
      logContext: buildClientLogContext(req, { model: 'Client', clientId }),
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    await clientProfileStorageService.updateClientProfile({
      firmId: accessContext.firmId,
      client,
      actorXID: req.user?.xID || 'SYSTEM',
      partialProfileInput: {
        legalName: businessName !== undefined ? String(businessName).trim() : undefined,
        businessAddress: businessAddress !== undefined ? String(businessAddress).trim() : undefined,
        businessEmail: businessEmail !== undefined ? String(businessEmail).trim().toLowerCase() : undefined,
        primaryContactNumber: primaryContactNumber !== undefined ? String(primaryContactNumber).trim() : undefined,
        secondaryContactNumber: secondaryContactNumber !== undefined ? (secondaryContactNumber ? String(secondaryContactNumber).trim() : null) : undefined,
        PAN: PAN !== undefined ? (PAN ? String(PAN).trim().toUpperCase() : null) : undefined,
        TAN: TAN !== undefined ? (TAN ? String(TAN).trim().toUpperCase() : null) : undefined,
        CIN: CIN !== undefined ? (CIN ? String(CIN).trim().toUpperCase() : null) : undefined,
        GST: GST !== undefined ? (GST ? String(GST).trim().toUpperCase() : null) : undefined,
        contactPersonName: contactPersonName !== undefined ? (contactPersonName ? String(contactPersonName).trim() : null) : undefined,
        contactPersonDesignation: contactPersonDesignation !== undefined ? (contactPersonDesignation ? String(contactPersonDesignation).trim() : null) : undefined,
        contactPersonPhoneNumber: contactPersonPhoneNumber !== undefined ? (contactPersonPhoneNumber ? String(contactPersonPhoneNumber).trim() : null) : undefined,
        contactPersonEmailAddress: contactPersonEmailAddress !== undefined ? (contactPersonEmailAddress ? String(contactPersonEmailAddress).trim().toLowerCase() : null) : undefined,
      },
    });

    if (businessName !== undefined) {
      client.businessName = String(businessName).trim();
    }

    // Update allowed metadata fields
    if (businessEmail !== undefined) {
      client.businessEmail = String(businessEmail).trim().toLowerCase();
    }
    
    if (primaryContactNumber !== undefined) {
      client.primaryContactNumber = String(primaryContactNumber).trim();
    }

    await client.save();

    const hydrated = await hydrateClientFromProfileIfAvailable(accessContext.firmId, client);
    
    res.json({
      success: true,
      data: mapClientResponse(hydrated),
      message: 'Client updated successfully',
    });
  } catch (error) {
    logClientError('CLIENT_UPDATE_ERROR', req, error, {
      clientId: req.params?.clientId || null,
    });
    res.status(400).json({
      success: false,
      message: 'Error updating client',
      error: error.message,
    });
  }
};

/**
 * Enable/disable client (Admin only)
 * PATCH /api/clients/:clientId/status
 * 
 * Disabled clients cannot be used for new cases
 * System client (C000001) cannot be disabled
 */
const toggleClientStatus = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive field is required (boolean)',
      });
    }
    
    // Get firmId from authenticated user for query scoping
    const accessContext = getClientAccessContext(req, res, 'User must belong to a firm to update clients');
    if (!accessContext) return;
    const client = await ClientRepository.findByClientId(accessContext.firmId, clientId, accessContext.role, {
      logContext: buildClientLogContext(req, { model: 'Client', clientId }),
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // PROTECTION: Prevent deactivation of system/internal/default clients
    // Check multiple flags to ensure the organization's root client is protected
    const isProtectedClient = client.isDefaultClient === true || client.isSystemClient === true;
    
    if (isProtectedClient && !isActive) {
      logClientWarn('CLIENT_PROTECTION', req, {
        clientId,
        isActive,
        message: 'Attempt to deactivate protected client',
      });
      
      return res.status(403).json({
        success: false,
        message: 'Default client cannot be deactivated.',
      });
    }
    
    // Update both legacy and new status fields
    client.isActive = isActive;
    client.status = isActive ? CANONICAL_CLIENT_STATUSES.ACTIVE : CANONICAL_CLIENT_STATUSES.INACTIVE;
    await client.save();
    
    log.info(`[CLIENT_STATUS] Client ${clientId} ${isActive ? 'activated' : 'deactivated'} by ${req.user?.xID}`);
    
    res.json({
      success: true,
      data: mapClientResponse(client),
      message: `Client ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    logClientError('CLIENT_STATUS_UPDATE_ERROR', req, error, {
      clientId: req.params?.clientId || null,
      requestedIsActive: req.body?.isActive,
    });
    res.status(400).json({
      success: false,
      message: 'Error updating client status',
      error: error.message,
    });
  }
};

/**
 * Change client legal name (Admin only)
 * POST /api/clients/:clientId/change-name
 * 
 * This is the ONLY way to change a client's business name after creation.
 * Requires:
 * - newBusinessName: The new legal name
 * - reason: Explanation for the name change (required for audit compliance)
 * 
 * The old name is automatically archived in previousBusinessNames array
 * with metadata about when, who, and why the change was made.
 */
const changeLegalName = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { newBusinessName, reason } = req.body;
    
    // Validate inputs
    if (!newBusinessName || !newBusinessName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'New business name is required',
      });
    }
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason for name change is required for audit compliance',
      });
    }
    
    // Get firmId from authenticated user for query scoping
    const accessContext = getClientAccessContext(req, res, 'User must belong to a firm to update clients');
    if (!accessContext) return;
    const client = await ClientRepository.findByClientId(accessContext.firmId, clientId, accessContext.role, {
      logContext: buildClientLogContext(req, { model: 'Client', clientId }),
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // Prevent editing system client
    if (client.isSystemClient) {
      return res.status(403).json({
        success: false,
        message: 'System client name cannot be changed',
      });
    }
    
    // Get user xID for audit trail
    const changedByXid = req.user?.xID;
    if (!changedByXid) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user xID not found',
      });
    }
    
    // Archive current name in history
    const oldName = client.businessName;
    if (!client.previousBusinessNames) {
      client.previousBusinessNames = [];
    }
    
    client.previousBusinessNames.push({
      name: oldName,
      changedOn: new Date(),
      changedByXid: changedByXid,
      reason: reason.trim(),
    });
    
    // Update to new name
    client.businessName = newBusinessName.trim();
    
    await client.save();
    
    res.json({
      success: true,
      data: mapClientResponse(client),
      message: 'Client legal name changed successfully',
      nameChangeHistory: {
        oldName,
        newName: newBusinessName.trim(),
        changedBy: changedByXid,
        changedOn: new Date(),
        reason: reason.trim(),
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error changing client legal name',
      error: error.message,
    });
  }
};

/**
 * Update Client Fact Sheet (Admin Only)
 * PUT /api/clients/:clientId/fact-sheet
 * 
 * Allows admin to update description and notes for client fact sheet
 * Files are managed via separate endpoints
 */
const updateClientFactSheet = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { clientId } = req.params;
    const { description, notes, basicInfo } = req.body;
    
    // Get firmId from authenticated user
    const userFirmId = req.user?.firmId;
    const performedByXID = req.user?.xID;
    
    if (!userFirmId) {
      return res.status(403).json({
        success: false,
        message: 'User must belong to a firm to update clients',
      });
    }
    
    if (!performedByXID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user xID not found',
      });
    }
    
    // Find client with firmId scoping
    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    const existingProfile = await clientProfileStorageService.getClientProfile({ firmId: userFirmId, client });
    const existingFactSheet = existingProfile?.profile?.factSheet || {};
    const isCreation = !existingFactSheet?._initialized;

    const nextFactSheet = {
      ...existingFactSheet,
      ...(description !== undefined ? { description } : {}),
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: new Date(),
      _initialized: true,
    };

    if (basicInfo && typeof basicInfo === 'object') {
      nextFactSheet.basicInfo = {
        clientName: basicInfo.clientName ?? nextFactSheet.basicInfo?.clientName ?? client.businessName,
        entityType: basicInfo.entityType ?? nextFactSheet.basicInfo?.entityType ?? '',
        PAN: basicInfo.PAN ?? nextFactSheet.basicInfo?.PAN ?? '',
        CIN: basicInfo.CIN ?? nextFactSheet.basicInfo?.CIN ?? '',
        GSTIN: basicInfo.GSTIN ?? nextFactSheet.basicInfo?.GSTIN ?? '',
        address: basicInfo.address ?? nextFactSheet.basicInfo?.address ?? '',
        contactPerson: basicInfo.contactPerson ?? nextFactSheet.basicInfo?.contactPerson ?? '',
        email: basicInfo.email ?? nextFactSheet.basicInfo?.email ?? client.businessEmail ?? '',
        phone: basicInfo.phone ?? nextFactSheet.basicInfo?.phone ?? client.primaryContactNumber ?? '',
      };
    }

    await clientProfileStorageService.updateClientProfile({
      firmId: userFirmId,
      client,
      actorXID: performedByXID,
      partialProfileInput: {
        clientFactSheet: nextFactSheet,
      },
    });
    
    // Log audit event
    if (isCreation) {
      await logFactSheetCreated({
        clientId,
        firmId: userFirmId,
        performedByXID,
        metadata: {
          hasDescription: !!description,
          hasNotes: !!notes,
        },
      });
    } else {
      await logFactSheetUpdated({
        clientId,
        firmId: userFirmId,
        performedByXID,
        metadata: {
          updatedDescription: description !== undefined,
          updatedNotes: notes !== undefined,
          updatedBasicInfo: !!basicInfo,
        },
      });
    }
    await logClientFactSheetAction({
      clientId,
      firmId: userFirmId,
      actionType: 'CLIENT_CFS_UPDATED',
      description: `Client Fact Sheet updated for ${client.businessName}`,
      performedByXID,
      metadata: { navigateTo: `/clients/${clientId}/cfs` },
      req,
    });
    
    res.json({
      success: true,
      data: nextFactSheet,
      message: 'Client Fact Sheet updated successfully',
    });
    logWorkflowEvent('CLIENT_FACT_SHEET_MUTATION', buildWorkflowMeta({
      req,
      workflow: 'client_fact_sheet_update',
      entity: { clientId },
      durationMs: Date.now() - startedAt,
      outcome: 'success',
    }));
  } catch (error) {
    logWorkflowEvent('CLIENT_FACT_SHEET_MUTATION', buildWorkflowMeta({
      req,
      workflow: 'client_fact_sheet_update',
      entity: { clientId: req.params?.clientId || null },
      durationMs: Date.now() - startedAt,
      outcome: 'failed',
      error,
    }));
    log.error('Error updating client fact sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating client fact sheet',
      error: error.message,
    });
  }
};

/**
 * Upload file to Client Fact Sheet (Admin Only)
 * POST /api/clients/:clientId/fact-sheet/files
 * 
 * Requires multer middleware for file upload
 */
const uploadFactSheetFile = async (req, res) => {
  if (!directUploadService.isDirectUploadsEnabled()) {
    return res.status(503).json({
      success: false,
      code: 'DIRECT_UPLOADS_DISABLED',
      message: 'File uploads are temporarily unavailable',
    });
  }
  return res.status(410).json({
    success: false,
    message: 'Legacy multipart upload is deprecated. Use upload intent/finalize endpoints.',
  });
};

const createClientCFSUploadIntent = async (req, res) => {
  const startedAt = Date.now();
  try {
    if (areFileUploadsDisabled()) {
      return res.status(503).json({
        success: false,
        message: 'File uploads are temporarily disabled',
      });
    }
    const { clientId } = req.params;
    const {
      fileName,
      mimeType,
      size,
      description = 'Client Fact Sheet attachment',
      fileType = 'documents',
      checksum,
    } = req.body || {};
    const userFirmId = String(req.user?.firmId || '');
    if (!userFirmId || !req.user?.xID) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const intent = await directUploadService.createIntent({
      firmId: userFirmId,
      clientId,
      source: 'client_cfs',
      fileName,
      mimeType,
      size,
      description,
      role: req.user?.role,
      user: req.user,
      fileType,
      checksum,
    });
    logWorkflowEvent('CLIENT_CFS_UPLOAD_INTENT', buildWorkflowMeta({
      req,
      workflow: 'client_cfs_upload_intent',
      entity: { clientId, uploadId: intent.uploadId },
      provider: intent.provider,
      providerMode: intent.providerMode,
      durationMs: Date.now() - startedAt,
      outcome: 'success',
    }));
    return res.status(201).json({ success: true, data: intent });
  } catch (error) {
    logWorkflowEvent('CLIENT_CFS_UPLOAD_INTENT', buildWorkflowMeta({
      req,
      workflow: 'client_cfs_upload_intent',
      entity: { clientId: req.params?.clientId || null },
      durationMs: Date.now() - startedAt,
      outcome: 'failed',
      error,
    }));
    return res.status(error.status || 500).json({ success: false, code: error.code || 'CLIENT_UPLOAD_INTENT_FAILED', message: error.message });
  }
};

/**
 * Delete file from Client Fact Sheet (Admin Only)
 * DELETE /api/clients/:clientId/fact-sheet/files/:fileId
 */
const deleteFactSheetFile = async (req, res) => {
  try {
    const { clientId, fileId } = req.params;
    
    // Get firmId and xID from authenticated user
    const userFirmId = req.user?.firmId;
    const performedByXID = req.user?.xID;
    
    if (!userFirmId || !performedByXID) {
      return res.status(403).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    const deletedAttachment = await cfsDriveService.deleteClientCFSFile(clientId, fileId, userFirmId, {
      req,
      reason: req.body?.reason || 'Client Fact Sheet delete',
    });

    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);
    if (client) {
      const existingProfile = await clientProfileStorageService.getClientProfile({ firmId: userFirmId, client });
      const factSheet = existingProfile?.profile?.factSheet || {};
      await clientProfileStorageService.updateClientProfile({
        firmId: userFirmId,
        client,
        actorXID: req.user?.xID || 'SYSTEM',
        partialProfileInput: { clientFactSheet: { ...factSheet, updatedAt: new Date() } },
      });
    }
    
    // Log audit event
    await logFactSheetFileRemoved({
      clientId,
      firmId: userFirmId,
      performedByXID,
      fileName: deletedAttachment.fileName,
      metadata: {
        fileId,
      },
    });
    
    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    log.error('Error deleting fact sheet file:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: error.message,
    });
  }
};

/**
 * Upload file to Client CFS (Admin only)
 * POST /api/clients/:clientId/cfs/files
 * 
 * Uploads a file to the client's CFS (Client File System) in Google Drive
 * Only admins can upload to client CFS
 * Files are stored in Google Drive and referenced via Attachment model
 */
const uploadClientCFSFile = async (req, res) => {
  if (!directUploadService.isDirectUploadsEnabled()) {
    return res.status(503).json({
      success: false,
      code: 'DIRECT_UPLOADS_DISABLED',
      message: 'File uploads are temporarily unavailable',
    });
  }
  return res.status(410).json({
    success: false,
    message: 'Legacy multipart upload is deprecated. Use upload intent/finalize endpoints.',
  });
};

const finalizeClientCFSUpload = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { clientId } = req.params;
    const { uploadId, completion = {}, checksum } = req.body || {};
    const userFirmId = String(req.user?.firmId || '');
    const userXID = req.user?.xID;
    if (!userFirmId || !userXID) return res.status(401).json({ success: false, message: 'Authentication required' });

    const attachment = await directUploadService.finalizeIntent({
      uploadId,
      completion,
      checksum,
      firmId: userFirmId,
      user: req.user,
    });

    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);
    if (client) {
      const existingProfile = await clientProfileStorageService.getClientProfile({ firmId: userFirmId, client });
      const factSheet = existingProfile?.profile?.factSheet || {};
      await clientProfileStorageService.updateClientProfile({
        firmId: userFirmId,
        client,
        actorXID: userXID,
        partialProfileInput: { clientFactSheet: { ...factSheet, updatedAt: new Date() } },
      });
    }

    await logFactSheetFileAdded({
      clientId,
      firmId: userFirmId,
      performedByXID: userXID,
      fileName: attachment.fileName,
      metadata: { fileId: String(attachment._id), mimeType: attachment.mimeType, fileSize: attachment.size },
    });
    logWorkflowEvent('CLIENT_CFS_UPLOAD_FINALIZE', buildWorkflowMeta({
      req,
      workflow: 'client_cfs_upload_finalize',
      entity: { clientId, uploadId },
      provider: attachment.storageProvider || null,
      durationMs: Date.now() - startedAt,
      outcome: 'success',
    }));

    return res.status(201).json({
      success: true,
      data: attachment,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    logWorkflowEvent('CLIENT_CFS_UPLOAD_FINALIZE', buildWorkflowMeta({
      req,
      workflow: 'client_cfs_upload_finalize',
      entity: { clientId: req.params?.clientId || null, uploadId: req.body?.uploadId || null },
      durationMs: Date.now() - startedAt,
      outcome: 'failed',
      error,
    }));
    log.error('Error finalizing client CFS upload:', error);
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'CLIENT_CFS_UPLOAD_FINALIZE_FAILED',
      message: 'Error finalizing client CFS upload',
      error: error.message,
    });
  }
};

/**
 * List Client CFS files (Admin and case users)
 * GET /api/clients/:clientId/cfs/files
 * 
 * Lists all files in the client's CFS
 * Accessible by admins and users with access to cases for this client
 */
const listClientCFSFiles = async (req, res) => {
  try {
    const { clientId } = req.params;
    const userFirmId = req.user?.firmId;

    if (!userFirmId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate client exists and user has access
    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found or access denied',
      });
    }

    const attachments = await AttachmentRepository.findByClientSource(userFirmId, clientId, 'client_cfs');

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
    log.error('Error listing client CFS files:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing client CFS files',
      error: error.message,
    });
  }
};

/**
 * Delete file from Client CFS (Admin only)
 * DELETE /api/clients/:clientId/cfs/files/:attachmentId
 * 
 * Deletes a file from the client's CFS
 * Only admins can delete from client CFS
 */
const deleteClientCFSFile = async (req, res) => {
  try {
    const { clientId, attachmentId } = req.params;
    const userFirmId = req.user?.firmId;

    if (!userFirmId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate client exists
    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found or access denied',
      });
    }

    await cfsDriveService.deleteClientCFSFile(clientId, attachmentId, userFirmId, {
      req,
      reason: req.body?.reason || 'Client CFS delete',
    });

    const existingProfile = await clientProfileStorageService.getClientProfile({ firmId: userFirmId, client });
    const factSheet = existingProfile?.profile?.factSheet || {};
    await clientProfileStorageService.updateClientProfile({
      firmId: userFirmId,
      client,
      actorXID: req.user?.xID || 'SYSTEM',
      partialProfileInput: { clientFactSheet: { ...factSheet, updatedAt: new Date() } },
    });

    res.json({
      success: true,
      message: 'File deleted from client CFS successfully',
    });
  } catch (error) {
    log.error('Error deleting client CFS file:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file from client CFS',
      error: error.message,
    });
  }
};

/**
 * Download Client CFS file (Admin and case users)
 * GET /api/clients/:clientId/cfs/files/:attachmentId/download
 * 
 * Downloads a file from the client's CFS
 * Accessible by admins and users with access to cases for this client
 */
const downloadClientCFSFile = async (req, res) => {
  try {
    const { clientId, attachmentId } = req.params;
    const userFirmId = req.user?.firmId;

    if (!userFirmId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate client exists
    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found or access denied',
      });
    }

    // Find attachment
    const Attachment = require('../models/Attachment.model');
    const attachment = await Attachment.findOne({
      _id: attachmentId,
      firmId: userFirmId,
      clientId: clientId,
      source: 'client_cfs',
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'File not found or access denied',
      });
    }

    const provider = await StorageProviderFactory.getProvider(userFirmId);

    // Download from Google Drive
    if (!attachment.driveFileId) {
      return res.status(404).json({
        success: false,
        message: 'File not available in Google Drive',
      });
    }

    const fileStream = await provider.downloadFile(attachment.driveFileId);
    const safeFilename = sanitizeFilename(attachment.fileName);

    // Set response headers
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    // Stream file to response
    fileStream.pipe(res);
  } catch (error) {
    log.error('Error downloading client CFS file:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading file from client CFS',
      error: error.message,
    });
  }
};



const listClientCfsComments = async (req, res) => {
  try {
    const { clientId } = req.params;
    const userFirmId = req.user?.firmId;
    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    const profile = await clientProfileStorageService.getClientProfile({ firmId: userFirmId, client });
    const comments = profile?.profile?.factSheet?.comments || [];
    return res.json({ success: true, data: comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching CFS comments', error: error.message });
  }
};

const addClientCfsComment = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { commentText, attachments = [] } = req.body;
    const userFirmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    const profile = await clientProfileStorageService.getClientProfile({ firmId: userFirmId, client });
    const factSheet = profile?.profile?.factSheet || {};
    const comments = Array.isArray(factSheet.comments) ? [...factSheet.comments] : [];
    const entry = {
      client_id: clientId,
      user_id: userXID,
      author_name: req.user?.name || req.user?.email || userXID,
      comment_text: commentText,
      created_at: new Date(),
      attachments: attachments.map((a) => ({
        file_name: a.file_name,
        file_url: a.file_url,
        uploaded_by: userXID,
        uploaded_at: new Date(),
      })),
    };
    comments.unshift(entry);
    await clientProfileStorageService.updateClientProfile({
      firmId: userFirmId,
      client,
      actorXID: userXID || 'SYSTEM',
      partialProfileInput: {
        clientFactSheet: {
          ...factSheet,
          comments,
          updatedAt: new Date(),
        },
      },
    });

    await logClientFactSheetAction({
      clientId,
      firmId: userFirmId,
      actionType: 'CLIENT_CFS_COMMENT_ADDED',
      description: `CFS comment added for client ${clientId}`,
      performedByXID: userXID,
      metadata: { commentLength: commentText?.length || 0 },
      req,
    });

    return res.status(201).json({ success: true, data: entry, message: 'Comment added' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error adding CFS comment', error: error.message });
  }
};

const listClientActivity = async (req, res) => {
  try {
    const { clientId } = req.params;
    const userFirmId = req.user?.firmId;
    const ClientAudit = require('../models/ClientAudit.model');
    const data = await ClientAudit.find({ clientId, firmId: userFirmId }).sort({ timestamp: -1 }).limit(100).lean();
    return res.json({ success: true, data: data.map((item) => ({ id: item._id, actionType: item.actionType, description: item.description, timestamp: item.timestamp })) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching client activity', error: error.message });
  }
};

const listClientDockets = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { limit = 20, order = 'desc' } = req.query;
    const Case = require('../models/Case.model');

    const rows = await Case.find({ firmId: req.user.firmId, clientId })
      .sort({ createdAt: String(order).toLowerCase() === 'asc' ? 1 : -1 })
      .limit(parseInt(limit, 10))
      .select('caseId category status createdAt')
      .lean();

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching client dockets' });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient: wrapWriteHandler(updateClient),
  toggleClientStatus: wrapWriteHandler(toggleClientStatus),
  changeLegalName: wrapWriteHandler(changeLegalName),
  updateClientFactSheet: wrapWriteHandler(updateClientFactSheet),
  uploadFactSheetFile: wrapWriteHandler(uploadFactSheetFile),
  createClientCFSUploadIntent: wrapWriteHandler(createClientCFSUploadIntent),
  finalizeClientCFSUpload: wrapWriteHandler(finalizeClientCFSUpload),
  deleteFactSheetFile: wrapWriteHandler(deleteFactSheetFile),
  // Client CFS management
  uploadClientCFSFile: wrapWriteHandler(uploadClientCFSFile),
  listClientCFSFiles,
  deleteClientCFSFile: wrapWriteHandler(deleteClientCFSFile),
  downloadClientCFSFile,
  listClientCfsComments,
  addClientCfsComment: wrapWriteHandler(addClientCfsComment),
  listClientActivity,
  listClientDockets,
  __testables: {
    persistClientProfileOrRollback,
  },
};
