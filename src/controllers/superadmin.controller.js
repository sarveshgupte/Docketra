const User = require('../models/User.model');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const SuperadminAudit = require('../models/SuperadminAudit.model');
const AuthAudit = require('../models/AuthAudit.model');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const emailService = require('../services/email.service');
const mongoose = require('mongoose');
const { generateNextClientId } = require('../services/clientIdGenerator');
const { slugify, normalizeFirmSlug } = require('../utils/slugify');
const { getDashboardSnapshot } = require('../utils/operationalMetrics');
const { wrapWriteHandler } = require('../utils/transactionGuards');

const { createFirmHierarchy, FirmBootstrapError } = require('../services/firmBootstrap.service');
const { isFirmCreationDisabled } = require('../services/featureFlags.service');

// Constants
const FIRM_ID_PATTERN = /^FIRM\d{3,}$/i;

const findFirmAdmin = async (firmObjectId) => {
  return User.findOne({ firmId: firmObjectId, isSystem: true, role: 'Admin' });
};

/**
 * Log Superadmin action to audit log
 * 
 * Supports both human-performed and system-triggered actions:
 * - For human actions: provide performedById as MongoDB ObjectId
 * - For system actions: performedById can be null,
 *   and performedBySystem will be set to true automatically
 */
const logSuperadminAction = async ({ actionType, description, performedBy, performedById, targetEntityType, targetEntityId, metadata = {}, req }) => {
  try {
    // Determine if this is a system-triggered action
    // System actions are identified by:
    // 1. performedById is null/undefined
    // 2. performedById is not a valid MongoDB ObjectId
    const isSystemAction = !performedById ||
                          (typeof performedById === 'string' && !mongoose.Types.ObjectId.isValid(performedById));
    
    // Build audit log entry
    const auditEntry = {
      actionType,
      description,
      performedBy,
      targetEntityType,
      targetEntityId,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
      metadata,
    };
    
    // Set system flag and performedById based on action type
    if (isSystemAction) {
      auditEntry.performedBySystem = true;
      auditEntry.performedById = null; // Don't pass invalid string to ObjectId field
    } else {
      auditEntry.performedById = performedById;
      auditEntry.performedBySystem = false;
    }
    
    await SuperadminAudit.create(auditEntry);
  } catch (error) {
    console.error('[SUPERADMIN_AUDIT] Failed to log action:', error.message);
    // Don't throw - audit failures shouldn't block the request
  }
};

/**
 * Create a new firm with transactional guarantees
 * POST /api/superadmin/firms
 * 
 * Atomically creates (ONE TRANSACTION):
 * 1. Firm
 * 2. Default Client (represents the firm, isSystemClient=true)
 * 3. Default Admin User (assigned to firm and default client)
 * 4. Links everything: Firm.defaultClientId, Admin.firmId, Admin.defaultClientId
 * 
 * If any step fails, all changes are rolled back.
 * This ensures a firm never exists without its default client and admin.
 * 
 * Sends Tier-1 emails:
 * - Firm Created SUCCESS to SuperAdmin
 * - Default Admin Created to Admin email
 * - Firm Creation FAILED to SuperAdmin (on error)
 */
