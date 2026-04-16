const { randomUUID } = require('crypto');
const pino = require('pino');
const { maskSensitiveObject } = require('./pii');

const OMITTED_KEYS = new Set(['req', 'res', 'socket']);

const safeStringify = (value) => {
  const seen = new WeakSet();

  return JSON.stringify(value, (key, currentValue) => {
    if (typeof currentValue === 'object' && currentValue !== null) {
      if (seen.has(currentValue)) {
        return '[Circular]';
      }
      seen.add(currentValue);
    }
    return currentValue;
  });
};

/**
 * Keep only safe request metadata from potentially unsafe payloads.
 */
const pickSafeRequestMeta = ({ meta = {}, req = null, res = null } = {}) => {
  const safeMeta = {};

  for (const [key, value] of Object.entries(meta || {})) {
    if (OMITTED_KEYS.has(key)) continue;
    safeMeta[key] = value;
  }

  const message =
    typeof safeMeta.message === 'string'
      ? safeMeta.message
      : typeof safeMeta.error?.message === 'string'
        ? safeMeta.error.message
        : null;

  return {
    method: req?.method || safeMeta.method || null,
    url: req?.originalUrl || req?.url || safeMeta.url || null,
    statusCode: Number.isFinite(res?.statusCode) ? res.statusCode : Number.isFinite(safeMeta.statusCode) ? safeMeta.statusCode : null,
    message,
    safeMeta,
  };
};

/**
 * OBSERVABILITY: Structured logging & request tracing
 */
const buildContext = (level, event, meta = {}) => {
  const req = meta?.req || null;
  const res = meta?.res || null;
  const resolvedRequestId = meta.requestId || req?.requestId || req?.id || randomUUID();

  if (req && !req.requestId) {
    req.requestId = resolvedRequestId;
  }

  const { safeMeta, method, url, statusCode, message } = pickSafeRequestMeta({ meta, req, res });
  const severity = safeMeta.severity || level;
  const tenantId = safeMeta.tenantId || safeMeta.firmId || req?.context?.tenantId || req?.context?.firmId || req?.firmId || req?.firm?.id || req?.user?.firmId || null;
  const userId = safeMeta.userId || req?.context?.userId || req?.user?._id || req?.user?.id || null;
  const errorPayload = safeMeta.error instanceof Error
    ? {
      name: safeMeta.error.name,
      message: safeMeta.error.message,
      stack: safeMeta.error.stack,
    }
    : safeMeta.error;
  const { error: _ignoredError, ...safeMetaWithoutError } = safeMeta;

  return {
    severity: String(severity).toUpperCase(),
    event,
    requestId: resolvedRequestId,
    method,
    url,
    statusCode,
    message,
    tenantId,
    firmId: tenantId,
    userId,
    userXID: safeMeta.userXID || req?.context?.userXID || req?.user?.xID || null,
    route: safeMeta.route || req?.context?.route || req?.originalUrl || req?.url || null,
    error: errorPayload,
    ...safeMetaWithoutError,
  };
};

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: null,
  messageKey: 'message',
});

const fallbackLogger = (level, event, error) => {
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logger(`[${String(level || 'error').toUpperCase()}] ${event}`, {
    event,
    message: 'Logging failure recovered by fallback logger',
    error: error?.message || String(error),
    timestamp: new Date().toISOString(),
  });
};

const logAtLevel = (level, event, meta = {}) => {
  try {
    const context = maskSensitiveObject(buildContext(level, event, meta));
    baseLogger[level](context, event);
  } catch (error) {
    fallbackLogger(level, event, error);
  }
};

module.exports = {
  safeStringify,
  info: (event, meta) => logAtLevel('info', event, meta),
  warn: (event, meta) => logAtLevel('warn', event, meta),
  error: (event, meta) => logAtLevel('error', event, meta),
};
