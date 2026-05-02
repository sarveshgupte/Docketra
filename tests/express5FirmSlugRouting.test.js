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

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  assert.doesNotThrow(() => createApp(), 'createApp should not throw with Express 5 route parsing');
  const app = createApp();


  const apiRoot = await request(app).get('/api');
  assert.strictEqual(apiRoot.status, 200);

  const apiHealth = await request(app).get('/api/health');
  assert.strictEqual(apiHealth.status, 200);

  const authLogin = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'x' });
  assert.notStrictEqual(authLogin.status, 404, 'auth login route should stay on auth namespace');

  const beforePublicNamespace = tenantResolverCalls;
  await request(app).get('/api/public');
  assert.strictEqual(tenantResolverCalls, beforePublicNamespace, 'public namespace must not hit tenantResolver');

  const beforePublicPost = tenantResolverCalls;
  await request(app).post('/api/public/cms/acme/intake').send({});
  assert.strictEqual(tenantResolverCalls, beforePublicPost, 'public POST namespace must not hit tenantResolver');

  const saLogin = await request(app).post('/api/superadmin/login').send({ email: 'sa@x.com', password: 'y' });
  assert.notStrictEqual(saLogin.status, 404, 'superadmin login route should remain mounted');
  const firmLogin = await request(app).get('/api/acme/login');
  assert.strictEqual(firmLogin.status, 200);
  assert.ok(tenantResolverCalls > 0, 'tenantResolver should run for valid firm slug');

  const beforeReserved = tenantResolverCalls;
  await request(app).get('/api/auth');
  assert.strictEqual(tenantResolverCalls, beforeReserved, '/api/auth must not hit tenantResolver in firm routes');

  const beforePublic = tenantResolverCalls;
  await request(app).get('/api/public');
  assert.strictEqual(tenantResolverCalls, beforePublic, '/api/public must not hit tenantResolver in firm routes');

  const beforeSuperadmin = tenantResolverCalls;
  await request(app).get('/api/superadmin');
  assert.strictEqual(tenantResolverCalls, beforeSuperadmin, '/api/superadmin must not hit tenantResolver in firm routes');


  const beforeAdmin = tenantResolverCalls;
  await request(app).get('/api/admin');
  assert.strictEqual(tenantResolverCalls, beforeAdmin, '/api/admin must not hit tenantResolver in firm routes');

  const beforeUsers = tenantResolverCalls;
  await request(app).get('/api/users');
  assert.strictEqual(tenantResolverCalls, beforeUsers, '/api/users must not hit tenantResolver in firm routes');

  const beforeReservedSlug = tenantResolverCalls;
  await request(app).get('/api/auth/login');
  assert.strictEqual(tenantResolverCalls, beforeReservedSlug, 'reserved firm slugs must not reach tenantResolver');

  const beforeInvalid = tenantResolverCalls;
  await request(app).get('/api/acme!!!/login');
  assert.strictEqual(tenantResolverCalls, beforeInvalid, 'invalid firm slug must not reach tenantResolver');

  console.log('express5FirmSlugRouting.test.js passed');
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
