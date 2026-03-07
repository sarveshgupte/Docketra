const { randomUUID } = require('crypto');
const AuthAudit = require('../models/AuthAudit.model');
const { enqueueAuditJob } = require('../queues/audit.queue');

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

  const requestId = req?.requestId || metadata?.requestId || randomUUID();
  if (req && !req.requestId) {
    req.requestId = requestId;
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
    requestId,
    timestamp: timestamp || new Date(),
    metadata: metadata
      ? {
          ...metadata,
          requestId,
        }
      : { requestId },
  };

  if (session) {
    await AuthAudit.create([entry], { session });
    return entry;
  }

  const queued = await enqueueAuditJob('createAuthAudit', { entry }).catch(() => ({ queued: false }));
  if (!queued?.queued) {
    await AuthAudit.create(entry);
  }
  return entry;
};

module.exports = {
  logAuthEvent,
};
