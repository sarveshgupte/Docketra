'use strict';

const log = require('../utils/log');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('./securityAudit.service');
const { getRequestIp } = require('./forensicAudit.service');

const counters = new Map();
const eventWindows = new Map();

const ALERT_TYPES = Object.freeze({
  SUSPICIOUS_LOGIN_PATTERN: 'suspicious_login_pattern',
  REFRESH_TOKEN_ABUSE: 'refresh_token_abuse',
  API_ABUSE_DETECTED: 'api_abuse_detected',
});

const SECURITY_METRIC_WINDOWS = Object.freeze({
  oneHour: 60 * 60 * 1000,
  failedApi: 2 * 60 * 1000,
  rapidIp: 60 * 1000,
  downloads: 5 * 60 * 1000,
  refreshTokenWindow: 10 * 60 * 1000,
  suspiciousTravel: 2 * 60 * 60 * 1000,
});

function incrementCounter(key, { windowMs, limit }) {
  const now = Date.now();
  const state = counters.get(key) || { count: 0, startedAt: now };
  if (now - state.startedAt > windowMs) {
    state.count = 0;
    state.startedAt = now;
  }
  state.count += 1;
  counters.set(key, state);

  return {
    count: state.count,
    thresholdReached: state.count === limit,
    startedAt: state.startedAt,
  };
}

function pushWindowValue(key, value, windowMs) {
  const now = Date.now();
  const existing = eventWindows.get(key) || [];
  const trimmed = existing.filter((entry) => now - entry.timestamp <= windowMs);
  trimmed.push({ value, timestamp: now });
  eventWindows.set(key, trimmed);
  return trimmed;
}

function countRecent(key, windowMs) {
  const now = Date.now();
  const existing = eventWindows.get(key) || [];
  const trimmed = existing.filter((entry) => now - entry.timestamp <= windowMs);
  eventWindows.set(key, trimmed);
  return trimmed.length;
}

function getRequestCountry(req) {
  const headers = req?.headers || {};
  const country =
    headers['cf-ipcountry'] ||
    headers['x-vercel-ip-country'] ||
    headers['cloudfront-viewer-country'] ||
    headers['x-appengine-country'] ||
    headers['x-country-code'] ||
    headers['x-geo-country'] ||
    null;

  return typeof country === 'string' && country.trim() ? country.trim().toUpperCase() : null;
}

function getIpRange(ipAddress) {
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
  if (octets.length === 4) {
    return octets.slice(0, 3).join('.');
  }

  return normalizedIp;
}

function isNewIpRangeDetected(lastLoginIp, previousIpRange, currentIpRange) {
  return Boolean(
    lastLoginIp &&
    previousIpRange !== 'unknown' &&
    currentIpRange !== 'unknown' &&
    previousIpRange !== currentIpRange
  );
}

function isRapidGeoChangeDetected(recentLogin, lastLoginCountry, currentCountry) {
  return Boolean(recentLogin && lastLoginCountry && currentCountry && lastLoginCountry !== currentCountry);
}

async function emitSecurityAlert({
  req,
  userId = null,
  firmId = null,
  resource = 'security',
  metadata = {},
  description,
  alertType = 'security_alert',
}) {
  const resolvedIp = metadata.ipAddress || getRequestIp(req);
  const enrichedMetadata = {
    ...metadata,
    event: alertType,
    ipAddress: resolvedIp,
    requestId: req?.requestId || metadata.requestId || null,
  };
  const entry = {
    req,
    action: SECURITY_AUDIT_ACTIONS.SECURITY_ALERT,
    resource,
    userId,
    firmId,
    metadata: enrichedMetadata,
    description: description || 'Security telemetry threshold exceeded',
  };

  countRecent('metric:security_alerts', SECURITY_METRIC_WINDOWS.oneHour);
  pushWindowValue('metric:security_alerts', alertType, SECURITY_METRIC_WINDOWS.oneHour);

  log.warn('SECURITY_ALERT', {
    req,
    resource,
    userId: userId || req?.user?._id || null,
    firmId: firmId || req?.firmId || req?.user?.firmId || null,
    description: entry.description,
    alertType,
    ...enrichedMetadata,
  });

  await logSecurityAuditEvent(entry).catch((error) => {
    log.error('SECURITY_ALERT_AUDIT_FAILURE', {
      req,
      userId: userId || req?.user?._id || null,
      firmId: firmId || req?.firmId || req?.user?.firmId || null,
      resource,
      alertType,
      error: error.message,
    });
    return null;
  });
}

