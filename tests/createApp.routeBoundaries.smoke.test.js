#!/usr/bin/env node
const assert = require('assert');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';

const tenantResolverModulePath = require.resolve('../src/middleware/tenantResolver');
const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
const createAppModulePath = require.resolve('../src/app/createApp');
const firmControllerModulePath = require.resolve('../src/controllers/firm.controller');
const bcryptModulePath = require.resolve('bcrypt');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

(async () => {
  let tenantResolverCalls = 0;
  swap(bcryptModulePath, {
    hash: async () => 'mock-hash',
    compare: async () => true,
    genSalt: async () => 'mock-salt',
  });

  swap(tenantResolverModulePath, (req, _res, next) => {
    tenantResolverCalls += 1;
    req.firmId = '507f1f77bcf86cd799439022';
    req.firmIdString = 'FIRM001';
    req.firmSlug = req.params.firmSlug;
    req.firmName = 'Acme';
    req.firm = { status: 'active', firmSlug: req.params.firmSlug };
    next();
  });

  const noOpHandler = (_req, res) => res.status(501).json({ success: false, message: 'mocked' });
  swap(authControllerModulePath, new Proxy({}, { get: () => noOpHandler }));
  swap(firmControllerModulePath, { getFirmSetupStatus: noOpHandler });

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');

  assert.doesNotThrow(() => createApp(), 'createApp should not throw');
  const app = createApp();

  const health = await request(app).get('/health');
  assert.strictEqual(health.status, 200, 'GET /health should return 200');

  const apiHealth = await request(app).get('/api/health');
  assert.strictEqual(apiHealth.status, 200, 'GET /api/health should return health response');

  const apiIndex = await request(app).get('/api');
  assert.strictEqual(apiIndex.status, 200, 'GET /api should return API index');
  assert.strictEqual(apiIndex.body?.success, true, 'GET /api should return success payload');

  const firmLogin = await request(app).get('/api/acme/login');
  assert.strictEqual(firmLogin.status, 200, 'GET /api/acme/login should reach firm route');
  assert.ok(tenantResolverCalls > 0, 'tenantResolver should run for valid firm slug');


  const beforeSetup = tenantResolverCalls;
  const setupStatus = await request(app).get('/api/acme/setup-status');
  assert.ok([200, 401, 403].includes(setupStatus.status), 'GET /api/acme/setup-status should resolve via firm route chain');
  if (setupStatus.status !== 401) {
    assert.strictEqual(tenantResolverCalls, beforeSetup + 1, 'GET /api/acme/setup-status should execute tenantResolver when firm route resolves');
  }

  const beforeInvalid = tenantResolverCalls;
  await request(app).get('/api/acme!!!/login');
  assert.strictEqual(tenantResolverCalls, beforeInvalid, 'invalid firm slug must not reach tenantResolver');

  const reservedPaths = ['/api/auth', '/api/public', '/api/superadmin', '/api/admin', '/api/users'];
  for (const reservedPath of reservedPaths) {
    const before = tenantResolverCalls;
    await request(app).get(reservedPath);
    assert.strictEqual(tenantResolverCalls, before, `${reservedPath} must not reach firmRoutes/tenantResolver`);
  }


  const beforeStorageConfig = tenantResolverCalls;
  const storageConfig = await request(app).get('/api/storage/configuration');
  assert.notStrictEqual(storageConfig.status, 404, 'GET /api/storage/configuration should not be plain 404');
  assert.ok([200, 401, 403].includes(storageConfig.status), 'GET /api/storage/configuration should be protected by storage auth/tenant middleware');
  assert.strictEqual(tenantResolverCalls, beforeStorageConfig, 'GET /api/storage/configuration must not be swallowed by firm-slug routing');

  const beforeStorageStatus = tenantResolverCalls;
  const storageStatus = await request(app).get('/api/storage/status');
  assert.notStrictEqual(storageStatus.status, 404, 'GET /api/storage/status should not be plain 404');
  assert.ok([200, 401, 403].includes(storageStatus.status), 'GET /api/storage/status should be protected by storage auth/tenant middleware');
  assert.strictEqual(tenantResolverCalls, beforeStorageStatus, 'GET /api/storage/status must not be swallowed by firm-slug routing');

  const beforeDockets = tenantResolverCalls;
  const dockets = await request(app).get('/api/dockets');
  assert.ok([401, 403, 404].includes(dockets.status), 'GET /api/dockets should remain protected tenant API');
  assert.strictEqual(tenantResolverCalls, beforeDockets, 'GET /api/dockets must not be swallowed by firm-slug routing');

  console.log('createApp.routeBoundaries.smoke.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  for (const { modulePath, original } of restore) {
    delete require.cache[modulePath];
    if (original) require.cache[modulePath] = original;
  }
  delete require.cache[createAppModulePath];
});
