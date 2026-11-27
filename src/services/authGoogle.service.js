const crypto = require('crypto');
const { google } = require('googleapis');

const getGoogleAuthRedirectUri = (env = {}) => (
  env.GOOGLE_AUTH_REDIRECT_URI
  || env.GOOGLE_CALLBACK_URL
  || env.GOOGLE_OAUTH_REDIRECT_URI
  || process.env.GOOGLE_AUTH_REDIRECT_URI
  || process.env.GOOGLE_CALLBACK_URL
  || process.env.GOOGLE_OAUTH_REDIRECT_URI
  || null
);

const getGoogleOAuthClient = (env = {}) => {
  const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CONFIG_MISSING');
  }

  const googleAuthRedirectUri = getGoogleAuthRedirectUri(env);
  if (!googleAuthRedirectUri) {
    throw new Error('GOOGLE_AUTH_REDIRECT_URI_MISSING');
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    googleAuthRedirectUri
  );
};

const signGoogleState = (payload) => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'docketra-google-auth')
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
};

const parseGoogleState = (rawState) => {
  if (!rawState || typeof rawState !== 'string' || !rawState.includes('.')) {
    return null;
  }

  const [encodedPayload, providedSig] = rawState.split('.');
  if (!encodedPayload || !providedSig) {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'docketra-google-auth')
    .update(encodedPayload)
    .digest('base64url');

  const expectedBuffer = Buffer.from(expectedSig);
  const providedBuffer = Buffer.from(providedSig);

  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch (_error) {
    return null;
  }
};

/**
 * Decode unverified state strictly to inspect allowlisted routing hints
 * (e.g. forwarding a CUG callback from the shared callback host before the
 * target backend performs full HMAC verification with its own JWT_SECRET).
 */
const peekGoogleStateRouting = (rawState) => {
  if (!rawState || typeof rawState !== 'string' || !rawState.includes('.')) {
    return { returnOrigin: null, targetBackendUrl: null };
  }
  const [encodedPayload] = rawState.split('.');
  if (!encodedPayload) {
    return { returnOrigin: null, targetBackendUrl: null };
  }
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return {
      returnOrigin: resolveAllowedFrontendOrigin(parsed?.returnOrigin),
      targetBackendUrl: resolveAllowedBackendOrigin(parsed?.targetBackendUrl),
    };
  } catch (_error) {
    return { returnOrigin: null, targetBackendUrl: null };
  }
};

const KNOWN_FRONTEND_HOSTS = [
  'docketshq.com',
  'www.docketshq.com',
  'app.docketshq.com',
  'cug.docketshq.com',
  'docketshq-cug.web.app',
  'docketshq-cug.firebaseapp.com',
  'docketshq-prod.web.app',
  'docketshq-prod.firebaseapp.com',
  'docketra-cug.web.app',
  'docketra-cug.firebaseapp.com',
  'cug.docketra.in',
  'docketra.in',
  'www.docketra.in',
  'app.docketra.in',
  'docketra-prod.web.app',
  'docketra-prod.firebaseapp.com',
];

const KNOWN_BACKEND_HOSTS = [
  'api.docketshq.com',
  'cug-api.docketshq.com',
  'docketra-api-cug-1078507569854.us-central1.run.app',
  'docketra-api-1078507569854.us-central1.run.app',
  'api.docketra.in',
  'cug-api.docketra.in',
];

const isLocalhost = (hostname) => (
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '[::1]'
);

const getConfiguredOrigins = () => {
  const raw = [
    process.env.FRONTEND_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.API_PUBLIC_ORIGIN,
    process.env.RENDER_EXTERNAL_URL,
  ].filter(Boolean).join(',');

  return raw.split(',').map((s) => s.trim()).filter(Boolean);
};

const resolveAllowedOrigin = (candidate, knownHosts) => {
  if (!candidate || typeof candidate !== 'string') return null;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const hostname = parsed.hostname.toLowerCase();

    for (const conf of getConfiguredOrigins()) {
      try {
        if (new URL(conf).origin.toLowerCase() === parsed.origin.toLowerCase()) {
          return parsed.origin;
        }
      } catch (_) {}
    }

    if (parsed.protocol === 'https:' && knownHosts.includes(hostname)) {
      return parsed.origin;
    }

    if (process.env.NODE_ENV !== 'production' && isLocalhost(hostname)) {
      return parsed.origin;
    }

    return null;
  } catch (_e) {
    return null;
  }
};

const resolveAllowedFrontendOrigin = (candidate) => resolveAllowedOrigin(candidate, KNOWN_FRONTEND_HOSTS);

const resolveAllowedBackendOrigin = (candidate) => resolveAllowedOrigin(candidate, KNOWN_BACKEND_HOSTS);

const getTargetBackendForOrigin = (frontendOrigin) => {
  if (!frontendOrigin || typeof frontendOrigin !== 'string') return null;
  const lower = frontendOrigin.toLowerCase();
  if (
    lower.includes('docketra-cug')
    || lower.includes('cug.docketra.in')
    || lower.includes('docketshq-cug')
    || lower.includes('cug.docketshq.com')
  ) {
    return 'https://docketra-api-cug-1078507569854.us-central1.run.app';
  }
  return null;
};

const getBackendOriginFromReq = (req) => {
  if (!req) return null;
  const host = String(req.get ? req.get('host') : req.headers?.host || '').trim();
  const proto = String(req.protocol || (req.headers && req.headers['x-forwarded-proto']) || 'https').trim().split(',')[0];
  if (host) {
    const candidate = `${proto}://${host}`;
    const resolved = resolveAllowedBackendOrigin(candidate);
    if (resolved) return resolved;
  }
  return resolveAllowedBackendOrigin(process.env.API_PUBLIC_ORIGIN);
};

module.exports = {
  getGoogleAuthRedirectUri,
  getGoogleOAuthClient,
  signGoogleState,
  parseGoogleState,
  peekGoogleStateRouting,
  resolveAllowedFrontendOrigin,
  resolveAllowedBackendOrigin,
  getTargetBackendForOrigin,
  getBackendOriginFromReq,
  KNOWN_FRONTEND_HOSTS,
  KNOWN_BACKEND_HOSTS,
};