async function noteLoginFailure({ req, xID = 'UNKNOWN', userId = null, firmId = null, reason = 'multiple_login_failures' }) {
  try {
    const ip = getRequestIp(req);
    pushWindowValue('metric:login_failures', { xID: String(xID).toUpperCase(), ip }, SECURITY_METRIC_WINDOWS.oneHour);

    const byIdentity = incrementCounter(`login:identity:${String(xID).toUpperCase()}`, {
      windowMs: 15 * 60 * 1000,
      limit: 5,
    });
    const byIp = incrementCounter(`login:ip:${ip}`, {
      windowMs: 15 * 60 * 1000,
      limit: 5,
    });

    if (byIdentity.thresholdReached || byIp.thresholdReached) {
      await emitSecurityAlert({
        req,
        userId,
        firmId,
        resource: 'auth/login',
        alertType: ALERT_TYPES.SUSPICIOUS_LOGIN_PATTERN,
        metadata: {
          reason,
          xID: String(xID).toUpperCase(),
          ipAddress: ip,
          failedAttempts: Math.max(byIdentity.count, byIp.count),
        },
        description: 'Multiple login failures detected',
      });
    }
  } catch (error) {
    log.error('SECURITY_TELEMETRY_LOGIN_FAILURE', { req, error: error.message, xID, userId, firmId });
  }
}

async function noteLockedAccountAttempt({ req, userId = null, firmId = null, xID = 'UNKNOWN' }) {
  try {
    await emitSecurityAlert({
      req,
      userId,
      firmId,
      resource: 'auth/login',
      alertType: ALERT_TYPES.SUSPICIOUS_LOGIN_PATTERN,
      metadata: {
        reason: 'locked_account_attempt',
        xID: String(xID).toUpperCase(),
      },
      description: 'Login attempt detected on a locked account',
    });
  } catch (error) {
    log.error('SECURITY_TELEMETRY_LOCKED_ACCOUNT', { req, error: error.message, xID, userId, firmId });
  }
}

async function noteSuccessfulLogin({
  req,
  userId = null,
  firmId = null,
  xID = 'UNKNOWN',
  lastLoginIp = null,
  lastLoginAt = null,
  lastLoginCountry = null,
  resource = 'auth/login',
  mfaRequired = false,
}) {
  try {
    const ip = getRequestIp(req);
    const currentIpRange = getIpRange(ip);
    const previousIpRange = getIpRange(lastLoginIp);
    const currentCountry = getRequestCountry(req);
    const lastLoginTs = lastLoginAt ? new Date(lastLoginAt).getTime() : null;
    const recentLogin = lastLoginTs && (Date.now() - lastLoginTs) <= SECURITY_METRIC_WINDOWS.suspiciousTravel;

    if (isNewIpRangeDetected(lastLoginIp, previousIpRange, currentIpRange)) {
      await emitSecurityAlert({
        req,
        userId,
        firmId,
        resource,
        alertType: ALERT_TYPES.SUSPICIOUS_LOGIN_PATTERN,
        metadata: {
          reason: 'new_ip_range',
          xID: String(xID).toUpperCase(),
          ipAddress: ip,
          previousIpRange,
          currentIpRange,
          lastLoginAt,
          mfaRequired,
        },
        description: 'Login detected from a new IP range',
      });
    }

    if (isRapidGeoChangeDetected(recentLogin, lastLoginCountry, currentCountry)) {
      await emitSecurityAlert({
        req,
        userId,
        firmId,
        resource,
        alertType: ALERT_TYPES.SUSPICIOUS_LOGIN_PATTERN,
        metadata: {
          reason: 'rapid_geo_change',
          xID: String(xID).toUpperCase(),
          ipAddress: ip,
          previousCountry: lastLoginCountry,
          currentCountry,
          lastLoginAt,
          mfaRequired,
        },
        description: 'Login detected from a different geography within a short time window',
      });
    }
  } catch (error) {
    log.error('SECURITY_TELEMETRY_LOGIN_SUCCESS', { req, error: error.message, xID, userId, firmId });
  }
}

async function noteRefreshTokenFailure({ req, userId = null, firmId = null, reason = 'refresh_token_abuse' }) {
  try {
    const ip = getRequestIp(req);
    pushWindowValue('metric:refresh_failures', { userId, firmId, reason, ip }, SECURITY_METRIC_WINDOWS.oneHour);

    const failureCounter = incrementCounter(`refresh:${ip}:${reason}`, {
      windowMs: 10 * 60 * 1000,
      limit: 3,
    });

    if (reason === 'revoked_refresh_token' || failureCounter.thresholdReached) {
      await emitSecurityAlert({
        req,
        userId,
        firmId,
        resource: 'auth/refresh',
        alertType: ALERT_TYPES.REFRESH_TOKEN_ABUSE,
        metadata: {
          reason,
          ipAddress: ip,
          userId: userId ? String(userId) : null,
          firmId: firmId ? String(firmId) : null,
          attempts: failureCounter.count,
        },
        description: 'Refresh token abuse detected',
      });
    }
  } catch (error) {
    log.error('SECURITY_TELEMETRY_REFRESH_FAILURE', { req, error: error.message, userId, firmId, reason });
  }
}

