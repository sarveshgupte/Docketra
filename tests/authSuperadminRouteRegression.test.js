#!/usr/bin/env node
const assert = require('assert');
const request = require('supertest');

const bcryptPath = require.resolve('bcrypt');
require.cache[bcryptPath] = {
  id: bcryptPath,
  filename: bcryptPath,
  loaded: true,
  exports: { compare: async () => true, hash: async (value) => value },
};

process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';

const tenantResolverModulePath = require.resolve('../src/middleware/tenantResolver');
const authMiddlewareModulePath = require.resolve('../src/middleware/auth.middleware');
const firmRoutesModulePath = require.resolve('../src/routes/firm.routes');
const createAppModulePath = require.resolve('../src/app/createApp');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

(async () => {
  let tenantResolverCalls = 0;

  swap(tenantResolverModulePath, (req, _res, next) => {
    tenantResolverCalls += 1;
    req.firmId = '507f1f77bcf86cd799439022';
    req.firmIdString = 'FIRM001';
    req.firmSlug = req.params.firmSlug;
    req.firmName = 'Acme';
    req.firm = { status: 'active', firmSlug: req.params.firmSlug };
    next();
  });


  let firmRouterHits = 0;
  const mockedFirmRouter = (req, res, next) => {
    firmRouterHits += 1;
    if (req.path === '/login' && req.method === 'GET') {
      return res.status(200).json({ success: true, data: { firmSlug: req.params.firmSlug } });
    }
    return next();
  };

  swap(firmRoutesModulePath, mockedFirmRouter);

  swap(authMiddlewareModulePath, {
    authenticate: (req, _res, next) => {
      req.user = { role: 'SUPERADMIN', xID: 'SATEST' };
      next();
    },
  });

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  const loginRes = await request(app).post('/api/superadmin/login').send({ xID: 'bad', password: 'bad' });
  assert.notStrictEqual(loginRes.status, 404, 'POST /api/superadmin/login must exist and not 404');

  const profileRes = await request(app).get('/api/auth/profile');
  assert.notStrictEqual(profileRes.status, 404, 'GET /api/auth/profile must exist and not 404');
  assert([200, 401, 403].includes(profileRes.status), 'profile route should return auth status, not routing failure');

  const beforeSuperadmin = tenantResolverCalls;
  const beforeSuperadminFirmRouterHits = firmRouterHits;
  await request(app).get('/api/superadmin/firms');
  assert.strictEqual(tenantResolverCalls, beforeSuperadmin, '/api/superadmin/* must not hit tenantResolver');
  assert.strictEqual(firmRouterHits, beforeSuperadminFirmRouterHits, '/api/superadmin/* must not hit firmRoutes');

  const beforeAuth = tenantResolverCalls;
  const beforeAuthFirmRouterHits = firmRouterHits;
  await request(app).get('/api/auth/profile');
  assert.strictEqual(tenantResolverCalls, beforeAuth, '/api/auth/* must not hit tenantResolver');
  assert.strictEqual(firmRouterHits, beforeAuthFirmRouterHits, '/api/auth/* must not hit firmRoutes');

  const beforeSuperadminLoginFirmRouterHits = firmRouterHits;
  await request(app).post('/api/superadmin/login').send({ xID: 'bad', password: 'bad' });
  assert.strictEqual(firmRouterHits, beforeSuperadminLoginFirmRouterHits, '/api/superadmin/login must not hit firmRoutes');

  console.log('authSuperadminRouteRegression.test.js passed');
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
