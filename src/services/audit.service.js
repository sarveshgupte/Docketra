const { randomUUID } = require('crypto');
const AuthAudit = require('../models/AuthAudit.model');
const { enqueueAuditJob } = require('../queues/audit.queue');
const { getIpRange } = require('../utils/ipRange');
const { sanitizeForAudit } = require('../utils/redaction');

const getRequestRoute = (req) => {
  const route = req?.context?.route || req?.originalUrl || req?.url || null;
  return typeof route === 'string' ? route.split('?')[0] : null;
};

const enrichMetadataFromRequest = (metadata, req, ipAddress, userAgent, requestId) => sanitizeForAudit({
  ...(metadata || {}),
  requestId,
  route: metadata?.route || getRequestRoute(req),
  method: metadata?.method || req?.method || null,
  firmId: metadata?.firmId || req?.context?.firmId || req?.user?.firmId || null,
  userId: metadata?.userId || req?.context?.userId || req?.user?._id || null,
  userXID: metadata?.userXID || req?.context?.userXID || req?.user?.xID || null,
  userAgent: metadata?.userAgent || userAgent || null,
  ipRange: metadata?.ipRange || getIpRange(ipAddress),
});

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

  const requestId = req?.context?.requestId || req?.requestId || metadata?.requestId || randomUUID();
  if (req && !req.requestId) {
    req.requestId = requestId;
  }

  const ipAddress = req?.ip;
  const userAgent = req?.get?.('user-agent');
  const enrichedMetadata = enrichMetadataFromRequest(metadata, req, ipAddress, userAgent, requestId);

  const entry = {
    xID: xID || performedBy || 'UNKNOWN',
    firmId: firmId || req?.context?.firmId || 'PLATFORM',
    userId: userId || req?.context?.userId || null,
    actionType: resolvedActionType,
    description: description || `Auth event: ${resolvedActionType}`,
    performedBy: performedBy || xID || req?.context?.userXID || 'SYSTEM',
    ipAddress,
    userAgent,
    requestId,
    timestamp: timestamp || new Date(),
    metadata: enrichedMetadata,
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