const createFirm = async (req, res) => {
  const requestId = req.requestId || crypto.randomUUID();
  try {
    if (isFirmCreationDisabled()) {
      return res.status(503).json({
        success: false,
        message: 'Firm creation is temporarily disabled',
        requestId,
      });
    }

    // Create a plain request context (no Express API leakage)
    // This context is safe to pass to services and background jobs
    const requestContext = {
      requestId,
      actorXID: req.user?.xID,
      actorEmail: req.user?.email,
      actorId: req.user?._id,
      ip: req.ip,
      // Side-effect queue properties (transferred from req)
      _pendingSideEffects: req._pendingSideEffects || [],
      transactionActive: req.transactionActive || false,
      transactionCommitted: req.transactionCommitted || false,
    };

    const result = await createFirmHierarchy({
      payload: req.body,
      performedBy: req.user,
      requestId,
      context: requestContext, // Pass context instead of req
    });

    // Transaction has completed successfully if we reach here
    // Mark as committed so side-effect queue will flush emails
    requestContext.transactionCommitted = true;
    
    // Transfer side effects back to req for proper lifecycle management
    req._pendingSideEffects = requestContext._pendingSideEffects;
    req.transactionCommitted = true;

    await logSuperadminAction({
      actionType: 'FirmCreated',
      description: `Firm created: ${result.firm.name} (${result.firm.firmId}, ${result.firm.firmSlug})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: result.firm._id.toString(),
      metadata: {
        firmId: result.firm.firmId,
        firmSlug: result.firm.firmSlug,
        defaultClientId: result.defaultClient._id,
        adminXID: result.adminUser.xID,
      },
      req,
    });

    // Return 201 Created (SUCCESS case)
    // Note: This endpoint must NEVER return 401 after successful authentication
    // 401 is reserved for authentication failures only (missing/invalid token)
    // Business logic errors use 400 (validation), 403 (authorization), 422 (semantic), or 500 (server error)
    return res.status(201).json({
      success: true,
      message: 'Firm created successfully with default client and admin. Admin credentials sent by email.',
      data: {
        firm: {
          _id: result.firm._id,
          firmId: result.firm.firmId,
          firmSlug: result.firm.firmSlug,
          name: result.firm.name,
          status: result.firm.status,
          bootstrapStatus: result.firm.bootstrapStatus,
          defaultClientId: result.firm.defaultClientId,
          createdAt: result.firm.createdAt,
        },
        defaultClient: {
          _id: result.defaultClient._id,
          clientId: result.defaultClient.clientId,
          businessName: result.defaultClient.businessName,
          isSystemClient: result.defaultClient.isSystemClient,
        },
        defaultAdmin: {
          _id: result.adminUser._id,
          xID: result.adminUser.xID,
          name: result.adminUser.name,
          email: result.adminUser.email,
          role: result.adminUser.role,
          status: result.adminUser.status,
          defaultClientId: result.adminUser.defaultClientId,
        },
      },
      requestId,
    });
  } catch (error) {
    // Error handling: Never return 401 here - authentication already succeeded
    // 401 is only for auth failures (handled by authenticate middleware)
    // Business errors use: 400 (validation), 403 (forbidden), 409 (conflict), 422 (semantic), 500 (server)
    
    if (error instanceof FirmBootstrapError && error.statusCode === 200 && error.meta?.idempotent) {
      const firm = error.meta.firm;
      return res.status(200).json({
        success: true,
        message: 'Firm already exists',
        data: {
          firm: {
            _id: firm._id,
            firmId: firm.firmId,
            firmSlug: firm.firmSlug,
            name: firm.name,
            status: firm.status,
            bootstrapStatus: firm.bootstrapStatus,
            defaultClientId: firm.defaultClientId,
            createdAt: firm.createdAt,
          },
        },
        idempotent: true,
        requestId,
      });
    }

    if (error instanceof FirmBootstrapError) {
      // Use appropriate status code from error (400, 403, 409, 422, 500, 503)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        requestId,
        ...(error.meta || {}),
      });
    }

    console.error('[SUPERADMIN] Error creating firm:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create firm - transaction rolled back',
      error: error.message,
      requestId,
    });
  }
};

/**
 * Get platform-level statistics
 * GET /api/superadmin/stats
 */
const getPlatformStats = async (req, res) => {
  try {
    const firmId = req.user?.firmId || null;
    const firmFilter = firmId ? { _id: firmId } : {};
    const firmScope = firmId ? { firmId } : {};

    // Get total firms
    const totalFirms = await Firm.countDocuments(firmFilter);
    const activeFirms = await Firm.countDocuments({ ...firmFilter, status: 'ACTIVE' });
    
    // Get total clients across all firms
    const totalClients = await Client.countDocuments(firmScope);
    
    // Get total users across all firms (excluding SUPER_ADMIN)
    const totalUsers = await User.countDocuments({ ...firmScope, role: { $ne: 'SuperAdmin' } });
    
    res.json({
      success: true,
      data: {
        totalFirms,
        activeFirms,
        inactiveFirms: totalFirms - activeFirms,
        totalClients,
        totalUsers,
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error getting platform stats:', error);
    res.status(200).json({
      success: false,
      degraded: true,
      message: 'Platform statistics unavailable; returning empty totals.',
      data: {
        totalFirms: 0,
        activeFirms: 0,
        inactiveFirms: 0,
        totalClients: 0,
        totalUsers: 0,
      },
    });
  }
};

/**
 * List all firms with client and user counts
 * GET /api/superadmin/firms
 */
const listFirms = async (req, res) => {
  try {
    const firms = await Firm.find()
      .select('firmId firmSlug name status createdAt')
      .sort({ createdAt: -1 });
    
    // Get counts for each firm
    const firmsWithCounts = await Promise.all(
      firms.map(async (firm) => {
        const clientCount = await Client.countDocuments({ firmId: firm._id });
        const userCount = await User.countDocuments({ firmId: firm._id });
        
        return {
          _id: firm._id,
          firmId: firm.firmId,
          firmSlug: firm.firmSlug,
          name: firm.name,
          status: firm.status,
          isActive: firm.status === 'ACTIVE',
          clientCount,
          userCount,
          createdAt: firm.createdAt,
        };
      })
    );
    
    res.json({
      success: true,
      data: firmsWithCounts,
      count: firmsWithCounts.length,
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error listing firms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list firms',
      error: error.message,
    });
  }
};

/**
 * Update firm status (activate/suspend)
 * PATCH /api/superadmin/firms/:id
 */
const updateFirmStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be ACTIVE or SUSPENDED',
      });
    }
    
    const firm = await Firm.findById(id);
    
    if (!firm) {
      return res.status(404).json({
        success: false,
        code: 'FIRM_NOT_FOUND',
        message: 'Firm not found',
      });
    }
    
    const oldStatus = firm.status;
    firm.status = status;
    await firm.save();
    
    // Log action
    const actionType = status === 'ACTIVE' ? 'FirmActivated' : 'FirmSuspended';
    await logSuperadminAction({
      actionType,
      description: `Firm ${status === 'ACTIVE' ? 'activated' : 'suspended'}: ${firm.name} (${firm.firmId})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: firm._id.toString(),
      metadata: { firmId: firm.firmId, name: firm.name, oldStatus, newStatus: status },
      req,
    });
    
    res.json({
      success: true,
      message: `Firm ${status === 'ACTIVE' ? 'activated' : 'suspended'} successfully`,
      data: {
        _id: firm._id,
        firmId: firm.firmId,
        name: firm.name,
        status: firm.status,
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error updating firm status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update firm status',
      error: error.message,
    });
  }
};

/**
 * Disable firm immediately (single action)
 * POST /api/superadmin/firms/:id/disable
 */
const disableFirmImmediately = async (req, res) => {
  try {
    const { id } = req.params;
    const firm = await Firm.findById(id);

    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }

    const oldStatus = firm.status;
    firm.status = 'SUSPENDED';
    await firm.save();

    await logSuperadminAction({
      actionType: 'FirmSuspended',
      description: `Firm disabled immediately: ${firm.name} (${firm.firmId})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: firm._id.toString(),
      metadata: { firmId: firm.firmId, name: firm.name, oldStatus, newStatus: 'SUSPENDED' },
      req,
    });

    return res.json({
      success: true,
      message: 'Firm disabled immediately',
      data: {
        _id: firm._id,
        firmId: firm.firmId,
        name: firm.name,
        status: firm.status,
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error disabling firm immediately:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to disable firm',
      error: error.message,
    });
  }
};

/**
 * Create firm admin
 * POST /api/superadmin/firms/:firmId/admin
 * 
 * Creates an Admin user for a firm with proper hierarchy:
 * - firmId: Links to the firm
 * - defaultClientId: Links to the firm's default client
 * 
 * The admin's defaultClientId MUST match the firm's defaultClientId.
 */
const createFirmAdmin = async (req, res) => {
  try {
    const { firmId } = req.params;
    const { name, email, xID } = req.body;
    
    // Validate required fields
    if (!name || !email || !xID) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and xID are required',
      });
    }
    
    // Normalize xID to uppercase
    const normalizedXID = xID.toUpperCase();
    
    // Validate xID format
    if (!/^X\d{6}$/.test(normalizedXID)) {
      return res.status(400).json({
        success: false,
        message: 'xID must be in format X123456',
      });
    }
    
    // Find firm by MongoDB _id and populate defaultClientId
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }
    
    // Ensure firm has a defaultClientId
    if (!firm.defaultClientId) {
      return res.status(400).json({
        success: false,
        message: 'Firm does not have a default client. Cannot create admin.',
      });
    }
    
    // Check if user with this xID already exists
    const existingUser = await User.findOne({ xID: normalizedXID });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this xID already exists',
      });
    }
    
    // Check if user with this email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }
    
    // Generate password setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenHash = crypto.createHash('sha256').update(setupToken).digest('hex');
    const setupExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    
    // Create admin user with firmId and defaultClientId
    const adminUser = new User({
      xID: normalizedXID,
      name,
      email: email.toLowerCase(),
      firmId: firm._id,
      defaultClientId: firm.defaultClientId, // Set to firm's default client
      role: 'Admin',
      status: 'INVITED',
      isActive: true,
      passwordSet: false,
      mustSetPassword: true,
      mustChangePassword: true,
      passwordSetupTokenHash: setupTokenHash,
      passwordSetupExpires: setupExpires,
      inviteSentAt: new Date(),
      passwordSetAt: null,
    });
    
    await adminUser.save();
    
    // Send password setup email
    try {
      const emailResult = await emailService.sendPasswordSetupEmail({
        email: adminUser.email,
        name: adminUser.name,
        token: setupToken,
        xID: normalizedXID,
        firmSlug: firm.firmSlug, // Pass firmSlug for firm-specific URL in email
        req,
      });
      if (!emailResult.success) {
        console.warn('[SUPERADMIN] Password setup email not sent:', emailResult.error);
      }
    } catch (emailError) {
      console.warn('[SUPERADMIN] Failed to send password setup email:', emailError.message);
      // Don't fail the request - admin was created successfully
    }
    
    // Log action
    await logSuperadminAction({
      actionType: 'FirmAdminCreated',
      description: `Firm admin created: ${name} (${xID}) for firm ${firm.name} (${firm.firmId})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'User',
      targetEntityId: adminUser._id.toString(),
      metadata: { firmId: firm.firmId, firmName: firm.name, adminXID: xID, adminEmail: email },
      req,
    });
    
    res.status(201).json({
      success: true,
      message: 'Firm admin created successfully',
      data: {
        _id: adminUser._id,
        xID: adminUser.xID,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        status: adminUser.status,
        firm: {
          _id: firm._id,
          firmId: firm.firmId,
          name: firm.name,
        },
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error creating firm admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create firm admin',
      error: error.message,
    });
  }
};

/**
 * Get firm metadata by slug (PUBLIC endpoint for login page)
 * GET /api/public/firms/:firmSlug
 */
const getFirmBySlug = async (req, res) => {
  try {
    const { firmSlug } = req.params;
    
    if (!firmSlug) {
      return res.status(400).json({
        success: false,
        message: 'Firm slug is required',
      });
    }
    
    const normalizedSlug = normalizeFirmSlug(firmSlug);
    if (!normalizedSlug) {
      return res.status(400).json({
        success: false,
        code: 'FIRM_RESOLUTION_FAILED',
        message: 'Firm slug is required',
      });
    }
    
    const firm = await Firm.findOne({ firmSlug: normalizedSlug })
      .select('firmId firmSlug name status');
    
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }
    
    res.json({
      success: true,
      data: {
        firmId: firm.firmId,
        firmSlug: firm.firmSlug,
        name: firm.name,
        status: firm.status,
        isActive: firm.status === 'ACTIVE',
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error getting firm by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get firm',
      error: error.message,
    });
  }
};

/**
 * Operational health snapshot for pilot safety dashboard
 * GET /api/superadmin/health
 */
const getOperationalHealth = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }
    return res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        firms: getDashboardSnapshot(),
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error generating operational health:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate health snapshot',
      error: error.message,
    });
  }
};

