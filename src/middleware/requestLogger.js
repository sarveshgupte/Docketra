/**
 * Request Logger Middleware
 * Logs all incoming requests for audit trail
 */

const { randomUUID } = require('crypto');
const log = require('../utils/log');
const { recordRequest } = require('../utils/operationalMetrics');
const metricsService = require('../services/metrics.service');
const { enqueueAfterCommit } = require('../services/sideEffectQueue.service');

const requestLogger = (req, res, next) => {
  if (!req.requestId) {
    req.requestId = randomUUID();
  }
  res.setHeader('X-Request-ID', req.requestId);
  const { method, originalUrl, ip } = req;
  enqueueAfterCommit(req, {
    type: 'METRIC_REQUEST',
    payload: { route: originalUrl || req.url },
    execute: async () => {
      recordRequest(req);
      metricsService.recordRequest(originalUrl || req.url);
    },
  });
  log.info('REQUEST_INCOMING', { req, method, route: originalUrl || req.url, ip });
  
  next();
};

module.exports = requestLogger;
