const mongoose = require('mongoose');
const User = require('../models/User.model');
const Case = require('../models/Case.model');
const Task = require('../models/Task');
const Firm = require('../models/Firm.model');
const emailService = require('../services/email.service');
const CaseStatus = require('../domain/case/caseStatus');
const { logAdminAction, logCaseListViewed } = require('../services/auditLog.service');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { getDiagnosticsSnapshot } = require('../services/diagnostics.service');
const { restoreDocument, buildDiagnostics } = require('../services/softDelete.service');
const { getLatestTenantMetrics } = require('../services/tenantCaseMetrics.service');
const userRepository = require('../repositories/user.repository');
const clientRepository = require('../repositories/client.repository');
const categoryRepository = require('../repositories/category.repository');
const { assertFirmContext } = require('../utils/tenantGuard');
const { logAuthEvent } = require('../services/audit.service');
const { isExternalStorageEnabled } = require('../services/featureFlags.service');
const log = require('../utils/log');

/**
 * Admin Controller for Admin Panel Operations
 * PR #41 - Admin panel statistics and management
 * PR #48 - Admin resend invite email functionality
 * PR: Case Lifecycle - Admin dashboard for all cases, pending, filed
 */

const INVITE_TOKEN_EXPIRY_HOURS = 48; // 48 hours for invite tokens
const DEFAULT_STORAGE_MODE = 'docketra_managed';

/**
 * Helper function to safely log audit events without throwing
 * Prevents audit logging failures from crashing admin operations
 */
const safeAuditLog = async (auditData) => {
  try {
    await logAuthEvent({
      actionType: auditData.actionType,
      xID: auditData.xID,
      firmId: auditData.firmId,
      userId: auditData.userId,
      description: auditData.description,
      performedBy: auditData.performedBy,
      req: {
        ip: auditData.ipAddress,
        get: (header) => (header?.toLowerCase() === 'user-agent' ? auditData.userAgent : undefined),
      },
      metadata: auditData.metadata,
      timestamp: auditData.timestamp,
    });
  } catch (auditError) {
    console.error('[ADMIN] Failed to log audit event:', auditError.message);
  }
};

const resetUserToInvitedState = (user, { tokenHash, tokenExpiry, inviteSentAt }) => {
  user.inviteTokenHash = tokenHash;
  user.inviteTokenExpiry = tokenExpiry;
  user.inviteSentAt = inviteSentAt || new Date();
  user.mustSetPassword = true;
  user.status = 'invited';
  user.isActive = false;
};

/**
 * Get admin dashboard statistics
 * GET /api/admin/stats
 * 
 * Returns all counts needed for admin panel header badges:
 * - Total users
 * - Total clients (active + inactive)
 * - Total categories (including soft-deleted)
 * - Pending approvals
 * - All open cases (across all users)
 * - All pending cases (across all users)
 * - Filed cases
 * - Resolved cases
 * 
 * PR: Case Lifecycle - Added comprehensive case counts
 * PR: Fix Case Lifecycle - Added resolved cases count
 */
const getAdminStats = async (req, res) => {
  const fallbackData = {
    totalUsers: 0,
    totalClients: 0,
    totalCategories: 0,
    pendingApprovals: 0,
    allOpenCases: 0,
    allPendingCases: 0,
    filedCases: 0,
    resolvedCases: 0,
    overdueCases: 0,
    avgResolutionTimeSeconds: 0,
    metricsDate: null,
  };

  try {
    assertFirmContext(req);
    const tenantId = req.user?.firmId;

    const [
      totalUsers,
      totalClients,
      totalCategories,
      latestMetrics,
      invitedUsers,
    ] = await Promise.all([
      userRepository.countUsers(tenantId, { status: { $ne: 'deleted' } }).catch(() => 0),
      clientRepository.countClients(tenantId).catch(() => 0),
      categoryRepository.countCategories(tenantId).catch(() => 0),
      getLatestTenantMetrics(tenantId).catch(() => null),
      userRepository.countUsers(tenantId, { status: 'invited' }).catch(() => 0),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalClients,
        totalCategories,
        pendingApprovals: (latestMetrics?.pendingApprovals || 0) + invitedUsers,
        allOpenCases: latestMetrics?.openCases || 0,
        allPendingCases: latestMetrics?.pendedCases || 0,
        filedCases: latestMetrics?.filedCases || 0,
        resolvedCases: latestMetrics?.resolvedCases || 0,
        overdueCases: latestMetrics?.overdueCases || 0,
        avgResolutionTimeSeconds: latestMetrics?.avgResolutionTimeSeconds || 0,
        metricsDate: latestMetrics?.date || null,
      },
    });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    log.warn('ADMIN_STATS_FALLBACK', {
      req,
      error: error.message,
    });
    res.json({
      success: true,
      data: fallbackData,
    });
  }
};

