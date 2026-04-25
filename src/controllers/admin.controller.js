const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Case = require('../models/Case.model');
const Task = require('../models/Task');
const Firm = require('../models/Firm.model');
const Team = require('../models/Team.model');
const Category = require('../models/Category.model');
const AuthAudit = require('../models/AuthAudit.model');
const CaseAudit = require('../models/CaseAudit.model');
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
const {
  safeAuditLog,
  resetUserToInvitedState,
  normalizeFirmSettings,
  normalizeWorkSettings,
} = require('../services/adminController.service');
const { isExternalStorageEnabled } = require('../services/featureFlags.service');
const { assertPrimaryAdmin, getTagValidationError, normalizeId } = require('../utils/hierarchy.utils');
const { logAuditEvent, getAuditLogs } = require('../services/adminActionAudit.service');
const { writeSettingsAudit, listSettingsAudit } = require('../services/productAudit.service');
const settingsAuditService = require('../services/settingsAudit.service');
const { safeDecrypt } = require('../utils/encryption');
const log = require('../utils/log');

/**
 * Admin Controller for Admin Panel Operations
 * PR #41 - Admin panel statistics and management
 * PR #48 - Admin resend invite email functionality
 * PR: Case Lifecycle - Admin dashboard for all cases, pending, filed
 */

const INVITE_TOKEN_EXPIRY_HOURS = 48; // 48 hours for invite tokens
const DEFAULT_STORAGE_MODE = 'docketra_managed';
const INTAKE_API_KEY_MASK = '••••••••••••••••';

const toNullableString = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const normalizeIntakePriority = (value) => {
  const normalized = toNullableString(value);
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  return ['LOW', 'MEDIUM', 'HIGH'].includes(upper) ? upper : null;
};

