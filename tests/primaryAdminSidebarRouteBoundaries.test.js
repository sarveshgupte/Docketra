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
const bcryptModulePath = require.resolve('bcrypt');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

(async () => {
  let tenantResolverCalls = 0;
  swap(bcryptModulePath, { hash: async () => 'mock-hash', compare: async () => true, genSalt: async () => 'mock-salt' });

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

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  const globalTenantApiPaths = [
    '/api/clients?activeOnly=false&page=1&limit=25',
    '/api/reports/case-metrics',
    '/api/storage/configuration',
    '/api/ai/configuration',
  ];

  for (const apiPath of globalTenantApiPaths) {
    const before = tenantResolverCalls;
    const res = await request(app).get(apiPath);
    assert.notStrictEqual(res.status, 404, `${apiPath} must not be route-level 404`);
    assert.strictEqual(tenantResolverCalls, before, `${apiPath} must not be captured by /api/:firmSlug`);
  }

  const firmLogin = await request(app).get('/api/acme/login');
  assert.strictEqual(firmLogin.status, 200, 'GET /api/acme/login should reach firm login behavior');
  assert.ok(tenantResolverCalls > 0, 'tenantResolver should run for valid firm slug login route');

  const beforeInvalid = tenantResolverCalls;
  const invalidFirmLogin = await request(app).get('/api/acme!!!/login');
  assert.notStrictEqual(invalidFirmLogin.status, 200, 'invalid firm slug must not be treated as valid');
  assert.strictEqual(tenantResolverCalls, beforeInvalid, 'invalid firm slug must not hit tenantResolver');

  console.log('primaryAdminSidebarRouteBoundaries.test.js passed');
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