/**
 * Resend invite email for a user who hasn't set password yet
 * POST /api/admin/users/:xID/resend-invite
 * 
 * PR #48: Admin-only endpoint to resend invite emails
 * - Bypasses password enforcement middleware
 * - Only works for users who haven't set password (mustSetPassword === true)
 * - Generates fresh invite token with 48-hour expiry
 * - Updates inviteSentAt timestamp
 */
const resendInviteEmail = async (req, res) => {
  try {
    const { xID } = req.params;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    log.info('ADMIN_INVITE_RESEND_REQUEST_RECEIVED', {
      req,
      firmId: admin.firmId,
      userXID: admin.xID,
      inviteXID: xID.toUpperCase(),
    });
    
    // Find target user by xID (same-firm only, prevent Superadmin access)
    const user = await User.findOne({ 
      xID: xID.toUpperCase(),
      firmId: admin.firmId,
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in your firm',
      });
    }
    
    if (user.status !== 'invited') {
      return res.status(400).json({
        success: false,
        message: 'User already activated. Cannot resend invite email for activated users.',
      });
    }
    
    // Generate new secure invite token (48-hour expiry)
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Update token and inviteSentAt timestamp
    resetUserToInvitedState(user, {
      tokenHash,
      tokenExpiry,
      inviteSentAt: new Date(),
    });
    await user.save();
    log.info('ADMIN_INVITE_RECORD_UPDATED', {
      req,
      firmId: admin.firmId,
      userXID: admin.xID,
      inviteXID: user.xID,
      invitedEmail: emailService.maskEmail(user.email),
      inviteExpiry: tokenExpiry.toISOString(),
    });
    
    // Fetch firmSlug for email
    let firmSlug = null;
    if (user.firmId) {
      const Firm = require('../models/Firm.model');
      const firm = await Firm.findById(user.firmId);
      if (firm) {
        firmSlug = firm.firmSlug;
      }
    }
    
    // Send invite reminder email with xID
    try {
      const emailResult = await emailService.sendPasswordSetupReminderEmail({
        email: user.email,
        name: user.name,
        token: token,
        xID: user.xID,
        firmSlug: firmSlug,
        req,
      });
      
      if (!emailResult.success) {
        log.warn('ADMIN_INVITE_EMAIL_FAILED', {
          req,
          firmId: admin.firmId,
          userXID: admin.xID,
          inviteXID: user.xID,
          invitedEmail: emailService.maskEmail(user.email),
          error: emailResult.error,
        });
        
        // Log failure but continue - token was updated
        await safeAuditLog({
          xID: user.xID,
          actionType: 'InviteEmailResendFailed',
          description: `Admin attempted to resend invite email but delivery failed`,
          performedBy: admin.xID,
          ipAddress: req.ip,
        });
        
        return res.status(500).json({
          success: false,
          message: 'Failed to send email. Please check email service configuration.',
        });
      }

      log.info('ADMIN_INVITE_EMAIL_SENT', {
        req,
        firmId: admin.firmId,
        userXID: admin.xID,
        inviteXID: user.xID,
        invitedEmail: emailService.maskEmail(user.email),
      });
      
      // Log successful email send
      await safeAuditLog({
        xID: user.xID,
        actionType: 'InviteEmailResent',
        description: `Admin resent invite email to ${emailService.maskEmail(user.email)}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
      
      res.json({
        success: true,
        message: 'Invite email sent successfully',
      });
    } catch (emailError) {
      log.error('ADMIN_INVITE_EMAIL_FAILED', {
        req,
        firmId: admin.firmId,
        userXID: admin.xID,
        inviteXID: user.xID,
        invitedEmail: emailService.maskEmail(user.email),
        error: emailError.message,
      });
      
      // Log failure
      await safeAuditLog({
        xID: user.xID,
        actionType: 'InviteEmailResendFailed',
        description: `Admin attempted to resend invite email but delivery failed`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send email. Please check email service configuration.',
      });
    }
  } catch (error) {
    console.error('[ADMIN] Error resending invite email:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending invite email',
      error: error.message,
    });
  }
};

/**
 * Get all open cases (Admin view)
 * GET /api/admin/cases/open
 * 
 * Returns all cases with status OPEN across all users.
 * Admins can see all open cases regardless of assignment.
 * 
 * PR: Case Lifecycle - Admin visibility for all open cases
 */
const getAllOpenCases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const firmScope = { firmId: req.firmId };

    const cases = await Case.find({ ...firmScope, status: CaseStatus.OPEN })
      .select('caseId caseName category createdAt updatedAt status clientId assignedTo')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await Case.countDocuments({ ...firmScope, status: CaseStatus.OPEN });
    
    // Log admin action for audit
    await logCaseListViewed({
      viewerXID: req.user.xID,
      filters: { status: CaseStatus.OPEN },
      listType: 'ADMIN_ALL_OPEN_CASES',
      resultCount: cases.length,
      req,
    });
    
    res.json({
      success: true,
      data: cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching open cases',
      error: error.message,
    });
  }
};

/**
 * Get all pending cases (Admin view)
 * GET /api/admin/cases/pending
 * 
 * Returns all cases with status PENDED across all users.
 * Admins can see all pending cases regardless of who pended them.
 * 
 * PR: Case Lifecycle - Admin visibility for all pending cases
 */
const getAllPendingCases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const firmScope = { firmId: req.firmId };

    const cases = await Case.find({ ...firmScope, status: CaseStatus.PENDED })
      .select('caseId caseName category createdAt updatedAt status clientId assignedTo pendedByXID pendingUntil')
      .sort({ pendingUntil: 1 }) // Sort by pending deadline (earliest first)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await Case.countDocuments({ ...firmScope, status: CaseStatus.PENDED });
    
    // Log admin action for audit
    await logCaseListViewed({
      viewerXID: req.user.xID,
      filters: { status: CaseStatus.PENDED },
      listType: 'ADMIN_ALL_PENDING_CASES',
      resultCount: cases.length,
      req,
    });
    
    res.json({
      success: true,
      data: cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending cases',
      error: error.message,
    });
  }
};

/**
 * Get all filed cases (Admin view)
 * GET /api/admin/cases/filed
 * 
 * Returns all cases with status FILED.
 * Filed cases are hidden from employees and only visible to admins.
 * 
 * PR: Case Lifecycle - Admin visibility for filed cases
 */
const getAllFiledCases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const firmScope = { firmId: req.firmId };

    const cases = await Case.find({ ...firmScope, status: CaseStatus.FILED })
      .select('caseId caseName category createdAt updatedAt status clientId assignedTo lastActionByXID lastActionAt')
      .sort({ lastActionAt: -1 }) // Sort by last action (most recently filed first)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await Case.countDocuments({ ...firmScope, status: CaseStatus.FILED });
    
    // MANDATORY: Log admin filed cases access for audit
    await logAdminAction({
      adminXID: req.user.xID,
      actionType: 'ADMIN_FILED_CASES_VIEWED',
      metadata: {
        page: parseInt(page),
        limit: parseInt(limit),
        resultCount: cases.length,
        total,
      },
      req,
    });
    
    res.json({
      success: true,
      data: cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching filed cases',
      error: error.message,
    });
  }
};

/**
 * Get all resolved cases (Admin view)
 * GET /api/admin/cases/resolved
 * 
 * Returns all cases with status RESOLVED.
 * Admins can see all resolved cases regardless of who resolved them.
 * 
 * PR: Fix Case Lifecycle - Admin visibility for resolved cases
 */
const getAllResolvedCases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const firmScope = { firmId: req.firmId };

    const cases = await Case.find({ ...firmScope, status: CaseStatus.RESOLVED })
      .select('caseId caseName category createdAt updatedAt status clientId assignedTo lastActionByXID lastActionAt')
      .sort({ lastActionAt: -1 }) // Sort by last action (most recently resolved first)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await Case.countDocuments({ ...firmScope, status: CaseStatus.RESOLVED });
    
    // Log admin action for audit
    await logAdminAction({
      adminXID: req.user.xID,
      actionType: 'ADMIN_RESOLVED_CASES_VIEWED',
      metadata: {
        page: parseInt(page),
        limit: parseInt(limit),
        resultCount: cases.length,
        total,
      },
      req,
    });
    
    res.json({
      success: true,
      data: cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resolved cases',
      error: error.message,
    });
  }
};

/**
 * Update user's restricted client list (Admin only)
 * PATCH /api/admin/users/:xID/restrict-clients
 * 
 * Allows admin to manage which clients a user cannot access (deny-list approach).
 * Default: empty array means user can access all clients.
 * 
 * Request body:
 * {
 *   restrictedClientIds: ["C123456", "C123457"] // Array of client IDs to restrict
 * }
 */
const updateRestrictedClients = async (req, res) => {
  try {
    const { xID } = req.params;
    const { restrictedClientIds } = req.body;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    if (!Array.isArray(restrictedClientIds)) {
      return res.status(400).json({
        success: false,
        message: 'restrictedClientIds must be an array',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find target user by xID (same-firm only)
    const user = await User.findOne({ 
      xID: xID.toUpperCase(),
      firmId: admin.firmId,
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in your firm',
      });
    }
    
    // Validate all client IDs are in correct format
    const invalidIds = restrictedClientIds.filter(id => !/^C\d{6}$/.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid client ID format: ${invalidIds.join(', ')}. Must be C123456 format.`,
      });
    }
    
    // Capture previous value before update for accurate audit (after validation)
    const previousRestrictedClientIds = user.restrictedClientIds || [];
    
    // Update restricted clients list
    user.restrictedClientIds = restrictedClientIds;
    await user.save();
    
    // Log admin action for audit
    await logAdminAction({
      adminXID: admin.xID,
      actionType: 'USER_CLIENT_ACCESS_UPDATED',
      targetXID: user.xID,
      metadata: {
        previousClientIds: previousRestrictedClientIds,
        restrictedClientIds,
        previousCount: previousRestrictedClientIds.length,
        newCount: restrictedClientIds.length,
      },
      req,
    });
    
    res.json({
      success: true,
      message: 'User client access restrictions updated successfully',
      data: {
        xID: user.xID,
        restrictedClientIds: user.restrictedClientIds,
      },
    });
  } catch (error) {
    console.error('[ADMIN] Error updating restricted clients:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating client access restrictions',
      error: error.message,
    });
  }
};

