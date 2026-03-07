'use strict';

const log = require('../utils/log');
const { getIpRange } = require('../utils/ipRange');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('./securityAudit.service');
const { getRequestIp } = require('./forensicAudit.service');

const counters = new Map();
const eventWindows = new Map();
const alertCooldowns = new Map();
const logWindows = new Map();

const MAX_TELEMETRY_KEYS = 5000;
const MAX_WINDOW_EVENTS = 200;
const ALERT_COOLDOWN = 10 * 60 * 1000;
const LOG_WINDOW_MS = 60 * 1000;
const MAX_IDENTICAL_LOGS_PER_WINDOW = 50;
const PRUNE_INTERVAL_MS = 60 * 1000;
let lastPruneAt = 0;

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

function getRequestRoute(req) {
  const route = req?.originalUrl || req?.url || null;
  return typeof route === 'string' ? route.split('?')[0] : null;
}

function getRequestUserAgent(req) {
  const userAgent = req?.headers?.['user-agent'] || req?.get?.('user-agent') || null;
  return typeof userAgent === 'string' && userAgent.trim() ? userAgent.trim() : null;
}

function enforceMapLimit(map, getTimestamp = (value) => value?.lastUpdatedAt || 0) {
  if (map.size <= MAX_TELEMETRY_KEYS) return;

  const overflow = map.size - MAX_TELEMETRY_KEYS;
  const oldestEntries = [...map.entries()]
    .sort(([, left], [, right]) => getTimestamp(left) - getTimestamp(right))
    .slice(0, overflow);

  oldestEntries.forEach(([key]) => map.delete(key));
}

function pruneCounters(now = Date.now()) {
  for (const [key, state] of counters.entries()) {
    if (!state || !state.windowMs || (now - state.startedAt) > state.windowMs) {
      counters.delete(key);
    }
  }

  enforceMapLimit(counters);
}

function pruneWindowEntries(now = Date.now()) {
  for (const [key, state] of eventWindows.entries()) {
    if (!state || !state.windowMs) {
      eventWindows.delete(key);
      continue;
    }

    const entries = (state.entries || []).filter((entry) => now - entry.timestamp <= state.windowMs);
    if (entries.length === 0) {
      eventWindows.delete(key);
      continue;
    }

    state.entries = entries.slice(-MAX_WINDOW_EVENTS);
    state.lastUpdatedAt = now;
    eventWindows.set(key, state);
  }

  enforceMapLimit(eventWindows);
}

function pruneCooldowns(now = Date.now()) {
  for (const [key, state] of alertCooldowns.entries()) {
    if (!state || (now - state.timestamp) > ALERT_COOLDOWN) {
      alertCooldowns.delete(key);
    }
  }

  enforceMapLimit(alertCooldowns);
}

function pruneLogWindows(now = Date.now()) {
  for (const [key, state] of logWindows.entries()) {
    if (!state || (now - state.startedAt) > LOG_WINDOW_MS) {
      logWindows.delete(key);
    }
  }

  enforceMapLimit(logWindows);
}

function pruneTelemetryState(now = Date.now(), { force = false } = {}) {
  if (!force && (now - lastPruneAt) < PRUNE_INTERVAL_MS) {
    return;
  }

  pruneCounters(now);
  pruneWindowEntries(now);
  pruneCooldowns(now);
  pruneLogWindows(now);
  lastPruneAt = now;
}

function maybePruneTelemetryState(now = Date.now()) {
  const overCapacity = (
    counters.size > MAX_TELEMETRY_KEYS ||
    eventWindows.size > MAX_TELEMETRY_KEYS ||
    alertCooldowns.size > MAX_TELEMETRY_KEYS ||
    logWindows.size > MAX_TELEMETRY_KEYS
  );

  pruneTelemetryState(now, { force: overCapacity || (now - lastPruneAt) >= PRUNE_INTERVAL_MS });
}

