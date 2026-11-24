process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-64-characters-long-for-testing-purposes-1234567890';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$abcdefghijklmnopqrstuv';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'SUPERADMIN';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'admin@example.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';

const assert = require('assert');
const {
  resolveAllowedFrontendOrigin,
  resolveAllowedBackendOrigin,
  getTargetBackendForOrigin,
  getBackendOriginFromReq,
  signGoogleState,
  parseGoogleState,
  KNOWN_FRONTEND_HOSTS,
  KNOWN_BACKEND_HOSTS,
} = require('../src/services/authGoogle.service');

// 1. Verify Allowed Frontend Origins
assert.strictEqual(
  resolveAllowedFrontendOrigin('https://docketra-cug.web.app/some/page'),
  'https://docketra-cug.web.app',
  'CUG web.app origin should be resolved and normalized'
);
assert.strictEqual(
  resolveAllowedFrontendOrigin('https://docketra-cug.firebaseapp.com'),
  'https://docketra-cug.firebaseapp.com',
  'CUG firebaseapp origin should be allowed'
);
assert.strictEqual(
  resolveAllowedFrontendOrigin('https://cug.docketra.in/login'),
  'https://cug.docketra.in',
  'CUG custom domain should be allowed'
);
assert.strictEqual(
  resolveAllowedFrontendOrigin('https://docketra.in/login'),
  'https://docketra.in',
  'Main production origin should be allowed'
);
assert.strictEqual(
  resolveAllowedFrontendOrigin('https://www.docketra.in'),
  'https://www.docketra.in',
  'www.docketra.in origin should be allowed'
);

// 2. Security: Open Redirect Prevention
assert.strictEqual(
  resolveAllowedFrontendOrigin('https://evil-phishing-site.com/fake-docketra'),
  null,
  'External arbitrary origins must be rejected'
);
assert.strictEqual(
  resolveAllowedFrontendOrigin('javascript:alert(1)'),
  null,
  'Javascript URI must be rejected'
);
assert.strictEqual(
  resolveAllowedFrontendOrigin('http://docketra.in'),
  null,
  'Insecure HTTP for production host must be rejected'
);
assert.strictEqual(
  resolveAllowedFrontendOrigin(null),
  null,
  'Null input should return null'
);
assert.strictEqual(
  resolveAllowedFrontendOrigin('not a valid url'),
  null,
  'Malformed url should return null'
);

// 3. Verify Allowed Backend Origins
assert.strictEqual(
  resolveAllowedBackendOrigin('https://docketra-api-cug-1078507569854.us-central1.run.app/api/auth/google/callback'),
  'https://docketra-api-cug-1078507569854.us-central1.run.app',
  'CUG Cloud Run backend origin should be allowed'
);
assert.strictEqual(
  resolveAllowedBackendOrigin('https://api.docketra.in/api/auth/google/callback'),
  'https://api.docketra.in',
  'Production API backend origin should be allowed'
);
assert.strictEqual(
  resolveAllowedBackendOrigin('https://malicious-backend.example.com'),
  null,
  'Unknown backend origins must be rejected'
);

// 4. Target Backend mapping for CUG
assert.strictEqual(
  getTargetBackendForOrigin('https://docketra-cug.web.app'),
  'https://docketra-api-cug-1078507569854.us-central1.run.app',
  'CUG frontend origin should map to CUG Cloud Run backend'
);
assert.strictEqual(
  getTargetBackendForOrigin('https://cug.docketra.in'),
  'https://docketra-api-cug-1078507569854.us-central1.run.app',
  'cug.docketra.in should map to CUG Cloud Run backend'
);
assert.strictEqual(
  getTargetBackendForOrigin('https://docketra.in'),
  null,
  'Production origin should not map to CUG backend'
);

// 5. Backend Origin from Request
const mockCugReq = {
  protocol: 'https',
  get: (h) => (h === 'host' ? 'docketra-api-cug-1078507569854.us-central1.run.app' : null),
  headers: { host: 'docketra-api-cug-1078507569854.us-central1.run.app' },
};
assert.strictEqual(
  getBackendOriginFromReq(mockCugReq),
  'https://docketra-api-cug-1078507569854.us-central1.run.app',
  'getBackendOriginFromReq should extract valid backend origin from req'
);