/**
 * Get firm storage configuration (Admin only)
 * GET /api/admin/storage
 */
const getStorageConfig = async (req, res) => {
  try {
    const firmId = req.user?.firmId;

    if (!firmId) {
      return res.status(403).json({
        success: false,
        message: 'Firm context is required',
      });
    }

    const firm = await Firm.findById(firmId).select('storage firmId name');

    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }

    res.json({
      success: true,
      data: {
        ...(firm.storage || { mode: 'docketra_managed', provider: null }),
        capabilities: {
          externalStorageEnabled: isExternalStorageEnabled(),
        },
      },
    });
  } catch (error) {
    console.error('[ADMIN] Error fetching storage config:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching storage configuration',
      error: error.message,
    });
  }
};

/**
 * Update firm storage configuration (Admin only)
 * PUT /api/admin/storage
 */
const updateStorageConfig = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    const { mode, provider, google = {}, onedrive = {} } = req.body || {};

    if (!firmId) {
      return res.status(403).json({
        success: false,
        message: 'Firm context is required',
      });
    }

    const firm = await Firm.findById(firmId);
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }

    const storageConfig = firm.storage || {};
    const newMode = mode || storageConfig.mode || DEFAULT_STORAGE_MODE;

    if (newMode === 'firm_connected') {
      if (!isExternalStorageEnabled()) {
        return res.status(403).json({
          success: false,
          message: 'Connect Your Storage is coming soon for this environment.',
          code: 'EXTERNAL_STORAGE_DISABLED',
        });
      }

      if (!provider) {
        return res.status(400).json({
          success: false,
          message: 'Provider is required when storage mode is firm_connected',
        });
      }

      storageConfig.mode = 'firm_connected';
      storageConfig.provider = provider;

      if (provider === 'google_drive') {
        storageConfig.google = {
          ...(storageConfig.google || {}),
          ...google,
        };
      } else if (provider === 'onedrive') {
        storageConfig.onedrive = {
          ...(storageConfig.onedrive || {}),
          ...onedrive,
        };
      }
    } else {
      storageConfig.mode = DEFAULT_STORAGE_MODE;
      storageConfig.provider = null;
    }

    firm.storage = storageConfig;
    await firm.save();

    await logAdminAction({
      adminXID: req.user?.xID,
      actionType: 'STORAGE_CONFIGURATION_UPDATED',
      targetFirmId: firm.firmId,
      metadata: {
        mode: firm.storage.mode,
        provider: firm.storage.provider,
      },
      req,
    });

    res.json({
      success: true,
      message: 'Storage configuration updated',
      data: firm.storage,
    });
  } catch (error) {
    console.error('[ADMIN] Error updating storage config:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating storage configuration',
      error: error.message,
    });
  }
};

