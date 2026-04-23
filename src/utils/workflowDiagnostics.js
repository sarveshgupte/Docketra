const log = require('./log');
const { normalizeOperationalError } = require('../constants/operationalErrorCodes');

const warnedKeys = new Map();
const WARN_TTL_MS = 30_000;

const now = () => Date.now();

const shouldWarn = (key) => {
  if (!key) return true;
  const ts = warnedKeys.get(key);
  if (!ts || now() - ts > WARN_TTL_MS) {
    warnedKeys.set(key, now());
    return true;
  }
  return false;
};

const buildWorkflowMeta = ({ req, workflow, route, entity = {}, outcome = 'success', durationMs = null, provider = null, providerMode = null, error = null }) => ({
  req,
  workflow,
  route: route || req?.originalUrl || req?.url || null,
  firmId: req?.user?.firmId || req?.firmId || req?.context?.firmId || null,
  actorXID: req?.user?.xID || null,
  correlationId: req?.correlationId || req?.headers?.['x-correlation-id'] || null,
  outcome,
  durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
  provider,
  providerMode,
  ...entity,
  ...(error ? { error: normalizeOperationalError(error), errorCode: normalizeOperationalError(error).code } : {}),
});

const logWorkflowEvent = (event, meta) => {
  const level = meta?.outcome === 'failed' ? 'error' : (meta?.durationMs >= 900 ? 'warn' : 'info');
  const warningKey = level === 'warn' ? `${event}:${meta?.workflow}:${meta?.route}:${meta?.errorCode || 'slow'}` : null;
  if (level === 'warn' && !shouldWarn(warningKey)) return;
  log[level](event, meta);
};

module.exports = {
  buildWorkflowMeta,
  logWorkflowEvent,
};
