const { URL } = require('url');
const log = require('../utils/log');

const getSourceUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return new URL(value);
  } catch (_error) {
    return null;
  }
};

const getAllowedOrigins = () => (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const getRequestHosts = (req) => {
  const forwardedHostHeader = String(req.headers['x-forwarded-host'] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const directHost = req.headers.host ? [String(req.headers.host).trim()] : [];
  return new Set([...forwardedHostHeader, ...directHost]);
};

const enforceSameOriginForCookieAuth = (req, res, next) => {
  const originUrl = getSourceUrl(req.headers.origin);
  const refererUrl = getSourceUrl(req.headers.referer);
  const requestHosts = getRequestHosts(req);
  const allowedOriginHosts = new Set(
    getAllowedOrigins()
      .map((origin) => getSourceUrl(origin))
      .filter(Boolean)
      .map((origin) => origin.host)
  );

  if (!originUrl && !refererUrl) {
    return next();
  }
  if (requestHosts.size === 0) {
    log.warn('[CSRF] Same-origin check rejected: missing request host headers.');
    return res.status(403).json({
      success: false,
      message: 'Invalid request origin',
    });
  }

  const candidateHost = originUrl?.host || refererUrl?.host || null;
  if (candidateHost && (requestHosts.has(candidateHost) || allowedOriginHosts.has(candidateHost))) {
    return next();
  }

  log.warn('[CSRF] Same-origin check rejected request.', {
    originHost: originUrl?.host || null,
    refererHost: refererUrl?.host || null,
    requestHosts: Array.from(requestHosts),
    allowedOriginHosts: Array.from(allowedOriginHosts),
    path: req.originalUrl || req.url,
    method: req.method,
  });

  return res.status(403).json({
    success: false,
    message: 'Invalid request origin',
  });
};

module.exports = {
  enforceSameOriginForCookieAuth,
};
