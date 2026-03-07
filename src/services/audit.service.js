const { randomUUID } = require('crypto');
const AuthAudit = require('../models/AuthAudit.model');
const { enqueueAuditJob } = require('../queues/audit.queue');

const getRequestRoute = (req) => {
  const route = req?.originalUrl || req?.url || null;
  return typeof route === 'string' ? route.split('?')[0] : null;
};

const getIpRange = (ipAddress) => {
  if (!ipAddress || ipAddress === 'unknown') return 'unknown';

  const normalizedIp = String(ipAddress).replace(/^::ffff:/, '');
  if (normalizedIp.includes(':')) {
    return normalizedIp
      .split(':')
      .filter(Boolean)
      .slice(0, 4)
      .join(':') || normalizedIp;
  }

  const octets = normalizedIp.split('.');
  return octets.length === 4 ? octets.slice(0, 3).join('.') : normalizedIp;
};

const enrichMetadataFromRequest = (metadata, req, ipAddress, userAgent, requestId) => ({
  ...(metadata || {}),
  requestId,
  route: metadata?.route || getRequestRoute(req),
  method: metadata?.method || req?.method || null,
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

  const requestId = req?.requestId || metadata?.requestId || randomUUID();
  if (req && !req.requestId) {
    req.requestId = requestId;
  }

  const ipAddress = req?.ip;
  const userAgent = req?.get?.('user-agent');
  const enrichedMetadata = enrichMetadataFromRequest(metadata, req, ipAddress, userAgent, requestId);

  const entry = {
    xID: xID || performedBy || 'UNKNOWN',
    firmId: firmId || 'PLATFORM',
    userId,
    actionType: resolvedActionType,
    description: description || `Auth event: ${resolvedActionType}`,
    performedBy: performedBy || xID || 'SYSTEM',
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
