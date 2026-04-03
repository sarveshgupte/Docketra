const { randomUUID } = require('crypto');
const log = require('../utils/log');
const metricsService = require('../services/metrics.service');
const { attachRecorder, flushRequestEffects } = require('../services/sideEffectQueue.service');
const { noteApiActivity } = require('../services/securityTelemetry.service');

const LOGIN_PATHS = new Set(['/superadmin/login']);
const TENANT_LOGIN_PATH = /^\/[^/]+\/login$/;
const normalizeLifecycleRoute = (req) => {
  if (typeof req.route?.path === 'string') {
    const baseUrl = req.baseUrl || '';
    return `${baseUrl}${req.route.path}` || req.originalUrl || req.url || 'unknown';
  }
  // Global middleware can finalize before Express exposes a concrete route pattern.
  // In that case we fall back to the raw request URL instead of dropping the label.
  return req.originalUrl || req.url || 'unknown';
};

const requestLifecycle = (req, res, next) => {
  const startTime = Date.now();
  const rawPath = (req.originalUrl || req.url || '').split('?')[0];
  const isLoginPath = LOGIN_PATHS.has(rawPath) || TENANT_LOGIN_PATH.test(rawPath);
  const skipSideEffects = req.method === 'OPTIONS' || isLoginPath;
  if (!req.requestId) {
    req.requestId = randomUUID();
  }
  res.setHeader('X-Request-ID', req.requestId);
  if (!skipSideEffects) {
    attachRecorder(req);
  }

  const emitLifecycleLog = (reason) => {
    if (res._lifecycleLogged) return;
    res._lifecycleLogged = true;
    const durationMs = Date.now() - startTime;
    const responseStatusCode = Number.isInteger(res.statusCode) ? res.statusCode : 200;
    metricsService.recordHttpRequest({
      method: req.method,
      route: normalizeLifecycleRoute(req),
      status: responseStatusCode,
      durationMs,
    });
    log.info('REQUEST_LIFECYCLE', {
      req,
      method: req.method,
      route: req.originalUrl || req.url || null,
      actor: req.user?.xID || req.user?.id || null,
      role: req.user?.role || null,
      firmId: req.firmId || req.firm?.id || req.user?.firmId || null,
      startTime: new Date(startTime).toISOString(),
      durationMs,
      statusCode: responseStatusCode,
      lifecycleEnd: reason,
      transactionCommitted: !!req.transactionCommitted,
      transactionState: req.transactionState || (req.transactionCommitted ? 'committed' : 'not_started'),
    });
    Promise.resolve(noteApiActivity({ req, statusCode: responseStatusCode })).catch(() => null);
    if (!skipSideEffects) {
      setImmediate(() => flushRequestEffects(req));
    }
  };

  const finalize = (reason) => {
    if (res._lifecycleFinalizeScheduled || res._lifecycleLogged) return;
    res._lifecycleFinalizeScheduled = true;
    Promise.resolve(req.transactionFinalized)
      .catch(() => null)
      .finally(() => {
        emitLifecycleLog(reason);
      });
  };

  res.once('finish', () => finalize('finish'));
  res.once('close', () => finalize('close'));

  next();
};

module.exports = requestLifecycle;
