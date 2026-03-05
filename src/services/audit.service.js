const AuthAudit = require('../models/AuthAudit.model');

const logAuthEvent = async ({
  eventType,
  actionType,
  userId = null,
  firmId = null,
  xID = null,
  performedBy = null,
  description = null,
  req = null,
  metadata = null,
  timestamp = null,
  session = null,
}) => {
  const resolvedActionType = actionType || eventType;
  if (!resolvedActionType) {
    throw new Error('actionType/eventType is required for auth audit logging');
  }

  const entry = {
    xID: xID || performedBy || 'UNKNOWN',
    firmId: firmId || 'PLATFORM',
    userId,
    actionType: resolvedActionType,
    description: description || `Auth event: ${resolvedActionType}`,
    performedBy: performedBy || xID || 'SYSTEM',
    ipAddress: req?.ip,
    userAgent: req?.get?.('user-agent'),
    timestamp: timestamp || new Date(),
    metadata: metadata || undefined,
  };

  if (session) {
    await AuthAudit.create([entry], { session });
  } else {
    await AuthAudit.create(entry);
  }
  return entry;
};

module.exports = {
  logAuthEvent,
};