/**
 * Disconnect firm storage (revert to Docketra-managed)
 * POST /api/admin/storage/disconnect
 */
const disconnectStorage = async (req, res) => {
  try {
    const firmId = req.user?.firmId;

    if (!firmId) {
      return res.status(403).json({
        success: false,
        message: 'Firm context is required',
      });
    }

    const firm = await Firm.findById(firmId);
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }

    firm.storage = {
      mode: 'docketra_managed',
      provider: null,
      google: {},
      onedrive: {},
    };

    await firm.save();

    await logAdminAction({
      adminXID: req.user?.xID,
      actionType: 'STORAGE_CONFIGURATION_DISCONNECTED',
      targetFirmId: firm.firmId,
      metadata: {},
      req,
    });

    res.json({
      success: true,
      message: 'Storage disconnected. Docketra-managed storage is now active.',
      data: firm.storage,
    });
  } catch (error) {
    console.error('[ADMIN] Error disconnecting storage:', error);
    res.status(500).json({
      success: false,
      message: 'Error disconnecting storage',
      error: error.message,
    });
  }
};

const getSystemDiagnostics = async (req, res) => {
  try {
    const diagnostics = await getDiagnosticsSnapshot();
    return res.json({
      success: true,
      data: diagnostics,
    });
  } catch (error) {
    console.error('[ADMIN] Failed to load system diagnostics:', error);
    return res.status(500).json({
      success: false,
      code: 'DIAGNOSTICS_FAILED',
      message: 'Failed to load system diagnostics',
    });
  }
};

