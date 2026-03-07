'use strict';

const { authenticate } = require('./auth.middleware');
const { requireSuperadmin } = require('./permission.middleware');

const resolveBearerToken = (headerValue) => {
  if (typeof headerValue !== 'string') return null;
  const trimmed = headerValue.trim();
  if (!/^bearer\s+/i.test(trimmed)) return null;
  return trimmed.replace(/^bearer\s+/i, '').trim() || null;
};

const allowInternalTokenOrSuperadmin = (req, res, next) => {
  const configuredToken = process.env.METRICS_TOKEN?.trim();
  const bearerToken = resolveBearerToken(req.headers.authorization);

  if (configuredToken && bearerToken && bearerToken === configuredToken) {
    req.isInternalMetricsRequest = true;
    return next();
  }

  return authenticate(req, res, () => requireSuperadmin(req, res, next));
};

module.exports = {
  allowInternalTokenOrSuperadmin,
};
