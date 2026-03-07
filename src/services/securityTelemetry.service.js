'use strict';

const log = require('../utils/log');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('./securityAudit.service');

const counters = new Map();

function incrementCounter(key, { windowMs, limit }) {
  const now = Date.now();
  const state = counters.get(key) || { count: 0, startedAt: now };
  if (now - state.startedAt > windowMs) {
    state.count = 0;
    state.startedAt = now;
  }
  state.count += 1;
  counters.set(key, state);
  return state.count >= limit;
}

async function emitSecurityAlert({ req, userId = null, firmId = null, resource = 'security', metadata = {}, description }) {
  const entry = {
    req,
    action: SECURITY_AUDIT_ACTIONS.SECURITY_ALERT,
    resource,
    userId,
    firmId,
    metadata,
    description: description || 'Security telemetry threshold exceeded',
  };

  log.warn('SECURITY_ALERT', {
    resource,
    userId: userId || req?.user?._id || null,
    firmId: firmId || req?.firmId || req?.user?.firmId || null,
    ...metadata,
  });

  await logSecurityAuditEvent(entry).catch(() => null);
}

async function noteLoginFailure({ req, xID = 'UNKNOWN', userId = null, firmId = null }) {
  const ip = req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown';
  const thresholdReached = incrementCounter(`login:${String(xID).toUpperCase()}:${ip}`, {
    windowMs: 15 * 60 * 1000,
    limit: 5,
  });

  if (thresholdReached) {
    await emitSecurityAlert({
      req,
      userId,
      firmId,
      resource: 'auth/login',
      metadata: { reason: 'multiple_login_failures', xID: String(xID).toUpperCase(), ipAddress: ip },
      description: 'Multiple login failures detected',
    });
  }
}

async function noteRefreshTokenFailure({ req, userId = null, firmId = null, reason = 'refresh_token_abuse' }) {
  const ip = req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown';
  const thresholdReached = incrementCounter(`refresh:${ip}:${reason}`, {
    windowMs: 10 * 60 * 1000,
    limit: 3,
  });

  if (thresholdReached) {
    await emitSecurityAlert({
      req,
      userId,
      firmId,
      resource: 'auth/refresh',
      metadata: { reason, ipAddress: ip },
      description: 'Refresh token abuse detected',
    });
  }
}

async function noteAdminPrivilegeChange({ req, userId = null, firmId = null, targetUserId = null, oldRole = null, newRole = null }) {
  await emitSecurityAlert({
    req,
    userId,
    firmId,
    resource: 'admin/user-role',
    metadata: { reason: 'admin_privilege_change', targetUserId, oldRole, newRole },
    description: 'Administrative privilege change detected',
  });
}

async function noteFileDownload({ req, userId = null, firmId = null, fileId = null }) {
  const actor = userId || req?.user?._id?.toString?.() || req?.user?.xID || 'unknown';
  const thresholdReached = incrementCounter(`download:${actor}`, {
    windowMs: 5 * 60 * 1000,
    limit: 20,
  });

  if (thresholdReached) {
    await emitSecurityAlert({
      req,
      userId,
      firmId,
      resource: 'files/download',
      metadata: { reason: 'unusual_download_activity', fileId },
      description: 'Unusual file download activity detected',
    });
  }
}

function _resetForTests() {
  counters.clear();
}

module.exports = {
  emitSecurityAlert,
  noteLoginFailure,
  noteRefreshTokenFailure,
  noteAdminPrivilegeChange,
  noteFileDownload,
  _resetForTests,
};