const restoreUser = async (req, res) => {
  try {
    const clauses = [];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      clauses.push({ _id: req.params.id });
    }
    clauses.push({ xID: req.params.id });
    const restored = await restoreDocument({
      model: User,
      filter: { firmId: req.firmId, $or: clauses },
      req,
    });
    if (!restored) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, data: restored, message: 'User restored' });
  } catch (error) {
    console.error('[ADMIN] Failed to restore user', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to restore user',
    });
  }
};

const restoreClient = async (req, res) => {
  try {
    const clauses = [];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      clauses.push({ _id: req.params.id });
    }
    clauses.push({ clientId: req.params.id });
    const restored = await restoreDocument({
      model: Client,
      filter: { firmId: req.firmId, $or: clauses },
      req,
    });
    if (!restored) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    return res.json({ success: true, data: restored, message: 'Client restored' });
  } catch (error) {
    console.error('[ADMIN] Failed to restore client', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to restore client',
    });
  }
};

const restoreCase = async (req, res) => {
  try {
    const clauses = [];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      clauses.push({ _id: req.params.id });
    }
    clauses.push({ caseNumber: req.params.id }, { caseId: req.params.id });
    const restored = await restoreDocument({
      model: Case,
      filter: { firmId: req.firmId, $or: clauses },
      req,
    });
    if (!restored) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }
    return res.json({ success: true, data: restored, message: 'Case restored' });
  } catch (error) {
    console.error('[ADMIN] Failed to restore case', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to restore case',
    });
  }
};

const restoreTask = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid task id' });
    }
    const restored = await restoreDocument({
      model: Task,
      filter: { _id: req.params.id, firmId: req.firmId },
      req,
    });
    if (!restored) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    return res.json({ success: true, data: restored, message: 'Task restored' });
  } catch (error) {
    console.error('[ADMIN] Failed to restore task', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to restore task',
    });
  }
};

const getRetentionPreview = async (req, res) => {
  try {
    const data = await buildDiagnostics();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[ADMIN] Failed to build retention preview', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to build retention preview',
      error: error.message,
    });
  }
};

module.exports = {
  getAdminStats,
  resendInviteEmail: wrapWriteHandler(resendInviteEmail),
  getAllOpenCases,
  getAllPendingCases,
  getAllFiledCases,
  getAllResolvedCases,
  updateRestrictedClients: wrapWriteHandler(updateRestrictedClients),
  getStorageConfig,
  updateStorageConfig: wrapWriteHandler(updateStorageConfig),
  disconnectStorage: wrapWriteHandler(disconnectStorage),
  getSystemDiagnostics,
  restoreUser: wrapWriteHandler(restoreUser),
  restoreClient: wrapWriteHandler(restoreClient),
  restoreCase: wrapWriteHandler(restoreCase),
  restoreTask: wrapWriteHandler(restoreTask),
  getRetentionPreview,
};
