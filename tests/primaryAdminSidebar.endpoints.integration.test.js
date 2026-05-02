const assert = require('assert');
process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'*80;
process.env.STORAGE_TOKEN_SECRET = process.env.STORAGE_TOKEN_SECRET || 'y'*80;
process.env.METRICS_TOKEN = process.env.METRICS_TOKEN || 'z'*80;

const Module = require('module');
const request = require('supertest');

const originalLoad = Module._load;
const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

const TEST_USER = Object.freeze({
  _id: '507f1f77bcf86cd799439012',
  id: '507f1f77bcf86cd799439012',
  xID: 'X000001',
  email: 'primary.admin@example.com',
  role: 'PRIMARY_ADMIN',
  firmId: '507f1f77bcf86cd799439011',
  defaultClientId: 'C000001',
});

Module._load = function(requestPath, parent, isMain) {
  if (requestPath === 'bcrypt') {
    return { hash: async () => 'hashed', compare: async () => true, genSalt: async () => 'salt' };
  }
  if (requestPath.includes('middleware/auth.middleware')) {
    return {
      authenticate: (req, _res, next) => {
        req.user = { ...TEST_USER };
        req.jwt = { userId: TEST_USER._id, role: TEST_USER.role, firmId: TEST_USER.firmId, defaultClientId: TEST_USER.defaultClientId, firmSlug: 'acme' };
        req.firmId = TEST_USER.firmId;
        req.userId = TEST_USER._id;
        req._authResolved = true;
        return next();
      },
    };
  }
  if (requestPath.includes('middleware/firmContext.middleware')) {
    return {
      firmContext: (req, _res, next) => {
        req.firmId = req.firmId || TEST_USER.firmId;
        req.ownershipFirmId = req.ownershipFirmId || TEST_USER.firmId;
        req.firm = req.firm || { _id: TEST_USER.firmId, ownershipFirmId: TEST_USER.firmId, status: 'ACTIVE' };
        return next();
      },
      attachFirmContext: (req, _res, next) => {
        req.firmId = req.firmId || TEST_USER.firmId;
        req.ownershipFirmId = req.ownershipFirmId || TEST_USER.firmId;
        req.firm = req.firm || { _id: TEST_USER.firmId, ownershipFirmId: TEST_USER.firmId, status: 'ACTIVE' };
        return next();
      },
    };
  }
  if (requestPath.includes('routes/routeGroups')) {
    const pass = [(_req, _res, next) => next()];
    return { tenantScopedApiAccess: pass, adminTenantScopedApiAccess: pass, adminBaseAccess: pass };
  }
  if (requestPath.includes('middleware/requireTenant')) {
    return (_req, _res, next) => next();
  }
  if (requestPath.includes('middleware/invariantGuard')) {
    return () => (_req, _res, next) => next();
  }
  return originalLoad(requestPath, parent, isMain);
};

['../src/app/createApp'].forEach(clear);
const { createApp } = require('../src/app/createApp');

async function run() {
  const app = createApp();

  const endpoints = [
    '/api/leads?limit=100',
    '/api/forms',
    '/api/clients?activeOnly=false&page=1&limit=25',
    '/api/reports/case-metrics',
    '/api/storage/configuration',
    '/api/ai/configuration',
  ];

  const results = [];
  for (const url of endpoints) {
    const res = await request(app).get(url).set('Cookie', 'accessToken=test-token');
    results.push({
      endpoint: url,
      status: res.status,
      body: res.body,
    });
  }

  const authFailures = results.filter((r) => r.status === 401 || r.body?.message === 'Authentication required. Please provide a valid token.');
  assert.strictEqual(authFailures.length, 0, `Harness auth failed for endpoints: ${JSON.stringify(authFailures, null, 2)}`);

  const routeMissing = results.filter((r) => r.status === 404);

  // eslint-disable-next-line no-console
  console.log('PRIMARY_ADMIN_ENDPOINT_DISCOVERY', JSON.stringify(results, null, 2));

  if (routeMissing.length > 0) {
    throw new Error(`Route-level 404 detected: ${JSON.stringify(routeMissing, null, 2)}`);
  }

  // Allow non-200 here for discovery in this PR phase, but surface details loudly.
  const non200 = results.filter((r) => r.status !== 200);
  if (non200.length > 0) {
    // eslint-disable-next-line no-console
    console.log('PRIMARY_ADMIN_ENDPOINT_NON_200', JSON.stringify(non200, null, 2));
  }

  console.log('primaryAdminSidebar.endpoints.integration.test.js completed');
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    Module._load = originalLoad;
  });
