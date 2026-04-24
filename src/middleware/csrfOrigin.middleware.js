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

const getRequestPath = (req) => String(req.originalUrl || req.url || req.path || '').split('?')[0];

const CSRF_SKIP_PATHS = [
  /^\/health(?:\/|$)/,
  /^\/api\/health(?:\/|$)/,
  /^\/api\/system\/health(?:\/|$)/,
  /^\/metrics(?:\/|$)/,
  /^\/api\/metrics\/security(?:\/|$)/,
  /^\/api\/csp-violation(?:\/|$)/,
];

const hasAuthCookie = (req) => {
  if (req?.cookies?.accessToken || req?.cookies?.refreshToken) return true;
  const cookieHeader = String(req?.headers?.cookie || '');
  if (!cookieHeader) return false;
  return /(?:^|;\s*)(?:accessToken|refreshToken)=/.test(cookieHeader);
};

const hasHeaderTokenAuth = (req) => Boolean(
  req?.headers?.authorization
  || req?.headers?.['x-internal-token']
  || req?.headers?.['x-metrics-token']
);

const shouldSkipCsrfForPath = (req) => {
  const path = getRequestPath(req);
  return CSRF_SKIP_PATHS.some((matcher) => matcher.test(path));
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

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const enforceSameOriginForMutatingRequests = (req, res, next) => {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') return next();
  if (!MUTATING_METHODS.has(method)) {
    return next();
  }

  if (shouldSkipCsrfForPath(req)) {
    return next();
  }

  // Only enforce same-origin when the request is carrying cookie auth material.
  // This avoids blocking non-browser or token-authenticated integrations that do
  // not rely on ambient browser cookies for authentication.
  if (!hasAuthCookie(req) && hasHeaderTokenAuth(req)) {
    return next();
  }
  if (!hasAuthCookie(req)) return next();

  return enforceSameOriginForCookieAuth(req, res, next);
};

module.exports = {
  enforceSameOriginForCookieAuth,
  enforceSameOriginForMutatingRequests,
  __private: {
    shouldSkipCsrfForPath,
    hasAuthCookie,
    hasHeaderTokenAuth,
  },
};
