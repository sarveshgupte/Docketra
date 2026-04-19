const { logAuthEvent } = require('./audit.service');
const log = require('../utils/log');

const DEFAULT_FIRM_SETTINGS = {
  slaDefaultDays: 3,
  escalationInactivityThresholdHours: 24,
  workloadThreshold: 15,
  enablePerformanceView: true,
  enableEscalationView: true,
  enableBulkActions: true,
  brandLogoUrl: '',
};

const DEFAULT_WORK_SETTINGS = {
  assignmentStrategy: 'manual',
  statusWorkflowMode: 'flexible',
  autoAssignmentEnabled: false,
  highPrioritySlaDays: 1,
  dueSoonWarningDays: 2,
};

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
    log.error('[ADMIN] Failed to log audit event:', auditError.message);
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

const normalizeFirmSettings = (raw = {}) => ({
  slaDefaultDays: Number(raw.slaDefaultDays) > 0 ? Number(raw.slaDefaultDays) : DEFAULT_FIRM_SETTINGS.slaDefaultDays,
  escalationInactivityThresholdHours: Number(raw.escalationInactivityThresholdHours) > 0
    ? Number(raw.escalationInactivityThresholdHours)
    : DEFAULT_FIRM_SETTINGS.escalationInactivityThresholdHours,
  workloadThreshold: Number(raw.workloadThreshold) > 0 ? Number(raw.workloadThreshold) : DEFAULT_FIRM_SETTINGS.workloadThreshold,
  enablePerformanceView: raw.enablePerformanceView !== false,
  enableEscalationView: raw.enableEscalationView !== false,
  enableBulkActions: raw.enableBulkActions !== false,
  brandLogoUrl: typeof raw.brandLogoUrl === 'string' ? raw.brandLogoUrl.trim() : DEFAULT_FIRM_SETTINGS.brandLogoUrl,
});

const normalizeWorkSettings = (raw = {}) => ({
  assignmentStrategy: ['manual', 'balanced'].includes(raw.assignmentStrategy) ? raw.assignmentStrategy : DEFAULT_WORK_SETTINGS.assignmentStrategy,
  statusWorkflowMode: ['flexible', 'strict'].includes(raw.statusWorkflowMode) ? raw.statusWorkflowMode : DEFAULT_WORK_SETTINGS.statusWorkflowMode,
  autoAssignmentEnabled: Boolean(raw.autoAssignmentEnabled),
  highPrioritySlaDays: Number(raw.highPrioritySlaDays) > 0 ? Number(raw.highPrioritySlaDays) : DEFAULT_WORK_SETTINGS.highPrioritySlaDays,
  dueSoonWarningDays: Number(raw.dueSoonWarningDays) > 0 ? Number(raw.dueSoonWarningDays) : DEFAULT_WORK_SETTINGS.dueSoonWarningDays,
});

module.exports = {
  DEFAULT_FIRM_SETTINGS,
  DEFAULT_WORK_SETTINGS,
  safeAuditLog,
  resetUserToInvitedState,
  normalizeFirmSettings,
  normalizeWorkSettings,
};