const mockProdReq = {
  protocol: 'https',
  get: (h) => (h === 'host' ? 'api.docketra.in' : null),
  headers: { host: 'api.docketra.in' },
};
assert.strictEqual(
  getBackendOriginFromReq(mockProdReq),
  'https://api.docketra.in',
  'getBackendOriginFromReq should extract production backend origin'
);

// 6. State Signing & Verification with returnOrigin and targetBackendUrl
const payload = {
  nonce: '12345',
  intent: 'login',
  firmSlug: 'gupte-opc',
  returnOrigin: 'https://docketra-cug.web.app',
  targetBackendUrl: 'https://docketra-api-cug-1078507569854.us-central1.run.app',
  issuedAt: Date.now(),
};

const signed = signGoogleState(payload);
assert.ok(typeof signed === 'string' && signed.includes('.'), 'State must be signed with signature');

const parsed = parseGoogleState(signed);
assert.strictEqual(parsed.firmSlug, 'gupte-opc');
assert.strictEqual(parsed.returnOrigin, 'https://docketra-cug.web.app');
assert.strictEqual(parsed.targetBackendUrl, 'https://docketra-api-cug-1078507569854.us-central1.run.app');

// Tampered state fails verification
const tampered = signed.slice(0, -4) + 'abcd';
assert.strictEqual(parseGoogleState(tampered), null, 'Tampered state must return null');

// 7. Test startGoogleAuth and googleAuthCallback delegation end-to-end
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret';
process.env.GOOGLE_AUTH_REDIRECT_URI = process.env.GOOGLE_AUTH_REDIRECT_URI || 'https://api.docketra.in/api/auth/google/callback';

const { startGoogleAuth, googleAuthCallback } = require('../src/controllers/auth.controller');

(async () => {
  // Test startGoogleAuth from CUG
  let redirectedAuthUrl = null;
  const cugStartReq = {
    query: {
      intent: 'login',
      firmSlug: 'gupte-opc',
      returnTo: 'https://docketra-cug.web.app/gupte-opc/login',
    },
    protocol: 'https',
    get: (h) => (h === 'host' ? 'docketra-api-cug-1078507569854.us-central1.run.app' : null),
    headers: { host: 'docketra-api-cug-1078507569854.us-central1.run.app' },
  };
  const cugStartRes = {
    redirect: (url) => { redirectedAuthUrl = url; },
    status: (s) => ({ json: (d) => { throw new Error(`Status ${s}: ${JSON.stringify(d)}`); } }),
  };

  await startGoogleAuth(cugStartReq, cugStartRes);
  assert.ok(redirectedAuthUrl, 'startGoogleAuth must redirect to Google authorization URL');

  const authUrlObj = new URL(redirectedAuthUrl);
  const rawState = authUrlObj.searchParams.get('state');
  assert.ok(rawState, 'Auth URL must have state query parameter');

  const parsedState = parseGoogleState(rawState);
  assert.strictEqual(parsedState.returnOrigin, 'https://docketra-cug.web.app');
  assert.strictEqual(parsedState.targetBackendUrl, 'https://docketra-api-cug-1078507569854.us-central1.run.app');
  assert.strictEqual(parsedState.firmSlug, 'gupte-opc');

  // Test callback delegation: when Google sends callback to api.docketra.in with CUG state,
  // api.docketra.in must forward/delegate the callback to docketra-api-cug
  let delegatedCallbackUrl = null;
  const prodCallbackReq = {
    query: {
      code: 'mock-auth-code-12345',
      state: rawState,
    },
    protocol: 'https',
    get: (h) => (h === 'host' ? 'api.docketra.in' : null),
    headers: { host: 'api.docketra.in' },
  };
  const prodCallbackRes = {
    redirect: (url) => { delegatedCallbackUrl = url; },
  };

  await googleAuthCallback(prodCallbackReq, prodCallbackRes);
  assert.ok(delegatedCallbackUrl, 'googleAuthCallback on prod must redirect to target backend');

  const delegatedUrlObj = new URL(delegatedCallbackUrl);
  assert.strictEqual(delegatedUrlObj.origin, 'https://docketra-api-cug-1078507569854.us-central1.run.app');
  assert.strictEqual(delegatedUrlObj.pathname, '/api/auth/google/callback');
  assert.strictEqual(delegatedUrlObj.searchParams.get('code'), 'mock-auth-code-12345');
  assert.strictEqual(delegatedUrlObj.searchParams.get('state'), rawState);

  // eslint-disable-next-line no-console
  console.log('authGoogleRedirect tests passed successfully');
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
