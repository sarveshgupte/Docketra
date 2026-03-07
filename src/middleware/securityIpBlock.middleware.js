'use strict';

const log = require('../utils/log');
const { getRequestIp } = require('../services/forensicAudit.service');
const { getIpBlockStatus } = require('../services/securityTelemetry.service');

// Superadmin login is a single explicit endpoint, while tenant logins are slug-based
// and therefore matched with a route-shaped regex.
const LOGIN_PATHS = new Set(['/superadmin/login']);
const TENANT_LOGIN_PATH = /^\/[^/]+\/login$/;
const REFRESH_PATHS = new Set(['/auth/refresh', '/api/auth/refresh']);

function shouldCheckTemporaryBlock(req) {
  const path = (req?.originalUrl || req?.url || '').split('?')[0];
  if (path.startsWith('/api')) {
    return true;
  }

  if (REFRESH_PATHS.has(path)) {
    return true;
  }

  if (req?.method === 'POST' && (LOGIN_PATHS.has(path) || TENANT_LOGIN_PATH.test(path))) {
    return true;
  }

  return false;
}

function enforceTemporaryIpBlock(req, res, next) {
  try {
    if (!shouldCheckTemporaryBlock(req)) {
      return next();
    }

    const ipStatus = getIpBlockStatus(getRequestIp(req));
    if (!ipStatus.blocked) {
      return next();
    }

    res.setHeader('Retry-After', String(ipStatus.retryAfter));
    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
      retryAfter: ipStatus.retryAfter,
    });
  } catch (error) {
    log.warn('SECURITY_IP_BLOCK_CHECK_FAILED', {
      req,
      error: error.message,
    });
    return next();
  }
}

module.exports = {
  enforceTemporaryIpBlock,
};
