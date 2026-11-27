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

  const cfRay = normalizeHeaderRequestId(req.headers?.['cf-ray']);
  if (cfRay) {
    req.cfRay = cfRay;
    res.setHeader('CF-Ray', cfRay);
  }

  next();
};

module.exports = requestId;