/**
 * Switch SuperAdmin into a firm context (impersonation mode)
 * POST /api/superadmin/switch-firm
 * 
 * Allows SuperAdmin to enter firm context for debugging, support, or setup.
 * Does NOT mutate user identity or firm ownership.
 * Attaches impersonatedFirmId to request context.
 * 
 * Supports two impersonation modes:
 * - READ_ONLY (default): View data only, mutations blocked
 * - FULL_ACCESS: Full access including write operations
 */
const switchFirm = async (req, res) => {
  try {
    const { firmId, mode = 'READ_ONLY' } = req.body;
    
    if (!firmId) {
      return res.status(400).json({
        success: false,
        message: 'firmId is required',
      });
    }
    
    // Validate impersonation mode
    if (!['READ_ONLY', 'FULL_ACCESS'].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid impersonation mode. Must be READ_ONLY or FULL_ACCESS.',
      });
    }
    
    // Find firm by MongoDB _id or firmId (FIRM001 format)
    let firm;
    if (mongoose.Types.ObjectId.isValid(firmId)) {
      firm = await Firm.findById(firmId);
    } else if (FIRM_ID_PATTERN.test(firmId)) {
      firm = await Firm.findOne({ firmId: firmId.toUpperCase() });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid firmId format',
      });
    }
    
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }
    
    // Generate a unique session ID for this impersonation session
    const sessionId = crypto.randomUUID();
    
    // Log impersonation action
    await logSuperadminAction({
      actionType: 'SwitchFirm',
      description: `SuperAdmin switched into firm context: ${firm.name} (${firm.firmId}) [${mode}]`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: firm._id.toString(),
      metadata: {
        firmId: firm.firmId,
        firmSlug: firm.firmSlug,
        fromContext: 'GLOBAL',
        toContext: 'FIRM',
        sessionId,
        mode,
      },
      req,
    });
    
    // Return firm context information
    // The actual context will be managed on frontend via session/state
    res.json({
      success: true,
      message: `Switched to firm context: ${firm.name}`,
      data: {
        impersonatedFirmId: firm._id.toString(),
        firmId: firm.firmId,
        firmSlug: firm.firmSlug,
        firmName: firm.name,
        firmStatus: firm.status,
        sessionId,
        impersonationMode: mode,
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error switching firm context:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to switch firm context',
      error: error.message,
    });
  }
};

