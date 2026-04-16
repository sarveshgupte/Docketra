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

const normalizeEventName = (event, level = 'info') => {
  const raw = typeof event === 'string' ? event : String(event || '');
  const normalized = raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  if (!normalized) {
    return `SYSTEM_LOG_${String(level || 'info').toUpperCase()}`;
  }

  const tokenCount = normalized.split('_').filter(Boolean).length;
  if (tokenCount >= 3) {
    return normalized;
  }

  return `SYSTEM_${normalized}_${String(level || 'info').toUpperCase()}`;
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
    event: normalizeEventName(event, level),
    requestId: resolvedRequestId,
    method,
    url,
    statusCode,
    message,
    req: req
      ? {
        id: req.requestId || req.id || null,
        method: req.method || null,
        url: req.originalUrl || req.url || null,
      }
      : null,
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
  process.stderr.write(`${JSON.stringify({
    severity: String(level || 'error').toUpperCase(),
    event,
    message: 'Logging failure recovered by fallback logger',
    error: error?.message || String(error),
    timestamp: new Date().toISOString(),
  })}\n`);
};

const toMetaObject = (value) => {
  if (value instanceof Error) {
    return { error: value, message: value.message };
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return { message: value };
  }
  if (value === undefined || value === null) {
    return {};
  }
  return { value };
};

const parseLogArgs = (level, args = []) => {
  if (!Array.isArray(args) || args.length === 0) {
    return {
      event: `SYSTEM_LOG_${String(level || 'info').toUpperCase()}`,
      meta: {},
    };
  }

  const [first, second, ...rest] = args;

  if (typeof first === 'string') {
    const event = first;
    const secondMeta = toMetaObject(second);
    if (rest.length === 0) {
      return { event, meta: secondMeta };
    }
    return {
      event,
      meta: {
        ...secondMeta,
        extra: [second, ...rest].map((arg) => (arg instanceof Error ? { name: arg.name, message: arg.message, stack: arg.stack } : arg)),
      },
    };
  }

  const firstMeta = toMetaObject(first);
  return {
    event: firstMeta.event || `SYSTEM_LOG_${String(level || 'info').toUpperCase()}`,
    meta: {
      ...firstMeta,
      ...(second !== undefined ? { extra: [second, ...rest] } : {}),
    },
  };
};

const logAtLevel = (level, ...args) => {
  try {
    const { event, meta } = parseLogArgs(level, args);
    const normalizedEvent = normalizeEventName(event, level);
    const context = maskSensitiveObject(buildContext(level, normalizedEvent, meta));
    baseLogger[level](context, normalizedEvent);
  } catch (error) {
    fallbackLogger(level, args?.[0], error);
  }
};

module.exports = {
  safeStringify,
  info: (...args) => logAtLevel('info', ...args),
  warn: (...args) => logAtLevel('warn', ...args),
  error: (...args) => logAtLevel('error', ...args),
};