function startPruner() {
  const timer = setInterval(() => {
    try {
      pruneTelemetryState(Date.now(), { force: true });
    } catch (error) {
      log.error('SECURITY_TELEMETRY_PRUNE_FAILED', { error: error.message });
    }
  }, PRUNE_INTERVAL_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

function buildAlertCooldownKey(alertType, userId, ipAddress) {
  return [alertType || 'security_alert', userId ? String(userId) : 'anonymous', ipAddress || 'unknown'].join(':');
}

function shouldEmitAlert({ alertType, userId, ipAddress, now = Date.now() }) {
  const key = buildAlertCooldownKey(alertType, userId, ipAddress);
  const existing = alertCooldowns.get(key);
  if (existing && (now - existing.timestamp) < ALERT_COOLDOWN) {
    existing.lastUpdatedAt = now;
    alertCooldowns.set(key, existing);
    maybePruneTelemetryState(now);
    return false;
  }

  alertCooldowns.set(key, { timestamp: now, lastUpdatedAt: now });
  maybePruneTelemetryState(now);
  return true;
}

function buildLogSuppressionKey(eventName, metadata) {
  return [
    eventName,
    metadata?.alertType || 'unknown',
    metadata?.userId ? String(metadata.userId) : 'anonymous',
    metadata?.ipAddress || 'unknown',
    metadata?.reason || metadata?.resource || 'unknown',
  ].join(':');
}

function shouldWriteSecurityAlertLog(metadata, now = Date.now()) {
  const key = buildLogSuppressionKey('SECURITY_ALERT', metadata);
  let state = logWindows.get(key);
  if (!state || (now - state.startedAt) > LOG_WINDOW_MS) {
    state = { startedAt: now, count: 0, suppressed: false, lastUpdatedAt: now };
  }

  state.count += 1;
  state.lastUpdatedAt = now;
  logWindows.set(key, state);
  maybePruneTelemetryState(now);

  if (state.count <= MAX_IDENTICAL_LOGS_PER_WINDOW) {
    return true;
  }

  if (!state.suppressed) {
    state.suppressed = true;
    logWindows.set(key, state);
    log.warn('SECURITY_ALERT_SUPPRESSED', {
      req: metadata?.req,
      alertType: metadata?.alertType || null,
      userId: metadata?.userId || null,
      resource: metadata?.resource || null,
      ipAddress: metadata?.ipAddress || null,
      suppressedAfter: MAX_IDENTICAL_LOGS_PER_WINDOW,
    });
  }

  return false;
}

function incrementCounter(key, { windowMs, limit }) {
  const now = Date.now();
  const state = counters.get(key) || { count: 0, startedAt: now, windowMs, lastUpdatedAt: now };
  if (now - state.startedAt > windowMs) {
    state.count = 0;
    state.startedAt = now;
  }
  state.windowMs = windowMs;
  state.count += 1;
  state.lastUpdatedAt = now;
  counters.set(key, state);
  maybePruneTelemetryState(now);

  return {
    count: state.count,
    thresholdReached: state.count === limit,
    startedAt: state.startedAt,
  };
}

function pushWindowValue(key, value, windowMs) {
  const now = Date.now();
  const state = eventWindows.get(key) || { entries: [], windowMs, lastUpdatedAt: now };
  const trimmed = (state.entries || []).filter((entry) => now - entry.timestamp <= windowMs);
  trimmed.push({ value, timestamp: now });
  state.entries = trimmed.slice(-MAX_WINDOW_EVENTS);
  state.windowMs = windowMs;
  state.lastUpdatedAt = now;
  eventWindows.set(key, state);
  maybePruneTelemetryState(now);
  return state.entries;
}

function countRecent(key, windowMs) {
  const now = Date.now();
  const state = eventWindows.get(key);
  const trimmed = (state?.entries || []).filter((entry) => now - entry.timestamp <= windowMs);
  if (trimmed.length === 0) {
    eventWindows.delete(key);
    maybePruneTelemetryState(now);
    return 0;
  }

  eventWindows.set(key, {
    entries: trimmed.slice(-MAX_WINDOW_EVENTS),
    windowMs,
    lastUpdatedAt: now,
  });
  maybePruneTelemetryState(now);
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
} = {}) {
  try {
    const now = Date.now();
    const resolvedIp = metadata.ipAddress || getRequestIp(req);
    if (!shouldEmitAlert({ alertType, userId, ipAddress: resolvedIp, now })) {
      // Duplicate alerts inside the cooldown window are intentionally dropped.
      return null;
    }

    const enrichedMetadata = {
      ...metadata,
      event: alertType,
      ipAddress: resolvedIp,
      requestId: req?.requestId || metadata.requestId || null,
      route: metadata.route || getRequestRoute(req),
      method: metadata.method || req?.method || null,
      userAgent: metadata.userAgent || getRequestUserAgent(req),
      ipRange: metadata.ipRange || getIpRange(resolvedIp),
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

    const logMetadata = {
      req,
      resource,
      userId: userId || req?.user?._id || null,
      firmId: firmId || req?.firmId || req?.user?.firmId || null,
      description: entry.description,
      alertType,
      ...enrichedMetadata,
    };

    if (shouldWriteSecurityAlertLog(logMetadata, now)) {
      log.warn('SECURITY_ALERT', logMetadata);
    }

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
  } catch (error) {
    log.error('SECURITY_ALERT_FAILURE', {
      req,
      userId: userId || req?.user?._id || null,
      firmId: firmId || req?.firmId || req?.user?.firmId || null,
      resource,
      alertType,
      error: error.message,
    });
  }
}

async function noteLoginFailure({ req, xID = 'UNKNOWN', userId = null, firmId = null, reason = 'multiple_login_failures' } = {}) {
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

async function noteLockedAccountAttempt({ req, userId = null, firmId = null, xID = 'UNKNOWN' } = {}) {
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
} = {}) {
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

async function noteRefreshTokenFailure({ req, userId = null, firmId = null, reason = 'refresh_token_abuse' } = {}) {
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

async function noteRefreshTokenUse({ req, userId = null, firmId = null, tokenIpAddress = null } = {}) {
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

async function noteAdminPrivilegeChange({ req, userId = null, firmId = null, targetUserId = null, oldRole = null, newRole = null } = {}) {
  try {
    await emitSecurityAlert({
      req,
      userId,
      firmId,
      resource: 'admin/user-role',
      metadata: { reason: 'admin_privilege_change', targetUserId, oldRole, newRole },
      description: 'Administrative privilege change detected',
    });
  } catch (error) {
    log.error('SECURITY_TELEMETRY_ADMIN_PRIVILEGE_CHANGE', {
      req,
      error: error.message,
      userId,
      firmId,
      targetUserId,
    });
  }
}

async function noteFileDownload({ req, userId = null, firmId = null, fileId = null } = {}) {
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

async function noteApiActivity({ req, statusCode = 200 } = {}) {
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
  alertCooldowns.clear();
  logWindows.clear();
  lastPruneAt = 0;
}

function _getInternalStateForTests() {
  return {
    countersSize: counters.size,
    eventWindowsSize: eventWindows.size,
    alertCooldownsSize: alertCooldowns.size,
    logWindowsSize: logWindows.size,
    maxWindowEntries: [...eventWindows.values()].reduce(
      (maxEntries, state) => Math.max(maxEntries, (state.entries || []).length),
      0
    ),
  };
}

startPruner();

module.exports = {
  ALERT_TYPES,
  SECURITY_METRIC_WINDOWS,
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
  MAX_TELEMETRY_KEYS,
  MAX_WINDOW_EVENTS,
  ALERT_COOLDOWN,
  _resetForTests,
  _getInternalStateForTests,
};