/**
 * Exit firm context and return to GLOBAL scope
 * POST /api/superadmin/exit-firm
 * 
 * Clears impersonation and returns SuperAdmin to GLOBAL context.
 */
const exitFirm = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // Log exit action with sessionId for audit trail linkage
    await logSuperadminAction({
      actionType: 'ExitFirm',
      description: 'SuperAdmin exited firm context, returned to GLOBAL scope',
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: null,
      metadata: {
        fromContext: 'FIRM',
        toContext: 'GLOBAL',
        sessionId: sessionId || null,
      },
      req,
    });
    
    res.json({
      success: true,
      message: 'Returned to GLOBAL context',
      data: {
        impersonatedFirmId: null,
        scope: 'GLOBAL',
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error exiting firm context:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to exit firm context',
      error: error.message,
    });
  }
};

/**
 * Get firm default admin details for SuperAdmin visibility
 * GET /api/superadmin/firms/:firmId/admin
 */
const getFirmAdminDetails = async (req, res) => {
  const { firmId } = req.params;

  const firm = await Firm.findById(firmId).select('firmId name');
  if (!firm) {
    return res.status(404).json({
      success: false,
      code: 'FIRM_NOT_FOUND',
      message: 'Firm not found',
    });
  }

  const admin = await findFirmAdmin(firm._id);
  if (!admin) {
    return res.status(404).json({
      success: false,
      code: 'ADMIN_NOT_FOUND',
      message: 'Default admin for this firm not found',
    });
  }

  let lastLoginAt = null;
  try {
    const lastLoginAudit = await AuthAudit.findOne({
      userId: admin._id,
      actionType: 'Login',
    }).select('timestamp').sort({ timestamp: -1 });
    lastLoginAt = lastLoginAudit?.timestamp || null;
  } catch (error) {
    console.warn('[SUPERADMIN] Failed to fetch admin last login audit:', error.message);
  }

  return res.status(200).json({
    success: true,
    data: {
      name: admin.name,
      emailMasked: emailService.maskEmail(admin.email),
      xID: admin.xID,
      status: admin.status,
      lastLoginAt,
      passwordSetAt: admin.passwordSetAt || null,
      inviteSentAt: admin.inviteSentAt || null,
      failedLoginAttempts: admin.failedLoginAttempts || 0,
      isLocked: Boolean(admin.isLocked),
    },
  });
};

