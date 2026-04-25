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
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  if (configuredToken && typeof bearerToken === 'string') {
    if (configuredToken.length === bearerToken.length) {
      let mismatch = 0;
      for (let i = 0; i < configuredToken.length; i++) {
        mismatch |= configuredToken.charCodeAt(i) ^ bearerToken.charCodeAt(i);
      }
      if (mismatch === 0) {
        req.isInternalMetricsRequest = true;
        return next();
      }
    }
  }

  if (isProduction) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Internal metrics token required' });
  }

  return authenticate(req, res, () => requireSuperadmin(req, res, next));
};

module.exports = {
  allowInternalTokenOrSuperadmin,
};