const normalizeCmsIntakeConfig = (config = {}, { includeApiKey = false } = {}) => {
  const decryptedKey = safeDecrypt(config?.intakeApiKey || null);
  return {
    autoCreateClient: Boolean(config?.autoCreateClient),
    autoCreateDocket: Boolean(config?.autoCreateDocket),
    defaultCategoryId: config?.defaultCategoryId ? String(config.defaultCategoryId) : null,
    defaultSubcategoryId: toNullableString(config?.defaultSubcategoryId),
    defaultWorkbasketId: config?.defaultWorkbasketId ? String(config.defaultWorkbasketId) : null,
    defaultPriority: normalizeIntakePriority(config?.defaultPriority),
    defaultAssignee: toNullableString(config?.defaultAssignee)?.toUpperCase() || null,
    intakeApiEnabled: Boolean(config?.intakeApiEnabled),
    intakeApiKeyConfigured: Boolean(decryptedKey),
    intakeApiKeyMasked: decryptedKey ? INTAKE_API_KEY_MASK : null,
    intakeApiKey: includeApiKey ? decryptedKey : null,
  };
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
    let firmName = null;
    if (user.firmId) {
      const Firm = require('../models/Firm.model');
      const firm = await Firm.findById(user.firmId);
      if (firm) {
        firmSlug = firm.firmSlug;
        firmName = firm.name;
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
        role: user.role,
        firmName: firmName || undefined,
        invitedBy: admin.name || admin.xID,
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
    log.error('[ADMIN] Error resending invite email:', error);
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

    // ⚡ Bolt Performance Optimization:
    // Replaced sequential database queries with concurrent Promise.all() execution.
    // Impact: Reduces endpoint latency by executing find() and countDocuments() in parallel.
    // Expected improvement: ~30-50% reduction in database response time for this endpoint.
    const [cases, total] = await Promise.all([
      Case.find({ ...firmScope, status: CaseStatus.OPEN })
        .select('caseId caseName category createdAt updatedAt status clientId assignedTo')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean(),
      Case.countDocuments({ ...firmScope, status: CaseStatus.OPEN }),
    ]);
    
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
 * Returns all cases with status PENDING across all users.
 * Admins can see all pending cases regardless of who pended them.
 * 
 * PR: Case Lifecycle - Admin visibility for all pending cases
 */
const getAllPendingCases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const firmScope = { firmId: req.firmId };

    // ⚡ Bolt Performance Optimization:
    // Replaced sequential database queries with concurrent Promise.all() execution.
    // Impact: Reduces endpoint latency by executing find() and countDocuments() in parallel.
    // Expected improvement: ~30-50% reduction in database response time for this endpoint.
    const [cases, total] = await Promise.all([
      Case.find({ ...firmScope, status: CaseStatus.PENDING })
        .select('caseId caseName category createdAt updatedAt status clientId assignedTo pendedByXID pendingUntil')
        .sort({ pendingUntil: 1 }) // Sort by pending deadline (earliest first)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean(),
      Case.countDocuments({ ...firmScope, status: CaseStatus.PENDING }),
    ]);
    
    // Log admin action for audit
    await logCaseListViewed({
      viewerXID: req.user.xID,
      filters: { status: CaseStatus.PENDING },
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

    // ⚡ Bolt Performance Optimization:
    // Replaced sequential database queries with concurrent Promise.all() execution.
    // Impact: Reduces endpoint latency by executing find() and countDocuments() in parallel.
    // Expected improvement: ~30-50% reduction in database response time for this endpoint.
    const [cases, total] = await Promise.all([
      Case.find({ ...firmScope, status: CaseStatus.FILED })
        .select('caseId caseName category createdAt updatedAt status clientId assignedTo lastActionByXID lastActionAt')
        .sort({ lastActionAt: -1 }) // Sort by last action (most recently filed first)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean(),
      Case.countDocuments({ ...firmScope, status: CaseStatus.FILED }),
    ]);
    
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

    // ⚡ Bolt Performance Optimization:
    // Replaced sequential database queries with concurrent Promise.all() execution.
    // Impact: Reduces endpoint latency by executing find() and countDocuments() in parallel.
    // Expected improvement: ~30-50% reduction in database response time for this endpoint.
    const [cases, total] = await Promise.all([
      Case.find({ ...firmScope, status: CaseStatus.RESOLVED })
        .select('caseId caseName category createdAt updatedAt status clientId assignedTo lastActionByXID lastActionAt')
        .sort({ lastActionAt: -1 }) // Sort by last action (most recently resolved first)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean(),
      Case.countDocuments({ ...firmScope, status: CaseStatus.RESOLVED }),
    ]);
    
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
    log.error('[ADMIN] Error updating restricted clients:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating client access restrictions',
      error: error.message,
    });
  }
};

/**
 * Get firm and work settings (Admin only)
 * GET /api/admin/firm-settings
 */
const getFirmSettings = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }

    const firm = await Firm.findById(firmId).select('settings');
    if (!firm) {
      return res.status(404).json({ success: false, message: 'Firm not found' });
    }

    return res.json({
      success: true,
      data: {
        firm: normalizeFirmSettings(firm.settings?.firm || {}),
        work: normalizeWorkSettings(firm.settings?.work || {}),
      },
    });
  } catch (error) {
    log.error('[ADMIN] Error fetching firm settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching firm settings',
      error: error.message,
    });
  }
};

/**
 * Update firm and work settings (Admin only)
 * PUT /api/admin/firm-settings
 */
const updateFirmSettings = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }

    const firm = await Firm.findById(firmId);
    if (!firm) {
      return res.status(404).json({ success: false, message: 'Firm not found' });
    }

    const previousSettings = {
      firm: normalizeFirmSettings(firm.settings?.firm || {}),
      work: normalizeWorkSettings(firm.settings?.work || {}),
    };
    const requestedFirmSettings = req.body?.firm ? normalizeFirmSettings(req.body.firm) : previousSettings.firm;
    const requestedWorkSettings = req.body?.work ? normalizeWorkSettings(req.body.work) : previousSettings.work;

    firm.settings = {
      ...(firm.settings || {}),
      firm: requestedFirmSettings,
      work: requestedWorkSettings,
    };
    await firm.save();

    const nextSettings = {
      firm: normalizeFirmSettings(firm.settings?.firm || {}),
      work: normalizeWorkSettings(firm.settings?.work || {}),
    };
    await writeSettingsAudit({
      req,
      settingsKey: 'firm-settings',
      action: 'CONFIG_CHANGED',
      oldDoc: previousSettings,
      newDoc: nextSettings,
      metadata: { source: 'admin.updateFirmSettings' },
      dedupeKey: 'firm-settings-update',
    });

    await logAdminAction({
      adminXID: req.user?.xID,
      actionType: 'FIRM_SETTINGS_UPDATED',
      targetFirmId: firm.firmId,
      metadata: {
        previous: previousSettings,
        next: nextSettings,
      },
      req,
    });

    await Promise.all([
      settingsAuditService.logConfigChange({
        firmId: req.user?.firmId,
        action: 'FIRM_CONFIG_UPDATED',
        entityType: 'firm.settings.firm',
        entityId: firm.firmId,
        performedBy: req.user?.xID,
        performedByRole: req.user?.role,
        before: previousSettings.firm,
        after: nextSettings.firm,
        metadata: { source: 'admin.controller.updateFirmSettings' },
      }),
      settingsAuditService.logWorkflowChange({
        firmId: req.user?.firmId,
        action: 'WORKFLOW_SETTINGS_UPDATED',
        entityType: 'firm.settings.work',
        entityId: firm.firmId,
        performedBy: req.user?.xID,
        performedByRole: req.user?.role,
        before: previousSettings.work,
        after: nextSettings.work,
        metadata: { source: 'admin.controller.updateFirmSettings' },
      }),
    ]);

    return res.json({
      success: true,
      message: 'Firm settings updated successfully',
      data: nextSettings,
    });
  } catch (error) {
    log.error('[ADMIN] Error updating firm settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating firm settings',
      error: error.message,
    });
  }
};