/**
 * Update firm default admin status (ACTIVE / DISABLED)
 * PATCH /api/superadmin/firms/:firmId/admin/status
 */
const updateFirmAdminStatus = async (req, res) => {
  const { firmId } = req.params;
  const { status } = req.body || {};

  if (!['ACTIVE', 'DISABLED'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be ACTIVE or DISABLED',
    });
  }

  const firm = await Firm.findById(firmId).select('firmId name');
  if (!firm) {
    return res.status(404).json({
      success: false,
      code: 'FIRM_NOT_FOUND',
      message: 'Firm not found',
    });
  }

  const admin = await findFirmAdmin(firm._id);
  if (!admin) {
    return res.status(404).json({
      success: false,
      code: 'ADMIN_NOT_FOUND',
      message: 'Default admin for this firm not found',
    });
  }

  if (admin.status === status) {
    return res.status(422).json({
      success: false,
      code: 'ADMIN_STATUS_UNCHANGED',
      message: `Admin is already ${status}`,
    });
  }

  if (status === 'ACTIVE' && admin.mustSetPassword) {
    return res.status(422).json({
      success: false,
      code: 'ADMIN_PASSWORD_NOT_SET',
      message: 'Cannot activate admin before password is set',
    });
  }

  const oldStatus = admin.status;
  admin.status = status;
  admin.isActive = status === 'ACTIVE';
  await admin.save();

  await logSuperadminAction({
    actionType: 'AdminStatusChanged',
    description: `Admin status changed for firm ${firm.name} (${firm.firmId}): ${admin.xID} ${oldStatus} → ${status}`,
    performedBy: req.user.email,
    performedById: req.user._id,
    targetEntityType: 'User',
    targetEntityId: admin._id.toString(),
    metadata: {
      firmId: firm.firmId,
      firmName: firm.name,
      adminXID: admin.xID,
      oldStatus,
      newStatus: status,
    },
    req,
  });

  return res.status(200).json({
    success: true,
    message: `Admin ${status === 'ACTIVE' ? 'enabled' : 'disabled'} successfully`,
    data: {
      xID: admin.xID,
      status: admin.status,
      isActive: admin.isActive,
    },
  });
};