async function noteRefreshTokenUse({ req, userId = null, firmId = null, tokenIpAddress = null }) {
  try {
    if (!userId) return;

    const currentIp = getRequestIp(req);
    const history = pushWindowValue(`refresh-usage:${String(userId)}`, currentIp, SECURITY_METRIC_WINDOWS.refreshTokenWindow);
    const distinctIps = new Set(
      [tokenIpAddress, ...history.map((entry) => entry.value)]
        .filter(Boolean)
        .map((entry) => String(entry))
    );

    if (distinctIps.size >= 3) {
      await emitSecurityAlert({
        req,
        userId,
        firmId,
        resource: 'auth/refresh',
        alertType: ALERT_TYPES.REFRESH_TOKEN_ABUSE,
        metadata: {
          reason: 'multiple_ips_rapidly',
          ipAddress: currentIp,
          distinctIpCount: distinctIps.size,
        },
        description: 'Refresh token used from multiple IPs rapidly',
      });
    }
  } catch (error) {
    log.error('SECURITY_TELEMETRY_REFRESH_USAGE', { req, error: error.message, userId, firmId });
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
  try {
    const ip = getRequestIp(req);
    const actor = userId || req?.user?._id?.toString?.() || req?.user?.xID || 'unknown';
    const threshold = incrementCounter(`download:${ip}`, {
      windowMs: SECURITY_METRIC_WINDOWS.downloads,
      limit: 30,
    });

    if (threshold.thresholdReached) {
      await emitSecurityAlert({
        req,
        userId,
        firmId,
        resource: 'files/download',
        alertType: ALERT_TYPES.API_ABUSE_DETECTED,
        metadata: {
          reason: 'large_download_volume',
          fileId,
          actor,
          ipAddress: ip,
          downloadsInWindow: threshold.count,
        },
        description: 'Large file download volume detected',
      });
    }
  } catch (error) {
    log.error('SECURITY_TELEMETRY_FILE_DOWNLOAD', { req, error: error.message, userId, firmId, fileId });
  }
}

async function noteApiActivity({ req, statusCode = 200 }) {
  try {
    const path = (req?.originalUrl || req?.url || '').split('?')[0];
    if (!path.startsWith('/api') || path.startsWith('/api/health') || path.startsWith('/api/metrics')) {
      return;
    }

    const ip = getRequestIp(req);
    const requestCount = incrementCounter(`api:requests:${ip}`, {
      windowMs: SECURITY_METRIC_WINDOWS.rapidIp,
      limit: 120,
    });

    if (requestCount.thresholdReached) {
      await emitSecurityAlert({
        req,
        userId: req?.user?._id || null,
        firmId: req?.firmId || req?.user?.firmId || null,
        resource: path,
        alertType: ALERT_TYPES.API_ABUSE_DETECTED,
        metadata: {
          reason: 'rapid_api_access_from_single_ip',
          ipAddress: ip,
          requestCount: requestCount.count,
        },
        description: 'Rapid API access detected from a single IP',
      });
    }

    if (statusCode >= 400 && ![404, 405].includes(statusCode)) {
      const failureCount = incrementCounter(`api:failures:${ip}`, {
        windowMs: SECURITY_METRIC_WINDOWS.failedApi,
        limit: 20,
      });

      if (failureCount.thresholdReached) {
        await emitSecurityAlert({
          req,
          userId: req?.user?._id || null,
          firmId: req?.firmId || req?.user?.firmId || null,
          resource: path,
          alertType: ALERT_TYPES.API_ABUSE_DETECTED,
          metadata: {
            reason: 'repeated_failed_api_calls',
            ipAddress: ip,
            failureCount: failureCount.count,
            statusCode,
          },
          description: 'Repeated failed API calls detected',
        });
      }
    }
  } catch (error) {
    log.error('SECURITY_TELEMETRY_API_ACTIVITY', {
      req,
      error: error.message,
      statusCode,
      route: req?.originalUrl || req?.url || null,
    });
  }
}

function getSecurityMetricsSnapshot() {
  return {
    login_failures_last_hour: countRecent('metric:login_failures', SECURITY_METRIC_WINDOWS.oneHour),
    refresh_token_failures: countRecent('metric:refresh_failures', SECURITY_METRIC_WINDOWS.oneHour),
    security_alerts_last_hour: countRecent('metric:security_alerts', SECURITY_METRIC_WINDOWS.oneHour),
  };
}

function _resetForTests() {
  counters.clear();
  eventWindows.clear();
}

module.exports = {
  ALERT_TYPES,
  emitSecurityAlert,
  noteLoginFailure,
  noteLockedAccountAttempt,
  noteSuccessfulLogin,
  noteRefreshTokenFailure,
  noteRefreshTokenUse,
  noteAdminPrivilegeChange,
  noteFileDownload,
  noteApiActivity,
  getSecurityMetricsSnapshot,
  getRequestCountry,
  getIpRange,
  _resetForTests,
};