/**
 * Get CMS intake settings (Admin only)
 * GET /api/admin/cms-intake-settings
 */
const getCmsIntakeSettings = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }

    const [firm, workbaskets, categories, assignees] = await Promise.all([
      Firm.findById(firmId).select('intakeConfig.cms firmId'),
      Team.find({ firmId, isActive: true }).select('_id name').sort({ name: 1 }).lean(),
      Category.find({ firmId, isActive: true }).select('_id name subcategories').sort({ name: 1 }).lean(),
      User.find({ firmId, status: { $ne: 'deleted' }, isActive: true, role: { $in: ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'] } })
        .select('xID name email role')
        .sort({ name: 1 })
        .lean(),
    ]);

    if (!firm) {
      return res.status(404).json({ success: false, message: 'Firm not found' });
    }

    const categoryOptions = categories.map((category) => ({
      id: String(category._id),
      name: category.name,
      subcategories: Array.isArray(category.subcategories)
        ? category.subcategories
          .filter((entry) => entry?.isActive !== false)
          .map((entry) => ({ id: String(entry.id || ''), name: entry.name || '' }))
        : [],
    }));

    const intakeSettings = normalizeCmsIntakeConfig(firm.intakeConfig?.cms || {}, {
      includeApiKey: String(req.query?.includeApiKey || '').toLowerCase() === 'true',
    });

    return res.json({
      success: true,
      data: {
        intake: intakeSettings,
        options: {
          workbaskets: workbaskets.map((entry) => ({ id: String(entry._id), name: entry.name })),
          categories: categoryOptions,
          priorities: ['LOW', 'MEDIUM', 'HIGH'],
          assignees: assignees.map((user) => ({
            xid: String(user.xID || '').toUpperCase(),
            name: user.name || user.email || String(user.xID || '').toUpperCase(),
            role: user.role || 'USER',
          })),
        },
      },
    });
  } catch (error) {
    log.error('[ADMIN] Error fetching CMS intake settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching CMS intake settings',
      error: error.message,
    });
  }
};

/**
 * Update CMS intake settings (Admin only)
 * PUT /api/admin/cms-intake-settings
 */
