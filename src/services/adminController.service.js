const { logAuthEvent } = require('./audit.service');
const log = require('../utils/log');

const DEFAULT_FIRM_SETTINGS = {
  slaDefaultDays: 3,
  slaWorkingDays: [1, 2, 3, 4, 5],
  slaHolidayDates: [],
  slaWorkingDateOverrides: [],
  calendarReminderLeadDays: 3,
  escalationInactivityThresholdHours: 24,
  workloadThreshold: 15,
  enablePerformanceView: true,
  enableEscalationView: true,
  enableBulkActions: true,
  brandLogoUrl: '',
  strictFirmOwnedStorage: false,
};

const normalizeIsoDateList = (values = []) => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .map((value) => String(value || '').trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))];
};

const normalizeWorkingDays = (days = []) => {
  if (!Array.isArray(days)) return DEFAULT_FIRM_SETTINGS.slaWorkingDays;
  const normalized = [...new Set(days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))];
  return normalized.length ? normalized : DEFAULT_FIRM_SETTINGS.slaWorkingDays;
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
  user.setupTokenHash = tokenHash;
  user.setupTokenExpiresAt = tokenExpiry;
  user.setupTokenUsedAt = null;
  user.passwordSetupTokenHash = tokenHash;
  user.passwordSetupExpires = tokenExpiry;
  user.inviteSentAt = inviteSentAt || new Date();
  user.mustSetPassword = true;
  user.mustChangePassword = true;
  user.status = 'invited';
  user.isActive = false;
};

const normalizeFirmSettings = (raw = {}) => ({
  slaDefaultDays: Number(raw.slaDefaultDays) > 0 ? Number(raw.slaDefaultDays) : DEFAULT_FIRM_SETTINGS.slaDefaultDays,
  slaWorkingDays: normalizeWorkingDays(raw.slaWorkingDays),
  slaHolidayDates: normalizeIsoDateList(raw.slaHolidayDates),
  slaWorkingDateOverrides: normalizeIsoDateList(raw.slaWorkingDateOverrides),
  calendarReminderLeadDays: Number(raw.calendarReminderLeadDays) >= 0
    ? Number(raw.calendarReminderLeadDays)
    : DEFAULT_FIRM_SETTINGS.calendarReminderLeadDays,
  escalationInactivityThresholdHours: Number(raw.escalationInactivityThresholdHours) > 0
    ? Number(raw.escalationInactivityThresholdHours)
    : DEFAULT_FIRM_SETTINGS.escalationInactivityThresholdHours,
  workloadThreshold: Number(raw.workloadThreshold) > 0 ? Number(raw.workloadThreshold) : DEFAULT_FIRM_SETTINGS.workloadThreshold,
  enablePerformanceView: raw.enablePerformanceView !== false,
  enableEscalationView: raw.enableEscalationView !== false,
  enableBulkActions: raw.enableBulkActions !== false,
  brandLogoUrl: typeof raw.brandLogoUrl === 'string' ? raw.brandLogoUrl.trim() : DEFAULT_FIRM_SETTINGS.brandLogoUrl,
  strictFirmOwnedStorage: Boolean(raw.strictFirmOwnedStorage),
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
