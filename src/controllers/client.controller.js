const Case = require('../models/Case.model');
const ClientRepository = require('../repositories/ClientRepository');
const AttachmentRepository = require('../repositories/AttachmentRepository');
const { mapClientResponse } = require('../mappers/client.mapper');
const { generateNextClientId } = require('../services/clientIdGenerator');
const { 
  logFactSheetCreated, 
  logFactSheetUpdated, 
  logFactSheetFileAdded, 
  logFactSheetFileRemoved,
  logClientFactSheetAction
} = require('../services/clientFactSheetAudit.service');
const { getMimeType } = require('../utils/fileUtils');
const { StorageProviderFactory } = require('../services/storage/StorageProviderFactory');
const { areFileUploadsDisabled } = require('../services/featureFlags.service');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { executeWrite } = require('../utils/executeWrite');
const { incrementTenantMetric } = require('../services/tenantMetrics.service');
const Firm = require('../models/Firm.model');
const { parseBooleanQuery } = require('../utils/query.utils');
const cfsDriveService = require('../services/cfsDrive.service');

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

const buildClientLogContext = (req, extra = {}) => ({
  firmId: req.user?.firmId || req.firmId || null,
  requestId: req.requestId || req.headers?.['x-request-id'] || null,
  userId: req.user?._id || req.user?.id || null,
  route: req.originalUrl || req.url || null,
  ...extra,
});

const logClientError = (event, req, error, extra = {}) => {
  console.error(event, buildClientLogContext(req, {
    ...extra,
    error: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
  }));
};

const logClientWarn = (event, req, extra = {}) => {
  console.warn(event, buildClientLogContext(req, extra));
};

const isStorageDisabled = async (firmId) => {
  const firm = await Firm.findById(firmId).select('storage.mode').lean();
  return firm?.storage?.mode !== 'firm_connected';
};

