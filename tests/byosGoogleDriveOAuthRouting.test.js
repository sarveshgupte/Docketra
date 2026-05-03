#!/usr/bin/env node
/**
 * Tests for the BYOS Google Drive OAuth routing fix.
 *
 * Covers:
 *  1. googleConnect: state token now includes firmSlug; redirects to Google OAuth
 *  2. googleCallback success: redirects to /app/firm/:firmSlug/storage-settings?connected=1
 *  3. googleCallback – invalid/missing state: redirects to firm error page, never to /api/login
 *  4. googleCallback – user denied (oauthError param): safe redirect
 *  5. googleCallback – no refresh token: safe redirect
 *  6. googleCallback – tenant mismatch: safe redirect
 *  7. googleCallback – missing code/state: safe redirect to FRONTEND_URL root
 *  8. GET /api/storage/configuration route reachability: route is defined in storage.routes.js
 *  9. GET /api/storage/google/connect route is defined and requires Primary Admin
 * 10. Callback route does NOT have requirePrimaryAdmin middleware-level rejection
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');

process.env.JWT_SECRET = 'byos-test-jwt-secret-for-routing-tests-64';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:5000/api/storage/google/callback';
process.env.STORAGE_TOKEN_SECRET = 'test-storage-token-secret-32chars!!';
process.env.FRONTEND_URL = 'https://app.docketra.test';
process.env.NODE_ENV = 'test';

// ──────────────────────────────────────────────────────────────────
// Stubs
// ──────────────────────────────────────────────────────────────────
const Module = require('module');
const originalLoad = Module._load;

let savedFirmId = null;
const mockOAuthClient = {
  generateAuthUrl: (opts) => `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(opts.state || '')}`,
  getToken: async () => ({ tokens: { access_token: 'acc', refresh_token: 'rt' } }),
  setCredentials: () => {},
};

Module._load = function (request, parent, isMain) {
  if (request === 'googleapis') {
    return {
      google: {
        auth: { OAuth2: function () { return mockOAuthClient; } },
        drive: () => ({ files: { create: async () => ({ data: { id: 'f-1' } }) } }),
      },
    };
  }
  if (request === 'mongoose') {
    const mock = {
      Schema: class {
        constructor() {}
        index() { return this; }
        pre() { return this; }
        virtual() { return { get() {} }; }
      },
      model: () => ({}),
      Types: { ObjectId: class { static isValid() { return true; } } },
    };
    mock.Schema.Types = { ObjectId: class {} };
    return mock;
  }
  if (request === '../models/Firm.model') {
    return {
      findById: () => ({ select: () => ({ lean: async () => ({ name: 'Test Firm', storageConfig: null, storage: {} }) }) }),
      findByIdAndUpdate: async () => ({}),
    };
  }
  if (request === '../models/TenantStorageConfig.model') {
    return { findOne: async () => null, findOneAndUpdate: async () => ({}), findByIdAndUpdate: async () => ({}), updateMany: async () => ({}) };
  }
  if (request === '../services/storageBackup.service') {
    return { storageBackupService: { listBackups: async () => [] } };
  }
  if (request === '../services/googleDrive.service') {
    return {
      googleDriveService: {
        getOAuthClient: () => mockOAuthClient,
        saveUserDriveConnection: async ({ firmId }) => { savedFirmId = firmId; return { rootFolderId: 'root-1' }; },
        getClient: async () => { throw new Error('no client'); },
        markStorageDisconnected: async () => {},
        markStorageError: async () => {},
      },
      PROVIDER_TYPES: { USER_GOOGLE_DRIVE: 'google_drive' },
    };
  }
  if (request === '../services/storage/providers/GoogleDriveProvider' || request === '../services/storage/providers/OneDriveProvider') {
    return class { async createFolder() { return 'f-1'; } };
  }
  if (request === '../services/storage/errors/StorageErrors') {
    return { StorageValidationError: class extends Error {} };
  }
  if (request === '../services/storage/StorageProviderFactory') {
    return { StorageProviderFactory: { getProvider: async () => ({ testConnection: async () => ({}) }) } };
  }
  if (request === '../services/tenantIdentity.service') {
    return {
      resolveStorageContextFromTenantId: async () => ({ ownershipFirmId: 'owner-firm-1' }),
      resolveCanonicalTenantForUser: async () => null,
    };
  }
  if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => {} };
  if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: {}, logPilotEvent: () => {} };
  if (request === 'bullmq') {
    return { Queue: class { constructor() {} add() { return Promise.resolve(); } }, Worker: class { constructor() {} on() {} } };
  }
  return originalLoad.apply(this, arguments);
};

const ctl = require('../src/controllers/storage.controller');
const { buildStateCookie, googleConnect, googleCallback } = ctl;

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────
function makeMockRes() {
  const res = {
    redirectedTo: null, statusCode: null, body: null, headers: {},
    redirect(url) { this.redirectedTo = url; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
  };
  return res;
}

function buildStateToken(tenantId, firmSlug) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = Buffer.from(JSON.stringify({ tenantId, firmSlug: firmSlug || null, provider: 'google_drive', nonce })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

// ──────────────────────────────────────────────────────────────────
// Test 1: googleConnect includes firmSlug in state token
// ──────────────────────────────────────────────────────────────────
async function testGoogleConnectIncludesFirmSlug() {
  const req = { firmId: 'tenant-1', firmSlug: 'gupte-opc', user: { role: 'PRIMARY_ADMIN' } };
  const res = makeMockRes();
  googleConnect(req, res);

  assert(res.redirectedTo, 'Should redirect to Google OAuth');
  assert(res.redirectedTo.startsWith('https://accounts.google.com/'), 'Should redirect to Google');

  // Extract state from redirect URL
  const url = new URL(res.redirectedTo);
  const stateEncoded = url.searchParams.get('state');
  assert(stateEncoded, 'State param must be present in redirect URL');

  // The cookie should be set
  assert(res.headers['Set-Cookie'], 'State cookie must be set');

  // Decode the state to verify firmSlug is included
  const token = decodeURIComponent(stateEncoded);
  const dotIdx = token.lastIndexOf('.');
  const payloadB64 = token.slice(0, dotIdx);
  const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  assert.strictEqual(decoded.tenantId, 'tenant-1', 'State must include tenantId');
  assert.strictEqual(decoded.firmSlug, 'gupte-opc', 'State must include firmSlug');
  assert.strictEqual(decoded.provider, 'google_drive', 'State must include provider');
  assert(typeof decoded.nonce === 'string' && decoded.nonce.length === 32, 'State must include 32-char nonce');

  console.log('  ✓ googleConnect includes firmSlug in state token');
}

// ──────────────────────────────────────────────────────────────────
// Test 2: googleCallback success → redirects to firm storage settings
// ──────────────────────────────────────────────────────────────────
async function testGoogleCallbackSuccessRedirectsToFirmPage() {
  savedFirmId = null;
  const token = buildStateToken('tenant-1', 'gupte-opc');
  const req = {
    firmId: 'tenant-1',
    firmSlug: 'gupte-opc',
    user: { role: 'PRIMARY_ADMIN' },
    query: { code: 'test-code', state: token },
    cookies: { storage_oauth_state: token },
    headers: { cookie: `storage_oauth_state=${token}` },
  };
  const res = makeMockRes();
  await googleCallback(req, res);

  assert(res.redirectedTo, 'Should redirect on success');
  assert(
    res.redirectedTo.includes('/app/firm/gupte-opc/storage-settings'),
    `Expected firm-aware success redirect, got: ${res.redirectedTo}`,
  );
  assert(res.redirectedTo.includes('connected=1'), `Expected connected=1, got: ${res.redirectedTo}`);
  assert(!res.redirectedTo.includes('/api/login'), 'Must NOT redirect to /api/login');
  assert(!res.redirectedTo.includes('/storage/success'), 'Must NOT use legacy /storage/success path');

  console.log('  ✓ googleCallback success redirects to /app/firm/:firmSlug/storage-settings?connected=1');
}

// ──────────────────────────────────────────────────────────────────
// Test 3: googleCallback invalid state → firm error page, not /api/login
// ──────────────────────────────────────────────────────────────────
async function testGoogleCallbackInvalidStateRedirectsSafely() {
  const token = buildStateToken('tenant-1', 'gupte-opc');
  const wrongToken = buildStateToken('other-tenant', 'other-firm');

  const req = {
    firmId: 'tenant-1',
    user: { role: 'PRIMARY_ADMIN' },
    query: { code: 'c', state: token },
    cookies: { storage_oauth_state: wrongToken }, // cookie ≠ state param
    headers: { cookie: `storage_oauth_state=${wrongToken}` },
  };
  const res = makeMockRes();
  await googleCallback(req, res);

  assert(res.redirectedTo, 'Should redirect');
  assert(!res.redirectedTo.includes('/api/login'), 'Must NOT redirect to /api/login');
  assert(res.redirectedTo.includes('storageError=invalid_state'), `Expected invalid_state error, got: ${res.redirectedTo}`);

  console.log('  ✓ googleCallback invalid state redirects safely (never to /api/login)');
}

// ──────────────────────────────────────────────────────────────────
// Test 4: googleCallback user denied (oauthError param)
// ──────────────────────────────────────────────────────────────────
async function testGoogleCallbackOAuthDenied() {
  const token = buildStateToken('tenant-1', 'gupte-opc');
  const req = {
    firmId: 'tenant-1',
    user: { role: 'PRIMARY_ADMIN' },
    query: { error: 'access_denied', state: token },
    cookies: { storage_oauth_state: token },
    headers: { cookie: `storage_oauth_state=${token}` },
  };
  const res = makeMockRes();
  await googleCallback(req, res);

  assert(res.redirectedTo, 'Should redirect');
  assert(!res.redirectedTo.includes('/api/login'), 'Must NOT redirect to /api/login');
  assert(res.redirectedTo.includes('storageError=oauth_denied'), `Expected oauth_denied, got: ${res.redirectedTo}`);
  assert(res.redirectedTo.includes('/app/firm/gupte-opc/'), `Expected firm-aware redirect, got: ${res.redirectedTo}`);

  console.log('  ✓ googleCallback oauth_denied redirects to firm error page');
}

// ──────────────────────────────────────────────────────────────────
// Test 5: googleCallback missing code and state
// ──────────────────────────────────────────────────────────────────
async function testGoogleCallbackMissingParams() {
  const req = {
    firmId: 'tenant-1',
    user: { role: 'PRIMARY_ADMIN' },
    query: {},
    cookies: {},
    headers: {},
  };
  const res = makeMockRes();
  await googleCallback(req, res);

  assert(res.redirectedTo, 'Should redirect');
  assert(!res.redirectedTo.includes('/api/login'), 'Must NOT redirect to /api/login');
  assert(res.redirectedTo.includes('storageError=missing_oauth_params'), `Expected missing_oauth_params, got: ${res.redirectedTo}`);

  console.log('  ✓ googleCallback missing params redirects safely');
}

// ──────────────────────────────────────────────────────────────────
// Test 6: googleCallback tenant mismatch
// ──────────────────────────────────────────────────────────────────
async function testGoogleCallbackTenantMismatch() {
  const token = buildStateToken('tenant-A', 'firm-a');
  const req = {
    firmId: 'tenant-B', // different from state tenantId
    user: { role: 'PRIMARY_ADMIN' },
    query: { code: 'c', state: token },
    cookies: { storage_oauth_state: token },
    headers: { cookie: `storage_oauth_state=${token}` },
  };
  const res = makeMockRes();
  await googleCallback(req, res);

  assert(res.redirectedTo, 'Should redirect');
  assert(!res.redirectedTo.includes('/api/login'), 'Must NOT redirect to /api/login');
  assert(res.redirectedTo.includes('storageError=tenant_mismatch'), `Expected tenant_mismatch, got: ${res.redirectedTo}`);

  console.log('  ✓ googleCallback tenant mismatch redirects safely');
}

// ──────────────────────────────────────────────────────────────────
// Test 7: googleCallback insufficient role → safe redirect
// ──────────────────────────────────────────────────────────────────
async function testGoogleCallbackInsufficientRole() {
  const token = buildStateToken('tenant-1', 'gupte-opc');
  const req = {
    firmId: 'tenant-1',
    user: { role: 'EMPLOYEE' },
    query: { code: 'c', state: token },
    cookies: { storage_oauth_state: token },
    headers: { cookie: `storage_oauth_state=${token}` },
  };
  const res = makeMockRes();
  await googleCallback(req, res);

  assert(res.redirectedTo, 'Should redirect');
  assert(!res.redirectedTo.includes('/api/login'), 'Must NOT redirect to /api/login');
  assert(res.redirectedTo.includes('storageError=insufficient_role'), `Expected insufficient_role error, got: ${res.redirectedTo}`);
  assert(res.redirectedTo.includes('/app/firm/gupte-opc/'), `Expected firm-aware redirect, got: ${res.redirectedTo}`);

  console.log('  ✓ googleCallback insufficient role redirects to firm error page (not /api/login)');
}

// ──────────────────────────────────────────────────────────────────
// Test 8: storage.routes.js defines GET /configuration
// ──────────────────────────────────────────────────────────────────
async function testConfigurationRouteIsDefinedInRouteFile() {
  // We parse the routes file to confirm GET /configuration is registered.
  const fs = require('fs');
  const path = require('path');
  const routeFileContent = fs.readFileSync(
    path.resolve(__dirname, '../src/routes/storage.routes.js'),
    'utf8',
  );
  assert(
    routeFileContent.includes("router.get('/configuration'"),
    "storage.routes.js must define GET /configuration",
  );
  console.log("  ✓ storage.routes.js defines GET /configuration");
}

// ──────────────────────────────────────────────────────────────────
// Test 9: GET /google/connect requires Primary Admin at route level
// ──────────────────────────────────────────────────────────────────
async function testConnectRouteRequiresPrimaryAdmin() {
  const fs = require('fs');
  const path = require('path');
  const routeFileContent = fs.readFileSync(
    path.resolve(__dirname, '../src/routes/storage.routes.js'),
    'utf8',
  );
  assert(
    routeFileContent.includes("router.get('/google/connect', oauthLimiter, requirePrimaryAdmin, googleConnect)"),
    "GET /google/connect must require Primary Admin at route level",
  );
  console.log("  ✓ GET /google/connect has requirePrimaryAdmin middleware");
}

// ──────────────────────────────────────────────────────────────────
// Test 10: GET /google/callback does NOT have requirePrimaryAdmin in route
// ──────────────────────────────────────────────────────────────────
async function testCallbackRouteHasNoRequirePrimaryAdminMiddleware() {
  const fs = require('fs');
  const path = require('path');
  const routeFileContent = fs.readFileSync(
    path.resolve(__dirname, '../src/routes/storage.routes.js'),
    'utf8',
  );
  // The callback line must NOT include requirePrimaryAdmin
  const callbackLine = routeFileContent
    .split('\n')
    .find((line) => line.includes("router.get('/google/callback'"));
  assert(callbackLine, "GET /google/callback route must be defined");
  assert(
    !callbackLine.includes('requirePrimaryAdmin'),
    `GET /google/callback must NOT have requirePrimaryAdmin middleware (would return JSON 403 on browser redirect). Line: ${callbackLine}`,
  );
  console.log("  ✓ GET /google/callback does not use requirePrimaryAdmin route middleware");
}

// ──────────────────────────────────────────────────────────────────
// Test 11: buildStateCookie flags
// ──────────────────────────────────────────────────────────────────
async function testBuildStateCookieFlags() {
  const setCookie = buildStateCookie('token123', 600);
  const clearCookie = buildStateCookie('', 0);

  assert(setCookie.includes('HttpOnly'), 'Set cookie should be HttpOnly');
  assert(setCookie.includes('SameSite=Lax'), 'Set cookie should have SameSite=Lax');
  assert(setCookie.includes('Path=/'), 'Set cookie should have Path=/');
  assert(clearCookie.includes('Max-Age=0'), 'Clear cookie should have Max-Age=0');
  assert(clearCookie.includes('HttpOnly'), 'Clear cookie should be HttpOnly');

  console.log('  ✓ buildStateCookie applies correct security flags');
}

// ──────────────────────────────────────────────────────────────────
// Runner
// ──────────────────────────────────────────────────────────────────
async function run() {
  console.log('Running byosGoogleDriveOAuthRouting tests...');
  try {
    await testGoogleConnectIncludesFirmSlug();
    await testGoogleCallbackSuccessRedirectsToFirmPage();
    await testGoogleCallbackInvalidStateRedirectsSafely();
    await testGoogleCallbackOAuthDenied();
    await testGoogleCallbackMissingParams();
    await testGoogleCallbackTenantMismatch();
    await testGoogleCallbackInsufficientRole();
    await testConfigurationRouteIsDefinedInRouteFile();
    await testConnectRouteRequiresPrimaryAdmin();
    await testCallbackRouteHasNoRequirePrimaryAdminMiddleware();
    await testBuildStateCookieFlags();
    console.log('All byosGoogleDriveOAuthRouting tests passed.');
  } catch (err) {
    console.error('byosGoogleDriveOAuthRouting tests failed:', err);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