/**
 * Force password reset for ACTIVE firm admin
 * POST /api/superadmin/firms/:firmId/admin/force-reset
 */
const forceResetFirmAdmin = async (req, res) => {
  const { firmId } = req.params;

  const firm = await Firm.findById(firmId);
  if (!firm) {
    return res.status(404).json({
      success: false,
      code: 'FIRM_NOT_FOUND',
      message: 'Firm not found',
    });
  }

  const admin = await findFirmAdmin(firm._id);
  if (!admin) {
    return res.status(404).json({
      success: false,
      code: 'ADMIN_NOT_FOUND',
      message: 'Default admin for this firm not found',
    });
  }

  if (admin.status !== 'ACTIVE') {
    return res.status(422).json({
      success: false,
      code: 'ADMIN_NOT_ACTIVE',
      message: 'Force password reset is only available for ACTIVE admins',
    });
  }

  const newToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  admin.passwordSetupTokenHash = null;
  admin.passwordSetupExpires = null;
  admin.passwordResetTokenHash = newTokenHash;
  admin.passwordResetExpires = tokenExpires;
  admin.forcePasswordReset = true;
  admin.mustChangePassword = true;
  await admin.save();

  let emailSuccess = true;
  try {
    const emailResult = await emailService.sendAdminPasswordResetEmail({
      email: admin.email,
      name: admin.name,
      token: newToken,
      xID: admin.xID,
      firmSlug: firm.firmSlug,
      req,
    });
    if (emailResult && emailResult.success === false) {
      emailSuccess = false;
      console.warn('[SUPERADMIN] Admin force-reset email not sent:', emailResult.error);
    }
  } catch (emailError) {
    emailSuccess = false;
    console.warn('[SUPERADMIN] Failed to send admin force-reset email:', emailError.message);
  }

  await logSuperadminAction({
    actionType: emailSuccess ? 'AdminForcePasswordReset' : 'AdminForcePasswordResetEmailFailed',
    description: `Admin force password reset for firm ${firm.name} (${firm.firmId}), admin ${admin.xID}`,
    performedBy: req.user.email,
    performedById: req.user._id,
    targetEntityType: 'User',
    targetEntityId: admin._id.toString(),
    metadata: {
      firmId: firm.firmId,
      firmName: firm.name,
      adminXID: admin.xID,
      emailSuccess,
    },
    req,
  });

  return res.status(200).json({
    success: true,
    emailMasked: emailService.maskEmail(admin.email),
  });
};