const setupClientStorage = async ({ req, userFirmId, clientId, clientMongoId }) => {
  console.info('CLIENT_STORAGE_SETUP_STARTED', buildClientLogContext(req, {
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
    setNoCacheHeaders(res);
    const { activeOnly, forCreateCase } = req.query;
    const shouldFilterActiveOnly = parseBooleanQuery(activeOnly);
    const shouldLoadForCreateCase = parseBooleanQuery(forCreateCase);

    const filter = shouldLoadForCreateCase || shouldFilterActiveOnly
      ? { isActive: true }
      : {};
    
    const clients = await ClientRepository.find(
      accessContext.firmId,
      filter,
      accessContext.role,
      {
        select: 'clientId businessName businessEmail primaryContactNumber status isSystemClient isInternal isDefaultClient createdAt',
        sort: { clientId: 1 },
        logContext: buildClientLogContext(req, { model: 'Client' }),
      }
    );

    const normalizedClients = normalizeClientList(clients).map(mapClientResponse);
    return res.json(buildClientListResponse(normalizedClients));
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
    
    const attachments = await AttachmentRepository.findByClientSource(accessContext.firmId, clientId, 'client_cfs');
    const payload = mapClientResponse(client);
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
  } catch (error) {
    logClientError('CLIENT_GET_ERROR', req, error, {
      clientId: req.params?.clientId || null,
    });
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
 * - businessName, businessAddress, primaryContactNumber, businessEmail
 * 
 * Optional fields:
 * - secondaryContactNumber, PAN, GST, TAN, CIN, latitude, longitude
 */
const createClient = async (req, res) => {
  try {
    // STEP 1: Sanitize input - Remove empty, null, undefined values
    const sanitizedBody = Object.fromEntries(
      Object.entries(req.body).filter(
        ([key, value]) => value !== '' && value !== null && value !== undefined
      )
    );
    
    // STEP 2: Unconditionally strip forbidden/deprecated fields
    // NOTE: These fields are also not in the allowedFields whitelist (STEP 3),
    // but we explicitly delete them here as a defensive measure and to make
    // the intent clear that these fields must NEVER be accepted.
    ['latitude', 'longitude', 'businessPhone'].forEach(field => {
      delete sanitizedBody[field];
    });
    
    // STEP 3: Define allowed fields (whitelist approach)
    const allowedFields = [
      'businessName',
      'businessAddress',
      'businessEmail',
      'primaryContactNumber',
      'secondaryContactNumber',
      'PAN',
      'TAN',
      'GST',
      'CIN'
    ];
    
    // STEP 4: Reject unexpected fields
    const unexpectedFields = Object.keys(sanitizedBody).filter(
      key => !allowedFields.includes(key)
    );
    
    if (unexpectedFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unexpected field(s) in client payload: ${unexpectedFields.join(', ')}`,
      });
    }
    
    // STEP 5: Extract and validate required business fields
    const {
      businessName,
      businessAddress,
      primaryContactNumber,
      businessEmail,
      secondaryContactNumber,
      PAN,
      GST,
      TAN,
      CIN,
    } = sanitizedBody;
    
    // Validate required business fields
    if (!businessName || !businessName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business name is required',
      });
    }
    
    if (!businessAddress || !businessAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business address is required',
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
        businessAddress: businessAddress.trim(),
        primaryContactNumber: primaryContactNumber.trim(),
        secondaryContactNumber: secondaryContactNumber ? secondaryContactNumber.trim() : undefined,
        businessEmail: businessEmail.trim().toLowerCase(),
        PAN: PAN ? PAN.trim().toUpperCase() : undefined,
        GST: GST ? GST.trim().toUpperCase() : undefined,
        TAN: TAN ? TAN.trim().toUpperCase() : undefined,
        CIN: CIN ? CIN.trim().toUpperCase() : undefined,
        // System-owned fields (injected server-side only, NEVER from client)
        firmId: userFirmId,
        createdByXid,
        createdBy: req.user?.email ? req.user.email.trim().toLowerCase() : undefined,
        isSystemClient: false,
        isActive: true,
        status: 'ACTIVE',
        previousBusinessNames: [],
      }, req.user?.role);
    });

    await incrementTenantMetric(userFirmId, 'clients').catch(() => null);

    console.info('CLIENT_CREATED', buildClientLogContext(req, {
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
 * RESTRICTED FIELDS - Only these fields can be updated:
 * - businessEmail
 * - primaryContactNumber
 * - secondaryContactNumber
 * 
 * IMMUTABLE FIELDS - These cannot be changed:
 * - clientId
 * - businessName (use changeLegalName endpoint instead)
 * - PAN, TAN, CIN
 * - createdByXid
 * - isSystemClient
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
    
    const isProtectedClient = client.isDefaultClient === true || client.isSystemClient === true || client.isInternal === true;

    if (!isProtectedClient && businessName !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Business name cannot be updated through this endpoint. Use the "Change Legal Name" action instead.',
      });
    }

    if (isProtectedClient && businessName !== undefined) {
      client.businessName = businessName;
    }

    if (isProtectedClient && businessAddress !== undefined) {
      client.businessAddress = businessAddress;
    }

    // Update allowed fields
    if (businessEmail !== undefined) {
      client.businessEmail = businessEmail.toLowerCase();
    }
    
    if (primaryContactNumber !== undefined) {
      client.primaryContactNumber = primaryContactNumber;
    }
    
    if (secondaryContactNumber !== undefined) {
      client.secondaryContactNumber = secondaryContactNumber || null;
    }
    
    await client.save();
    
    res.json({
      success: true,
      data: mapClientResponse(client),
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
    client.status = isActive ? 'ACTIVE' : 'INACTIVE';
    await client.save();
    
    console.log(`[CLIENT_STATUS] Client ${clientId} ${isActive ? 'activated' : 'deactivated'} by ${req.user?.xID}`);
    
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
    
    // Initialize clientFactSheet if it doesn't exist
    if (!client.clientFactSheet) {
      client.clientFactSheet = { files: [] };
    }
    
    // Track if this is creation or update for audit logging
    // Use _initialized flag for accurate detection
    const isCreation = !client.clientFactSheet._initialized;
    
    // Update description and notes
    if (description !== undefined) {
      client.clientFactSheet.description = description;
      client.clientFactSheet.updatedAt = new Date();
    }
    if (notes !== undefined) {
      client.clientFactSheet.notes = notes;
      client.clientFactSheet.updatedAt = new Date();
    }

    // Optional: capture structured client fact sheet metadata.
    // This complements existing top-level client fields and keeps CFS case-friendly.
    if (basicInfo && typeof basicInfo === 'object') {
      client.clientFactSheet.basicInfo = {
        clientName: basicInfo.clientName ?? client.clientFactSheet.basicInfo?.clientName ?? client.businessName,
        entityType: basicInfo.entityType ?? client.clientFactSheet.basicInfo?.entityType ?? '',
        PAN: basicInfo.PAN ?? client.clientFactSheet.basicInfo?.PAN ?? client.PAN ?? '',
        CIN: basicInfo.CIN ?? client.clientFactSheet.basicInfo?.CIN ?? client.CIN ?? '',
        GSTIN: basicInfo.GSTIN ?? client.clientFactSheet.basicInfo?.GSTIN ?? client.GST ?? '',
        address: basicInfo.address ?? client.clientFactSheet.basicInfo?.address ?? client.businessAddress,
        contactPerson: basicInfo.contactPerson ?? client.clientFactSheet.basicInfo?.contactPerson ?? '',
        email: basicInfo.email ?? client.clientFactSheet.basicInfo?.email ?? client.businessEmail,
        phone: basicInfo.phone ?? client.clientFactSheet.basicInfo?.phone ?? client.primaryContactNumber,
      };
    }
    
    // Mark as initialized
    client.clientFactSheet._initialized = true;
    
    await client.save();
    
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
      data: client.clientFactSheet,
      message: 'Client Fact Sheet updated successfully',
    });
  } catch (error) {
    console.error('Error updating client fact sheet:', error);
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
  try {
    if (areFileUploadsDisabled()) {
      return res.status(503).json({
        success: false,
        message: 'File uploads are temporarily disabled',
      });
    }
    const { clientId } = req.params;
    
    // Get firmId and xID from authenticated user
    const userFirmId = req.user?.firmId;
    const performedByXID = req.user?.xID;
    
    if (!userFirmId || !performedByXID) {
      return res.status(403).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }
    
    const queuedFile = await cfsDriveService.uploadClientCFSFile(clientId, userFirmId, req.file, {
      userRole: req.user?.role,
      userEmail: req.user?.email || 'unknown',
      userXID: performedByXID,
      userName: req.user?.name || req.user?.email || performedByXID,
      description: req.body?.description || 'Client Fact Sheet attachment',
      fileType: req.body?.fileType || 'documents',
    });

    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);
    if (client) {
      client.clientFactSheet = client.clientFactSheet || {};
      client.clientFactSheet.updatedAt = new Date();
      await client.save();
    }
    
    // Log audit event
    await logFactSheetFileAdded({
      clientId,
      firmId: userFirmId,
      performedByXID,
      fileName: req.file.originalname,
      metadata: {
        fileId: String(queuedFile._id),
        mimeType: getMimeType(req.file.originalname) || req.file.mimetype || 'application/octet-stream',
        fileSize: req.file.size,
      },
    });
    await logClientFactSheetAction({
      clientId,
      firmId: userFirmId,
      actionType: 'CLIENT_CFS_ATTACHMENT_ADDED',
      description: `Attachment added to CFS for ${client.businessName}: ${req.file.originalname}`,
      performedByXID,
      metadata: { fileName: req.file.originalname, navigateTo: `/clients/${clientId}/cfs` },
      req,
    });
    
    res.status(202).json({
      success: true,
      data: {
        fileId: String(queuedFile._id),
        fileName: req.file.originalname,
        size: req.file.size || 0,
        mimeType: getMimeType(req.file.originalname) || req.file.mimetype || 'application/octet-stream',
        uploadedAt: queuedFile.createdAt || new Date(),
      },
      message: 'File upload queued for processing',
    });
  } catch (error) {
    console.error('Error uploading fact sheet file:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message,
    });
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
      client.clientFactSheet = client.clientFactSheet || {};
      client.clientFactSheet.updatedAt = new Date();
      await client.save();
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
    console.error('Error deleting fact sheet file:', error);
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
  try {
    if (areFileUploadsDisabled()) {
      return res.status(503).json({
        success: false,
        message: 'File uploads are temporarily disabled',
      });
    }
    const { clientId } = req.params;
    const { description, fileType = 'documents' } = req.body;

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided',
      });
    }

    // Validate description
    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'File description is required',
      });
    }

    // Get user context
    const userFirmId = req.user?.firmId;
    const userXID = req.user?.xID;
    const userName = req.user?.name || req.user?.email;

    if (!userFirmId || !userXID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const caseFile = await cfsDriveService.uploadClientCFSFile(clientId, userFirmId, req.file, {
      userRole: req.user?.role,
      userEmail: req.user?.email || 'unknown',
      userXID,
      userName,
      description: description.trim(),
      fileType,
    });

    const client = await ClientRepository.findByClientId(userFirmId, clientId, req.user?.role);
    if (client) {
      client.clientFactSheet = client.clientFactSheet || {};
      client.clientFactSheet.updatedAt = new Date();
      await client.save();
    }

    return res.status(202).json({
      success: true,
      data: caseFile,
      message: 'File upload queued for processing',
    });
  } catch (error) {
    console.error('Error uploading client CFS file:', error);

    res.status(500).json({
      success: false,
      message: 'Error uploading file to client CFS',
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
    console.error('Error listing client CFS files:', error);
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

    client.clientFactSheet = client.clientFactSheet || {};
    client.clientFactSheet.updatedAt = new Date();
    await client.save();

    res.json({
      success: true,
      message: 'File deleted from client CFS successfully',
    });
  } catch (error) {
    console.error('Error deleting client CFS file:', error);
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

    // Set response headers
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);

    // Stream file to response
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading client CFS file:', error);
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
    const comments = client.clientFactSheet?.comments || [];
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
    if (!client.clientFactSheet) client.clientFactSheet = { files: [], comments: [] };
    if (!Array.isArray(client.clientFactSheet.comments)) client.clientFactSheet.comments = [];
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
    client.clientFactSheet.comments.unshift(entry);
    await client.save();

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
};
