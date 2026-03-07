'use strict';

const log = require('../utils/log');
const { getIpRange } = require('../utils/ipRange');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('./securityAudit.service');
const { getRequestIp } = require('./forensicAudit.service');

const counters = new Map();
const eventWindows = new Map();
const alertCooldowns = new Map();
const logWindows = new Map();
const blockedIps = new Map();

const MAX_TELEMETRY_KEYS = 5000;
const MAX_WINDOW_EVENTS = 200;
const ALERT_COOLDOWN = 10 * 60 * 1000;
const LOG_WINDOW_MS = 60 * 1000;
const MAX_IDENTICAL_LOGS_PER_WINDOW = 50;
const PRUNE_INTERVAL_MS = 60 * 1000;
const HIGH_SEVERITY_ALERT_LIMIT = 3;
const HIGH_SEVERITY_LEVELS = new Set(['high', 'critical']);
// Alert when an IP crosses the “more than 20 unique routes” requirement.
const API_ENUMERATION_THRESHOLD = 21;
// Alert when a user exceeds the “more than 100 downloads” requirement.
const DATA_EXFILTRATION_THRESHOLD = 101;
let lastPruneAt = 0;

const ALERT_TYPES = Object.freeze({
  SUSPICIOUS_LOGIN_PATTERN: 'suspicious_login_pattern',
  IMPOSSIBLE_TRAVEL_DETECTED: 'impossible_travel_detected',
  REFRESH_TOKEN_ABUSE: 'refresh_token_abuse',
  API_ABUSE_DETECTED: 'api_abuse_detected',
  TENANT_ABUSE_DETECTED: 'tenant_abuse_detected',
  ACCOUNT_TAKEOVER_SUSPECTED: 'account_takeover_suspected',
  DATA_EXFILTRATION_SUSPECTED: 'data_exfiltration_suspected',
  API_ENUMERATION_DETECTED: 'api_enumeration_detected',
});