const updateCmsIntakeSettings = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }

    const firm = await Firm.findById(firmId);
    if (!firm) {
      return res.status(404).json({ success: false, message: 'Firm not found' });
    }

    const previousIntakeSettings = normalizeCmsIntakeConfig(firm.intakeConfig?.cms || {});
    const body = req.body || {};
    const nextCmsConfig = {
      ...(firm.intakeConfig?.cms || {}),
      autoCreateClient: Boolean(body.autoCreateClient),
      autoCreateDocket: Boolean(body.autoCreateDocket),
      intakeApiEnabled: Boolean(body.intakeApiEnabled),
      defaultCategoryId: mongoose.isValidObjectId(body.defaultCategoryId) ? body.defaultCategoryId : null,
      defaultSubcategoryId: toNullableString(body.defaultSubcategoryId),
      defaultWorkbasketId: mongoose.isValidObjectId(body.defaultWorkbasketId) ? body.defaultWorkbasketId : null,
      defaultPriority: normalizeIntakePriority(body.defaultPriority),
      defaultAssignee: toNullableString(body.defaultAssignee)?.toUpperCase() || null,
    };

    if (nextCmsConfig.defaultCategoryId && nextCmsConfig.defaultSubcategoryId) {
      const category = await Category.findOne({
        _id: nextCmsConfig.defaultCategoryId,
        firmId,
        isActive: true,
        'subcategories.id': nextCmsConfig.defaultSubcategoryId,
      })
        .select('_id subcategories')
        .lean();

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Default subcategory must belong to the selected active category',
        });
      }
    } else if (nextCmsConfig.defaultSubcategoryId && !nextCmsConfig.defaultCategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Default category is required when default subcategory is provided',
      });
    }

    if (nextCmsConfig.defaultWorkbasketId) {
      const workbasket = await Team.findOne({ _id: nextCmsConfig.defaultWorkbasketId, firmId, isActive: true }).select('_id').lean();
      if (!workbasket) {
        return res.status(400).json({
          success: false,
          message: 'Default workbasket must be an active workbasket from this firm',
        });
      }
    }

    if (nextCmsConfig.defaultAssignee) {
      const assignee = await User.findOne({
        firmId,
        xID: nextCmsConfig.defaultAssignee,
        status: { $ne: 'deleted' },
        isActive: true,
      }).select('_id');
      if (!assignee) {
        return res.status(400).json({
          success: false,
          message: 'Default assignee must be an active firm user',
        });
      }
    }

    const previousKey = firm.intakeConfig?.cms?.intakeApiKey || null;
    firm.intakeConfig = {
      ...(firm.intakeConfig || {}),
      cms: {
        ...(firm.intakeConfig?.cms || {}),
        ...nextCmsConfig,
        intakeApiKey: previousKey,
      },
    };
    await firm.save();

    const nextIntakeSettings = normalizeCmsIntakeConfig(firm.intakeConfig?.cms || {});
    await writeSettingsAudit({
      req,
      settingsKey: 'cms-intake-settings',
      action: 'CONFIG_CHANGED',
      oldDoc: previousIntakeSettings,
      newDoc: nextIntakeSettings,
      metadata: { source: 'admin.updateCmsIntakeSettings' },
      dedupeKey: 'cms-intake-settings-update',
    });

    return res.json({
      success: true,
      message: 'CMS intake settings updated successfully',
      data: nextIntakeSettings,
    });
  } catch (error) {
    log.error('[ADMIN] Error updating CMS intake settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating CMS intake settings',
      error: error.message,
    });
  }
};

/**
 * Regenerate CMS intake API key (Admin only)
 * POST /api/admin/cms-intake-settings/intake-api-key/regenerate
 */
const regenerateCmsIntakeApiKey = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }

    const firm = await Firm.findById(firmId).select('intakeConfig');
    if (!firm) {
      return res.status(404).json({ success: false, message: 'Firm not found' });
    }

    const newApiKey = crypto.randomBytes(24).toString('hex');
    firm.intakeConfig = {
      ...(firm.intakeConfig || {}),
      cms: {
        ...(firm.intakeConfig?.cms || {}),
        intakeApiKey: newApiKey,
      },
    };
    await firm.save();

    const nextIntakeSettings = normalizeCmsIntakeConfig(firm.intakeConfig?.cms || {});
    await writeSettingsAudit({
      req,
      settingsKey: 'cms-intake-settings',
      action: 'API_KEY_REGENERATED',
      oldDoc: { intakeApiKeyConfigured: true },
      newDoc: { intakeApiKeyConfigured: true },
      metadata: { source: 'admin.regenerateCmsIntakeApiKey' },
      dedupeKey: 'cms-intake-api-key-regenerate',
    });

    return res.json({
      success: true,
      message: 'CMS intake API key regenerated',
      data: {
        intake: {
          ...nextIntakeSettings,
          intakeApiKey: newApiKey,
        },
      },
    });
  } catch (error) {
    log.error('[ADMIN] Error regenerating CMS intake API key:', error);
    return res.status(500).json({
      success: false,
      message: 'Error regenerating CMS intake API key',
      error: error.message,
    });
  }
};

/**
 * Get firm-scoped admin activity feed for settings/governance surfaces
 * GET /api/admin/firm-settings/activity
 */
