const { randomUUID } = require('crypto');
const log = require('../utils/log');
const metricsService = require('../services/metrics.service');
const { enqueueAfterCommit, attachRecorder, flushRequestEffects } = require('../services/sideEffectQueue.service');
const { noteApiActivity } = require('../services/securityTelemetry.service');

const LOGIN_PATHS = new Set(['/superadmin/login']);
const TENANT_LOGIN_PATH = /^\/[^/]+\/login$/;

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

  const finalize = (reason) => {
    if (res._lifecycleLogged) return;
    res._lifecycleLogged = true;
    const durationMs = Date.now() - startTime;
    if (!skipSideEffects) {
      enqueueAfterCommit(req, {
        type: 'METRICS_LATENCY',
        payload: { route: req.originalUrl || req.url, durationMs },
        execute: async () => metricsService.recordLatency(durationMs),
      });
    }
    log.info('REQUEST_LIFECYCLE', {
      req,
      method: req.method,
      route: req.originalUrl || req.url || null,
      actor: req.user?.xID || req.user?.id || null,
      role: req.user?.role || null,
      firmId: req.firmId || req.firm?.id || req.user?.firmId || null,
      startTime: new Date(startTime).toISOString(),
      durationMs,
      status: res.statusCode,
      lifecycleEnd: reason,
      transactionCommitted: !!req.transactionCommitted,
    });
    Promise.resolve(noteApiActivity({ req, statusCode: res.statusCode })).catch(() => null);
    if (!skipSideEffects) {
      setImmediate(() => flushRequestEffects(req));
    }
  };

  res.once('finish', () => finalize('finish'));
  res.once('close', () => finalize('close'));

  next();
};

module.exports = requestLifecycle;
