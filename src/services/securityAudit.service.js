'use strict';

const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const log = require('../utils/log');
const { getIpRange } = require('../utils/ipRange');
const { logAuthEvent } = require('./audit.service');
const { getRequestIp, getRequestUserAgent } = require('./forensicAudit.service');

const SECURITY_AUDIT_ACTIONS = Object.freeze({
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  ADMIN_ACTION: 'ADMIN_ACTION',
  FILE_DOWNLOADED: 'FILE_DOWNLOADED',
  SECURITY_ALERT: 'SECURITY_ALERT',
});

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(secret|password|token|authorization|cookie|otp|totp|passcode|csrf|xsrf|session(?:id|token)?|api[_-]?key|bearer)/i;

function sanitizeMetadata(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMetadata(entry, seen));
  }
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';

  seen.add(value);
  return Object.entries(value).reduce((acc, [key, nested]) => {
    acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED_VALUE : sanitizeMetadata(nested, seen);
    return acc;
  }, {});
}

function coerceUserId(userId) {
  if (!userId) return null;
  const normalized = typeof userId?.toString === 'function' ? userId.toString() : String(userId);
  return mongoose.Types.ObjectId.isValid(normalized) ? normalized : null;
}

function getRequestRoute(req) {
  const route = req?.originalUrl || req?.url || null;
  return typeof route === 'string' ? route.split('?')[0] : null;
}

async function logSecurityAuditEvent({
  req = null,
  action,
  resource,
  userId = null,
  firmId = null,
  xID = null,
  performedBy = null,
  metadata = {},
  description = null,
} = {}) {
  if (!action) {
    throw new Error('action is required for security audit logging');
  }

  const timestamp = new Date().toISOString();
  const resolvedFirmId = firmId || req?.firmId || req?.firm?.id || req?.user?.firmId || 'PLATFORM';
  const resolvedUserId = coerceUserId(userId || req?.user?._id || req?.user?.id);
  const resolvedXid = xID || req?.user?.xID || 'UNKNOWN';
  const resolvedPerformedBy = performedBy || req?.user?.xID || resolvedXid || 'SYSTEM';
  const requestId = req?.requestId || metadata?.requestId || randomUUID();
  if (req && !req.requestId) {
    req.requestId = requestId;
  }
  const ipAddress = getRequestIp(req);
  const userAgent = getRequestUserAgent(req);
  const safeMetadata = sanitizeMetadata({
    ...(metadata || {}),
    requestId,
    route: metadata?.route || getRequestRoute(req),
    method: metadata?.method || req?.method || null,
    userAgent: metadata?.userAgent || userAgent,
    ipRange: metadata?.ipRange || getIpRange(ipAddress),
  });
  const entry = {
    timestamp,
    requestId,
    userId: resolvedUserId,
    firmId: typeof resolvedFirmId?.toString === 'function' ? resolvedFirmId.toString() : String(resolvedFirmId),
    action,
    resource: resource || req?.originalUrl || req?.url || 'unknown',
    ipAddress,
    userAgent,
    metadata: safeMetadata,
  };

  log.info('SECURITY_AUDIT', entry);

  // Unit tests commonly exercise controller logic without a live MongoDB
  // connection. Skip persistence in that narrow case so security logging
  // remains non-blocking while production/dev still writes immutable audit rows.
  if (process.env.NODE_ENV === 'test' && mongoose.connection?.readyState !== 1) {
    return entry;
  }

  await logAuthEvent({
    eventType: action,
    actionType: action,
    userId: resolvedUserId,
    firmId: entry.firmId,
    xID: resolvedXid,
      performedBy: resolvedPerformedBy,
      description: description || `Security audit event: ${action}`,
      req: {
        ip: entry.ipAddress,
        get: (header) => (header?.toLowerCase() === 'user-agent' ? entry.userAgent : undefined),
        requestId,
      },
      metadata: {
        resource: entry.resource,
        timestamp,
        ...safeMetadata,
    },
  });

  return entry;
}

module.exports = {
  SECURITY_AUDIT_ACTIONS,
  logSecurityAuditEvent,
  sanitizeMetadata,
};