const getFirmSettingsActivity = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }

    const rawLimit = parseInt(req.query?.limit, 10);
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 25;

    const caseActionTypes = [
      'USER_CLIENT_ACCESS_UPDATED',
      'FIRM_SETTINGS_UPDATED',
      'STORAGE_CONFIGURATION_UPDATED',
      'STORAGE_CONFIGURATION_DISCONNECTED',
    ];

    const authActionTypes = [
      'AdminMutation',
      'UserCreated',
      'AccountActivated',
      'AccountDeactivated',
      'InviteEmailResent',
      'PasswordResetByAdmin',
      'SetupLinkResent',
    ];

    const fetchLimit = Math.min(limit * 4, 250);
    const [caseAuditRows, authAuditRows] = await Promise.all([
      CaseAudit.find({
        firmId,
        actionType: { $in: caseActionTypes },
      })
        .sort({ timestamp: -1 })
        .limit(fetchLimit)
        .lean(),
      AuthAudit.find({
        firmId,
        actionType: { $in: authActionTypes },
      })
        .sort({ timestamp: -1 })
        .limit(fetchLimit)
        .lean(),
    ]);

    const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    const authMapped = authAuditRows
      .filter((row) => {
        if (row.actionType !== 'AdminMutation') return true;
        const route = String(row.metadata?.route || '');
        const method = String(row.metadata?.method || '').toUpperCase();
        const isAdminMutationRoute = (route.startsWith('/api/admin') || route.startsWith('/api/bulk-upload'))
          && mutationMethods.has(method);
        return isAdminMutationRoute;
      })
      .map((row) => ({
        id: `auth-${row._id}`,
        source: 'AuthAudit',
        xID: row.xID || row.performedBy || 'UNKNOWN',
        action: row.actionType,
        description: row.description,
        timestamp: row.timestamp,
        metadata: row.metadata || {},
      }));

    const caseMapped = caseAuditRows.map((row) => ({
      id: `case-${row._id}`,
      source: 'CaseAudit',
      xID: row.performedByXID || 'UNKNOWN',
      action: row.actionType,
      description: row.description,
      timestamp: row.timestamp,
      metadata: row.metadata || {},
    }));

    const data = [...caseMapped, ...authMapped]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    log.error('[ADMIN] Error fetching firm settings activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching firm settings activity',
      error: error.message,
    });
  }
};

const getSettingsAudit = async (req, res) => {
  try {
    const tenantId = req.user?.firmId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }

    const { page = 1, limit = 50, key } = req.query || {};
    const result = await listSettingsAudit({
      tenantId,
      settingsKey: key || null,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasNextPage: (result.page * result.limit) < result.total,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching settings audit',
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
    log.error('[ADMIN] Error fetching storage config:', error);
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

    const previousStorage = {
      mode: firm.storage?.mode || DEFAULT_STORAGE_MODE,
      provider: firm.storage?.provider || null,
    };
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
    await writeSettingsAudit({
      req,
      settingsKey: 'storage-config',
      action: 'CONFIG_CHANGED',
      oldDoc: previousStorage,
      newDoc: {
        mode: firm.storage.mode,
        provider: firm.storage.provider,
      },
      metadata: { source: 'admin.updateStorageConfig' },
      dedupeKey: 'storage-config-update',
    });

    await settingsAuditService.logIntegrationChange({
      firmId: req.user?.firmId,
      action: 'INTEGRATION_SETTINGS_UPDATED',
      entityType: 'firm.storage',
      entityId: firm.firmId,
      performedBy: req.user?.xID,
      performedByRole: req.user?.role,
      before: previousStorage,
      after: {
        mode: firm.storage.mode,
        provider: firm.storage.provider,
      },
      metadata: {
        source: 'admin.controller.updateStorageConfig',
      },
    });

    res.json({
      success: true,
      message: 'Storage configuration updated',
      data: firm.storage,
    });
  } catch (error) {
    log.error('[ADMIN] Error updating storage config:', error);
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

    const previousStorage = {
      mode: firm.storage?.mode || DEFAULT_STORAGE_MODE,
      provider: firm.storage?.provider || null,
    };
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
    await writeSettingsAudit({
      req,
      settingsKey: 'storage-config',
      action: 'CONFIG_CHANGED',
      oldDoc: previousStorage,
      newDoc: { mode: 'docketra_managed', provider: null },
      metadata: { source: 'admin.disconnectStorage' },
      dedupeKey: 'storage-config-disconnect',
    });

    await settingsAuditService.logIntegrationChange({
      firmId: req.user?.firmId,
      action: 'INTEGRATION_DISCONNECTED',
      entityType: 'firm.storage',
      entityId: firm.firmId,
      performedBy: req.user?.xID,
      performedByRole: req.user?.role,
      before: previousStorage,
      after: {
        mode: firm.storage.mode,
        provider: firm.storage.provider,
      },
      metadata: {
        source: 'admin.controller.disconnectStorage',
      },
    });

    res.json({
      success: true,
      message: 'Storage disconnected. Docketra-managed storage is now active.',
      data: firm.storage,
    });
  } catch (error) {
    log.error('[ADMIN] Error disconnecting storage:', error);
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
    log.error('[ADMIN] Failed to load system diagnostics:', error);
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
    log.error('[ADMIN] Failed to restore user', error);
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
    log.error('[ADMIN] Failed to restore client', error);
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
    log.error('[ADMIN] Failed to restore case', error);
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
    log.error('[ADMIN] Failed to restore task', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to restore task',
    });
  }
};