/**
 * Resend Admin Access (Invite or Password Reset)
 * POST /api/superadmin/firms/:firmId/admin/resend-access
 *
 * Handles:
 * - INVITED: Regenerates passwordSetupToken and sends setup email
 * - ACTIVE: Regenerates passwordResetToken and sends reset email
 * - DISABLED: Rejects request
 *
 * Invalidates old unused tokens before generating new ones.
 * Always logs audit entry. Returns 200 even if email fails.
 */
const resendAdminAccess = async (req, res) => {
  const { firmId } = req.params;

  // Validate firm exists
  const firm = await Firm.findById(firmId);
  if (!firm) {
    return res.status(404).json({
      success: false,
      code: 'FIRM_NOT_FOUND',
      message: 'Firm not found',
    });
  }

  // Find the default admin for this firm (isSystem=true, role=Admin)
  const admin = await User.findOne({ firmId: firm._id, isSystem: true, role: 'Admin' });
  if (!admin) {
    return res.status(404).json({
      success: false,
      code: 'ADMIN_NOT_FOUND',
      message: 'Default admin for this firm not found',
    });
  }

  // Reject disabled admins
  if (admin.status === 'DISABLED') {
    return res.status(422).json({
      success: false,
      code: 'ADMIN_DISABLED',
      message: 'Admin account is disabled. Cannot resend access.',
    });
  }

  const isInvited = admin.status === 'INVITED';
  const newToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Invalidate old tokens and set new ones
  if (isInvited) {
    admin.passwordSetupTokenHash = newTokenHash;
    admin.passwordSetupExpires = tokenExpires;
    admin.inviteSentAt = new Date();
    // Clear any stale reset token
    admin.passwordResetTokenHash = null;
    admin.passwordResetExpires = null;
  } else {
    // ACTIVE
    admin.passwordResetTokenHash = newTokenHash;
    admin.passwordResetExpires = tokenExpires;
    // Clear any stale setup token
    admin.passwordSetupTokenHash = null;
    admin.passwordSetupExpires = null;
  }

  await admin.save();

  const maskedEmail = emailService.maskEmail(admin.email);
  const action = isInvited ? 'INVITE_RESENT' : 'PASSWORD_RESET_SENT';

  // Send email
  let emailSuccess = true;
  try {
    let emailResult;
    if (isInvited) {
      emailResult = await emailService.sendPasswordSetupEmail({
        email: admin.email,
        name: admin.name,
        token: newToken,
        xID: admin.xID,
        firmSlug: firm.firmSlug,
        req,
      });
    } else {
      emailResult = await emailService.sendAdminPasswordResetEmail({
        email: admin.email,
        name: admin.name,
        token: newToken,
        xID: admin.xID,
        firmSlug: firm.firmSlug,
        req,
      });
    }
    if (emailResult && emailResult.success === false) {
      emailSuccess = false;
      console.warn('[SUPERADMIN] Admin access resend email not sent:', emailResult.error);
    }
  } catch (emailError) {
    emailSuccess = false;
    console.warn('[SUPERADMIN] Failed to send admin access resend email:', emailError.message);
  }

  // Log audit entry
  await logSuperadminAction({
    actionType: emailSuccess ? 'AdminAccessResent' : 'AdminAccessResendEmailFailed',
    description: `Admin access resent (${action}) for firm ${firm.name} (${firm.firmId}), admin ${admin.xID}`,
    performedBy: req.user.email,
    performedById: req.user._id,
    targetEntityType: 'User',
    targetEntityId: admin._id.toString(),
    metadata: {
      firmId: firm.firmId,
      firmName: firm.name,
      adminXID: admin.xID,
      action,
      emailSuccess,
    },
    req,
  });

  return res.status(200).json({
    success: true,
    action,
    emailMasked: maskedEmail,
  });
};

module.exports = {
  createFirm: wrapWriteHandler(createFirm),
  listFirms,
  updateFirmStatus: wrapWriteHandler(updateFirmStatus),
  disableFirmImmediately: wrapWriteHandler(disableFirmImmediately),
  createFirmAdmin: wrapWriteHandler(createFirmAdmin),
  getFirmAdminDetails,
  updateFirmAdminStatus: wrapWriteHandler(updateFirmAdminStatus),
  forceResetFirmAdmin: wrapWriteHandler(forceResetFirmAdmin),
  resendAdminAccess: wrapWriteHandler(resendAdminAccess),
  getPlatformStats,
  getFirmBySlug,
  getOperationalHealth,
  switchFirm,
  exitFirm,
};
