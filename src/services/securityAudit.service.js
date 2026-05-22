'use strict';

const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { getIpRange } = require('../utils/ipRange');
const { logAuthEvent } = require('./audit.service');
const { getRequestIp, getRequestUserAgent } = require('./forensicAudit.service');
const log = require('../utils/log');
const { sanitizeForAudit } = require('../utils/redaction');

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

  SIGNUP_INIT_ATTEMPT: 'SIGNUP_INIT_ATTEMPT',
  SIGNUP_TURNSTILE_MISSING: 'SIGNUP_TURNSTILE_MISSING',
  SIGNUP_TURNSTILE_FAILED: 'SIGNUP_TURNSTILE_FAILED',
  SIGNUP_TURNSTILE_PASSED: 'SIGNUP_TURNSTILE_PASSED',
  FORGOT_PASSWORD_TURNSTILE_MISSING: 'FORGOT_PASSWORD_TURNSTILE_MISSING',
  FORGOT_PASSWORD_TURNSTILE_FAILED: 'FORGOT_PASSWORD_TURNSTILE_FAILED',
  FORGOT_PASSWORD_TURNSTILE_PASSED: 'FORGOT_PASSWORD_TURNSTILE_PASSED',
  SIGNUP_OTP_SENT: 'SIGNUP_OTP_SENT',
  SIGNUP_OTP_VERIFY_ATTEMPT: 'SIGNUP_OTP_VERIFY_ATTEMPT',
  SIGNUP_OTP_VERIFY_FAILED: 'SIGNUP_OTP_VERIFY_FAILED',
  SIGNUP_OTP_VERIFIED: 'SIGNUP_OTP_VERIFIED',
  SIGNUP_COMPLETED: 'SIGNUP_COMPLETED',
  SIGNUP_RATE_LIMITED: 'SIGNUP_RATE_LIMITED',
});

function sanitizeMetadata(value) {
  return sanitizeForAudit(value);
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

  // Tests should remain fully isolated from queue/Redis/Mongo side effects.
  // Keep audit event construction/logging behavior intact, but skip persistence.
  if (process.env.NODE_ENV === 'test') {
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
