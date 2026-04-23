const { randomUUID } = require('crypto');

const normalizeHeaderRequestId = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return normalized.slice(0, 128);
};

const requestId = (req, res, next) => {
  if (!req.requestId) {
    req.requestId = normalizeHeaderRequestId(req.headers?.['x-request-id']) || randomUUID();
  }
  req.correlationId = normalizeHeaderRequestId(req.headers?.['x-correlation-id']) || req.requestId;
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
};

module.exports = requestId;