const normalizeHierarchyRole = (role) => String(role || 'USER').trim().toUpperCase();

const toHierarchyUserNode = (user) => ({
  id: String(user._id),
  xID: user.xID || null,
  name: user.name || '',
  email: user.email || '',
  role: normalizeHierarchyRole(user.role),
  status: user.status || null,
  isActive: Boolean(user.isActive),
  primaryAdminId: normalizeId(user.primaryAdminId),
  adminId: normalizeId(user.adminId),
  managerId: normalizeId(user.managerId),
});

const getHierarchyTree = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);

    const users = await User.find({
      firmId: req.user?.firmId,
      status: { $ne: 'deleted' },
    })
      .select('_id xID name email role status isActive primaryAdminId adminId managerId')
      .lean();

    const primaryAdminDoc = users.find((user) => normalizeHierarchyRole(user.role) === 'PRIMARY_ADMIN' && String(user._id) === String(req.user?._id))
      || users.find((user) => normalizeHierarchyRole(user.role) === 'PRIMARY_ADMIN');

    const primaryAdmin = primaryAdminDoc ? toHierarchyUserNode(primaryAdminDoc) : null;

    const tree = {
      primaryAdmin,
      admins: [],
      unassignedUsers: [],
    };

    if (!primaryAdmin) {
      return res.json({ success: true, data: tree });
    }

    const userNodes = users
      .filter((user) => String(user._id) !== String(primaryAdminDoc._id))
      .map(toHierarchyUserNode);

    const admins = userNodes.filter((node) => node.role === 'ADMIN');
    const managers = userNodes.filter((node) => node.role === 'MANAGER');
    const usersOnly = userNodes.filter((node) => node.role === 'USER');

    const adminsById = new Map(admins.map((admin) => [admin.id, { ...admin, managers: [], users: [] }]));
    const managersById = new Map(managers.map((manager) => [manager.id, { ...manager, users: [] }]));

    managersById.forEach((manager) => {
      const admin = manager.adminId ? adminsById.get(manager.adminId) : null;
      if (admin) {
        admin.managers.push(manager);
      } else {
        tree.unassignedUsers.push(manager);
      }
    });

    usersOnly.forEach((user) => {
      if (user.managerId) {
        const manager = managersById.get(user.managerId);
        if (manager) {
          manager.users.push(user);
          return;
        }
      }

      if (user.adminId) {
        const admin = adminsById.get(user.adminId);
        if (admin) {
          admin.users.push(user);
          return;
        }
      }

      tree.unassignedUsers.push(user);
    });

    tree.admins = Array.from(adminsById.values()).filter((admin) => !admin.primaryAdminId || admin.primaryAdminId === primaryAdmin.id);

    return res.json({ success: true, data: tree });
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: error.message || 'Failed to load hierarchy',
    });
  }
};

