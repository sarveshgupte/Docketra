const { randomUUID } = require('crypto');

/**
 * OBSERVABILITY: Structured logging & request tracing
 */
const buildContext = (level, event, meta = {}) => {
  const { req = null, severity, ...rest } = meta || {};
  const resolvedRequestId = meta.requestId || req?.requestId || req?.id || randomUUID();
  if (req && !req.requestId) {
    req.requestId = resolvedRequestId;
  }

  return {
    timestamp: new Date().toISOString(),
    severity: (severity || level).toUpperCase(),
    event,
    requestId: resolvedRequestId,
    firmId: meta.firmId || req?.context?.firmId || req?.firmId || req?.firm?.id || req?.user?.firmId || null,
    userId: meta.userId || req?.context?.userId || req?.user?._id || req?.user?.id || null,
    userXID: meta.userXID || req?.context?.userXID || req?.user?.xID || null,
    route: meta.route || req?.context?.route || req?.originalUrl || req?.url || null,
    ...rest,
  };
};

const logAtLevel = (level, event, meta = {}) => {
  const context = buildContext(level, event, meta);
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (process.env.NODE_ENV === 'production') {
    logger(JSON.stringify(context));
    return;
  }

  logger(`[${context.severity}][${context.requestId}] ${event}`, context);
};

module.exports = {
  info: (event, meta) => logAtLevel('info', event, meta),
  warn: (event, meta) => logAtLevel('warn', event, meta),
  error: (event, meta) => logAtLevel('error', event, meta),
};