const SECURITY_METRIC_WINDOWS = Object.freeze({
  oneHour: 60 * 60 * 1000,
  tenantAbuse: 10 * 60 * 1000,
  failedApi: 2 * 60 * 1000,
  rapidIp: 60 * 1000,
  downloads: 5 * 60 * 1000,
  bulkDownload: 10 * 60 * 1000,
  apiEnumeration: 2 * 60 * 1000,
  refreshTokenWindow: 10 * 60 * 1000,
  accountTakeover: 10 * 60 * 1000,
  ipBlock: 15 * 60 * 1000,
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

function pruneBlockedIps(now = Date.now()) {
  for (const [key, state] of blockedIps.entries()) {
    if (!state || state.expiresAt <= now) {
      blockedIps.delete(key);
    }
  }

  enforceMapLimit(blockedIps, (value) => value?.expiresAt || value?.lastUpdatedAt || 0);
}

function pruneTelemetryState(now = Date.now(), { force = false } = {}) {
  if (!force && (now - lastPruneAt) < PRUNE_INTERVAL_MS) {
    return;
  }

  pruneCounters(now);
  pruneWindowEntries(now);
  pruneCooldowns(now);
  pruneLogWindows(now);
  pruneBlockedIps(now);
  lastPruneAt = now;
}

function maybePruneTelemetryState(now = Date.now()) {
  const overCapacity = (
    counters.size > MAX_TELEMETRY_KEYS ||
    eventWindows.size > MAX_TELEMETRY_KEYS ||
    alertCooldowns.size > MAX_TELEMETRY_KEYS ||
    logWindows.size > MAX_TELEMETRY_KEYS ||
    blockedIps.size > MAX_TELEMETRY_KEYS
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

function buildAlertCooldownKey(alertType, userId, ipAddress, cooldownKey = null) {
  if (cooldownKey) {
    return [alertType || 'security_alert', cooldownKey].join(':');
  }

  return [alertType || 'security_alert', userId ? String(userId) : 'anonymous', ipAddress || 'unknown'].join(':');
}

function shouldEmitAlert({ alertType, userId, ipAddress, cooldownKey = null, now = Date.now() }) {
  const key = buildAlertCooldownKey(alertType, userId, ipAddress, cooldownKey);
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

function getLatestWindowValue(key, windowMs) {
  const now = Date.now();
  const state = eventWindows.get(key);
  const trimmed = (state?.entries || []).filter((entry) => now - entry.timestamp <= windowMs);
  if (trimmed.length === 0) {
    eventWindows.delete(key);
    maybePruneTelemetryState(now);
    return null;
  }

  eventWindows.set(key, {
    entries: trimmed.slice(-MAX_WINDOW_EVENTS),
    windowMs,
    lastUpdatedAt: now,
  });
  maybePruneTelemetryState(now);
  return trimmed[trimmed.length - 1];
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

function getAlertSeverity(alertType, metadata = {}) {
  if (metadata?.severity) {
    return metadata.severity;
  }

  switch (alertType) {
    case ALERT_TYPES.ACCOUNT_TAKEOVER_SUSPECTED:
    case ALERT_TYPES.DATA_EXFILTRATION_SUSPECTED:
      return 'critical';
    case ALERT_TYPES.IMPOSSIBLE_TRAVEL_DETECTED:
    case ALERT_TYPES.REFRESH_TOKEN_ABUSE:
    case ALERT_TYPES.TENANT_ABUSE_DETECTED:
    case ALERT_TYPES.API_ENUMERATION_DETECTED:
      return 'high';
    case ALERT_TYPES.SUSPICIOUS_LOGIN_PATTERN:
    case ALERT_TYPES.API_ABUSE_DETECTED:
      return 'medium';
    default:
      return 'low';
  }
}

// Normalize IPv4-mapped IPv6 addresses so both temporary block enforcement and
// block-status checks treat ::ffff:203.0.113.10 and 203.0.113.10 as the same source.
function normalizeIpAddress(ipAddress) {
  return String(ipAddress || 'unknown').replace(/^::ffff:/, '');
}

function hasSignificantIpRangeMismatch(previousIpRange, currentIpRange) {
  return Boolean(
    previousIpRange &&
    currentIpRange &&
    previousIpRange !== 'unknown' &&
    currentIpRange !== 'unknown' &&
    previousIpRange !== currentIpRange
  );
}

function blockIpAddress(ipAddress, now = Date.now()) {
  const normalizedIp = normalizeIpAddress(ipAddress);
  if (!normalizedIp || normalizedIp === 'unknown') {
    return null;
  }

  const state = {
    blockedAt: now,
    expiresAt: now + SECURITY_METRIC_WINDOWS.ipBlock,
    lastUpdatedAt: now,
  };
  blockedIps.set(normalizedIp, state);
  maybePruneTelemetryState(now);
  return state;
}

function getIpBlockStatus(ipAddress, now = Date.now()) {
  const normalizedIp = normalizeIpAddress(ipAddress);
  const state = blockedIps.get(normalizedIp);
  if (!state || state.expiresAt <= now) {
    if (state) {
      blockedIps.delete(normalizedIp);
    }
    maybePruneTelemetryState(now);
    return {
      blocked: false,
      retryAfter: 0,
      expiresAt: null,
    };
  }

  state.lastUpdatedAt = now;
  blockedIps.set(normalizedIp, state);
  maybePruneTelemetryState(now);
  return {
    blocked: true,
    retryAfter: Math.max(1, Math.ceil((state.expiresAt - now) / 1000)),
    expiresAt: state.expiresAt,
  };
}

async function noteTenantFailure({
  req,
  tenantId = null,
  failureType,
  threshold,
  resource = 'security',
} = {}) {
  try {
    if (!tenantId || !failureType || !Number.isFinite(threshold)) {
      return;
    }

    const normalizedTenantId = String(tenantId);
    const counter = incrementCounter(`tenant:${failureType}:${normalizedTenantId}`, {
      windowMs: SECURITY_METRIC_WINDOWS.tenantAbuse,
      limit: threshold + 1,
    });

    if (counter.thresholdReached) {
      await emitSecurityAlert({
        req,
        firmId: normalizedTenantId,
        resource,
        alertType: ALERT_TYPES.TENANT_ABUSE_DETECTED,
        cooldownKey: `tenant:${normalizedTenantId}:${failureType}`,
        metadata: {
          tenantId: normalizedTenantId,
          failureType,
          count: counter.count,
          timeWindow: '10m',
        },
        description: 'Tenant abuse detected from repeated failures',
      });
    }
  } catch (error) {
    log.error('SECURITY_TELEMETRY_TENANT_ABUSE', {
      req,
      error: error.message,
      tenantId,
      failureType,
    });
  }
}

async function emitSecurityAlert({
  req,
  userId = null,
  firmId = null,
  resource = 'security',
  metadata = {},
  description,
  alertType = 'security_alert',
  cooldownKey = null,
} = {}) {
  try {
    const now = Date.now();
    const resolvedIp = metadata.ipAddress || getRequestIp(req);
    if (!shouldEmitAlert({ alertType, userId, ipAddress: resolvedIp, cooldownKey, now })) {
      // Duplicate alerts inside the cooldown window are intentionally dropped.
      return null;
    }

    const severity = getAlertSeverity(alertType, metadata);
    const enrichedMetadata = {
      ...metadata,
      event: alertType,
      severity,
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
    if (severity === 'critical') {
      pushWindowValue('metric:critical_alerts', alertType, SECURITY_METRIC_WINDOWS.oneHour);
    }
    if (alertType === ALERT_TYPES.TENANT_ABUSE_DETECTED) {
      pushWindowValue('metric:tenant_abuse_events', enrichedMetadata.tenantId || firmId || 'unknown', SECURITY_METRIC_WINDOWS.oneHour);
    }

    if (HIGH_SEVERITY_LEVELS.has(severity) && resolvedIp && resolvedIp !== 'unknown') {
      const highSeverityAlertCount = incrementCounter(`ip:block:${normalizeIpAddress(resolvedIp)}`, {
        windowMs: SECURITY_METRIC_WINDOWS.ipBlock,
        limit: HIGH_SEVERITY_ALERT_LIMIT,
      });

      if (highSeverityAlertCount.thresholdReached) {
        blockIpAddress(resolvedIp, now);
      }
    }

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

    await noteTenantFailure({
      req,
      tenantId: firmId || req?.firmId || req?.user?.firmId || null,
      failureType: 'login_failures',
      threshold: 50,
      resource: 'auth/login',
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

      pushWindowValue(`login-ip-range:${String(userId || xID || 'unknown')}`, {
        ipRange: currentIpRange,
        userId: userId ? String(userId) : null,
      }, SECURITY_METRIC_WINDOWS.accountTakeover);
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

    if (
      isRapidGeoChangeDetected(recentLogin, lastLoginCountry, currentCountry) &&
      hasSignificantIpRangeMismatch(previousIpRange, currentIpRange)
    ) {
      await emitSecurityAlert({
        req,
        userId,
        firmId,
        resource,
        alertType: ALERT_TYPES.IMPOSSIBLE_TRAVEL_DETECTED,
        metadata: {
          reason: 'impossible_travel',
          xID: String(xID).toUpperCase(),
          ipAddress: ip,
          previousCountry: lastLoginCountry,
          currentCountry,
          previousIpRange,
          currentIpRange,
          lastLoginAt,
          mfaRequired,
        },
        description: 'Impossible travel detected across distant login locations',
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

    await noteTenantFailure({
      req,
      tenantId: firmId || req?.firmId || req?.user?.firmId || null,
      failureType: 'refresh_failures',
      threshold: 30,
      resource: 'auth/refresh',
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
    const currentIpRange = getIpRange(currentIp);
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

    const recentLogin = getLatestWindowValue(`login-ip-range:${String(userId)}`, SECURITY_METRIC_WINDOWS.accountTakeover);
    const loginIpRange = recentLogin?.value?.ipRange || null;
    if (hasSignificantIpRangeMismatch(loginIpRange, currentIpRange)) {
      await emitSecurityAlert({
        req,
        userId,
        firmId,
        resource: 'auth/refresh',
        alertType: ALERT_TYPES.ACCOUNT_TAKEOVER_SUSPECTED,
        cooldownKey: `account-takeover:${String(userId)}`,
        metadata: {
          reason: 'login_refresh_ip_mismatch',
          loginIpRange,
          refreshIpRange: currentIpRange,
          userId: String(userId),
          ipAddress: currentIp,
        },
        description: 'Potential account takeover detected from post-login refresh activity',
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
    const exfiltrationThreshold = incrementCounter(`download:bulk:${String(firmId || 'unknown')}:${String(actor)}`, {
      windowMs: SECURITY_METRIC_WINDOWS.bulkDownload,
      limit: DATA_EXFILTRATION_THRESHOLD,
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

    if (exfiltrationThreshold.thresholdReached) {
      await emitSecurityAlert({
        req,
        userId,
        firmId,
        resource: 'files/download',
        alertType: ALERT_TYPES.DATA_EXFILTRATION_SUSPECTED,
        cooldownKey: `data-exfiltration:${String(firmId || 'unknown')}:${String(actor)}`,
        metadata: {
          userId: userId ? String(userId) : String(actor),
          firmId: firmId ? String(firmId) : null,
          downloadCount: exfiltrationThreshold.count,
          ipAddress: ip,
        },
        description: 'Bulk file download activity suggests potential data exfiltration',
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
    const routeEntries = pushWindowValue(`api:routes:${ip}`, path, SECURITY_METRIC_WINDOWS.apiEnumeration);
    const uniqueRoutes = [...new Set(routeEntries.map((entry) => entry.value).filter(Boolean))];

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

    if (uniqueRoutes.length >= API_ENUMERATION_THRESHOLD) {
      await emitSecurityAlert({
        req,
        userId: req?.user?._id || null,
        firmId: req?.firmId || req?.user?.firmId || null,
        resource: path,
        alertType: ALERT_TYPES.API_ENUMERATION_DETECTED,
        metadata: {
          reason: 'unique_route_scan',
          ipAddress: ip,
          uniqueRoutes,
          count: uniqueRoutes.length,
        },
        description: 'Suspicious API endpoint enumeration detected',
      });
    }

    if (statusCode >= 400 && ![404, 405].includes(statusCode)) {
      const failureCount = incrementCounter(`api:failures:${ip}`, {
        windowMs: SECURITY_METRIC_WINDOWS.failedApi,
        limit: 20,
      });

      await noteTenantFailure({
        req,
        tenantId: req?.firmId || req?.user?.firmId || null,
        failureType: 'api_failures',
        threshold: 200,
        resource: path,
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
  try {
    pruneBlockedIps(Date.now());
    return {
      login_failures_last_hour: countRecent('metric:login_failures', SECURITY_METRIC_WINDOWS.oneHour),
      refresh_token_failures: countRecent('metric:refresh_failures', SECURITY_METRIC_WINDOWS.oneHour),
      security_alerts_last_hour: countRecent('metric:security_alerts', SECURITY_METRIC_WINDOWS.oneHour),
      critical_alerts_last_hour: countRecent('metric:critical_alerts', SECURITY_METRIC_WINDOWS.oneHour),
      blocked_ips: blockedIps.size,
      tenant_abuse_events: countRecent('metric:tenant_abuse_events', SECURITY_METRIC_WINDOWS.oneHour),
    };
  } catch (error) {
    log.error('SECURITY_TELEMETRY_METRICS_SNAPSHOT', { error: error.message });
    return {
      login_failures_last_hour: 0,
      refresh_token_failures: 0,
      security_alerts_last_hour: 0,
      critical_alerts_last_hour: 0,
      blocked_ips: 0,
      tenant_abuse_events: 0,
    };
  }
}

function _resetForTests() {
  counters.clear();
  eventWindows.clear();
  alertCooldowns.clear();
  logWindows.clear();
  blockedIps.clear();
  lastPruneAt = 0;
}

function _getInternalStateForTests() {
  return {
    countersSize: counters.size,
    eventWindowsSize: eventWindows.size,
    alertCooldownsSize: alertCooldowns.size,
    logWindowsSize: logWindows.size,
    blockedIpsSize: blockedIps.size,
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
  getAlertSeverity,
  getIpBlockStatus,
  MAX_TELEMETRY_KEYS,
  MAX_WINDOW_EVENTS,
  ALERT_COOLDOWN,
  _resetForTests,
  _getInternalStateForTests,
};