const updateUserHierarchy = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);

    const lookup = [
      { xID: String(req.params.id || '').toUpperCase() },
    ];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      lookup.push({ _id: req.params.id });
    }

    const target = await User.findOne({
      firmId: req.user?.firmId,
      status: { $ne: 'deleted' },
      $or: lookup,
    });

    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const role = normalizeHierarchyRole(target.role);
    const requestedAdminId = req.body?.adminId === undefined ? target.adminId : normalizeId(req.body?.adminId);
    const requestedManagerId = req.body?.managerId === undefined ? target.managerId : normalizeId(req.body?.managerId);

    const primaryAdminId = role === 'PRIMARY_ADMIN'
      ? null
      : (normalizeId(target.primaryAdminId) || normalizeId(req.user?._id));

    const hierarchyError = getTagValidationError({
      role,
      primaryAdminId,
      adminId: requestedAdminId,
      managerId: requestedManagerId,
    });

    if (hierarchyError) {
      return res.status(400).json({ success: false, message: hierarchyError });
    }

    const refIds = [requestedAdminId, requestedManagerId].filter(Boolean);
    const referenced = refIds.length
      ? await User.find({ _id: { $in: refIds }, firmId: req.user?.firmId, status: { $ne: 'deleted' } })
        .select('_id role adminId')
        .lean()
      : [];
    const refById = new Map(referenced.map((entry) => [String(entry._id), entry]));

    if (requestedAdminId) {
      const adminUser = refById.get(String(requestedAdminId));
      if (!adminUser || normalizeHierarchyRole(adminUser.role) !== 'ADMIN') {
        return res.status(400).json({ success: false, message: 'adminId must reference an ADMIN in the same firm' });
      }
    }

    if (requestedManagerId) {
      const managerUser = refById.get(String(requestedManagerId));
      if (!managerUser || normalizeHierarchyRole(managerUser.role) !== 'MANAGER') {
        return res.status(400).json({ success: false, message: 'managerId must reference a MANAGER in the same firm' });
      }
      if (requestedAdminId && normalizeId(managerUser.adminId) !== normalizeId(requestedAdminId)) {
        return res.status(400).json({ success: false, message: 'managerId must belong to the selected adminId' });
      }
    }

    if (role === 'PRIMARY_ADMIN') {
      target.adminId = null;
      target.managerId = null;
      target.reportsToUserId = null;
    } else if (role === 'ADMIN') {
      target.adminId = null;
      target.managerId = null;
      target.reportsToUserId = null;
    } else if (role === 'MANAGER') {
      target.adminId = requestedAdminId || null;
      target.managerId = null;
      target.reportsToUserId = null;
    } else {
      target.adminId = requestedAdminId || null;
      target.managerId = requestedManagerId || null;
      target.reportsToUserId = target.managerId || null;
    }

    await target.save();

    await logAuditEvent({
      firmId: req.user?.firmId,
      actorId: req.user?._id,
      targetId: target._id,
      action: 'HIERARCHY_UPDATED',
      metadata: {
        adminId: target.adminId,
        managerId: target.managerId,
      },
    });

    return res.json({ success: true, data: toHierarchyUserNode(target) });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update hierarchy',
    });
  }
};

const getAdminAuditLogs = async (req, res) => {
  try {
    const result = await getAuditLogs({
      firmId: req.user?.firmId,
      userId: req.query?.userId,
      actor: req.query?.actor,
      action: req.query?.action,
      actionType: req.query?.actionType,
      module: req.query?.module,
      startDate: req.query?.startDate,
      endDate: req.query?.endDate,
      targetEntity: req.query?.targetEntity,
      severity: req.query?.severity,
      page: req.query?.page,
      limit: req.query?.limit,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to fetch audit logs',
    });
  }
};

const getRetentionPreview = async (req, res) => {
  try {
    const data = await buildDiagnostics();
    return res.json({ success: true, data });
  } catch (error) {
    log.error('[ADMIN] Failed to build retention preview', error);
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
  getHierarchyTree,
  updateUserHierarchy: wrapWriteHandler(updateUserHierarchy),
  updateRestrictedClients: wrapWriteHandler(updateRestrictedClients),
  getFirmSettings,
  getFirmSettingsActivity,
  getSettingsAudit,
  updateFirmSettings: wrapWriteHandler(updateFirmSettings),
  getCmsIntakeSettings,
  updateCmsIntakeSettings: wrapWriteHandler(updateCmsIntakeSettings),
  regenerateCmsIntakeApiKey: wrapWriteHandler(regenerateCmsIntakeApiKey),
  getStorageConfig,
  updateStorageConfig: wrapWriteHandler(updateStorageConfig),
  disconnectStorage: wrapWriteHandler(disconnectStorage),
  getSystemDiagnostics,
  restoreUser: wrapWriteHandler(restoreUser),
  restoreClient: wrapWriteHandler(restoreClient),
  restoreCase: wrapWriteHandler(restoreCase),
  restoreTask: wrapWriteHandler(restoreTask),
  getRetentionPreview,
  getAdminAuditLogs,
};
